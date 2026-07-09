-- ============================================================================
-- Fatura de cartão em ABERTO (CMV) — importação semanal multi-banco.
--
-- Puxamos a fatura em andamento (Itaú .xls, Nubank .csv/.ofx) toda semana pra
-- lançar as compras no Conta Azul e fechar o CMV antes da fatura fechar. Como a
-- MESMA fatura é reimportada a cada semana, precisamos DEDUPLICAR: cada linha tem
-- uma chave estável (FITID do OFX quando existe; senão hash de banco+cartão+data+
-- valor+descrição+parcela). Reimportou → só o que é novo aparece; nunca lança 2x.
--
-- Uma fatura mistura bar 3 e bar 4 — por isso bar_id é CLASSIFICAÇÃO por linha
-- (escolhida na tela), não vem do arquivo.
-- ============================================================================

CREATE TABLE IF NOT EXISTS financial.cartao_fatura_linhas (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_hash             varchar NOT NULL UNIQUE,   -- FITID (OFX) ou hash estável
  banco                   varchar NOT NULL,          -- 'itau' | 'nubank'
  origem_formato          varchar NOT NULL,          -- 'xls' | 'csv' | 'ofx'
  fitid                   varchar,

  data_transacao          date NOT NULL,
  descricao               text NOT NULL,
  valor                   numeric(12,2) NOT NULL,    -- magnitude positiva da compra
  tipo                    varchar NOT NULL,          -- 'compra' | 'pagamento' | 'estorno'
  parcela                 varchar,                   -- "11/12" quando parcelado
  cartao_final            varchar,                   -- 4 últimos dígitos (Itaú traz; Nubank não)
  titular_nome            varchar,

  -- Classificação + lançamento (preenchidos na tela)
  bar_id                  integer,                   -- bar atribuído à linha
  categoria_id            varchar,                   -- categoria CA
  categoria_nome          varchar,
  contaazul_lancamento_id varchar,                   -- protocolId do CA (idempotência)

  status                  varchar NOT NULL DEFAULT 'novo',  -- 'novo' | 'lancado' | 'ignorado'
  importado_por           varchar,
  importado_em            timestamptz NOT NULL DEFAULT now(),
  atualizado_em           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cartao_fatura_status ON financial.cartao_fatura_linhas (status, data_transacao DESC);
CREATE INDEX IF NOT EXISTS idx_cartao_fatura_bar    ON financial.cartao_fatura_linhas (bar_id, data_transacao DESC);
CREATE INDEX IF NOT EXISTS idx_cartao_fatura_cartao ON financial.cartao_fatura_linhas (cartao_final);

GRANT SELECT, INSERT, UPDATE, DELETE ON financial.cartao_fatura_linhas TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
