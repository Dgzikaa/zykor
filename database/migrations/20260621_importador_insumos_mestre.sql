-- 2026-06-21 — Importador reutilizável do cadastro de insumos a partir das planilhas mestre.
-- Botão na tela de Insumos chama /api/ferramentas/insumos/sincronizar-mestre, que lê os 2 sheets
-- e chama esta função. Casa por código (i0XXX). Ver [[project_insumos_cadastro_planilha_mestre]].
ALTER TABLE operations.insumos ADD COLUMN IF NOT EXISTS fornecedor text;
ALTER TABLE operations.insumos ADD COLUMN IF NOT EXISTS embalagem text;

CREATE OR REPLACE FUNCTION operations.upsert_insumos_master(p_bar_id int, p_rows jsonb)
RETURNS TABLE(atualizados int, sem_match int, sem_match_codigos text)
LANGUAGE sql SET search_path TO 'operations','pg_catalog' AS $$
  WITH r AS (
    SELECT * FROM jsonb_to_recordset(p_rows) AS x(codigo text, custo numeric, fornecedor text, embalagem text, categoria text)
  ),
  upd AS (
    UPDATE operations.insumos i SET
      custo_unitario = COALESCE(r.custo, i.custo_unitario),
      fornecedor = COALESCE(NULLIF(r.fornecedor,''), i.fornecedor),
      embalagem = COALESCE(NULLIF(r.embalagem,''), i.embalagem),
      categoria = COALESCE(NULLIF(r.categoria,''), i.categoria),
      updated_at = now()
    FROM r WHERE i.bar_id = p_bar_id AND i.codigo = r.codigo
    RETURNING i.codigo
  )
  SELECT (SELECT count(*) FROM upd)::int,
         (SELECT count(*) FROM r WHERE NOT EXISTS (SELECT 1 FROM operations.insumos i WHERE i.bar_id=p_bar_id AND i.codigo=r.codigo))::int,
         (SELECT string_agg(r.codigo, ', ') FROM r WHERE NOT EXISTS (SELECT 1 FROM operations.insumos i WHERE i.bar_id=p_bar_id AND i.codigo=r.codigo));
$$;
GRANT EXECUTE ON FUNCTION operations.upsert_insumos_master(int, jsonb) TO anon, authenticated, service_role;
