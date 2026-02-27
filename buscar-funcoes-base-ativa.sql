-- PASSO 1: Buscar a função get_count_base_ativa do banco
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('get_count_base_ativa', 'calcular_clientes_ativos_periodo')
ORDER BY p.proname;
