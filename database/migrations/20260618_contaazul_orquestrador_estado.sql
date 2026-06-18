-- 2026-06-18 — Orquestrador do Conta Azul: tabela de lock (1 run por vez).
-- A edge fn contaazul-orquestrador roda o pipeline do CA EM FILA (lançamentos ->
-- enriquecimento por parcela) pra respeitar o rate-limit POR CONTA do CA (10/seg, 600/min).
-- O lock evita execuções sobrepostas (pula se já rodando há < 12 min).

CREATE TABLE IF NOT EXISTS public.contaazul_orq_estado (
  bar_id      int PRIMARY KEY,
  running     boolean NOT NULL DEFAULT false,
  started_at  timestamptz,
  finished_at timestamptz,
  ultimo      jsonb
);
INSERT INTO public.contaazul_orq_estado(bar_id) VALUES (3) ON CONFLICT (bar_id) DO NOTHING;

-- Cron (a ligar após validar 1 run limpo), em minutos que não batem com baixas/full-ano:
--   SELECT cron.schedule('contaazul-orquestrador','3,13,23,33,43,53 * * * *',
--     $$ SELECT net.http_post(url:='.../functions/v1/contaazul-orquestrador',
--        headers:=jsonb_build_object('Authorization','Bearer '||public.get_service_role_key(),'Content-Type','application/json'),
--        body:=jsonb_build_object('bar_id',3), timeout_milliseconds:=380000); $$);
-- E aposentar (folded no orquestrador): cron.unschedule('contaazul-alteracao-1h'),
--   cron.unschedule('contaazul-conciliacao-backfill').
