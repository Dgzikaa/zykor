-- ============================================================================
-- Fatura Cartão Aberto — modelo FATURA-FIRST (igual ao fechamento de freelas).
--
-- Fatura = Cartão (Banco + Tipo + Dono) + Vencimento. Só 1 fatura selecionada por vez
-- (garante que o total bate). Sobe-se o Excel dentro da fatura; reimportar atualiza. Ao
-- terminar o ciclo, "Encerrar fatura" (não é o fechamento do banco — é o ciclo que o
-- usuário fechou: subiu último Excel, lançou tudo, conciliou).
-- ============================================================================

-- 1) Cadastro de cartões (Banco + Tipo + Dono) — selecionável ao criar a fatura.
CREATE TABLE IF NOT EXISTS financial.cartao_cadastro (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id      integer NOT NULL,
  banco       varchar NOT NULL,        -- 'itau' | 'nubank' | ...
  tipo        varchar NOT NULL,        -- Azul, Latam, Ultravioleta
  dono        varchar NOT NULL,        -- Gonza, Cadu, Digão
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cartao_cadastro_bar ON financial.cartao_cadastro (bar_id, ativo);

-- 2) Faturas (uma por cartão + vencimento). Podem existir 2 abertas do mesmo cartão.
CREATE TABLE IF NOT EXISTS financial.cartao_faturas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id          integer NOT NULL,
  cartao_id       uuid NOT NULL REFERENCES financial.cartao_cadastro(id),
  vencimento      date NOT NULL,
  valor_informado numeric(12,2),       -- total do banco (conferência), opcional
  status          varchar NOT NULL DEFAULT 'aberta',  -- 'aberta' | 'encerrada'
  encerrada_em    timestamptz,
  encerrada_por   varchar,
  criado_por      varchar,
  created_at      timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cartao_faturas_bar ON financial.cartao_faturas (bar_id, status, vencimento DESC);

-- 3) Linhas passam a pertencer a uma FATURA. Dedupe passa a ser POR FATURA
--    (reimportar a mesma fatura atualiza; faturas diferentes são independentes).
ALTER TABLE financial.cartao_fatura_linhas
  ADD COLUMN IF NOT EXISTS fatura_id uuid REFERENCES financial.cartao_faturas(id) ON DELETE CASCADE;

-- Remove a unicidade GLOBAL do dedupe_hash e cria por (fatura_id, dedupe_hash).
ALTER TABLE financial.cartao_fatura_linhas DROP CONSTRAINT IF EXISTS cartao_fatura_linhas_dedupe_hash_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cartao_linha_fatura_dedupe
  ON financial.cartao_fatura_linhas (fatura_id, dedupe_hash);

-- Linhas soltas antigas (testes, sem fatura) saem — o modelo agora é por fatura.
DELETE FROM financial.cartao_fatura_linhas WHERE fatura_id IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON financial.cartao_cadastro TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON financial.cartao_faturas   TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
