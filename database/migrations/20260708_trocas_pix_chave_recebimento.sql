-- Chave PIX de RECEBIMENTO por bar (pra onde o dinheiro da troca cai) + rastreio do PIX
-- da troca. A troca: RECEBEDOR dos insumos (bar_destino) paga o EMISSOR (bar_origem);
-- o PIX sai da credencial Inter padrão do bar pagador e cai na chave do bar recebedor.
ALTER TABLE financial.pagamento_config_bar
  ADD COLUMN IF NOT EXISTS chave_pix_recebimento text;

INSERT INTO financial.pagamento_config_bar (bar_id, chave_pix_recebimento, atualizado_em)
VALUES
  (3, '901e70fe-1724-4111-9174-b5f00b536040', now()),  -- Ordinário
  (4, '6bcbeee4-f97b-4341-9fcd-5ab7221e5ce7', now())   -- Descubra/Deboche
ON CONFLICT (bar_id) DO UPDATE
  SET chave_pix_recebimento = EXCLUDED.chave_pix_recebimento, atualizado_em = now();

-- Idempotência: só dispara o PIX da troca se inter_codigo_solicitacao estiver null.
ALTER TABLE financial.trocas ADD COLUMN IF NOT EXISTS inter_codigo_solicitacao text;
ALTER TABLE financial.trocas ADD COLUMN IF NOT EXISTS inter_pix_erro text;
