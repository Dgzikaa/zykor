-- v2 do fn_insumos_em_ficha: a v1 (2026-07-02-insumo-em-ficha-por-bar) só olhava
-- ficha de PRODUÇÃO (producao_base) e perdia todo insumo usado só em ficha de
-- PRODUTO de finalização/cardápio (produto_cardapio via produto_id) — ex.: i0195
-- "Batata Palito" nas fichas de "Batata Frita"/"Carne de Sol com Batata" (bar 4),
-- que apareciam como "sem ficha" (garfinho vermelho) e inflavam o contador.
-- Agora considera os dois tipos de pai, sempre do mesmo bar.
-- Aplicado no banco via MCP; versionado aqui p/ o source control refletir o schema.
create or replace function operations.fn_insumos_em_ficha(p_bar_id integer)
returns table(insumo_codigo text)
language sql stable security definer
set search_path = public, operations
as $$
  select distinct fi.insumo_codigo
  from public.producao_ficha_item fi
  where fi.componente_tipo = 'insumo' and fi.insumo_codigo is not null
    and (
      exists (select 1 from public.producao_base pb
              where pb.id = coalesce(fi.producao_id, fi.producao_ref) and pb.bar_id = p_bar_id)
      or exists (select 1 from public.produto_cardapio pc
              where pc.id = fi.produto_id and pc.bar_id = p_bar_id)
    );
$$;
revoke all on function operations.fn_insumos_em_ficha(integer) from public, anon;
grant execute on function operations.fn_insumos_em_ficha(integer) to service_role;
