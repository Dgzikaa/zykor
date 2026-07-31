-- NPS: a pesquisa LEGADA 'NPS Digital' passa a contar no nps_digital (semanal + mensal).
--
-- Reportado em 31/07/2026: na visao mensal, o valor do NPS na tabela nao batia com o do
-- popup de detalhes. Duas causas; esta migration resolve UMA delas (a outra e' de tela).
--
-- A pesquisa digital do Falae chamava-se 'NPS Digital' ate 29/03/2026 e virou 'NPS' em
-- 30/03/2026 — o handoff e' limpo, nao ha sobreposicao de datas:
--     NPS Digital : 67 respostas, 17/03 a 29/03/2026 (bar 3)
--     NPS         : a partir de 30/03/2026
-- Os dois ETLs filtravam search_name = 'NPS' e portanto IGNORAVAM as 67 respostas legadas,
-- enquanto o popup da tela sempre as incluiu. Resultado em mar/2026 do Ordinario:
--     tabela: 20 respostas digitais (NPS 55,00)   popup: 87 respostas (NPS 41,38)
-- Sao respostas reais de NPS do periodo: o certo e' conta-las. Depois desta migration o
-- mes de marco/2026 fica MAIS BAIXO e MAIS COMPLETO.
--
-- Unico periodo afetado: marco/2026 do bar 3 (mensal) e as semanas que cruzam 17-29/03.
-- Abril em diante nao muda (0 respostas legadas). Bar 4 nao tem legado (so 'Salao').
--
-- Aplicado via REGEXP/REPLACE em pg_get_functiondef, mesmo padrao das migrations
-- 2026-06-01-fix-nps-digital-search-name.sql e 20260527_nps_janela_ter_seg_todas_fontes.sql.
-- As DUAS funcoes sao alteradas juntas de proposito: elas alimentam a MESMA coluna em
-- granularidades diferentes, e corrigir so uma recria a divergencia em outro lugar.

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.etl_gold_desempenho_semanal(integer,integer,integer)'::regprocedure)::text
    INTO v_def;
  v_def := REPLACE(v_def, E'search_name = ''NPS''', E'search_name IN (''NPS'', ''NPS Digital'')');
  EXECUTE v_def;

  SELECT pg_get_functiondef('public.etl_gold_desempenho_mensal(integer,integer,integer)'::regprocedure)::text
    INTO v_def;
  v_def := REPLACE(v_def, E'search_name = ''NPS''', E'search_name IN (''NPS'', ''NPS Digital'')');
  EXECUTE v_def;
END $$;

-- Backfill do unico periodo afetado (marco/2026): semanas 11-15 cobrem 17-29/03 com folga,
-- porque a janela semanal do NPS e' deslocada (inicio+1 a fim+1).
SELECT * FROM public.etl_gold_desempenho_semanal_range(3, 2026, 11, 2026, 15);
SELECT * FROM public.etl_gold_desempenho_mensal_range(3, 2026, 3, 2026, 3);
