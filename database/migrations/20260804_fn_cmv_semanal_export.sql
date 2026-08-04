-- Exportação do CMV Semanal (pedido do Isaías, 04/08/2026: "consegue colocar pra eu exportar
-- como xls? tanto os antigos ou como tá agora").
--
-- Devolve a semana com a DECOMPOSIÇÃO do Faturamento Limpo (denominador do CMV%) e as três
-- leituras do CMV%, pra ele conferir na planilha de onde vem a diferença:
--   * fat_limpo_hoje         = o que está gravado (Bruto − comissão − couvert − Yuzer "entrada" − Sympla)
--   * fat_limpo_regra_antiga = regra até 30/06 (Bruto − comissão − couvert), sem bilheteria
--   * fat_limpo_corrigido    = bilheteria só do INGRESSO (Yuzer − bar do Yuzer) + Sympla
-- O `yuzer_bar` é o consumo de bar do evento: hoje ele sai do denominador junto com o ingresso,
-- e é isso que estoura o CMV% nas semanas de evento.

create or replace function financial.fn_cmv_semanal_export(p_bar_id integer, p_ano integer)
returns table (
  ano integer, semana integer, data_inicio date, data_fim date,
  faturamento_bruto numeric, comissao numeric, couvert numeric,
  yuzer_entrada numeric, yuzer_bar numeric, sympla numeric,
  fat_limpo_hoje numeric, fat_limpo_regra_antiga numeric, fat_limpo_corrigido numeric,
  estoque_inicial numeric, compras_periodo numeric, estoque_final numeric,
  consumacoes numeric, bonificacoes numeric, cma_total numeric,
  cmv_calculado numeric, cmv_real numeric,
  cmv_pct_hoje numeric, cmv_pct_regra_antiga numeric, cmv_pct_corrigido numeric,
  cmv_limpo_pct numeric, cmv_teorico_pct numeric,
  atualizado_em timestamp
)
language sql
stable
security definer
set search_path to 'financial', 'public', 'gold'
as $function$
  select
    s.ano, s.semana, s.data_inicio, s.data_fim,
    round(coalesce(s.faturamento_bruto,0),2),
    round(coalesce(cc.comissao,0),2),
    round(coalesce(cc.couvert,0),2),
    round(coalesce(y.entrada,0),2),
    round(coalesce(y.bar,0),2),
    round(coalesce(y.sympla,0),2),
    round(coalesce(s.faturamento_cmvivel,0),2),
    round(coalesce(s.faturamento_bruto,0) - coalesce(cc.comissao,0) - coalesce(cc.couvert,0), 2),
    round(coalesce(s.faturamento_bruto,0) - coalesce(cc.comissao,0) - coalesce(cc.couvert,0)
          - (greatest(coalesce(y.entrada,0) - coalesce(y.bar,0), 0) + coalesce(y.sympla,0)), 2),
    round(coalesce(s.estoque_inicial,0),2),
    round(coalesce(s.compras_periodo,0),2),
    round(coalesce(s.estoque_final,0),2),
    round(coalesce(s.consumo_socios,0)+coalesce(s.consumo_beneficios,0)+coalesce(s.consumo_adm,0)
          +coalesce(s.consumo_rh,0)+coalesce(s.consumo_artista,0),2),
    round(coalesce(s.bonificacoes,0),2),
    round(coalesce(s.cma_total,0),2),
    round(coalesce(s.cmv_calculado,0),2),
    round(coalesce(s.cmv_real,0),2),
    round(s.cmv_calculado / nullif(s.faturamento_cmvivel,0) * 100, 2),
    round(s.cmv_calculado / nullif(coalesce(s.faturamento_bruto,0) - coalesce(cc.comissao,0) - coalesce(cc.couvert,0), 0) * 100, 2),
    round(s.cmv_calculado / nullif(coalesce(s.faturamento_bruto,0) - coalesce(cc.comissao,0) - coalesce(cc.couvert,0)
          - (greatest(coalesce(y.entrada,0) - coalesce(y.bar,0), 0) + coalesce(y.sympla,0)), 0) * 100, 2),
    round(coalesce(s.cmv_limpo_percentual,0),2),
    round(coalesce(s.cmv_teorico_percentual, s.cmv_teorico_percentual_manual),2),
    s.updated_at
  from financial.cmv_semanal s
  left join lateral public.get_comissao_couvert_periodo(s.bar_id, s.data_inicio, s.data_fim) cc on true
  left join lateral (
    select sum(p.faturamento_entrada_yuzer) entrada, sum(p.faturamento_bar_yuzer) bar, sum(p.sympla_liquido) sympla
    from gold.planejamento p
    where p.bar_id = s.bar_id and p.data_evento between s.data_inicio and s.data_fim
  ) y on true
  where s.bar_id = p_bar_id and s.ano = p_ano
  order by s.semana;
$function$;

revoke all on function financial.fn_cmv_semanal_export(integer, integer) from public, anon;
grant execute on function financial.fn_cmv_semanal_export(integer, integer) to service_role;
