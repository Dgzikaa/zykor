-- 2026-06-23 — Auditoria de Preenchimento: (1) roda POR BAR (1 msg/dia cada) e
--              (2) para de logar o flapping de vencimento PENDING<->OVERDUE.
--
-- INVESTIGAÇÃO DO FLAPPING (23/06):
--   Os mesmos lançamentos NÃO-PAGOS pingavam status PENDING<->OVERDUE ~50x/dia, dia e
--   madrugada. Único escritor de `status` é o edge contaazul-sync (status: item.status).
--   contaazul-baixas e contaazul-conciliacao só tocam parcelas pagas e nem gravam status;
--   nenhuma função/trigger de banco recomputa status. Conclusão: o Conta Azul devolve
--   `status` inconsistente p/ a mesma parcela não-paga (o "vencido" é derivado e oscila do
--   lado deles) e o sync, a cada 6 min, regrava cego o que vier — o trigger logava cada flip
--   (bar 4 = 11.342 linhas de auditoria em 26h vs 1.497 do bar 3). Impacto no DRE/DFC/CMV: zero
--   (ninguém filtra PENDING vs OVERDUE). Dano real: inchaço da tabela de auditoria + ruído.
--   Fix: o trigger ignora a mudança quando o ÚNICO campo alterado é status entre PENDING/OVERDUE.
--   (status -> ACQUITTED/PARTIAL continua logado, pois é pagamento de verdade.)

-- (1) Trigger: não loga flapping de vencimento ------------------------------------------
CREATE OR REPLACE FUNCTION bronze.fn_log_contaazul_lancamento_change()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE m jsonb := '{}'::jsonb; v_evento text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO bronze.contaazul_lancamentos_historico(contaazul_id,bar_id,data_competencia,categoria_nome,evento,snapshot)
    VALUES (NEW.contaazul_id, NEW.bar_id, NEW.data_competencia, NEW.categoria_nome, 'INSERT',
      jsonb_build_object('categoria_nome',NEW.categoria_nome,'valor_bruto',NEW.valor_bruto,'valor_pago',NEW.valor_pago,
        'data_competencia',NEW.data_competencia,'data_pagamento',NEW.data_pagamento,'tipo',NEW.tipo,'status',NEW.status,'conciliado',NEW.conciliado));
    RETURN NEW;
  END IF;
  IF NEW.categoria_nome   IS DISTINCT FROM OLD.categoria_nome   THEN m := m || jsonb_build_object('categoria_nome',  jsonb_build_object('de',OLD.categoria_nome,'para',NEW.categoria_nome)); END IF;
  IF NEW.valor_bruto      IS DISTINCT FROM OLD.valor_bruto      THEN m := m || jsonb_build_object('valor_bruto',     jsonb_build_object('de',OLD.valor_bruto,'para',NEW.valor_bruto)); END IF;
  IF NEW.valor_pago       IS DISTINCT FROM OLD.valor_pago       THEN m := m || jsonb_build_object('valor_pago',      jsonb_build_object('de',OLD.valor_pago,'para',NEW.valor_pago)); END IF;
  IF NEW.data_competencia IS DISTINCT FROM OLD.data_competencia THEN m := m || jsonb_build_object('data_competencia',jsonb_build_object('de',OLD.data_competencia,'para',NEW.data_competencia)); END IF;
  IF NEW.data_pagamento   IS DISTINCT FROM OLD.data_pagamento   THEN m := m || jsonb_build_object('data_pagamento',  jsonb_build_object('de',OLD.data_pagamento,'para',NEW.data_pagamento)); END IF;
  IF NEW.tipo             IS DISTINCT FROM OLD.tipo             THEN m := m || jsonb_build_object('tipo',            jsonb_build_object('de',OLD.tipo,'para',NEW.tipo)); END IF;
  IF NEW.status           IS DISTINCT FROM OLD.status           THEN m := m || jsonb_build_object('status',          jsonb_build_object('de',OLD.status,'para',NEW.status)); END IF;
  IF NEW.excluido_em      IS DISTINCT FROM OLD.excluido_em      THEN m := m || jsonb_build_object('excluido_em',     jsonb_build_object('de',OLD.excluido_em,'para',NEW.excluido_em)); END IF;
  IF NEW.conciliado       IS DISTINCT FROM OLD.conciliado       THEN m := m || jsonb_build_object('conciliado',      jsonb_build_object('de',OLD.conciliado,'para',NEW.conciliado)); END IF;
  IF m = '{}'::jsonb THEN RETURN NEW; END IF;
  -- Ruído: flapping de vencimento (status PENDING<->OVERDUE e nada mais) não é preenchimento.
  IF (m - 'status') = '{}'::jsonb
     AND (m->'status'->>'de')   IN ('PENDING','OVERDUE')
     AND (m->'status'->>'para') IN ('PENDING','OVERDUE') THEN
    RETURN NEW;
  END IF;
  v_evento := CASE WHEN OLD.excluido_em IS NULL AND NEW.excluido_em IS NOT NULL THEN 'EXCLUIDO'
                   WHEN OLD.excluido_em IS NOT NULL AND NEW.excluido_em IS NULL THEN 'REATIVADO'
                   WHEN m ? 'conciliado' AND (m - 'conciliado') = '{}'::jsonb THEN 'CONCILIADO'
                   ELSE 'UPDATE' END;
  INSERT INTO bronze.contaazul_lancamentos_historico(contaazul_id,bar_id,data_competencia,categoria_nome,evento,mudancas)
  VALUES (NEW.contaazul_id, NEW.bar_id, NEW.data_competencia, NEW.categoria_nome, v_evento, m);
  RETURN NEW;
END;
$fn$;

-- (2) Detector parametrizado por bar ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.verificar_preenchimento_ca(p_bar integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','financial','bronze','operations','extensions','pg_temp'
AS $fn$
DECLARE
  v_bar int := p_bar;
  v_nome text := COALESCE((SELECT nome FROM operations.bares WHERE id=p_bar), 'Bar '||p_bar);
  v_msg text := ''; v_retro text := ''; v_snap text := '';
  v_data text := current_date::text;
  v_mes date := date_trunc('month', current_date)::date;
  v_hoje date; v_ant date; r record;
  v_n_real int := 0; v_n_raw int := 0; v_extra int := 0; v_linhas int := 0;
BEGIN
  SELECT count(*) INTO v_n_raw
  FROM bronze.contaazul_lancamentos_historico
  WHERE bar_id=v_bar AND alterado_em >= now() - interval '26 hours'
    AND data_competencia IS NOT NULL AND data_competencia < v_mes;

  FOR r IN
    WITH win AS (
      SELECT contaazul_id, categoria_nome, data_competencia, alterado_em,
             (jsonb_each(mudancas)).key AS campo,
             (jsonb_each(mudancas)).value AS val
      FROM bronze.contaazul_lancamentos_historico
      WHERE bar_id=v_bar AND alterado_em >= now() - interval '26 hours'
        AND data_competencia IS NOT NULL AND data_competencia < v_mes
    ),
    net AS (
      SELECT contaazul_id, campo,
             max(data_competencia) AS comp,
             (array_agg(categoria_nome ORDER BY alterado_em DESC))[1] AS categoria,
             (array_agg(val->>'de'   ORDER BY alterado_em ASC ))[1] AS de,
             (array_agg(val->>'para' ORDER BY alterado_em DESC))[1] AS para
      FROM win GROUP BY contaazul_id, campo
    ),
    real AS (
      SELECT * FROM net
      WHERE de IS DISTINCT FROM para
        AND NOT (campo='status' AND de IN ('PENDING','OVERDUE') AND para IN ('PENDING','OVERDUE'))
    ),
    lines AS (
      SELECT 1 AS prio, re.comp,
        format('• 💰 %s · %s%s · comp %s · pgto %s · R$ %s → R$ %s',
               re.categoria,
               COALESCE(left(b.pessoa_nome,30),'(sem fornecedor)'),
               CASE WHEN b.descricao IS NOT NULL THEN ' — '||left(b.descricao,28) ELSE '' END,
               COALESCE(to_char(b.data_competencia,'DD/MM/YY'), to_char(re.comp,'DD/MM/YY')),
               COALESCE(to_char(b.data_pagamento,'DD/MM/YY'),'—'),
               to_char(COALESCE(re.de,'0')::numeric,'FM999G999G990D00'),
               to_char(COALESCE(re.para,'0')::numeric,'FM999G999G990D00')) AS line
      FROM real re
      LEFT JOIN bronze.bronze_contaazul_lancamentos b ON b.contaazul_id::text = re.contaazul_id AND b.bar_id = v_bar
      WHERE re.campo IN ('valor_pago','valor_bruto')
      UNION ALL
      SELECT 2 AS prio, max(comp) AS comp,
        CASE campo
          WHEN 'categoria_nome'   THEN format('• 🏷️ Recategorização "%s" → "%s": %s lançamento(s) (comp. %s a %s)',
                de, para, count(*), to_char(min(comp),'TMMon/YY'), to_char(max(comp),'TMMon/YY'))
          WHEN 'conciliado'       THEN format('• 🔗 Conciliados: %s lançamento(s) [comp. %s]',
                count(*), to_char(max(comp),'TMMon/YY'))
          WHEN 'status'           THEN format('• ✅ Status %s → %s: %s lançamento(s) [comp. %s]',
                de, para, count(*), to_char(max(comp),'TMMon/YY'))
          WHEN 'data_pagamento'   THEN format('• 📅 Data de pagamento → %s: %s lançamento(s) [comp. %s]',
                para, count(*), to_char(max(comp),'TMMon/YY'))
          WHEN 'data_competencia' THEN format('• 🗓️ Competência %s → %s: %s lançamento(s)', de, para, count(*))
          ELSE format('• %s: %s → %s (%s lançamento(s))', campo, de, para, count(*))
        END AS line
      FROM real WHERE campo NOT IN ('valor_pago','valor_bruto')
      GROUP BY campo, de, para
    )
    SELECT line, count(*) OVER () AS total FROM lines ORDER BY prio, comp DESC NULLS LAST
  LOOP
    v_n_real := r.total;
    v_linhas := v_linhas + 1;
    IF v_linhas <= 25 THEN
      v_retro := v_retro || r.line || E'\n';
    END IF;
  END LOOP;

  IF v_linhas > 25 THEN
    v_extra := v_linhas - 25;
    v_retro := v_retro || format('• …e mais %s alteração(ões).'||E'\n', v_extra);
  END IF;

  -- Fase 2: DRE snapshot diff (só existe pro bar que tem snapshot; senão fica vazio)
  SELECT max(snapshot_date) INTO v_hoje FROM financial.dre_dfc_snapshot WHERE bar_id=v_bar AND tipo='DRE';
  SELECT max(snapshot_date) INTO v_ant  FROM financial.dre_dfc_snapshot WHERE bar_id=v_bar AND tipo='DRE' AND snapshot_date < v_hoje;
  IF v_ant IS NOT NULL THEN
    FOR r IN
      WITH h AS (SELECT mes,grupo,categoria,valor FROM financial.dre_dfc_snapshot WHERE bar_id=v_bar AND tipo='DRE' AND snapshot_date=v_hoje),
           a AS (SELECT mes,grupo,categoria,valor FROM financial.dre_dfc_snapshot WHERE bar_id=v_bar AND tipo='DRE' AND snapshot_date=v_ant)
      SELECT COALESCE(h.categoria,a.categoria) AS categoria, COALESCE(h.mes,a.mes) AS mes,
             COALESCE(a.valor,0) AS v_ant, COALESCE(h.valor,0) AS v_hoje
      FROM h FULL JOIN a ON h.mes=a.mes AND h.grupo=a.grupo AND h.categoria=a.categoria
      WHERE COALESCE(h.mes,a.mes) < v_mes AND ABS(COALESCE(h.valor,0)-COALESCE(a.valor,0)) > 1000
      ORDER BY ABS(COALESCE(h.valor,0)-COALESCE(a.valor,0)) DESC LIMIT 8
    LOOP
      v_snap := v_snap || format('• %s (%s): R$ %s → R$ %s.'||E'\n', r.categoria, to_char(r.mes,'TMMon/YY'),
        to_char(r.v_ant,'FM999G999G990'), to_char(r.v_hoje,'FM999G999G990'));
    END LOOP;
  END IF;

  IF v_retro <> '' THEN
    v_msg := v_msg || format('_Mudanças retroativas no CA (24h, mês já fechado) — %s alteração(ões) real(is) de %s registro(s) brutos:_',
      v_n_real, v_n_raw)||E'\n'||v_retro;
  END IF;
  IF v_snap  <> '' THEN v_msg := v_msg || E'\n'||'_Linhas da DRE que mudaram desde a última foto (mês fechado):_'||E'\n'||v_snap; END IF;

  IF v_msg <> '' THEN
    RETURN public.enviar_alerta_discord_sistema_dedup(
      v_bar,'alerta','preenchimento_ca','🔎 Auditoria de Preenchimento ('||v_nome||') — '||v_data,
      'Movimentações em meses já fechados — vale conferir/cobrar:'||E'\n'||v_msg, 15105570, 'preench_ca_v4_'||v_bar||'_'||v_data);
  END IF;
  RETURN 'OK_SEM_ALERTA bar='||v_bar;
END;
$fn$;

-- (3) Wrapper sem-arg (o que o cron chama): roda pra cada bar que tem dados do Conta Azul.
CREATE OR REPLACE FUNCTION public.verificar_preenchimento_ca()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','bronze','pg_temp'
AS $fn$
DECLARE b int; v_out text := '';
BEGIN
  FOR b IN SELECT DISTINCT bar_id FROM bronze.bronze_contaazul_lancamentos WHERE bar_id IS NOT NULL ORDER BY bar_id
  LOOP
    v_out := v_out || public.verificar_preenchimento_ca(b) || ' | ';
  END LOOP;
  RETURN COALESCE(NULLIF(v_out,''),'SEM_BARS');
END;
$fn$;
