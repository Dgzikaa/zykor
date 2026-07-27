-- Quebra do "p/ Produção" (AB) do plano de compras, por insumo.
-- gold.fn_plano_compras devolve o AB já SOMADO; sem a quebra a operação não consegue conferir
-- por que a sugestão subiu ("tá pedindo 7kg mas tenho 8kg em estoque"). Aqui sai linha a linha:
-- qual produção planejada, quantas receitas foram decididas e quanto cada receita leva.
-- Mesma origem do AB na fn_plano_compras (plano ENCERRADO da semana), pra bater com o total.
create or replace function public.plano_compras_ab_detalhe(p_bar int, p_semana date)
returns table (cod text, producao text, receitas numeric, qtd_receita numeric, total numeric)
language sql
stable
security definer
set search_path = public, operations
as $$
  select upper(fi.insumo_codigo)::text,
         pb.nome::text,
         pi.decidido_receitas::numeric,
         fi.quantidade::numeric,
         (pi.decidido_receitas * fi.quantidade)::numeric
  from operations.producao_plano pp
  join operations.producao_plano_item pi on pi.plano_id = pp.id
  join public.producao_base pb on pb.id = pi.producao_id
  join public.producao_ficha_item fi on fi.producao_id = pi.producao_id
       and fi.componente_tipo = 'insumo' and fi.insumo_codigo is not null
  where pp.bar_id = p_bar
    and pp.semana_ini = p_semana
    and pp.status = 'encerrado'
    and coalesce(pi.decidido_receitas, 0) > 0
  order by upper(fi.insumo_codigo), (pi.decidido_receitas * fi.quantidade) desc;
$$;

revoke all on function public.plano_compras_ab_detalhe(int, date) from public;
grant execute on function public.plano_compras_ab_detalhe(int, date) to service_role;
