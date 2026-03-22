-- View: vw_diagnostico_anos
CREATE OR REPLACE VIEW public.vw_diagnostico_anos AS
 SELECT ds.id, ds.bar_id, b.nome AS bar_nome, ds.ano AS ano_registro, EXTRACT(year FROM ds.data_inicio) AS ano_data_inicio, ds.ano_sistema, ds.numero_semana, ds.data_inicio, ds.data_fim,
   CASE WHEN ((ds.ano)::numeric <> EXTRACT(year FROM ds.data_inicio)) THEN 'Inconsistente' WHEN ((ds.ano)::numeric > (EXTRACT(year FROM CURRENT_DATE) + 1)) THEN 'Futuro' WHEN (ds.ano < 2020) THEN 'Antigo' WHEN ((ds.bar_id = 3) AND (ds.ano < 2025)) THEN 'Ordinário não existia' WHEN ((ds.bar_id = 4) AND (ds.ano < 2024)) THEN 'Deboche não existia' ELSE 'OK' END AS status
   FROM (desempenho_semanal ds LEFT JOIN bares b ON (ds.bar_id = b.id));
