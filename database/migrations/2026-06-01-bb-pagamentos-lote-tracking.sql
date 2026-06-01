-- ============================================================================
-- Tracking de pagamentos via API Pagamentos em Lote do Banco do Brasil
--
-- Modelo: 1 lote (financial.bb_lotes) → N lançamentos (financial.bb_lote_lancamentos).
-- Diferente do PIX avulso do Inter (financial.pix_enviados), porque o BB trabalha
-- por lote com liquidação assíncrona (consulta, sem webhook).
--
-- NÃO APLICADA AINDA — aplicar quando o convênio PAG do BB estiver liberado.
-- O schema `financial` já está exposto no PostgREST (pix_enviados funciona via
-- supabase.schema('financial')); por isso só precisamos dos GRANTs abaixo.
-- ============================================================================

CREATE TABLE IF NOT EXISTS financial.bb_lotes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id              integer NOT NULL,
  bb_credencial_id    integer NOT NULL,           -- api_credentials.id (sistema=banco_brasil)
  tipo                varchar NOT NULL,            -- 'transferencias' | 'boletos' | 'tributos'
  numero_requisicao   varchar,                     -- id devolvido pelo BB
  estado              varchar NOT NULL DEFAULT 'criado', -- criado|liberado|liquidado|erro|parcial
  quantidade          integer NOT NULL DEFAULT 0,
  valor_total         numeric NOT NULL DEFAULT 0,
  bb_response         jsonb,                       -- payload bruto de criação
  last_consulta_at    timestamptz,
  last_consulta_payload jsonb,
  erro_mensagem       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bb_lotes_bar ON financial.bb_lotes (bar_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bb_lotes_requisicao ON financial.bb_lotes (numero_requisicao);

CREATE TABLE IF NOT EXISTS financial.bb_lote_lancamentos (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id                 uuid NOT NULL REFERENCES financial.bb_lotes(id) ON DELETE CASCADE,
  bar_id                  integer NOT NULL,
  pagamento_zykor_id      varchar,                 -- correlação com a lista da tela
  tipo                    varchar NOT NULL,        -- 'pix'|'ted'|'boleto'|'tributo'
  valor                   numeric NOT NULL,
  data_pagamento          date,
  beneficiario            jsonb,                   -- nome/chave/banco/agencia/conta etc
  contaazul_lancamento_id varchar,                 -- conta a pagar criada no CA
  bb_status               varchar,                 -- status devolvido pelo BB por lançamento
  status                  varchar NOT NULL DEFAULT 'pendente', -- pendente|enviado|agendado|liquidado|erro
  erro_mensagem           text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bb_lanc_lote ON financial.bb_lote_lancamentos (lote_id);
CREATE INDEX IF NOT EXISTS idx_bb_lanc_zykor ON financial.bb_lote_lancamentos (pagamento_zykor_id);

-- Grants pro PostgREST enxergar (mesmo padrão das outras tabelas em financial)
GRANT USAGE ON SCHEMA financial TO authenticated, service_role, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON financial.bb_lotes TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON financial.bb_lote_lancamentos TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
