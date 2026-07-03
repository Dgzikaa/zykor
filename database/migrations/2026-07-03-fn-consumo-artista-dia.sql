-- Consumação do PRÓPRIO artista por dia = descontos/cortesias cujo motivo classifica como
-- 'artistas' (financial.consumos_keywords, mesma fonte da tela /operacional/consumacao).
-- Usada no ranking de atrações. Aplicado via MCP; versionado aqui.
create or replace function operations.fn_consumo_artista_dia(p_bar integer, p_ini date, p_fim date)
returns table(dia date, valor numeric)
language sql stable security definer
set search_path = public, financial, bronze, operations
as $$
  with lanc as (
    select v.trn_dtgerencial::date as dia, lower(coalesce(v.vd_motivodesconto, '')) as motivo,
           coalesce(v.vd_vrdescontos, 0) as val
    from bronze.bronze_contahub_avendas_vendasperiodo v
    where v.bar_id = p_bar and v.trn_dtgerencial between p_ini and p_fim
      and coalesce(v.vd_vrdescontos, 0) > 0
  ),
  classif as (
    select l.dia, l.val,
      (select k.categoria from financial.consumos_keywords k
       where k.ativo and (k.bar_id is null or k.bar_id = p_bar) and l.motivo ~ lower(k.pattern)
       order by k.prioridade asc limit 1) as categoria
    from lanc l
  )
  select dia, sum(val)::numeric from classif where categoria = 'artistas' group by dia;
$$;
revoke all on function operations.fn_consumo_artista_dia(integer, date, date) from public, anon;
grant execute on function operations.fn_consumo_artista_dia(integer, date, date) to service_role;
