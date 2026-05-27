-- Aplicada via MCP em 2026-05-27.
-- Task #91: NPS Digital ja usava janela ter-seg (inicio+1 a fim+1) mas Salao
-- e Reservas usavam seg-dom. Socio confirmou que TODAS deveriam ser ter-seg
-- pra refletir as respostas chegando 1 dia apos a visita.
--
-- Mudancas em public.etl_gold_desempenho_semanal:
--   fase_nps_geral, fase_nps_salao, fase_nps_reservas, fase_nps_criterios
--   passam a usar BETWEEN (v_data_inicio + 1) AND (v_data_fim + 1)
--
-- Mensal nao precisa shift (janela cobre 30 dias, 1 dia muda pouco).
--
-- Aplicacao foi via DO block que extraiu pg_get_functiondef, fez REGEXP_REPLACE
-- nos 4 trechos e re-aplicou. Esta migration documenta a intenção.

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.etl_gold_desempenho_semanal(integer,integer,integer)'::regprocedure)::text INTO v_def;

  v_def := REGEXP_REPLACE(v_def,
    'fase_nps_geral AS \(([\s\S]*?)data_referencia BETWEEN v_data_inicio AND v_data_fim',
    'fase_nps_geral AS (\1data_referencia BETWEEN (v_data_inicio + 1) AND (v_data_fim + 1)'
  );

  v_def := REGEXP_REPLACE(v_def,
    E'fase_nps_salao AS \\(([\\s\\S]*?)BETWEEN v_data_inicio AND v_data_fim AND search_name = ''Salão''',
    E'fase_nps_salao AS (\\1BETWEEN (v_data_inicio + 1) AND (v_data_fim + 1) AND search_name = ''Salão'''
  );

  v_def := REGEXP_REPLACE(v_def,
    'fase_nps_reservas AS \(([\s\S]*?)data_referencia BETWEEN v_data_inicio AND v_data_fim',
    'fase_nps_reservas AS (\1data_referencia BETWEEN (v_data_inicio + 1) AND (v_data_fim + 1)'
  );

  v_def := REGEXP_REPLACE(v_def,
    'fase_nps_criterios AS \(([\s\S]*?)nps\.data_referencia BETWEEN v_data_inicio AND v_data_fim',
    'fase_nps_criterios AS (\1nps.data_referencia BETWEEN (v_data_inicio + 1) AND (v_data_fim + 1)'
  );

  EXECUTE v_def;
END $$;

-- Backfill: re-rodar todas semanas 2026 Bar 3 e 4
SELECT * FROM public.etl_gold_desempenho_semanal_range(3, 2026, 1, 2026, 22);
SELECT * FROM public.etl_gold_desempenho_semanal_range(4, 2026, 1, 2026, 22);
