-- 2026-06-16 — Balanço: Estoques (do CMV) + Provisões (auto do CA).
--
-- Estoques = estoque_final da última semana FECHADA dentro do mês na ferramenta de
-- CMV semanal (financial.cmv_semanal, /ferramentas/cmv-semanal/tabela). Se não
-- preenchida, 0.
CREATE OR REPLACE FUNCTION public.get_estoque_cmv(p_bar_id integer, p_ano integer, p_mes integer)
RETURNS numeric LANGUAGE sql STABLE SET search_path TO 'public','financial' AS $$
  SELECT COALESCE(s.estoque_final, 0)
  FROM financial.cmv_semanal s
  WHERE s.bar_id = p_bar_id
    AND s.data_fim >= make_date(p_ano,p_mes,1)
    AND s.data_fim <= (make_date(p_ano,p_mes,1) + INTERVAL '1 month - 1 day')::date
    AND COALESCE(s.estoque_final,0) > 0
  ORDER BY s.data_fim DESC
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_estoque_cmv(integer,integer,integer) TO authenticated, service_role, anon;

-- get_balanco_ca v9: passou a expor provisoes_fiscais E provisoes_trabalhistas
-- (= PROVISÃO FISCAL / PROVISÃO TRABALHISTA em aberto no CA). Corpo completo
-- aplicado em apply_migration get_balanco_ca_v9_provisoes_trab. Assim as duas
-- provisões viram automáticas (laranja) no Balanço, antes manuais.
-- OBS: em maio/Ordi a PROVISÃO TRABALHISTA em aberto = 139.917,94 (a planilha
-- usava 198.553,95 — confirmar a regra com o sócio).