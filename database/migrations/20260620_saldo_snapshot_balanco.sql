-- 2026-06-20 — Caixa+Investimentos do Balanço automático via saldo do Conta Azul.
-- Descoberta: o CA expõe GET /v1/conta-financeira/{id}/saldo-atual (por conta). Somando
-- todas as contas (corrente=caixa, aplicacao/investimento/poupanca=investimentos) temos o
-- Caixa+Investimentos — uma fonte só, grátis (sem Inter/BB/Stone/Open Finance pra isso).
-- snapshot mensal diário (cron) → o mês fecha com o saldo do último dia → o Balanço usa.
CREATE TABLE IF NOT EXISTS financial.saldo_snapshot_mensal (
  bar_id        integer NOT NULL,
  ano           integer NOT NULL,
  mes           integer NOT NULL,
  caixa         numeric(14,2),
  investimentos numeric(14,2),
  total         numeric(14,2),
  detalhe       jsonb,
  capturado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bar_id, ano, mes)
);

-- cron diário chama a rota que captura o saldo-atual de todas as contas e grava o mês corrente.
SELECT cron.unschedule('snapshot-saldos-ca') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='snapshot-saldos-ca');
SELECT cron.schedule('snapshot-saldos-ca', '0 4 * * *', $cron$
  SELECT net.http_post(
    url := 'https://zykor.com.br/api/financeiro/contaazul/saldos/snapshot',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.get_service_role_key()),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
$cron$);
