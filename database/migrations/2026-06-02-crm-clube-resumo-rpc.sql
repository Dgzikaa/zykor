-- ============================================================
-- 2026-06-02 — crm.clube_resumo(p_bar_id): agregados do Clube no banco.
-- Bug: /api/crm/clube agregava no Node sobre um SELECT sem limite -> PostgREST
-- cortava em 1.000 de ~110k membros, zerando níveis altos ("0 consumido") e
-- truncando total_membros. Agora GROUP BY no banco retorna ~10 linhas.
-- Aplicado via Supabase MCP apply_migration.
-- ============================================================
CREATE OR REPLACE FUNCTION crm.clube_resumo(p_bar_id integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = crm, public
AS $$
  WITH base AS (
    SELECT COALESCE(nivel, '(sem)')    AS nivel,
           COALESCE(segmento, '(sem)') AS segmento,
           COALESCE(valor_total_consumo, 0) AS consumo
      FROM crm.clube_ordi_membros
     WHERE bar_id = p_bar_id
  ), niv AS (
    SELECT nivel, count(*) AS qtd, sum(consumo) AS gasto_total FROM base GROUP BY nivel
  ), seg AS (
    SELECT segmento, count(*) AS qtd, sum(consumo) AS gasto_total FROM base GROUP BY segmento
  )
  SELECT jsonb_build_object(
    'total_membros', (SELECT count(*) FROM base),
    'por_nivel', COALESCE((
      SELECT jsonb_object_agg(nivel, jsonb_build_object('qtd', qtd, 'gasto_total', round(gasto_total, 2)))
        FROM niv), '{}'::jsonb),
    'por_segmento', COALESCE((
      SELECT jsonb_object_agg(segmento, jsonb_build_object('qtd', qtd, 'gasto_total', round(gasto_total, 2)))
        FROM seg), '{}'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION crm.clube_resumo(integer) TO anon, authenticated, service_role;
