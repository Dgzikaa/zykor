-- =============================================================================
-- A frase abaixo do CMV passa a LER o headline, em vez de recalcular — 11/08/2026
-- =============================================================================
--
-- Sintoma: a frase mostrava um "para X%" que nunca era o número grande da tela.
-- Foram TRÊS causas em camadas, todas na mesma direção (a frase recalculava por conta própria):
--   1. somava qtd_consumo enquanto o headline usa qtd_venda .............. 2,14 p.p.
--   2. o headline usava preço de hoje e a frase preço as-of .............. ~0,3 p.p.
--   3. mesmo com os dois no as-of, a frase aplicava UM custo (o do fim do período) para a
--      semana inteira, enquanto o headline usa o custo de CADA DIA ....... 0,56 p.p.
--
-- Corrigir (3) recalculando de novo seria repetir a mesma classe de bug na próxima mudança.
-- Então cmv_atual e cmv_ant passam a vir de gold.cmv_teorico_dia — a MESMA fonte do número
-- grande. A frase não tem como divergir: é o mesmo dado agregado.
--
-- Só o "smix" continua calculado aqui, porque é um contrafactual que não existe em lugar
-- nenhum: as vendas do período ATUAL avaliadas ao custo do período ANTERIOR. É ele que separa
--   mix_pp     = smix - cmv_ant     (mudou o que vendeu)
--   compras_pp = cmv_atual - smix   (mudou o que o insumo custou)
-- e a soma dos dois fecha a variação total (resta ±0,01 p.p. de arredondamento por parcela).
--
-- Validado nos dois bares:
--   bar 3, 27/07–02/08: frase 30,26% = headline 30,26% (mix +0,63 · compras -0,39)
--   bar 4, 03–09/08:    frase 34,39% = headline 34,39% (mix -2,11 · compras +3,42)
-- =============================================================================

create or replace function gold.fn_cmv_teorico_comparativo(p_bar integer, p_ini date, p_fim date, p_ini_ant date, p_fim_ant date)
 returns table(cmv_atual numeric, cmv_ant numeric, fat_atual numeric, fat_ant numeric, mix_pp numeric, compras_pp numeric)
 language sql
 stable security definer
 set search_path to 'gold', 'public', 'silver'
as $function$
  with
  -- headline dos dois períodos: mesma fonte da tela
  h_atual as (
    select sum(custo) custo, sum(faturamento) fat
      from gold.cmv_teorico_dia
     where bar_id = p_bar and data between p_ini and p_fim
  ),
  h_ant as (
    select sum(custo) custo, sum(faturamento) fat
      from gold.cmv_teorico_dia
     where bar_id = p_bar and data between p_ini_ant and p_fim_ant
  ),
  -- produtos COM ficha técnica (itens_ficha>0); os sem ficha ficam fora do CMV
  com_ficha as (
    select pc.codigo, pc.id
      from public.produto_cardapio pc
      join gold.produto_cmv cm on cm.bar_id = p_bar and cm.produto_id = pc.id
     where pc.bar_id = p_bar and coalesce(cm.itens_ficha,0) > 0
  ),
  -- custo de referência do período ANTERIOR (as-of do fim dele)
  custo_ref as (
    select cf.codigo, coalesce(h.custo, cm.custo, 0) as c
      from com_ficha cf
      left join lateral (select custo from gold.produto_cmv_historico h
                          where h.bar_id = p_bar and h.produto_id = cf.id and h.data_ref <= p_fim_ant
                          order by h.data_ref desc limit 1) h on true
      left join gold.produto_cmv cm on cm.bar_id = p_bar and cm.produto_id = cf.id
  ),
  -- vendas do período ATUAL (qtd_venda: mesmo campo do headline)
  v_atual as (
    select v.cod_interno cod, sum(v.qtd_venda) q, sum(v.valor) fat
      from silver.vendas_consolidada_dia v
     where v.bar_id = p_bar and v.data between p_ini and p_fim
       and v.cod_interno in (select codigo from com_ficha)
     group by v.cod_interno
  ),
  -- contrafactual: o que vendeu agora, ao custo de antes
  smix as (
    select sum(va.q * cr.c) custo, sum(va.fat) fat
      from v_atual va left join custo_ref cr on cr.codigo = va.cod
  )
  select
    round(h_atual.custo / nullif(h_atual.fat,0) * 100, 2) cmv_atual,
    round(h_ant.custo   / nullif(h_ant.fat,0)   * 100, 2) cmv_ant,
    round(h_atual.fat, 2) fat_atual,
    round(h_ant.fat, 2)   fat_ant,
    round((smix.custo/nullif(smix.fat,0)*100) - (h_ant.custo/nullif(h_ant.fat,0)*100), 2) mix_pp,
    round((h_atual.custo/nullif(h_atual.fat,0)*100) - (smix.custo/nullif(smix.fat,0)*100), 2) compras_pp
  from h_atual, h_ant, smix;
$function$;
