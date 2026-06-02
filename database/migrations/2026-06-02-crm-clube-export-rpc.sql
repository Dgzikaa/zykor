-- ============================================================
-- 2026-06-02 — crm.clube_export(bar_id, segmento, nivel): export completo do Clube.
-- PostgREST corta listas em 1.000 linhas. Esta RPC retorna o filtro COMPLETO como
-- um único jsonb (1 linha -> sem cap), consumida por /api/crm/clube?export=true
-- pra gerar CSV (disparo no Umbler). Ex.: segmento 'dormindo' = 3.133, total = 110.588.
-- Aplicado via Supabase MCP apply_migration.
-- ============================================================
CREATE OR REPLACE FUNCTION crm.clube_export(
  p_bar_id integer,
  p_segmento text DEFAULT NULL,
  p_nivel text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = crm, public
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.pontos_total DESC NULLS LAST), '[]'::jsonb)
  FROM (
    SELECT cliente_nome, cliente_fone_norm, nivel, segmento, total_visitas,
           valor_total_consumo, ticket_medio_consumo, pontos_total, dias_inativo
      FROM crm.clube_ordi_membros
     WHERE bar_id = p_bar_id
       AND (p_segmento IS NULL OR segmento = p_segmento)
       AND (p_nivel IS NULL OR nivel = p_nivel)
  ) t;
$$;

GRANT EXECUTE ON FUNCTION crm.clube_export(integer, text, text) TO anon, authenticated, service_role;
