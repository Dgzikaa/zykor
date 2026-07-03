-- tem_ficha por BAR. O código i0XXX é reusado entre bares (i0200 = Budweiser no
-- bar 3, Caldo de Carne em Pó no bar 4), então checar ficha por código sem bar
-- marcava o insumo de um bar como "em ficha" por causa da ficha do outro (garfinho
-- não ficava vermelho). Liga o item de ficha ao pai (producao_base via producao_id
-- ou producao_ref) pra pegar o bar_id; itens órfãos (sem pai) não contam.
-- Aplicado no banco via MCP; versionado aqui p/ o source control refletir o schema.
create or replace function operations.fn_insumos_em_ficha(p_bar_id integer)
returns table(insumo_codigo text)
language sql stable security definer
set search_path = public, operations
as $$
  select distinct fi.insumo_codigo
  from public.producao_ficha_item fi
  join public.producao_base pb on pb.id = coalesce(fi.producao_id, fi.producao_ref)
  where fi.componente_tipo = 'insumo'
    and fi.insumo_codigo is not null
    and pb.bar_id = p_bar_id;
$$;
revoke all on function operations.fn_insumos_em_ficha(integer) from public, anon;
grant execute on function operations.fn_insumos_em_ficha(integer) to service_role;
