-- View: vw_cmo_historico_completo
CREATE OR REPLACE VIEW public.vw_cmo_historico_completo AS
 SELECT h.id, h.cmo_semanal_id, h.versao, h.bar_id, b.nome AS bar_nome, h.ano, h.semana, h.cmo_total, h.freelas, h.fixos_total, h.cma_alimentacao, h.pro_labore_semanal, h.simulacao_salva, h.funcionarios, jsonb_array_length(h.funcionarios) AS total_funcionarios, h.tipo_mudanca, h.mudancas_detectadas, h.created_at,
   lag(h.cmo_total) OVER (PARTITION BY h.cmo_semanal_id ORDER BY h.versao) AS cmo_total_anterior,
   (h.cmo_total - lag(h.cmo_total) OVER (PARTITION BY h.cmo_semanal_id ORDER BY h.versao)) AS diferenca_cmo_total
   FROM (cmo_semanal_historico h LEFT JOIN bares b ON (h.bar_id = b.id)) ORDER BY h.cmo_semanal_id, h.versao DESC;
