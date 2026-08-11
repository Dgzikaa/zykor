-- =============================================================================
-- A frase embaixo do CMV não acompanhava o número grande — corrigido em 11/08/2026
-- =============================================================================
--
-- Sintoma (Rodrigo): headline da semana 27/07–02/08 marcava 34,27% e a frase logo abaixo
-- dizia "CMV caiu de 33.41% para 32.88%". O "para" nunca era o número da tela.
--
-- CAUSA. gold.fn_cmv_teorico_comparativo somava `qtd_consumo` (inclui cortesia), enquanto
-- todo o resto do CMV teórico usa `qtd_venda`. A matview gold.cmv_teorico_dia foi trocada
-- de qtd_consumo → qtd_venda em 06/07/2026 (decisão do Gonza: a cortesia não teve receita,
-- então entra no consumo/produção/desvio mas NÃO no CMV teórico, senão infla o percentual).
-- Esta função ficou para trás naquela migração.
--
-- Medido na semana 27/07–02/08 do bar 3 — faturamento idêntico nos dois lados, só o custo
-- mudava:
--   qtd_venda   + custo atual      = 31,06%   <- headline
--   qtd_consumo + custo atual      = 33,20%
--   qtd_venda   + custo histórico  = 30,74%
--   qtd_consumo + custo histórico  = 32,88%   <- o que a frase mostrava
-- A escolha do campo respondia por 2,14 p.p.; o custo as-of por 0,32 p.p.
--
-- O custo as-of (gold.produto_cmv_historico) NÃO foi mexido de propósito: é ele que separa
-- "mix" (o que vendeu) de "compras" (o que o insumo custou) — o ponto da frase. Por isso
-- resta ~0,3 p.p. contra o headline, que usa o custo de HOJE para todo o histórico (ou seja,
-- o CMV de uma semana fechada muda quando o preço do insumo muda hoje). Comportamento
-- conhecido e separado deste bug; alinhar os dois exigiria o headline passar a usar as-of.
--
-- Depois da correção, mesma semana: frase "de 30,10% para 30,74%" (mix +0,60 · compras +0,04,
-- que somam exatamente os 0,64 p.p.) contra 31,06% no headline.
-- =============================================================================

create or replace function gold.fn_cmv_teorico_comparativo(p_bar integer, p_ini date, p_fim date, p_ini_ant date, p_fim_ant date)
 returns table(cmv_atual numeric, cmv_ant numeric, fat_atual numeric, fat_ant numeric, mix_pp numeric, compras_pp numeric)
 language sql
 stable security definer
 set search_path to 'gold', 'public', 'silver'
as $function$
  with
  -- produtos COM ficha técnica (itens_ficha>0); os sem ficha ficam fora do CMV
  com_ficha as (
    select pc.codigo
    from public.produto_cardapio pc
    join gold.produto_cmv cm on cm.bar_id=p_bar and cm.produto_id=pc.id
    where pc.bar_id=p_bar and coalesce(cm.itens_ficha,0) > 0
  ),
  custo_atual as (
    select pc.codigo, coalesce(h.custo, cm.custo, 0) as c
    from public.produto_cardapio pc
    left join lateral (select custo from gold.produto_cmv_historico h
       where h.bar_id=p_bar and h.produto_id=pc.id and h.data_ref <= p_fim
       order by h.data_ref desc limit 1) h on true
    left join gold.produto_cmv cm on cm.bar_id=p_bar and cm.produto_id=pc.id
    where pc.bar_id=p_bar
  ),
  custo_ant as (
    select pc.codigo, coalesce(h.custo, cm.custo, 0) as c
    from public.produto_cardapio pc
    left join lateral (select custo from gold.produto_cmv_historico h
       where h.bar_id=p_bar and h.produto_id=pc.id and h.data_ref <= p_fim_ant
       order by h.data_ref desc limit 1) h on true
    left join gold.produto_cmv cm on cm.bar_id=p_bar and cm.produto_id=pc.id
    where pc.bar_id=p_bar
  ),
  -- qtd_venda (NAO qtd_consumo): mesmo campo de gold.cmv_teorico_dia. A cortesia entra em
  -- consumo/producao/desvio, mas nao no CMV teorico (decisao do Gonza, 06/07/2026) — senao
  -- a frase de baixo diverge do numero grande da tela.
  v_atual as (
    select v.cod_interno cod, sum(v.qtd_venda) q, sum(v.valor) fat
    from silver.vendas_consolidada_dia v
    where v.bar_id=p_bar and v.data between p_ini and p_fim
      and v.cod_interno in (select codigo from com_ficha)
    group by v.cod_interno
  ),
  v_ant as (
    select v.cod_interno cod, sum(v.qtd_venda) q, sum(v.valor) fat
    from silver.vendas_consolidada_dia v
    where v.bar_id=p_bar and v.data between p_ini_ant and p_fim_ant
      and v.cod_interno in (select codigo from com_ficha)
    group by v.cod_interno
  ),
  s2 as (select sum(va.q*ca.c) custo, sum(va.fat) fat from v_atual va left join custo_atual ca on ca.codigo=va.cod),
  s1 as (select sum(vp.q*cp.c) custo, sum(vp.fat) fat from v_ant vp left join custo_ant cp on cp.codigo=vp.cod),
  smix as (select sum(va.q*coalesce(cp.c, ca.c)) custo, sum(va.fat) fat
           from v_atual va left join custo_ant cp on cp.codigo=va.cod left join custo_atual ca on ca.codigo=va.cod)
  select
    round(s2.custo/nullif(s2.fat,0)*100,2) cmv_atual,
    round(s1.custo/nullif(s1.fat,0)*100,2) cmv_ant,
    round(s2.fat,2) fat_atual, round(s1.fat,2) fat_ant,
    round((smix.custo/nullif(smix.fat,0)*100) - (s1.custo/nullif(s1.fat,0)*100),2) mix_pp,
    round((s2.custo/nullif(s2.fat,0)*100) - (smix.custo/nullif(smix.fat,0)*100),2) compras_pp
  from s2, s1, smix;
$function$;
