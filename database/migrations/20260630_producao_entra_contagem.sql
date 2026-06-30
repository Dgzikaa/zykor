-- Flag por produção: "Entra na contagem de estoque".
-- Nem toda produção tem contagem física; default true preserva o comportamento atual
-- (todas entravam na semanal/mensal); o usuário desmarca as exceções na ficha técnica.
-- A tela de Contagem de Estoque (operations.contagem_itens) passa a seguir esse flag.
alter table public.producao_base
  add column if not exists entra_contagem boolean not null default true;

comment on column public.producao_base.entra_contagem is
  'Produção entra na contagem de estoque (semanal/mensal; diária se curva_a). Curva A exige true.';

-- contagem_itens: gate da produção pelo novo flag. Insumos seguem por frequencia (inalterado).
CREATE OR REPLACE FUNCTION operations.contagem_itens(p_bar_id integer, p_tipo text, p_data date)
 RETURNS TABLE(insumo_id bigint, codigo text, nome text, categoria text, tipo_local text, tipo_item text, classe text, unidade_medida text, unidade_contagem text, fator_contagem numeric, frequencia text, preco_atual numeric, ultimo_final numeric, contado numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'operations', 'public', 'pg_catalog'
AS $function$
  select i.id, i.codigo::text, i.nome::text, i.categoria::text, i.tipo_local::text, i.tipo_item::text,
    coalesce(i.classe,'insumo')::text, i.unidade_medida::text,
    coalesce(i.unidade_contagem, i.unidade_medida)::text, coalesce(i.fator_contagem, 1),
    i.frequencia::text, coalesce(pa.preco_atual, i.custo_unitario, 0),
    (select c.estoque_final from operations.contagem_estoque_insumos c
       where c.bar_id=p_bar_id and upper(c.insumo_codigo)=upper(i.codigo) and c.data_contagem < p_data
       order by c.data_contagem desc limit 1),
    (select c.estoque_final from operations.contagem_estoque_insumos c
       where c.bar_id=p_bar_id and upper(c.insumo_codigo)=upper(i.codigo) and c.data_contagem = p_data limit 1)
  from operations.insumos i
  left join operations.v_insumo_preco_atual pa on pa.bar_id=i.bar_id and pa.cod_u=upper(i.codigo)
  where i.bar_id=p_bar_id and i.ativo=true and i.codigo !~* '^p[cd]'
    and ( p_tipo='mensal'
       or (p_tipo='semanal' and i.frequencia in ('diaria','semanal'))
       or (p_tipo='diaria' and i.frequencia='diaria') )

  union all

  select pb.id, pb.codigo::text, pb.nome::text,
    case when lower(pb.codigo) like 'pd%' then 'Produção Drinks' else 'Produção Cozinha' end::text,
    case when lower(pb.codigo) like 'pd%' then 'Produção Drinks' else 'Produção Cozinha' end::text,
    'producao'::text, 'producao'::text, pb.unidade::text,
    coalesce(pb.unidade_contagem, pb.unidade)::text, coalesce(pb.fator_contagem, 1),
    case when pb.curva_a then 'diaria' else 'semanal' end,
    coalesce(pcu.custo_cu, 0),
    (select c.estoque_final from operations.contagem_estoque_insumos c
       where c.bar_id=p_bar_id and upper(c.insumo_codigo)=upper(pb.codigo) and c.data_contagem < p_data
       order by c.data_contagem desc limit 1),
    (select c.estoque_final from operations.contagem_estoque_insumos c
       where c.bar_id=p_bar_id and upper(c.insumo_codigo)=upper(pb.codigo) and c.data_contagem = p_data limit 1)
  from public.producao_base pb
  left join lateral (
    select case when pb.rendimento>0 then sum(coalesce(fi.custo_planilha,0))/pb.rendimento*coalesce(pb.fator_contagem,1) else null end as custo_cu
    from public.producao_ficha_item fi where fi.producao_id=pb.id
  ) pcu on true
  where pb.bar_id=p_bar_id and pb.codigo is not null and coalesce(pb.ativo,true)
    and coalesce(pb.entra_contagem, true)
    and ( p_tipo in ('mensal','semanal') or (p_tipo='diaria' and pb.curva_a=true) )

  order by 5, 4 nulls last, 3;
$function$;
