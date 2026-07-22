-- Sugestão de compras: (1) ESTOQUE REAL e (2) sinal "insumo acabou" (badge).
-- Complementa 2026-07-21_fn_plano_compras_expande_preparos.sql.
--
-- (1) fn_plano_compras ganha coluna `consumo_pos`: consumo de produções JÁ FINALIZADAS desde a
--     contagem da semana (por insumo). O frontend faz estoque_real = contagem − consumo_pos, então
--     o estoque "anda" conforme as produções dão baixa, sem esperar a próxima contagem. Produção
--     PAUSADA não dá baixa → não entra aqui (esses casos ficam pro sinal manual abaixo).
--     Mudou a assinatura de retorno (+1 coluna) → precisa DROP antes do CREATE.
--
-- (2) operations.insumo_falta: sinal manual de que um insumo acabou (chão de produção via pausa
--     "Acabou insumo", ou gestor no Plano de Compras). Vira badge "⚠ acabou" no Plano de Compras
--     mesmo com a contagem mostrando estoque. 1 registro ATIVO por insumo/bar (índice parcial).
--
-- Já aplicado em produção. Ver project_plano_compras_expande_preparos.

DROP FUNCTION IF EXISTS gold.fn_plano_compras(integer, date);
CREATE OR REPLACE FUNCTION gold.fn_plano_compras(p_bar integer, p_semana date DEFAULT NULL::date)
 RETURNS TABLE(insumo_codigo text, nome text, fornecedor text, categoria text, secao_vmarket text, unidade_medida text, base text, embalagem numeric, custo numeric, curva_a boolean, estoque_cont numeric, consumo_pos numeric, ab numeric, comprado numeric, semanas date[], saidas numeric[])
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'gold', 'public', 'silver', 'operations'
AS $function$
  with recursive anchor as (select coalesce(p_semana, date_trunc('week', current_date)::date) as w),
  ins as (
    select upper(i.codigo) cod, i.nome, i.fornecedor, i.categoria, i.unidade_medida,
      i.custo_unitario, coalesce(i.curva_a,false) curva_a,
      c.base cat_base, c.secao_vmarket cat_secao,
      case when c.embalagem is not null and c.embalagem > 0 then c.embalagem::numeric else null end cat_emb
    from operations.insumos i
    left join silver.insumo_catalogo c on c.bar_id=i.bar_id and upper(c.codigo)=upper(i.codigo)
    where i.bar_id=p_bar and coalesce(i.ativo,true) and i.codigo is not null
  ),
  tree as (
    select pc.id produto_id, 1 depth, fi.componente_tipo, upper(fi.insumo_codigo) cod, fi.producao_ref,
           (coalesce(fi.quantidade,0)/coalesce(nullif(fi.fator_correcao,0),1)) * coalesce(pc.multiplicador,1)::numeric qtd_eff
    from public.produto_cardapio pc
    join public.producao_ficha_item fi on fi.produto_id=pc.id
    where pc.bar_id=p_bar
    union all
    select t.produto_id, t.depth+1, cfi.componente_tipo, upper(cfi.insumo_codigo), cfi.producao_ref,
           (t.qtd_eff/coalesce(nullif(pb.rendimento,0),1)) * (coalesce(cfi.quantidade,0)/coalesce(nullif(cfi.fator_correcao,0),1))
    from tree t
    join public.producao_base pb on pb.id=t.producao_ref
    join public.producao_ficha_item cfi on cfi.producao_id=pb.id
    where t.componente_tipo='producao' and t.depth < 8
  ),
  direta as (select produto_id, cod, sum(qtd_eff) qtd from tree where componente_tipo='insumo' and cod is not null group by produto_id, cod),
  semanas as (select ((select w from anchor) - (g*7))::date sem from generate_series(1,6) g),
  vendas as (
    select pc.id produto_id, date_trunc('week', v.data)::date sem, sum(v.qtd_consumo) qtd
    from silver.vendas_consolidada_dia v
    join public.produto_cardapio pc on pc.bar_id=v.bar_id and pc.codigo=v.cod_interno
    where v.bar_id=p_bar and v.data >= (select w from anchor) - 42 and v.data < (select w from anchor)
    group by 1,2
  ),
  saida_raw as (select d.cod, vd.sem, sum(vd.qtd*d.qtd) saida from direta d join vendas vd on vd.produto_id=d.produto_id group by 1,2),
  ab as (
    select upper(fi.insumo_codigo) cod, sum(pi.decidido_receitas * fi.quantidade) ab
    from operations.producao_plano pp
    join operations.producao_plano_item pi on pi.plano_id=pp.id
    join public.producao_ficha_item fi on fi.producao_id=pi.producao_id and fi.componente_tipo='insumo' and fi.insumo_codigo is not null
    where pp.bar_id=p_bar and pp.semana_ini=(select w from anchor) and pp.status='encerrado'
    group by 1
  ),
  est as (
    select distinct on (upper(insumo_codigo)) upper(insumo_codigo) cod, estoque_final, data_contagem
    from silver.estoque_contagem
    where bar_id=p_bar and data_contagem >= (select w from anchor) and data_contagem < (select w from anchor) + 7
    order by upper(insumo_codigo), data_contagem asc
  ),
  consumo_pos as (
    select upper(ei.insumo_codigo) cod, sum(coalesce(ei.qtd_real, ei.qtd_calculada, 0)) consumo
    from operations.producao_execucao_insumo ei
    join operations.producao_execucao e on e.id=ei.execucao_id
    join est on est.cod = upper(ei.insumo_codigo)
    where e.bar_id=p_bar and e.status='finalizada' and ei.insumo_codigo is not null
      and e.criado_em >= est.data_contagem::timestamp
    group by 1
  ),
  comprado as (
    select upper(it.cod_interno) cod, sum(it.quantidade) comprado
    from gold.vmarket_pedido_item it
    join gold.vmarket_pedido p on p.bar_id=it.bar_id and p.id_pedido=it.id_pedido
    where it.bar_id=p_bar and it.cod_interno is not null
      and p.data >= (select w from anchor) and p.data < (select w from anchor) + 7
    group by 1
  ),
  full_grid as (
    select i.cod, i.nome, i.fornecedor, i.categoria, i.cat_secao, i.unidade_medida, i.custo_unitario, i.curva_a,
      i.cat_base, i.cat_emb,
      coalesce(e.estoque_final,0) estoque_cont, coalesce(cpos.consumo,0) consumo_pos,
      coalesce(ab.ab,0) ab, coalesce(cp.comprado,0) comprado, s.sem, coalesce(sr.saida,0) saida
    from ins i
    cross join semanas s
    left join saida_raw sr on sr.cod=i.cod and sr.sem=s.sem
    left join est e on e.cod=i.cod
    left join consumo_pos cpos on cpos.cod=i.cod
    left join ab on ab.cod=i.cod
    left join comprado cp on cp.cod=i.cod
  )
  select fg.cod, fg.nome::text, fg.fornecedor::text, fg.categoria::text, max(fg.cat_secao)::text secao_vmarket,
    fg.unidade_medida::text, max(fg.cat_base)::text base, max(fg.cat_emb) embalagem,
    fg.custo_unitario, fg.curva_a,
    max(fg.estoque_cont) estoque_cont, max(fg.consumo_pos) consumo_pos, max(fg.ab) ab, max(fg.comprado) comprado,
    array_agg(fg.sem order by fg.sem) semanas,
    array_agg(round(fg.saida,4) order by fg.sem) saidas
  from full_grid fg
  group by fg.cod, fg.nome, fg.fornecedor, fg.categoria, fg.unidade_medida, fg.custo_unitario, fg.curva_a
  having sum(fg.saida) > 0 or max(fg.ab) > 0 or max(fg.comprado) > 0;
$function$;

create table if not exists operations.insumo_falta (
  id bigint generated always as identity primary key,
  bar_id integer not null,
  insumo_codigo text not null,
  nome text,
  origem text,                 -- 'producao' (pausa "acabou") | 'compras' (marca manual)
  observacao text,
  marcado_por text,
  marcado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por text
);
create unique index if not exists ux_insumo_falta_ativo
  on operations.insumo_falta (bar_id, upper(insumo_codigo)) where resolvido_em is null;
