-- View: view_dre
CREATE OR REPLACE VIEW public.view_dre AS
 WITH dados_nibo AS (SELECT EXTRACT(year FROM na.data_competencia) AS ano, EXTRACT(month FROM na.data_competencia) AS mes, (COALESCE(nc.categoria_macro, 'Outras Despesas'))::character varying(100) AS categoria_macro, sum(na.valor) AS total_valor, count(*) AS total_registros, 'automatico'::character varying(20) AS origem
   FROM (nibo_agendamentos na LEFT JOIN nibo_categorias nc ON ((na.categoria_nome = nc.categoria_nome))) WHERE ((na.data_competencia IS NOT NULL) AND ((na.deletado IS NULL) OR (na.deletado = false))) GROUP BY (EXTRACT(year FROM na.data_competencia)), (EXTRACT(month FROM na.data_competencia)), COALESCE(nc.categoria_macro, 'Outras Despesas')),
 dados_manuais AS (SELECT EXTRACT(year FROM dre_manual.data_competencia) AS ano, EXTRACT(month FROM dre_manual.data_competencia) AS mes, dre_manual.categoria_macro, sum(dre_manual.valor) AS total_valor, count(*) AS total_registros, 'manual'::character varying(20) AS origem
   FROM dre_manual WHERE (dre_manual.data_competencia IS NOT NULL) GROUP BY (EXTRACT(year FROM dre_manual.data_competencia)), (EXTRACT(month FROM dre_manual.data_competencia)), dre_manual.categoria_macro)
 SELECT * FROM dados_nibo UNION ALL SELECT * FROM dados_manuais ORDER BY 1 DESC, 2 DESC, 3;
