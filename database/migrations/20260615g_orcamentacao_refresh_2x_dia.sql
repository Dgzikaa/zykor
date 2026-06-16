-- 2026-06-15 — Orçamentação: refresh do gold 2x/dia + reorder Comerciais.
--
-- Antes o gold da orçamentação (gold.orcamento_realizado_mensal, fonte do realizado)
-- só atualizava 1x/dia (03:30 BRT). Sócio faz lançamentos/ajustes no CA todo dia ->
-- passa a rodar 2x/dia: 08:15 e 20:15 BRT (11:15 e 23:15 UTC), uns minutos após o
-- sync horário do CA (contaazul-alteracao-1h).
SELECT cron.schedule(
  'refresh-gold-orcamentacao-diario',
  '15 11,23 * * *',
  $$ SELECT public.cron_refresh_gold_orcamentacao_diario(); $$
);

-- Despesas Comerciais: [Consumação] Programa de Pontos abaixo de Benefício Clientes.
UPDATE financial.dre_categoria_macro SET ordem_sub=4 WHERE categoria_macro='Despesas Comerciais' AND categoria_nome='[Consumação] Programa de Pontos';
UPDATE financial.dre_categoria_macro SET ordem_sub=5 WHERE categoria_macro='Despesas Comerciais' AND categoria_nome='[Consumação] Influencers';
UPDATE financial.dre_categoria_macro SET ordem_sub=6 WHERE categoria_macro='Despesas Comerciais' AND categoria_nome='Atrações Programação';
UPDATE financial.dre_categoria_macro SET ordem_sub=7 WHERE categoria_macro='Despesas Comerciais' AND categoria_nome='[Consumação] Artistas';
UPDATE financial.dre_categoria_macro SET ordem_sub=8 WHERE categoria_macro='Despesas Comerciais' AND categoria_nome='Produção Eventos';
