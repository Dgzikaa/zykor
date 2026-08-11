-- =============================================================================
-- Fecha o último ponto onde o CMV divergia — 11/08/2026
-- =============================================================================
--
-- Sintoma (Rodrigo): "a semana atual ficou certinho, mas se pegamos semanas pra trás,
-- tá errado". Ex.: 27/07–02/08 mostrava headline 31,06% e frase 30,26%.
--
-- CAUSA. O headline da tela NÃO vem de gold.cmv_teorico_dia (que já tinha sido migrada
-- para o modelo C) — vem de gold.fn_cmv_teorico_periodo, somando o custo_total de cada
-- produto. E essa função ainda multiplicava por gold.produto_cmv.custo, o custo de HOJE.
-- Daí o padrão exato que ele descreveu: a semana corrente batia (hoje ≈ as-of de hoje) e
-- as antigas não.
--
-- Agora usa o custo as-of de CADA DIA (gold.produto_cmv_historico), igual à matview e ao
-- comparativo — modelo C: preço congelado na data, ficha sempre a atual
-- (ver 20260811_rebuild_produto_cmv_historico_asof.sql). Fallback em produto_cmv para
-- datas anteriores a 26/06/2026, quando o snapshot começa.
--
-- `custo_unit` (coluna da tabela de produtos) passa a ser o custo as-of do FIM do período
-- exibido, em vez do de hoje.
--
-- Validado nas 13 semanas de 29/06 a 10/08, nos DOIS bares: headline == frase em todas.
-- =============================================================================

create or replace function gold.fn_cmv_teorico_periodo(p_bar_id integer, p_ini date, p_fim date)
 returns table(codigo text, nome text, categoria text, fonte text, qtd numeric, qtd_consumo numeric, preco_venda numeric, custo_unit numeric, faturamento numeric, custo_total numeric, margem numeric, cmv_pct numeric, itens_ficha integer)
 language sql
 security definer
 set search_path to 'gold', 'public', 'silver'
as $function$
  select pc.codigo, pc.nome, pc.categoria,
    v.fonte,
    sum(v.qtd_venda) qtd,
    sum(v.qtd_consumo) qtd_consumo,
    -- preço de venda por fonte: Yuzer = preço efetivo do evento (faturamento/qtd);
    -- ContaHub = preço de tabela do cardápio (gold.produto_cmv).
    case when v.fonte = 'yuzer' then round(sum(v.valor) / nullif(sum(v.qtd_venda), 0), 2)
         else max(pcmv.preco_venda) end preco_venda,
    -- custo unitário DO PERÍODO: as-of do fim dele (não o de hoje)
    max(cfim.custo) custo_unit,
    sum(v.valor) faturamento,
    round(sum(v.qtd_venda * coalesce(hc.custo, pcmv.custo, 0)),2) custo_total,
    round(sum(v.valor) - sum(v.qtd_venda * coalesce(hc.custo, pcmv.custo, 0)),2) margem,
    case when sum(v.valor) > 0
         then round(sum(v.qtd_venda * coalesce(hc.custo, pcmv.custo, 0)) / sum(v.valor) * 100, 2)
    end cmv_pct,
    coalesce(max(pcmv.itens_ficha),0)::int itens_ficha
  from silver.vendas_consolidada_dia v
  join public.produto_cardapio pc on pc.bar_id=v.bar_id and pc.codigo=v.cod_interno
  left join gold.produto_cmv pcmv on pcmv.bar_id=v.bar_id and pcmv.produto_id=pc.id
  -- custo as-of do DIA da venda (mesma regra da matview gold.cmv_teorico_dia)
  left join lateral (
    select h.custo from gold.produto_cmv_historico h
     where h.bar_id = v.bar_id and h.produto_id = pc.id and h.data_ref <= v.data
     order by h.data_ref desc limit 1
  ) hc on true
  -- custo as-of do FIM do período, só para exibir na coluna custo_unit
  left join lateral (
    select h.custo from gold.produto_cmv_historico h
     where h.bar_id = v.bar_id and h.produto_id = pc.id and h.data_ref <= p_fim
     order by h.data_ref desc limit 1
  ) cfim on true
  where v.bar_id=p_bar_id and v.data between p_ini and p_fim
  group by pc.codigo, pc.nome, pc.categoria, v.fonte
  having sum(v.qtd_venda) > 0 or sum(v.valor) > 0
  order by sum(v.valor) desc;
$function$;
