-- fn_desvios passa a esconder produções fora da contagem de estoque (producao_base.entra_contagem=false).
-- O teórico dos insumos componentes continua vindo de silver.consumo_teorico_insumo_dia (uso
-- indireto), então o desvio dos insumos não muda — só some a LINHA da produção não contada.
-- Produção que DEVERIA ter contagem mas falta o "produzido" segue como pendente (entra_contagem=true).
CREATE OR REPLACE FUNCTION gold.fn_desvios(p_bar integer, p_ini date, p_fim date)
 RETURNS TABLE(insumo_codigo text, insumo_nome text, categoria text, unidade text, curva_a boolean, is_producao boolean, estoque_ini numeric, compra numeric, produzido numeric, saida_teorica numeric, desperdicio numeric, estoque_fim_teorico numeric, estoque_fim_real numeric, desvio_qtd numeric, preco numeric, desvio_rs numeric, produzido_informado boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'gold', 'public', 'operations', 'silver'
AS $function$
  with recursive
  expl as (
    select fi.produto_id as raiz, fi.componente_tipo, upper(fi.insumo_codigo) as cod, fi.producao_ref,
           fi.quantidade::numeric as qtd, 1::numeric as fator, 0 as lvl
    from public.producao_ficha_item fi where fi.produto_id is not null
    union all
    select e.raiz, fi.componente_tipo, upper(fi.insumo_codigo), fi.producao_ref,
           fi.quantidade::numeric, e.fator * (e.qtd / nullif(pb.rendimento,0)), e.lvl+1
    from expl e
    join public.producao_base pb on pb.id=e.producao_ref
    join public.producao_ficha_item fi on fi.producao_id=e.producao_ref
    where e.componente_tipo='producao' and e.lvl < 6
  ),
  cad as (
    select upper(codigo) as cod, max(nome) as nome, max(categoria) as cat, max(unidade_medida) as un, bool_or(curva_a) as curva_a
    from operations.insumos where bar_id=p_bar group by upper(codigo)
  ),
  prod_base as (
    select id, upper(codigo) as cod, nome, coalesce(rendimento,0) as rendimento, coalesce(fator_contagem,1) as fator_contagem,
           unidade_contagem, coalesce(curva_a,false) as curva_a, coalesce(entra_contagem,true) as entra_contagem
    from public.producao_base where bar_id=p_bar and codigo is not null
  ),
  prod_custo as (
    select pb.cod, case when pb.rendimento>0 then sum(coalesce(fi.custo_planilha,0))/pb.rendimento*pb.fator_contagem else null end as custo_cu
    from prod_base pb join public.producao_ficha_item fi on fi.producao_id=pb.id
    group by pb.cod, pb.rendimento, pb.fator_contagem
  ),
  preco_emb as (
    select upper(i.codigo) as cod, max(vp.preco_atual) as preco, max(iu.embalagem) as embalagem
    from operations.insumos i
    left join operations.v_insumo_preco_atual vp on vp.bar_id=i.bar_id and vp.cod_u=upper(i.codigo)
    left join public.bronze_vmarket_produtos b on b.bar_id=i.bar_id and (b.codigo_planilha=i.codigo or b.cod_interno=i.codigo)
    left join public.insumo_unidade iu on iu.bar_id=i.bar_id and iu.id_prod=b.id_produto_sisfood_cotacao
    where i.bar_id=p_bar group by upper(i.codigo)
  ),
  vendas as (
    -- CONSOLIDADO (ContaHub + Yuzer), qtd_consumo (inclui cortesia) — igual fn_plano_producao
    select pc.id as produto_id, sum(v.qtd_consumo)::numeric as qtd
    from silver.vendas_consolidada_dia v
    join public.produto_cardapio pc on pc.bar_id=v.bar_id and pc.codigo=v.cod_interno
    where v.bar_id=p_bar and v.data >= p_ini and v.data < p_fim
    group by pc.id
  ),
  producao_por_produto as (
    select e.raiz as produto_id, pb.cod, sum(e.qtd*e.fator) as qtd_cu
    from expl e join prod_base pb on pb.id=e.producao_ref
    where e.componente_tipo='producao' and e.producao_ref is not null group by e.raiz, pb.cod
  ),
  teorico_ins as (
    select upper(insumo_codigo) cod, sum(qtd_teorica) as base
    from silver.consumo_teorico_insumo_dia
    where bar_id=p_bar and data >= p_ini and data < p_fim group by upper(insumo_codigo)
  ),
  teorico_prod as (
    select ppp.cod, sum(ppp.qtd_cu * vd.qtd) as base
    from producao_por_produto ppp join vendas vd on vd.produto_id=ppp.produto_id group by ppp.cod
  ),
  compras as (
    select upper(coalesce(b.codigo_planilha,b.cod_interno)) as cod, sum(pi.quantidade) as qtd
    from gold.vmarket_pedido_item pi
    join gold.vmarket_pedido pp on pp.id_pedido=pi.id_pedido and pp.bar_id=pi.bar_id
    join public.bronze_vmarket_produtos b on b.id_produto_sisfood_cotacao=pi.id_produto_sisfood_cotacao and b.bar_id=pi.bar_id
    where pi.bar_id=p_bar and pp.data::date >= p_ini and pp.data::date < p_fim group by 1
  ),
  entrada as (
    select upper(producao_codigo) cod, sum(produzido_qtd) qtd from operations.producao_entrada_manual
    where bar_id=p_bar and data >= p_ini and data < p_fim group by 1
  ),
  desperd as (
    select upper(insumo_codigo) cod, sum(qtd) qtd from operations.desvio_desperdicio_manual
    where bar_id=p_bar and data >= p_ini and data < p_fim group by 1
  ),
  est_ini as (select upper(insumo_codigo) cod, sum(estoque_final) q from silver.estoque_contagem where bar_id=p_bar and data_contagem=p_ini group by 1),
  est_fim as (select upper(insumo_codigo) cod, sum(estoque_final) q from silver.estoque_contagem where bar_id=p_bar and data_contagem=p_fim group by 1),
  keys as (select cod from est_ini union select cod from est_fim union select cod from compras
           union select cod from teorico_ins union select cod from teorico_prod union select cod from entrada union select cod from desperd),
  joined as (
    select k.cod,
      coalesce(pb.nome, cd.nome) as nome, cd.cat, coalesce(pb.unidade_contagem, cd.un) as un,
      coalesce(pb.curva_a, cd.curva_a, false) as curva_a, (pb.cod is not null) as is_producao,
      coalesce(pb.entra_contagem, true) as entra_contagem,
      coalesce(ei.q,0) as e_ini, coalesce(c.qtd,0) as compra, coalesce(en.qtd,0) as produzido,
      case when pb.cod is not null then coalesce(round(tp.base / nullif(pb.fator_contagem,0),3),0)
           else coalesce(round(ti.base / nullif(pe.embalagem,0),3),0) end as saida_teo,
      coalesce(dp.qtd,0) as desperdicio, coalesce(ef.q,0) as e_fim_real,
      coalesce(pe.preco, pcu.custo_cu) as preco, (en.cod is not null) as produzido_informado
    from keys k
    left join cad cd on cd.cod=k.cod
    left join prod_base pb on pb.cod=k.cod
    left join prod_custo pcu on pcu.cod=k.cod
    left join est_ini ei on ei.cod=k.cod
    left join est_fim ef on ef.cod=k.cod
    left join compras c on c.cod=k.cod
    left join teorico_ins ti on ti.cod=k.cod
    left join teorico_prod tp on tp.cod=k.cod
    left join entrada en on en.cod=k.cod
    left join desperd dp on dp.cod=k.cod
    left join preco_emb pe on pe.cod=k.cod
  )
  select cod, nome, cat, un, curva_a, is_producao,
    e_ini, compra, produzido, saida_teo, desperdicio,
    round(e_ini + compra + produzido - saida_teo - desperdicio, 3) as estoque_fim_teorico,
    e_fim_real,
    round(e_fim_real - (e_ini + compra + produzido - saida_teo - desperdicio), 3) as desvio_qtd,
    round(preco,2) as preco,
    round((e_fim_real - (e_ini + compra + produzido - saida_teo - desperdicio)) * coalesce(preco,0), 2) as desvio_rs,
    produzido_informado
  from joined
  -- produção fora da contagem de estoque não aparece no Desvios (insumos componentes seguem no teórico)
  where not (is_producao and not entra_contagem)
$function$;
