-- Plano de Produção: uso indireto por preparo, com o recorte DIRETO separado.
--
-- 22/08/2026 (Gonza): "aqui eu preciso saber separadamente o quanto eu preciso de xarope para a
-- saída DIRETA". A coluna sempre foi o total (o que a venda puxa por qualquer caminho — o conceito
-- de "inception" dele: croquete vendido → massa croquete → carne de panela). O que faltava era
-- conseguir LER as duas partes sem ter que confiar.
--
-- `saidas` continua sendo o TOTAL (nada mudou de valor — a sugestão é a mesma).
-- `saidas_diretas` é a parte de nível 0: o que está escrito na ficha do produto vendido.
-- A diferença entre as duas é o que passa por dentro de outro preparo (espuma, refrigerante,
-- pré-batch). Ex. Moscow Mule: 30 ml direto + 17,5 ml via Espuma de Gengibre = 47,5.
--
-- Return type mudou → precisa de DROP antes do CREATE.
drop function if exists gold.fn_plano_producao(integer, date);

create or replace function gold.fn_plano_producao(p_bar integer, p_semana date default null::date)
 returns table(producao_id bigint, producao_cod text, producao_nome text, rendimento numeric,
               fator_contagem numeric, unidade text, curva_a boolean, controle_producao boolean,
               estoque_atual numeric, semanas date[], saidas numeric[], saidas_diretas numeric[])
 language sql
 stable security definer
 set search_path to 'gold', 'public', 'silver', 'operations'
as $function$
  with anchor as (select coalesce(p_semana, date_trunc('week', current_date)::date) as w),
  expl as (
    with recursive e as (
      select fi.produto_id as raiz, fi.componente_tipo, fi.producao_ref, fi.quantidade::numeric as qtd, 1::numeric as fator, 0 as lvl
      from public.producao_ficha_item fi where fi.produto_id is not null
      union all
      select e.raiz, fi.componente_tipo, fi.producao_ref, fi.quantidade::numeric, e.fator*(e.qtd/nullif(pb.rendimento,0)), e.lvl+1
      from e join public.producao_base pb on pb.id=e.producao_ref
      join public.producao_ficha_item fi on fi.producao_id=e.producao_ref
      where e.componente_tipo='producao' and e.lvl < 6
    )
    select * from e
  ),
  prod_base as (
    select id, upper(codigo) cod, nome, coalesce(rendimento,0) rendimento, coalesce(fator_contagem,1) fator_contagem,
           coalesce(
             nullif(unidade_contagem,''),
             case when coalesce(fator_contagem,1) = 1 then unidade
                  when lower(unidade)='g'  and fator_contagem=1000 then 'kg'
                  when lower(unidade)='ml' and fator_contagem=1000 then 'L'
                  else unidade end
           ) as unidade_contagem,
           coalesce(curva_a,false) curva_a, coalesce(controle_producao,false) controle_producao
    from public.producao_base where bar_id=p_bar and codigo is not null
  ),
  ppp as (
    -- lvl = 0 é o componente escrito na ficha do PRODUTO VENDIDO (saída direta);
    -- lvl > 0 chegou aqui atravessando outro preparo.
    select e.raiz produto_id, pb.cod,
           sum(e.qtd*e.fator) qtd_cu,
           sum(e.qtd*e.fator) filter (where e.lvl = 0) qtd_cu_direta
    from expl e join prod_base pb on pb.id=e.producao_ref
    where e.componente_tipo='producao' and e.producao_ref is not null group by 1,2
  ),
  semanas as (select ((select w from anchor) - (g*7))::date sem from generate_series(1,6) g),
  vendas as (
    select pc.id produto_id, date_trunc('week', v.data)::date sem, sum(v.qtd_consumo) qtd
    from silver.vendas_consolidada_dia v
    join public.produto_cardapio pc on pc.bar_id=v.bar_id and pc.codigo=v.cod_interno
    where v.bar_id=p_bar and v.data >= (select w from anchor) - 42 and v.data < (select w from anchor)
    group by 1,2
  ),
  saida_raw as (
    select ppp.cod, vd.sem,
           sum(ppp.qtd_cu*vd.qtd) saida,
           sum(coalesce(ppp.qtd_cu_direta,0)*vd.qtd) saida_direta
    from ppp join vendas vd on vd.produto_id=ppp.produto_id group by 1,2
  ),
  est as (
    select distinct on (upper(insumo_codigo)) upper(insumo_codigo) cod, estoque_final
    from silver.estoque_contagem
    where bar_id=p_bar and data_contagem >= (select w from anchor) and data_contagem < (select w from anchor) + 7
    order by upper(insumo_codigo), data_contagem asc
  ),
  full_grid as (
    select pb.id, pb.cod, pb.nome, pb.rendimento, pb.fator_contagem, pb.unidade_contagem, pb.curva_a, pb.controle_producao, s.sem,
      coalesce(sr.saida,0)/nullif(pb.fator_contagem,0) saida,
      coalesce(sr.saida_direta,0)/nullif(pb.fator_contagem,0) saida_direta
    from prod_base pb cross join semanas s left join saida_raw sr on sr.cod=pb.cod and sr.sem=s.sem
  )
  select fg.id, fg.cod, fg.nome::text, fg.rendimento, fg.fator_contagem, fg.unidade_contagem::text, fg.curva_a, fg.controle_producao,
    coalesce(e.estoque_final,0) as estoque_atual,
    array_agg(fg.sem order by fg.sem) semanas,
    array_agg(round(fg.saida,6) order by fg.sem) saidas,
    array_agg(round(fg.saida_direta,6) order by fg.sem) saidas_diretas
  from full_grid fg left join est e on e.cod=fg.cod
  group by fg.id, fg.cod, fg.nome, fg.rendimento, fg.fator_contagem, fg.unidade_contagem, fg.curva_a, fg.controle_producao, e.estoque_final
  -- FIX 2026-07-08: respeita o checkbox "Aparece no Controle de Produção" (controle_producao).
  -- Antes só entrava quem tinha saída>0 (consumo derivado de vendas), ignorando a curadoria —
  -- produções intermediárias marcadas à mão (ex.: Aquafaba, sem produto vendido referenciando)
  -- ficavam de fora. Agora produção curada aparece mesmo com saída 0 (sugestão 0 = "não produzir").
  having sum(fg.saida) > 0 or bool_or(fg.controle_producao);
$function$;
