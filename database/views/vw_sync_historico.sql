-- View: vw_sync_historico
CREATE OR REPLACE VIEW public.vw_sync_historico AS
 SELECT h.id, b.nome AS bar, h.data_contagem, h.sync_executado_em, h.contagens_novas, h.contagens_atualizadas, h.contagens_sem_alteracao, (h.contagens_novas + h.contagens_atualizadas) AS total_alteracoes, jsonb_array_length(COALESCE(h.mudancas, '[]'::jsonb)) AS itens_detalhados, h.origem, h.observacoes
   FROM (sync_contagem_historico h JOIN bares b ON (b.id = h.bar_id)) ORDER BY h.sync_executado_em DESC;
