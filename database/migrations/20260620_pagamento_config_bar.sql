-- 2026-06-20 — Padrão de pagamento por bar (aprovação 1-clique) + conta do cartão (#2).
-- A aprovação de pedido exige conta financeira pagadora + credencial Inter. Em vez de o
-- financeiro escolher toda vez, memoriza na 1ª aprovação e preenche nas próximas (ele ainda
-- pode sobrescrever). cartao_conta_financeira_id/cartao_pessoa_id ficam pra o "gerar
-- lançamentos" do cartão. Bar 3 já tem o cartão como conta financeira no CA.
CREATE TABLE IF NOT EXISTS financial.pagamento_config_bar (
  bar_id                      integer PRIMARY KEY,
  conta_financeira_id         text,
  inter_credencial_id         integer,
  cartao_conta_financeira_id  text,
  cartao_pessoa_id            text,
  atualizado_em               timestamptz NOT NULL DEFAULT now()
);
-- seed: cartão do bar 3 (Cartão de crédito INTER)
INSERT INTO financial.pagamento_config_bar (bar_id, cartao_conta_financeira_id)
VALUES (3, 'e6b5751d-a2bb-4d96-9cd8-29bfc1234ce1')
ON CONFLICT (bar_id) DO UPDATE SET cartao_conta_financeira_id = EXCLUDED.cartao_conta_financeira_id;
