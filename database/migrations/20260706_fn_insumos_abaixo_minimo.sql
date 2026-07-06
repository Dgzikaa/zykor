-- ============================================================================
-- Sinal do construtor de alertas: insumos abaixo do mínimo
-- ----------------------------------------------------------------------------
-- Usada pelo motor (condition-engine.ts, sinal 'estoque_insumo_min'): pega a
-- ÚLTIMA contagem por insumo (silver.estoque_contagem) e cruza com o mínimo
-- cadastrado (operations.insumos.estoque_min). Retorna só os que estão abaixo.
-- Aplicada em prod em 06/jul/2026.
-- ============================================================================

create or replace function gold.fn_insumos_abaixo_minimo(p_bar integer)
returns table (insumo_codigo text, insumo_nome text, estoque_final numeric, estoque_min numeric)
language sql
stable
security definer
set search_path = public, operations, silver
as $$
  with ult as (
    select distinct on (ec.insumo_codigo)
      ec.insumo_codigo, ec.insumo_nome, ec.estoque_final
    from silver.estoque_contagem ec
    where ec.bar_id = p_bar
    order by ec.insumo_codigo, ec.data_contagem desc
  )
  select u.insumo_codigo,
         coalesce(u.insumo_nome, i.nome) as insumo_nome,
         u.estoque_final,
         i.estoque_min
  from ult u
  join operations.insumos i
    on i.bar_id = p_bar and i.codigo = u.insumo_codigo and i.ativo = true
  where i.estoque_min is not null and i.estoque_min > 0
    and u.estoque_final is not null
    and u.estoque_final < i.estoque_min
  order by (i.estoque_min - u.estoque_final) desc;
$$;

grant execute on function gold.fn_insumos_abaixo_minimo(integer) to service_role;
