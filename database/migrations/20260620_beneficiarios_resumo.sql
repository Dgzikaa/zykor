-- 2026-06-20 — Resumo agregado dos beneficiários (pra a lista paginada não sofrer do
-- limite de 1k do PostgREST). Conta pessoas, soma total pago e conta duplicados sobre
-- TODO o conjunto filtrado (não só a página). Sempre por bar.
CREATE OR REPLACE FUNCTION financial.beneficiarios_resumo(p_bar_id integer, p_q text DEFAULT NULL, p_so_dup boolean DEFAULT false)
RETURNS TABLE(pessoas bigint, total_pago numeric, com_duplicados bigint)
LANGUAGE sql STABLE SET search_path TO 'gold','pg_catalog' AS $$
  SELECT count(*), COALESCE(sum(total_pago),0), count(*) FILTER (WHERE qtd_cadastros_ca > 1)
  FROM gold.pagamentos_por_beneficiario
  WHERE bar_id = p_bar_id
    AND (p_q IS NULL OR p_q='' OR nome ILIKE '%'||p_q||'%')
    AND (NOT p_so_dup OR qtd_cadastros_ca > 1);
$$;
