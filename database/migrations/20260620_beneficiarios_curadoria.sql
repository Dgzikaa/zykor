-- 2026-06-20 — Curadoria de beneficiários (unificar duplicados de nome parecido).
-- Auto já junta nome/CPF idêntico; isto cobre grafias diferentes (maiúscula, pontuação,
-- documento divergente). pg_trgm sugere pares; unificar mapeia todos os pessoa_id do CA
-- num beneficiário só (de-para) — reversível, não toca o Conta Azul.
-- ATENÇÃO: operadores do pg_trgm vivem no schema 'extensions' → search_path precisa incluí-lo.

CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
CREATE INDEX IF NOT EXISTS idx_pag_benef_nome_trgm ON gold.pagamentos_por_beneficiario USING gin (nome extensions.gin_trgm_ops);

CREATE OR REPLACE FUNCTION financial.beneficiarios_duplicados_sugeridos(p_bar_id integer)
RETURNS TABLE(key_a text, nome_a text, total_a numeric, cad_a integer, key_b text, nome_b text, total_b numeric, cad_b integer, similaridade real)
LANGUAGE sql STABLE SET search_path TO 'gold','public','extensions','pg_catalog' AS $$
  SELECT a.canonical_key, a.nome, a.total_pago, a.qtd_cadastros_ca,
         b.canonical_key, b.nome, b.total_pago, b.qtd_cadastros_ca, similarity(a.nome,b.nome)
  FROM gold.pagamentos_por_beneficiario a
  JOIN gold.pagamentos_por_beneficiario b
    ON b.bar_id=a.bar_id AND a.canonical_key < b.canonical_key AND a.nome % b.nome
  WHERE a.bar_id = p_bar_id AND similarity(a.nome,b.nome) >= 0.5
  ORDER BY similarity(a.nome,b.nome) DESC LIMIT 80;
$$;

CREATE OR REPLACE FUNCTION financial.unificar_beneficiarios(p_bar_id integer, p_keys text[], p_nome text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'financial','silver','gold','public','pg_catalog' AS $$
DECLARE v_benef uuid; v_nome text; r record;
BEGIN
  SELECT substring(k from 3)::uuid INTO v_benef FROM unnest(p_keys) k WHERE k LIKE 'B:%' LIMIT 1;
  IF v_benef IS NULL THEN
    v_nome := COALESCE(NULLIF(btrim(p_nome),''),
      (SELECT nome FROM gold.pagamentos_por_beneficiario WHERE bar_id=p_bar_id AND canonical_key=ANY(p_keys) ORDER BY total_pago DESC LIMIT 1), 'Beneficiário');
    INSERT INTO financial.beneficiarios (bar_id, nome, tipo) VALUES (p_bar_id, v_nome, 'fornecedor') RETURNING id INTO v_benef;
  END IF;
  FOR r IN SELECT DISTINCT contaazul_pessoa_id FROM silver.beneficiario_canonico
           WHERE bar_id=p_bar_id AND canonical_key=ANY(p_keys) AND contaazul_pessoa_id IS NOT NULL
  LOOP
    INSERT INTO financial.beneficiario_contaazul_map (bar_id, contaazul_pessoa_id, beneficiario_id, origem)
    VALUES (p_bar_id, r.contaazul_pessoa_id::text, v_benef, 'manual')
    ON CONFLICT (bar_id, contaazul_pessoa_id) DO UPDATE SET beneficiario_id=EXCLUDED.beneficiario_id, origem='manual';
  END LOOP;
  REFRESH MATERIALIZED VIEW gold.pagamentos_por_beneficiario;
  RETURN v_benef;
END;$$;
