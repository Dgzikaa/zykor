-- View: cliente_visitas
-- MIGRADO: visitas (domain table) em vez de contahub_periodo
CREATE OR REPLACE VIEW public.cliente_visitas AS
SELECT id, bar_id, cliente_nome, cliente_fone AS cliente_telefone, created_at
FROM visitas
WHERE cliente_nome IS NOT NULL;