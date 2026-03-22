-- View: view_eventos
CREATE OR REPLACE VIEW public.view_eventos AS
 SELECT id, bar_id, data_evento, nome, dia_semana, COALESCE(genero, 'N/A') AS casa_show, artista, NULL::text AS promoter,
   CASE WHEN ativo THEN 'ativo' ELSE 'inativo' END AS status,
   CASE WHEN dia_semana IN ('Sábado', 'Sexta') THEN 'show' WHEN dia_semana = 'Domingo' THEN 'happy_hour' ELSE 'evento' END AS tipo_evento,
   observacoes, criado_em, atualizado_em, COALESCE(faturamento_couvert, 0) AS receita_garantida, COALESCE(faturamento_bar, 0) AS receita_bar, COALESCE(real_r, 0) AS receita_total, COALESCE(c_prod, 0) AS custo_producao
   FROM eventos_base e WHERE (ativo = true);
