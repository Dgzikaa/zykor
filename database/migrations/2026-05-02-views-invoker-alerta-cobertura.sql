-- 2026-05-02: 3 fixes consolidados
--
-- 1. Converter 34 views regulares pra SECURITY INVOKER (advisor security_definer_view)
--    Mantem auth_custom.* e materialized views. App testado e nao quebrou.
--
-- 2. Funcao + cron de alerta Discord se cobertura de classificacao de consumos < 95%
--    Roda segundas 13h UTC (10h Brasil), uma semana de defasagem pra dados estaveis.
--
-- 3. Keywords novas pra fechar gap Deb (S17 estava 77.45% por causa de):
--    - DESVIO (R$ 1072) -> _descartado (estoque desviado, nao eh cortesia)
--    - Avaliacao (R$ 147) -> operacao (P&D)
--    - Func Nathalia, Wallace, Milla -> operacao
--    - Katrinne (ADM), Debora (M.K.T) -> escritorio
--    - Sufixos (ADM)/(M.K.T)/(FUNC) -> auto-classificacao por convencao
--
-- Cobertura final apos fix:
--    Ord S17: 99.44%
--    Ord S12: 97.85%
--    Deb S17: 100% (era 77.45%)

-- ============================================================
-- 1. Views -> SECURITY INVOKER
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS view_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'v'
      AND n.nspname IN ('public','operations','financial','crm','silver','gold','bronze')
  LOOP
    BEGIN
      EXECUTE format('ALTER VIEW %I.%I SET (security_invoker = true)',
        r.schema_name, r.view_name);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped %.%: %', r.schema_name, r.view_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- 2. Alerta Discord cobertura consumos
-- ============================================================
CREATE OR REPLACE FUNCTION public.verificar_cobertura_consumos_alerta_discord()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, financial, bronze, pg_catalog
AS $$
DECLARE
  v_bar record; v_semana int; v_ano int;
  v_data_inicio date; v_data_fim date;
  v_total_categorizado numeric; v_total_sem_padrao numeric;
  v_total numeric; v_pct numeric; v_emoji text;
BEGIN
  v_semana := EXTRACT(week FROM CURRENT_DATE - INTERVAL '7 days')::int;
  v_ano := EXTRACT(isoyear FROM CURRENT_DATE - INTERVAL '7 days')::int;

  FOR v_bar IN SELECT id, nome FROM operations.bares WHERE ativo = true LOOP
    v_data_inicio := (date_trunc('week', make_date(v_ano,1,4)) + ((v_semana-1)*INTERVAL '1 week') - INTERVAL '3 days')::date;
    v_data_fim := v_data_inicio + 6;

    SELECT COALESCE(SUM(total)::numeric, 0) INTO v_total_categorizado
    FROM public.get_consumos_classificados_semana(v_bar.id, v_data_inicio, v_data_fim);

    SELECT COALESCE(SUM(total_desconto)::numeric, 0) INTO v_total_sem_padrao
    FROM public.get_consumos_sem_categoria_semana(v_bar.id, v_data_inicio, v_data_fim);

    v_total := v_total_categorizado + v_total_sem_padrao;
    IF v_total = 0 THEN CONTINUE; END IF;
    v_pct := (v_total_categorizado / v_total) * 100;

    IF v_pct < 95 THEN
      v_emoji := CASE WHEN v_pct < 90 THEN '🔴' ELSE '🟡' END;
      PERFORM public.enviar_alerta_discord_sistema_dedup(
        v_bar.id, 'cobertura_consumos', 'qualidade_dados',
        v_emoji || ' Cobertura de consumos baixa: ' || v_bar.nome,
        format('Semana %s/%s: classificado %s%% (R$ %s de R$ %s). Sem padrão: R$ %s. Abrir /ferramentas/consumos-classificacao pra revisar pendências.',
          v_semana, v_ano, ROUND(v_pct,1)::text, v_total_categorizado::text, v_total::text, v_total_sem_padrao::text),
        CASE WHEN v_pct < 90 THEN 16711680 ELSE 16753920 END,
        format('cobertura_consumos:%s:%s:%s', v_bar.id, v_ano, v_semana)
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verificar_cobertura_consumos_alerta_discord() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'verificar-cobertura-consumos-semanal',
  '0 13 * * 1',
  $cron$ SELECT public.verificar_cobertura_consumos_alerta_discord(); $cron$
);

-- ============================================================
-- 3. Keywords novas pra fechar gap Deb
-- ============================================================
INSERT INTO financial.consumos_keywords (pattern, categoria, prioridade, descricao) VALUES
  ('desvio',     '_descartado',             10, 'Desvio/quebra de estoque - nao eh consumo de cortesia'),
  ('avaliacao',  'funcionarios_operacao',   40, 'Avaliacao de produtos por funcionarios'),
  ('\mteste\M',  'funcionarios_operacao',   40, 'Teste de drinks/produtos (P&D operacional)'),
  ('nathalia',   'funcionarios_operacao',   40, 'Func Nathalia (Deb)'),
  ('wallace',    'funcionarios_operacao',   40, 'Func Wallace (Deb)'),
  ('\mmilla\M',  'funcionarios_operacao',   40, 'Func Milla (Deb) - boundary pra nao confundir'),
  ('katrinne',   'funcionarios_escritorio', 50, 'Katrinne ADM (Deb)'),
  ('debora',     'funcionarios_escritorio', 50, 'Debora MKT (Deb)'),
  ('\m\(adm\)',  'funcionarios_escritorio', 50, 'Sufixo (ADM) marca escritorio'),
  ('\(m.k.t\)',  'funcionarios_escritorio', 50, 'Sufixo (M.K.T) marca marketing/escritorio'),
  ('\(func\)',   'funcionarios_operacao',   40, 'Sufixo (FUNC) marca operacao')
ON CONFLICT DO NOTHING;
