-- Fix: nps_digital ficou NULL em gold.desempenho semanal desde a semana 20/2026.
--
-- Causa raiz: fase_nps_digital em public.etl_gold_desempenho_semanal filtrava
--   search_name = 'NPS Digital'
-- mas o valor real gravado em bronze.bronze_falae_respostas e 'NPS' (a pesquisa
-- digital do Falae). O literal 'NPS Digital' nunca existiu na tabela, entao o
-- filtro casava zero linhas e nps_digital saia NULL.
--
-- As semanas 18/19 ainda exibem NPS porque foram calculadas em 29/05 com uma
-- versao anterior da funcao (antes do split digital/salao por search_name).
-- As semanas 20+ foram recalculadas depois ja com o literal quebrado.
--
-- Salao (search_name = 'Salão') esta correto e nao e tocado.
--
-- Aplicado via REGEXP_REPLACE em pg_get_functiondef (mesmo padrao da migration
-- 20260527_nps_janela_ter_seg_todas_fontes.sql) pra preservar o resto da funcao.

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.etl_gold_desempenho_semanal(integer,integer,integer)'::regprocedure)::text
    INTO v_def;

  v_def := REPLACE(v_def, E'search_name = ''NPS Digital''', E'search_name = ''NPS''');

  EXECUTE v_def;
END $$;

-- Backfill: re-rodar semanas afetadas (bar 3 e 4, semanas 20-22 de 2026)
SELECT * FROM public.etl_gold_desempenho_semanal_range(3, 2026, 20, 2026, 22);
SELECT * FROM public.etl_gold_desempenho_semanal_range(4, 2026, 20, 2026, 22);
