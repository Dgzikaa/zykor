-- View: pessoas_diario_corrigido
CREATE OR REPLACE VIEW public.pessoas_diario_corrigido AS
 SELECT id, bar_id, data_evento AS data, 0 AS total_pessoas_bruto
   FROM eventos_base WHERE (ativo = true);
