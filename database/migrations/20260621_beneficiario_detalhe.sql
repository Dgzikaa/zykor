-- 2026-06-21 — Detalhe do beneficiário (clicar → entradas/saídas + categorias).
-- Lista todos os lançamentos (CA) de um beneficiário pela canonical_key (via silver.beneficiario_canonico).
-- A "classe" do fornecedor sai da categoria dominante (Ambev=Custo Bebidas, Benzadeus=Atrações).
CREATE OR REPLACE FUNCTION financial.beneficiario_detalhe(p_bar_id int, p_key text)
RETURNS TABLE(data date, competencia date, descricao text, tipo text, categoria text, valor numeric, status text, conciliado boolean)
LANGUAGE sql STABLE SET search_path TO 'financial','bronze','silver','public','pg_catalog' AS $$
  SELECT l.data_pagamento, l.data_competencia, l.descricao::text, l.tipo::text, l.categoria_nome::text,
    COALESCE(NULLIF(l.valor_pago,0), l.valor_bruto), l.status::text, l.conciliado
  FROM bronze.bronze_contaazul_lancamentos l
  JOIN silver.beneficiario_canonico bc ON bc.bar_id=l.bar_id AND bc.contaazul_pessoa_id=l.pessoa_id
  WHERE l.bar_id=p_bar_id AND bc.canonical_key=p_key AND l.excluido_em IS NULL
  ORDER BY l.data_pagamento DESC NULLS LAST, l.data_competencia DESC;
$$;
GRANT EXECUTE ON FUNCTION financial.beneficiario_detalhe(int, text) TO anon, authenticated, service_role;
