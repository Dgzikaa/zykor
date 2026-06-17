-- 2026-06-16 — Balanço: Estoques (do CMV) + Provisões (auto do CA).
--
-- Estoques = estoque_final da aba MENSAL do CMV (financial.cmv_mensal,
-- /ferramentas/cmv-semanal/tabela aba mensal). Se o mês não estiver preenchido, 0.
-- (revisado: antes lia da semanal; o sócio quer da aba mensal.)
CREATE OR REPLACE FUNCTION public.get_estoque_cmv(p_bar_id integer, p_ano integer, p_mes integer)
RETURNS numeric LANGUAGE sql STABLE SET search_path TO 'public','financial' AS $$
  SELECT COALESCE(m.estoque_final, 0)
  FROM financial.cmv_mensal m
  WHERE m.bar_id = p_bar_id AND m.ano = p_ano AND m.mes = p_mes
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_estoque_cmv(integer,integer,integer) TO authenticated, service_role, anon;

-- get_balanco_ca v9: passou a expor provisoes_fiscais E provisoes_trabalhistas
-- (= PROVISÃO FISCAL / PROVISÃO TRABALHISTA em aberto no CA). Corpo completo
-- aplicado em apply_migration get_balanco_ca_v9_provisoes_trab. Assim as duas
-- provisões viram automáticas (laranja) no Balanço, antes manuais.
-- OBS: em maio/Ordi a PROVISÃO TRABALHISTA em aberto = 139.917,94 (a planilha
-- usava 198.553,95 — confirmar a regra com o sócio).