-- fn_desvios: a coluna `unidade` passa a exibir o RÓTULO de contagem do insumo
-- (operations.insumos.unidade_contagem, ex.: "garrafa") em vez da unidade da ficha ("ml").
-- Só rótulo — os números já vivem na unidade de compra/contagem (o motor reconcilia via embalagem).
-- Mudanças mínimas: (1) `cad` expõe unidade_contagem; (2) `joined.un` prefere esse rótulo.

CREATE OR REPLACE FUNCTION gold.fn_desvios(p_bar integer, p_ini date, p_fim date)
 RETURNS TABLE(insumo_codigo text, insumo_nome text, categoria text, unidade text, curva_a boolean, is_producao boolean, estoque_ini numeric, compra numeric, troca numeric, produzido numeric, saida_teorica numeric, desperdicio numeric, estoque_fim_teorico numeric, estoque_fim_real numeric, desvio_qtd numeric, preco numeric, desvio_rs numeric, produzido_informado boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'gold', 'public', 'operations', 'silver', 'financial'
AS $function$
  with recursive
  expl as (
    select fi.produto_id as raiz, fi.componente_tipo, upper(fi.insumo_codigo) as cod, fi.producao_ref,
           fi.quantidade::numeric as qtd, 1::numeric as fator, 0 as lvl
    from public.producao_ficha_item fi where fi.produto_id is not null
    union all
    select e.raiz, fi.componente_tipo, upper(fi.insumo_codigo), fi.producao_ref,
           fi.quantidade::numeric, e.fator * (e.qtd / nullif(pb.rendimento,0)), e.lvl+1
    from expl e join public.producao_base pb on pb.id=e.producao_ref
    join public.producao_ficha_item fi on fi.producao_id=e.producao_ref
    where e.componente_tipo='producao' and e.lvl < 6
  ),
  prod_imult as (
    select pb.id as rid, upper(pb.codigo) as rcod, fi.componente_tipo as ct, upper(fi.insumo_codigo) as icod, fi.producao_ref,
           (fi.quantidade / nullif(pb.rendimento,0))::numeric as q, 0 as lvl
    from public.producao_base pb join public.producao_ficha_item fi on fi.producao_id=pb.id where pb.bar_id=p_bar
    union all
    select r.rid, r.rcod, fi.componente_tipo, upper(fi.insumo_codigo), fi.producao_ref,
           r.q * (fi.quantidade / nullif(sub.rendimento,0)), r.lvl+1
    from prod_imult r
    join public.producao_base sub on sub.id=r.producao_ref and sub.bar_id=p_bar and not coalesce(sub.entra_contagem,true)
    join public.producao_ficha_item fi on fi.producao_id=r.producao_ref
    where r.ct='producao' and r.lvl < 6
  ),
  cad as (select upper(codigo) as cod, max(nome) as nome, max(categoria) as cat, max(unidade_medida) as un,
                 max(unidade_contagem) as unid_cont, bool_or(curva_a) as curva_a
    from operations.insumos where bar_id=p_bar group by upper(codigo)),
  -- FIX (Gonza 08/07): insumo que NÃO está em nenhuma ficha DESTE bar não entra no desvio de
  -- consumo (sem ficha = sem consumo teórico → viraria 100% "desperdício" falso). Proteínas têm
  -- o desvio próprio (fn_desvios_proteina); itens tipo gelo/arroz-funcionário/azeitona não têm ficha.
  cods_ficha as (
    select distinct upper(fi.insumo_codigo) as cod
    from public.producao_ficha_item fi
    left join public.produto_cardapio pc on pc.id = fi.produto_id
    left join public.producao_base pbf on pbf.id = fi.producao_id
    where fi.insumo_codigo is not null and (pc.bar_id = p_bar or pbf.bar_id = p_bar)
  ),
  prod_base as (select id, upper(codigo) as cod, nome, coalesce(rendimento,0) as rendimento, coalesce(fator_contagem,1) as fator_contagem,
           unidade_contagem, coalesce(curva_a,false) as curva_a, coalesce(entra_contagem,true) as entra_contagem, coalesce(decompor_contagem,false) as decompor_contagem
    from public.producao_base where bar_id=p_bar and codigo is not null),
  prod_custo as (select pb.cod, case when pb.rendimento>0 then sum(coalesce(fi.custo_planilha,0))/pb.rendimento*pb.fator_contagem else null end as custo_cu
    from prod_base pb join public.producao_ficha_item fi on fi.producao_id=pb.id group by pb.cod, pb.rendimento, pb.fator_contagem),
  preco_emb as (
    select upper(i.codigo) as cod, max(vp.preco_atual) as preco,
           coalesce(max(iu.embalagem), operations.derive_embalagem(max(i.nome), max(i.unidade_medida))) as embalagem
    from operations.insumos i
    left join operations.v_insumo_preco_atual vp on vp.bar_id=i.bar_id and vp.cod_u=upper(i.codigo)
    left join public.bronze_vmarket_produtos b on b.bar_id=i.bar_id and (b.codigo_planilha=i.codigo or b.cod_interno=i.codigo)
    left join public.insumo_unidade iu on iu.bar_id=i.bar_id and iu.id_prod=b.id_produto_sisfood_cotacao
    where i.bar_id=p_bar group by upper(i.codigo)
  ),
  prod_insumo_mult as (select rcod, icod as cod, sum(q) as q from prod_imult where ct='insumo' and icod is not null group by rcod, icod),
  prebatch_ini as (
    select mult.cod, sum(s.estoque_final * pbb.fator_contagem * mult.q / nullif(pe.embalagem,0)) q
    from silver.estoque_contagem s
    join prod_base pbb on pbb.cod=upper(s.insumo_codigo) and pbb.decompor_contagem
    join prod_insumo_mult mult on mult.rcod=pbb.cod
    join preco_emb pe on pe.cod=mult.cod
    where s.bar_id=p_bar and s.data_contagem=p_ini group by mult.cod
  ),
  prebatch_fim as (
    select mult.cod, sum(s.estoque_final * pbb.fator_contagem * mult.q / nullif(pe.embalagem,0)) q
    from silver.estoque_contagem s
    join prod_base pbb on pbb.cod=upper(s.insumo_codigo) and pbb.decompor_contagem
    join prod_insumo_mult mult on mult.rcod=pbb.cod
    join preco_emb pe on pe.cod=mult.cod
    where s.bar_id=p_bar and s.data_contagem=p_fim group by mult.cod
  ),
  vendas as (select pc.id as produto_id, sum(v.qtd_consumo)::numeric as qtd
    from silver.vendas_consolidada_dia v join public.produto_cardapio pc on pc.bar_id=v.bar_id and pc.codigo=v.cod_interno
    where v.bar_id=p_bar and v.data >= p_ini and v.data < p_fim group by pc.id),
  producao_por_produto as (select e.raiz as produto_id, pb.cod, sum(e.qtd*e.fator) as qtd_cu
    from expl e join prod_base pb on pb.id=e.producao_ref where e.componente_tipo='producao' and e.producao_ref is not null group by e.raiz, pb.cod),
  teorico_ins as (select upper(insumo_codigo) cod, sum(qtd_teorica) as base from silver.consumo_teorico_insumo_dia
    where bar_id=p_bar and data >= p_ini and data < p_fim group by upper(insumo_codigo)),
  exec_no_periodo as (select distinct producao_id from operations.producao_execucao where bar_id=p_bar and inicio::date >= p_ini and inicio::date < p_fim),
  exec_rend as (select pe.producao_id, sum(pe.rendimento_real) rr from operations.producao_execucao pe
    where pe.bar_id=p_bar and pe.inicio::date >= p_ini and pe.inicio::date < p_fim and pe.rendimento_real is not null group by pe.producao_id),
  real_prod as (select upper(pei.insumo_codigo) cod, sum(pei.qtd_real) as base
    from operations.producao_execucao_insumo pei join operations.producao_execucao pe on pe.id=pei.execucao_id
    where pe.bar_id=p_bar and pe.inicio::date >= p_ini and pe.inicio::date < p_fim
      and pei.qtd_real is not null and pei.insumo_codigo is not null and pei.insumo_codigo !~* '^p[cd]' group by upper(pei.insumo_codigo)),
  entrada_manual as (select upper(producao_codigo) cod, sum(produzido_qtd) qtd from operations.producao_entrada_manual
    where bar_id=p_bar and data >= p_ini and data < p_fim group by 1),
  entrada as (select pb.cod, coalesce(er.rr / nullif(pb.fator_contagem,0), em.qtd) as qtd
    from prod_base pb left join exec_rend er on er.producao_id=pb.id left join entrada_manual em on em.cod=pb.cod
    where er.rr is not null or em.qtd is not null),
  teorico_ins_prod as (select pim.cod, sum(em.qtd * pb.fator_contagem * pim.q) as base
    from entrada_manual em join prod_base pb on pb.cod = em.cod and pb.entra_contagem join prod_insumo_mult pim on pim.rcod = em.cod
    where not exists (select 1 from exec_no_periodo x where x.producao_id = pb.id) group by pim.cod),
  teorico_prod as (select ppp.cod, sum(ppp.qtd_cu * vd.qtd) as base from producao_por_produto ppp join vendas vd on vd.produto_id=ppp.produto_id group by ppp.cod),
  compras as (select upper(coalesce(b.codigo_planilha,b.cod_interno)) as cod, sum(pi.quantidade) as qtd
    from gold.vmarket_pedido_item pi join gold.vmarket_pedido pp on pp.id_pedido=pi.id_pedido and pp.bar_id=pi.bar_id
    join public.bronze_vmarket_produtos b on b.id_produto_sisfood_cotacao=pi.id_produto_sisfood_cotacao and b.bar_id=pi.bar_id
    where pi.bar_id=p_bar and pp.id_pedido_status = 6
      and coalesce(pp.dt_entrega, pp.data) >= p_ini and coalesce(pp.dt_entrega, pp.data) < p_fim group by 1),
  troca_ent as (select upper(ti.insumo_codigo) cod, sum(ti.quantidade) qtd
    from financial.trocas t join financial.troca_itens ti on ti.troca_id=t.id
    where t.bar_destino=p_bar and t.status <> 'cancelada' and t.data_competencia >= p_ini and t.data_competencia < p_fim group by 1),
  troca_sai as (select upper(ti.insumo_codigo) cod, sum(ti.quantidade) qtd
    from financial.trocas t join financial.troca_itens ti on ti.troca_id=t.id
    where t.bar_origem=p_bar and t.status <> 'cancelada' and t.data_competencia >= p_ini and t.data_competencia < p_fim group by 1),
  desperd as (select upper(insumo_codigo) cod, sum(qtd) qtd from operations.desvio_desperdicio_manual where bar_id=p_bar and data >= p_ini and data < p_fim group by 1),
  est_ini as (select upper(insumo_codigo) cod, sum(estoque_final) q from silver.estoque_contagem where bar_id=p_bar and data_contagem=p_ini group by 1),
  est_fim as (select upper(insumo_codigo) cod, sum(estoque_final) q from silver.estoque_contagem where bar_id=p_bar and data_contagem=p_fim group by 1),
  keys as (select cod from est_ini union select cod from est_fim union select cod from compras
           union select cod from troca_ent union select cod from troca_sai
           union select cod from teorico_ins union select cod from teorico_prod union select cod from entrada union select cod from desperd
           union select cod from prebatch_ini union select cod from prebatch_fim),
  joined as (
    select k.cod, coalesce(pb.nome, cd.nome) as nome, cd.cat,
      -- rótulo da unidade: produção usa o seu; insumo prefere o rótulo de contagem (ex.: garrafa), senão a unidade da ficha
      coalesce(pb.unidade_contagem, nullif(cd.unid_cont, ''), cd.un) as un,
      coalesce(pb.curva_a, cd.curva_a, false) as curva_a, (pb.cod is not null) as is_producao,
      coalesce(pb.entra_contagem, true) as entra_contagem,
      coalesce(ei.q,0) + coalesce(pbi.q,0) as e_ini, coalesce(c.qtd,0) as compra,
      coalesce(tent.qtd,0) - coalesce(tsai.qtd,0) as troca, coalesce(en.qtd,0) as produzido,
      case when pb.cod is not null then coalesce(round(tp.base / nullif(pb.fator_contagem,0),3),0)
           else coalesce(round((coalesce(ti.base,0) + coalesce(tip.base,0) + coalesce(rp.base,0)) / nullif(pe.embalagem,0),3),0) end as saida_teo,
      coalesce(dp.qtd,0) as desperdicio, coalesce(ef.q,0) + coalesce(pbf.q,0) as e_fim_real,
      coalesce(pe.preco, pcu.custo_cu) as preco, (en.cod is not null) as produzido_informado
    from keys k
    left join cad cd on cd.cod=k.cod left join prod_base pb on pb.cod=k.cod left join prod_custo pcu on pcu.cod=k.cod
    left join est_ini ei on ei.cod=k.cod left join est_fim ef on ef.cod=k.cod left join compras c on c.cod=k.cod
    left join troca_ent tent on tent.cod=k.cod left join troca_sai tsai on tsai.cod=k.cod
    left join prebatch_ini pbi on pbi.cod=k.cod left join prebatch_fim pbf on pbf.cod=k.cod
    left join teorico_ins ti on ti.cod=k.cod left join teorico_ins_prod tip on tip.cod=k.cod left join real_prod rp on rp.cod=k.cod
    left join teorico_prod tp on tp.cod=k.cod left join entrada en on en.cod=k.cod left join desperd dp on dp.cod=k.cod
    left join preco_emb pe on pe.cod=k.cod
  )
  select cod, nome, cat, un, curva_a, is_producao, e_ini, compra, troca, produzido, saida_teo, desperdicio,
    round(e_ini + compra + troca + produzido - saida_teo - desperdicio, 3) as estoque_fim_teorico, e_fim_real,
    round(e_fim_real - (e_ini + compra + troca + produzido - saida_teo - desperdicio), 3) as desvio_qtd,
    round(preco,2) as preco,
    round((e_fim_real - (e_ini + compra + troca + produzido - saida_teo - desperdicio)) * coalesce(preco,0), 2) as desvio_rs,
    produzido_informado
  from joined
  where not (is_producao and not entra_contagem)
    and (is_producao or cod in (select cod from cods_ficha))
$function$;
