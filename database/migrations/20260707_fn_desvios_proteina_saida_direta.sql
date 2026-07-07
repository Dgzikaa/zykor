-- Desvio de Proteínas: a saída teórica passa a ser Utilizado Produção + SAÍDA DIRETA.
--
-- Contexto (Gonza, 07/07): proteína tem 2 tipos de saída — (a) "Utilizado Produção" = proteína
-- que a cozinha processou em preparos (Controle de Produção / fornadas), já contado; e (b) "Saída
-- Direta" = proteína vendida DIRETO num produto do cardápio (ex.: Filé mignon → "Filé com
-- gorgonzola"), que NÃO passava pela conta. Sem a saída direta, a proteína vendida direto sumia do
-- teórico e virava "perda" falsa (ex.: Filé mignon 3/4 kg aparecia -1,7 kg / -R$117 num dia).
--
-- Saída Direta = silver.consumo_teorico_insumo_dia (vendas × ficha DIRETA do produto, componente
-- 'insumo'; a matview NÃO explode produção → é exatamente o consumo direto, DISJUNTO do Utilizado
-- Produção, sem duplicar). Convertido g → kg (÷1000). Bate com a tela "Saídas" que o sócio validou.
--
-- Novo balanço: estoque_fim_teorico = ini + compras − utilizado_producao − saida_direta − desperdício.
-- Mantém o filtro de compra por pedido conferido (status 6) da migração anterior.

CREATE OR REPLACE FUNCTION gold.fn_desvios_proteina(p_bar integer, p_ini date, p_fim date)
 RETURNS TABLE(insumo_cod text, insumo_nome text, unidade text, estoque_ini numeric, comprou numeric, utilizado_producao numeric, saida_direta numeric, desperdicio numeric, estoque_fim_teorico numeric, estoque_fim_real numeric, desvio_qtd numeric, preco numeric, desvio_rs numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'gold', 'public', 'operations', 'silver'
AS $function$
  with prot as (
    select codigo, nome from operations.insumos where bar_id=p_bar and ativo and curva_a_proteina = true
  ),
  est_ini as (select upper(insumo_codigo) cod, sum(estoque_final) q from silver.estoque_contagem where bar_id=p_bar and data_contagem=p_ini group by 1),
  est_fim as (select upper(insumo_codigo) cod, sum(estoque_final) q from silver.estoque_contagem where bar_id=p_bar and data_contagem=p_fim group by 1),
  -- compra entra pela data de ENTREGA e SÓ conta quando o pedido está conferido (status 6 = Entrega Confirmada)
  compras as (
    select upper(coalesce(b.codigo_planilha,b.cod_interno)) cod, sum(pi.quantidade) q
    from gold.vmarket_pedido_item pi
    join gold.vmarket_pedido pp on pp.id_pedido=pi.id_pedido and pp.bar_id=pi.bar_id
    join public.bronze_vmarket_produtos b on b.id_produto_sisfood_cotacao=pi.id_produto_sisfood_cotacao and b.bar_id=pi.bar_id
    where pi.bar_id=p_bar and pp.id_pedido_status = 6
      and coalesce(pp.dt_entrega, pp.data) >= p_ini and coalesce(pp.dt_entrega, pp.data) < p_fim group by 1
  ),
  -- SAÍDA DIRETA: proteína vendida direto no produto (vendas × ficha direta). matview direto-only, g → kg.
  saida_dir as (
    select upper(insumo_codigo) cod, sum(qtd_teorica) / 1000.0 q
    from silver.consumo_teorico_insumo_dia
    where bar_id=p_bar and data >= p_ini and data < p_fim group by 1
  ),
  -- utilizado REAL do Controle de Produção: mestre proteína = peso_bruto; demais = qtd_real (g → kg)
  usou_controle as (
    select upper(pei.insumo_codigo) cod,
      sum( case when pei.is_mestre and pe.peso_bruto is not null then pe.peso_bruto else pei.qtd_real end ) / 1000.0 q
    from operations.producao_execucao_insumo pei
    join operations.producao_execucao pe on pe.id=pei.execucao_id
    join operations.insumos i on i.bar_id=p_bar and upper(i.codigo)=upper(pei.insumo_codigo) and i.curva_a_proteina = true
    where pe.bar_id=p_bar and pe.inicio::date >= p_ini and pe.inicio::date < p_fim and pei.qtd_real is not null
    group by upper(pei.insumo_codigo)
  ),
  -- utilizado automático (fornadas × proteína na ficha) — fallback p/ quem não tem Controle
  usou_auto as (
    select upper(fi.insumo_codigo) cod,
      sum( coalesce(nullif(pe.produzido_qtd,0), pe.fornadas*pb.rendimento) / nullif(pb.rendimento,0)
           * (fi.quantidade / coalesce(nullif(fi.fator_correcao,0),1)) / 1000 ) q
    from operations.producao_entrada_manual pe
    join public.producao_base pb on pb.bar_id=p_bar and upper(pb.codigo)=upper(pe.producao_codigo)
    join public.producao_ficha_item fi on fi.producao_id=pb.id and fi.componente_tipo='insumo'
    join operations.insumos i on i.bar_id=p_bar and upper(i.codigo)=upper(fi.insumo_codigo) and i.curva_a_proteina = true
    where pe.bar_id=p_bar and pe.data >= p_ini and pe.data < p_fim
    group by upper(fi.insumo_codigo)
  ),
  -- utilizado manual (override) — se preenchido, ganha de todos
  usou_man as (
    select upper(insumo_codigo) cod, sum(qtd) q from operations.proteina_utilizado_manual
    where bar_id=p_bar and data >= p_ini and data < p_fim group by 1
  ),
  desperd as (
    select upper(insumo_codigo) cod, sum(qtd) qtd from operations.desvio_desperdicio_manual
    where bar_id=p_bar and data >= p_ini and data < p_fim group by 1
  ),
  prc as (
    select upper(i.codigo) cod, max(vp.preco_atual) preco
    from operations.insumos i
    left join operations.v_insumo_preco_atual vp on vp.bar_id=i.bar_id and vp.cod_u=upper(i.codigo)
    where i.bar_id=p_bar group by upper(i.codigo)
  )
  select pr.codigo, pr.nome::text, 'kg'::text,
    coalesce(ei.q,0), coalesce(c.q,0),
    round(coalesce(um.q, uc.q, ua.q, 0),3) as utilizado_producao,
    round(coalesce(sd.q,0),3) as saida_direta,
    coalesce(dp.qtd,0),
    round(coalesce(ei.q,0)+coalesce(c.q,0)-coalesce(um.q, uc.q, ua.q, 0)-coalesce(sd.q,0)-coalesce(dp.qtd,0),3) as estoque_fim_teorico,
    coalesce(ef.q,0),
    round(coalesce(ef.q,0) - (coalesce(ei.q,0)+coalesce(c.q,0)-coalesce(um.q, uc.q, ua.q, 0)-coalesce(sd.q,0)-coalesce(dp.qtd,0)),3) as desvio_qtd,
    round(p.preco,2),
    round((coalesce(ef.q,0) - (coalesce(ei.q,0)+coalesce(c.q,0)-coalesce(um.q, uc.q, ua.q, 0)-coalesce(sd.q,0)-coalesce(dp.qtd,0))) * coalesce(p.preco,0),2) as desvio_rs
  from prot pr
  left join est_ini ei on ei.cod=upper(pr.codigo)
  left join est_fim ef on ef.cod=upper(pr.codigo)
  left join compras c on c.cod=upper(pr.codigo)
  left join saida_dir sd on sd.cod=upper(pr.codigo)
  left join usou_controle uc on uc.cod=upper(pr.codigo)
  left join usou_auto ua on ua.cod=upper(pr.codigo)
  left join usou_man um on um.cod=upper(pr.codigo)
  left join desperd dp on dp.cod=upper(pr.codigo)
  left join prc p on p.cod=upper(pr.codigo)
  order by coalesce(c.q,0) desc, pr.nome;
$function$;