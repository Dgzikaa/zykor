-- 2026-06-21 — Dashboard "Por categoria" dentro de Beneficiários (cruzamento classe×fornecedores).
-- "Onde o dinheiro vai por tipo" + quais fornecedores em cada classe + média/mês.
CREATE OR REPLACE FUNCTION financial.beneficiarios_categoria_resumo(p_bar_id int)
RETURNS TABLE(categoria text, qtd_fornecedores int, qtd_pagamentos bigint, total numeric, meses int)
LANGUAGE sql STABLE SET search_path TO 'financial','bronze','silver','pg_catalog' AS $$
  SELECT COALESCE(NULLIF(TRIM(l.categoria_nome),''),'(sem categoria)'),
    count(DISTINCT c.canonical_key)::int, count(*),
    round(sum(COALESCE(NULLIF(l.valor_pago,0), l.valor_bruto)),2),
    count(DISTINCT to_char(l.data_pagamento,'YYYY-MM'))::int
  FROM bronze.bronze_contaazul_lancamentos l
  JOIN silver.beneficiario_canonico c ON c.bar_id=l.bar_id AND c.contaazul_pessoa_id=l.pessoa_id
  WHERE l.bar_id=p_bar_id AND l.excluido_em IS NULL AND l.tipo='DESPESA' AND l.valor_pago>0
  GROUP BY 1 ORDER BY 4 DESC;
$$;
CREATE OR REPLACE FUNCTION financial.fornecedores_de_categoria(p_bar_id int, p_categoria text)
RETURNS TABLE(canonical_key text, nome text, qtd bigint, total numeric)
LANGUAGE sql STABLE SET search_path TO 'financial','bronze','silver','pg_catalog' AS $$
  SELECT c.canonical_key, max(l.pessoa_nome)::text, count(*),
    round(sum(COALESCE(NULLIF(l.valor_pago,0), l.valor_bruto)),2)
  FROM bronze.bronze_contaazul_lancamentos l
  JOIN silver.beneficiario_canonico c ON c.bar_id=l.bar_id AND c.contaazul_pessoa_id=l.pessoa_id
  WHERE l.bar_id=p_bar_id AND l.excluido_em IS NULL AND l.tipo='DESPESA' AND l.valor_pago>0
    AND COALESCE(NULLIF(TRIM(l.categoria_nome),''),'(sem categoria)') = p_categoria
  GROUP BY c.canonical_key ORDER BY 4 DESC;
$$;
GRANT EXECUTE ON FUNCTION financial.beneficiarios_categoria_resumo(int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION financial.fornecedores_de_categoria(int, text) TO anon, authenticated, service_role;
