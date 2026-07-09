-- ============================================================================
-- Pedidos de Pagamento — dois casos reais:
--
-- CASO 1: 1 pagamento com VÁRIAS COMPETÊNCIAS (ex.: fornecedor de gelo entrega
--   em 4 dias/valores diferentes, mas manda 1 PIX cheio). No Conta Azul viram N
--   lançamentos (um por competência/valor); no Inter sai 1 PIX só, no vencimento.
--   -> tabela filha pedidos_pagamento_competencias (idempotência por linha:
--      guarda o contaazul_lancamento_id de cada competência).
--
-- CASO 2: pagamento por PIX COPIA E COLA / QR (ex.: Meta Ads via Adyen). A API do
--   Inter não paga copia-e-cola de forma confiável (e está em ajuste desde 12/2025),
--   então guardamos o código e o pagamento é MANUAL (sócio cola no app do Inter).
--   -> coluna pix_copia_cola.
-- ============================================================================

-- CASO 2 — código copia e cola / QR (BR Code EMV)
ALTER TABLE financial.pedidos_pagamento
  ADD COLUMN IF NOT EXISTS pix_copia_cola text;

-- CASO 1 — competências múltiplas de um mesmo pagamento
CREATE TABLE IF NOT EXISTS financial.pedidos_pagamento_competencias (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id               uuid NOT NULL REFERENCES financial.pedidos_pagamento(id) ON DELETE CASCADE,
  bar_id                  integer NOT NULL,
  data_competencia        date NOT NULL,
  valor                   numeric(12,2) NOT NULL,
  descricao               text,                          -- ex.: "130 gelo triturado 29/06"
  contaazul_lancamento_id varchar,                       -- lançamento CA desta competência (idempotência)
  ordem                   integer NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_pag_comp_pedido
  ON financial.pedidos_pagamento_competencias (pedido_id, ordem);

-- Grants no mesmo padrão das outras tabelas do módulo
GRANT SELECT, INSERT, UPDATE, DELETE ON financial.pedidos_pagamento_competencias TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
