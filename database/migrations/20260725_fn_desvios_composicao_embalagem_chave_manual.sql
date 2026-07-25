-- 25/07/2026 — gold.fn_desvios_composicao lia a embalagem da chave ERRADA
--
-- Continuação de 20260724_fn_desvios_embalagem_manual_chave_correta.sql: aquela migration
-- corrigiu `gold.fn_desvios`, mas o irmão dele (`fn_desvios_composicao`, que alimenta a
-- decomposição de pré-batch do modal) ficou pra trás com o join antigo.
--
-- A embalagem mora em public.insumo_unidade em DUAS chaves pro MESMO insumo:
--   id_prod = -operations.insumos.id      -> edição MANUAL da tela de Insumos (a verdade;
--                                            é o que silver.insumo_catalogo e a tela leem)
--   id_prod = id_produto_sisfood_cotacao  -> valor AUTO derivado do VMarket
--
-- Medido em 25/07/2026, insumos ativos com as duas chaves divergindo:
--   Deboche (4): 103 insumos — fator médio 40x, pior caso 1000x
--   Ordinário (3): 9 insumos — pior caso 100x
--
-- Como `embutido` divide pela embalagem, a decomposição de pré-batch saía errada na mesma
-- proporção — e divergia da própria tela de Desvios, que já usa a chave certa desde 24/07.
--
-- O join com bronze_vmarket_produtos sai junto: deixou de ser necessário.
--
-- Validação: gold.fn_desvios_composicao(3,'2026-07-17','2026-07-24') → 105 linhas, 22 com
-- pré-batch; bar 4 → 80 linhas. Função é bar-agnóstica (recebe p_bar), então corrige todos
-- os bares ao vivo, sobre todo o histórico.

CREATE OR REPLACE FUNCTION gold.fn_desvios_composicao(p_bar integer, p_ini date, p_fim date)
 RETURNS TABLE(cod text, contagem_ini numeric, prebatch_ini numeric, contagem_fim numeric, prebatch_fim numeric, prebatches jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'gold', 'public', 'operations', 'silver', 'financial'
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
    -- AQUI: chave manual (-i.id), igual ao fn_desvios. Antes: iu.id_prod=b.id_produto_sisfood_cotacao
    select upper(i.codigo) cod, coalesce(max(iu.embalagem), operations.derive_embalagem(max(i.nome), max(i.unidade_medida))) embalagem
    from operations.insumos i
    left join public.insumo_unidade iu on iu.bar_id=i.bar_id and iu.id_prod = -i.id
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
