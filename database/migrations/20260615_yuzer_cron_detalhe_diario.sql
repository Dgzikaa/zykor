-- 2026-06-15 — Religa o processamento de DETALHE do Yuzer.
--
-- O orquestrador public.yuzer_cron_processar_proximo_evento() processa 1 painel
-- pendente por execução (produtos+pagamentos+estatísticas+fatporhora) e se
-- auto-desligava ('yuzer-sync-backfill') ao terminar o backfill — foi o que
-- aconteceu em 17/02/2026, e desde então o discovery achava eventos mas o detalhe
-- nunca era puxado (Yuzer parou de coletar).
--
-- Solução: cron PERMANENTE sob nome NOVO ('yuzer-detalhe-diario') — o unschedule
-- interno mira 'yuzer-sync-backfill' (no-op aqui), então este não se auto-desliga.
-- Roda a cada 20 min entre 7–11 UTC (4–8h BRT), depois do discovery (6 UTC) e antes
-- do silver (11:45 UTC). Advisory lock evita concorrência; idempotente.
--
-- Já aplicado em produção via MCP em 2026-06-15.

SELECT cron.schedule(
  'yuzer-detalhe-diario',
  '*/20 7-11 * * *',
  'SELECT public.yuzer_cron_processar_proximo_evento();'
);
