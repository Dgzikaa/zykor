-- v2 (04/08/2026, depois de corrigir a bilheteria e reprocessar 2026):
-- a planilha passa a mostrar as TRÊS eras do Faturamento Limpo, pra qualquer print antigo ser
-- explicável sem adivinhação:
--   * fat_limpo_hoje         = o que está gravado agora (bilheteria = INGRESSO Yuzer + Sympla)
--   * fat_limpo_regra_antiga = até 30/06 (Bruto − comissão − couvert), sem bilheteria
--   * fat_limpo_regra_0107   = a regra que vigorou de 01/07 a 04/08 e estourava o CMV
--                              (descontava o Yuzer INTEIRO, levando o bar do evento junto)
-- O ingresso agora vem de silver.yuzer_produtos_evento (eh_ingresso) — é o número que a
-- operação confere no Yuzer. Ex. 13/06 bar 4: R$ 10.135 de ingresso, não os R$ 62.530 cheios.

drop function if exists financial.fn_cmv_semanal_export(integer, integer);

create or replace function financial.fn_cmv_semanal_export(p_bar_id integer, p_ano integer)
returns table (
  ano integer, semana integer, data_inicio date, data_fim date,
  faturamento_bruto numeric, comissao numeric, couvert numeric,
  yuzer_ingresso numeric, yuzer_bar numeric, yuzer_lancado_como_entrada numeric, sympla numeric,
  fat_limpo_hoje numeric, fat_limpo_regra_antiga numeric, fat_limpo_regra_0107 numeric,
  estoque_inicial numeric, compras_periodo numeric, estoque_final numeric,
  consumacoes numeric, bonificacoes numeric, cma_total numeric,
  cmv_calculado numeric, cmv_real numeric,
  cmv_pct_hoje numeric, cmv_pct_regra_antiga numeric, cmv_pct_regra_0107 numeric,
  cmv_limpo_pct numeric, cmv_teorico_pct numeric,
  atualizado_em timestamp
)
language sql
stable
security definer
set search_path to 'financial', 'public', 'gold', 'silver'
as $function$
  with base as (
    select s.*,
      coalesce(cc.comissao,0) v_comissao,
      coalesce(cc.couvert,0)  v_couvert,
      coalesce(y.entrada,0)   v_entrada,
      coalesce(y.bar,0)       v_bar,
      coalesce(y.sympla,0)    v_sympla,
      coalesce(pr.ingresso,0) v_ingresso
    from financial.cmv_semanal s
    left join lateral public.get_comissao_couvert_periodo(s.bar_id, s.data_inicio, s.data_fim) cc on true
    left join lateral (
      select sum(p.faturamento_entrada_yuzer) entrada, sum(p.faturamento_bar_yuzer) bar, sum(p.sympla_liquido) sympla
      from gold.planejamento p
      where p.bar_id = s.bar_id and p.data_evento between s.data_inicio and s.data_fim
    ) y on true
    left join lateral (
      select sum(q.valor_total) filter (where q.eh_ingresso) ingresso
      from silver.yuzer_produtos_evento q
      where q.bar_id = s.bar_id and q.data_evento between s.data_inicio and s.data_fim
    ) pr on true
    where s.bar_id = p_bar_id and s.ano = p_ano
  )
  select
    b.ano, b.semana, b.data_inicio, b.data_fim,
    round(coalesce(b.faturamento_bruto,0),2),
    round(b.v_comissao,2), round(b.v_couvert,2),
    round(b.v_ingresso,2), round(b.v_bar,2), round(b.v_entrada,2), round(b.v_sympla,2),
    round(coalesce(b.faturamento_cmvivel,0),2),
    round(coalesce(b.faturamento_bruto,0) - b.v_comissao - b.v_couvert, 2),
    round(coalesce(b.faturamento_bruto,0) - b.v_comissao - b.v_couvert - b.v_entrada - b.v_sympla, 2),
    round(coalesce(b.estoque_inicial,0),2),
    round(coalesce(b.compras_periodo,0),2),
    round(coalesce(b.estoque_final,0),2),
    round(coalesce(b.consumo_socios,0)+coalesce(b.consumo_beneficios,0)+coalesce(b.consumo_adm,0)
          +coalesce(b.consumo_rh,0)+coalesce(b.consumo_artista,0),2),
    round(coalesce(b.bonificacoes,0),2),
    round(coalesce(b.cma_total,0),2),
    round(coalesce(b.cmv_calculado,0),2),
    round(coalesce(b.cmv_real,0),2),
    round(b.cmv_calculado / nullif(b.faturamento_cmvivel,0) * 100, 2),
    round(b.cmv_calculado / nullif(coalesce(b.faturamento_bruto,0) - b.v_comissao - b.v_couvert, 0) * 100, 2),
    round(b.cmv_calculado / nullif(coalesce(b.faturamento_bruto,0) - b.v_comissao - b.v_couvert - b.v_entrada - b.v_sympla, 0) * 100, 2),
    round(coalesce(b.cmv_limpo_percentual,0),2),
    round(coalesce(b.cmv_teorico_percentual, b.cmv_teorico_percentual_manual),2),
    b.updated_at
  from base b
  order by b.semana;
$function$;

revoke all on function financial.fn_cmv_semanal_export(integer, integer) from public, anon;
grant execute on function financial.fn_cmv_semanal_export(integer, integer) to service_role;
