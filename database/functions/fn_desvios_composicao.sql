-- Composição do estoque inicial/final do Desvios (gold.fn_desvios) por insumo: separa a
-- CONTAGEM crua do que está EMBUTIDO em pré-batches contados (produtos decompor_contagem).
-- Serve o tooltip da tela de Desvios ("estoque inicial" e "estoque real") pra debug — mostra
-- quanto do valor vem da garrafa contada e quanto vem de mixes (ex.: Jim Beam dentro do
-- Pré-Batch Zé Pilintra). Mesma matemática das CTEs prebatch_ini/prebatch_fim de fn_desvios.
CREATE OR REPLACE FUNCTION gold.fn_desvios_composicao(p_bar integer, p_ini date, p_fim date)
 RETURNS TABLE(cod text, contagem_ini numeric, prebatch_ini numeric, contagem_fim numeric, prebatch_fim numeric, prebatches jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'gold','public','operations','silver','financial'
AS $function$
  with recursive
  prod_imult as (
    select pb.id rid, upper(pb.codigo) rcod, fi.componente_tipo ct, upper(fi.insumo_codigo) icod, fi.producao_ref,
           (fi.quantidade / nullif(pb.rendimento,0))::numeric q, 0 lvl
    from public.producao_base pb join public.producao_ficha_item fi on fi.producao_id=pb.id where pb.bar_id=p_bar
    union all
    select r.rid, r.rcod, fi.componente_tipo, upper(fi.insumo_codigo), fi.producao_ref,
           r.q * (fi.quantidade / nullif(sub.rendimento,0)), r.lvl+1
    from prod_imult r
    join public.producao_base sub on sub.id=r.producao_ref and sub.bar_id=p_bar and not coalesce(sub.entra_contagem,true)
    join public.producao_ficha_item fi on fi.producao_id=r.producao_ref
    where r.ct='producao' and r.lvl<6
  ),
  prod_base as (
    select id, upper(codigo) cod, nome, coalesce(fator_contagem,1) fator_contagem, coalesce(decompor_contagem,false) decompor_contagem
    from public.producao_base where bar_id=p_bar and codigo is not null
  ),
  preco_emb as (
    select upper(i.codigo) cod, coalesce(max(iu.embalagem), operations.derive_embalagem(max(i.nome), max(i.unidade_medida))) embalagem
    from operations.insumos i
    left join public.bronze_vmarket_produtos b on b.bar_id=i.bar_id and (b.codigo_planilha=i.codigo or b.cod_interno=i.codigo)
    left join public.insumo_unidade iu on iu.bar_id=i.bar_id and iu.id_prod=b.id_produto_sisfood_cotacao
    where i.bar_id=p_bar group by upper(i.codigo)
  ),
  prod_insumo_mult as (select rcod, icod cod, sum(q) q from prod_imult where ct='insumo' and icod is not null group by rcod, icod),
  cont as (
    select upper(insumo_codigo) cod,
      coalesce(sum(estoque_final) filter (where data_contagem=p_ini),0) ini,
      coalesce(sum(estoque_final) filter (where data_contagem=p_fim),0) fim
    from silver.estoque_contagem where bar_id=p_bar and data_contagem in (p_ini,p_fim) group by 1
  ),
  det as (
    select mult.cod, s.data_contagem dt, pbb.cod pre_batch, pbb.nome, s.estoque_final qtd_prebatch,
      round((s.estoque_final * pbb.fator_contagem * mult.q / nullif(pe.embalagem,0))::numeric,4) embutido
    from silver.estoque_contagem s
    join prod_base pbb on pbb.cod=upper(s.insumo_codigo) and pbb.decompor_contagem
    join prod_insumo_mult mult on mult.rcod=pbb.cod
    join preco_emb pe on pe.cod=mult.cod
    where s.bar_id=p_bar and s.data_contagem in (p_ini,p_fim) and s.estoque_final is not null
  ),
  det_agg as (
    select cod,
      coalesce(sum(embutido) filter (where dt=p_ini),0) pb_ini,
      coalesce(sum(embutido) filter (where dt=p_fim),0) pb_fim,
      jsonb_agg(jsonb_build_object('pre_batch',pre_batch,'nome',nome,'quando', case when dt=p_ini then 'ini' else 'fim' end,
                'qtd_prebatch',qtd_prebatch,'embutido',embutido) order by dt, pre_batch)
        filter (where embutido is not null and embutido <> 0) prebatches
    from det group by cod
  )
  select coalesce(c.cod,d.cod), coalesce(c.ini,0), coalesce(d.pb_ini,0),
         coalesce(c.fim,0), coalesce(d.pb_fim,0), coalesce(d.prebatches,'[]'::jsonb)
  from cont c full join det_agg d on d.cod=c.cod
$function$;

grant execute on function gold.fn_desvios_composicao(integer,date,date) to authenticated, service_role, anon;
