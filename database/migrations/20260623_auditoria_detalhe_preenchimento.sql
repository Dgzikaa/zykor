-- 2026-06-23 — Auditoria de Preenchimento: alerta passa a mostrar O QUE mudou, não só a contagem.
-- Antes: agrupava por (mes, evento) e só dizia "41 lançamento(s)". A maior parte era RUÍDO:
--   os mesmos poucos lançamentos pingando status OVERDUE<->PENDING a cada sync da manhã.
-- Agora: calcula o EFEITO LÍQUIDO por lançamento na janela de 26h (primeiro 'de' -> último 'para'),
--   descarta o flapping de status (PENDING<->OVERDUE, que é só recálculo de vencimento, não preenchimento),
--   agrupa mudanças idênticas (ex.: recategorização em massa vira UMA linha com a contagem),
--   e lista pagamentos/valores um a um (categoria + de->para).
-- O diff 'de->para' já vem da Fase 1 (trigger em bronze.contaazul_lancamentos_historico.mudancas).
-- Dedup key versionada (v2) para o detalhamento re-disparar hoje sem esbarrar no alerta antigo do dia.

CREATE OR REPLACE FUNCTION public.verificar_preenchimento_ca()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','financial','bronze','extensions','pg_temp'
AS $fn$
DECLARE
  v_bar int := 3;
  v_msg text := ''; v_retro text := ''; v_snap text := '';
  v_data text := current_date::text;
  v_mes date := date_trunc('month', current_date)::date;
  v_hoje date; v_ant date; r record;
  v_n_real int := 0; v_n_raw int := 0; v_extra int := 0; v_linhas int := 0;
BEGIN
  -- Quantas alterações BRUTAS x REAIS no período (pra contextualizar o "41" no header).
  SELECT count(*) INTO v_n_raw
  FROM bronze.contaazul_lancamentos_historico
  WHERE bar_id=v_bar AND alterado_em >= now() - interval '26 hours'
    AND data_competencia IS NOT NULL AND data_competencia < v_mes;

  -- Linhas detalhadas (efeito líquido por lançamento, ruído de status removido).
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
        -- flapping de vencimento não é preenchimento: ignora status que volta entre pendente/atrasado
        AND NOT (campo='status' AND de IN ('PENDING','OVERDUE') AND para IN ('PENDING','OVERDUE'))
    ),
    lines AS (
      -- valores: uma linha por lançamento, com fornecedor + comp + pgto pra localizar no CA
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
      LEFT JOIN bronze.bronze_contaazul_lancamentos b ON b.contaazul_id::text = re.contaazul_id
      WHERE re.campo IN ('valor_pago','valor_bruto')
      UNION ALL
      -- demais campos: agrupa mudanças idênticas (recategorização em massa = 1 linha)
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

  -- Fase 2: linhas da DRE que mudaram entre as 2 últimas fotos (mês fechado).
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
      v_bar,'alerta','preenchimento_ca','🔎 Auditoria de Preenchimento (Ordinário) — '||v_data,
      'Movimentações em meses já fechados — vale conferir/cobrar:'||E'\n'||v_msg, 15105570, 'preench_ca_v3_'||v_data);
  END IF;
  RETURN 'OK_SEM_ALERTA';
END;
$fn$;
