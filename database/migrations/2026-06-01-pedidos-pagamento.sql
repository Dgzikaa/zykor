-- ============================================================================
-- Módulo "Pedidos de Pagamento" — substitui o grupo de WhatsApp de pagamentos.
--
-- Qualquer funcionário abre um pedido (reembolso / fornecedor / avulso /
-- adiantamento). O financeiro (David) revisa, comenta, ajusta e aprova; ao
-- aprovar, o sistema cria a conta a pagar no Conta Azul e agenda o PIX no Inter
-- (motor que já existe em /api/financeiro/contaazul/lancamentos e
-- /api/financeiro/inter/pix). Vínculo com o CA (pessoa/contato, categoria,
-- centro de custo, conta pagadora) só acontece no momento da aprovação.
--
-- O schema `financial` já está exposto no PostgREST (pix_enviados funciona via
-- supabase.schema('financial')); por isso só precisamos dos GRANTs + reload.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Pedido
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financial.pedidos_pagamento (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                   varchar,                       -- legível, ex PD-2026-0001 (fase 2)
  bar_id                   integer NOT NULL,
  tipo                     varchar NOT NULL,              -- 'reembolso'|'fornecedor'|'avulso'|'adiantamento'
  status                   varchar NOT NULL DEFAULT 'aguardando_aprovacao',
                           -- rascunho | aguardando_aprovacao | aprovado | agendado | pago
                           -- | erro_ca | erro_inter | rejeitado | cancelado

  -- Quem pediu
  solicitante_id           varchar,                       -- usuarios.auth_id
  solicitante_nome         varchar,

  -- Conteúdo do pedido (preenchido pelo solicitante)
  descricao                text NOT NULL,
  valor                    numeric(12,2) NOT NULL,
  data_competencia         date,
  data_vencimento          date NOT NULL,
  beneficiario_nome        varchar,
  chave_pix                varchar,
  tipo_chave               varchar,                       -- CPF|CNPJ|EMAIL|TELEFONE|CHAVE_ALEATORIA
  cpf_cnpj                 varchar,
  observacao               text,

  -- Preenchido pelo financeiro na aprovação (vínculo Conta Azul / Inter)
  categoria_id             varchar,                       -- UUID CA
  categoria_nome           varchar,
  centro_custo_id          varchar,                       -- UUID CA
  centro_custo_nome        varchar,
  contaazul_pessoa_id      varchar,                       -- UUID contato/fornecedor no CA
  conta_financeira_id      varchar,                       -- UUID conta pagadora no CA
  inter_credencial_id      integer,                       -- api_credentials.id (sistema inter)

  -- Resultado da execução
  contaazul_lancamento_id  varchar,                       -- protocolId devolvido pelo CA
  inter_codigo_solicitacao varchar,                       -- código do PIX no Inter
  erro_mensagem            text,

  -- Decisão
  aprovado_por_id          varchar,
  aprovado_por_nome        varchar,
  aprovado_em              timestamptz,
  rejeitado_por_id         varchar,
  rejeitado_por_nome       varchar,
  rejeitado_em             timestamptz,
  motivo_rejeicao          text,
  pago_em                  timestamptz,

  criado_por               varchar,
  atualizado_por           varchar,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_pag_bar_status
  ON financial.pedidos_pagamento (bar_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_pag_solicitante
  ON financial.pedidos_pagamento (solicitante_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Comentários (thread solicitante ↔ financeiro)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financial.pedidos_pagamento_comentarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id   uuid NOT NULL REFERENCES financial.pedidos_pagamento(id) ON DELETE CASCADE,
  bar_id      integer NOT NULL,
  autor_id    varchar,
  autor_nome  varchar,
  mensagem    text NOT NULL,
  tipo        varchar NOT NULL DEFAULT 'comentario',  -- 'comentario' | 'sistema'
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_pag_coment_pedido
  ON financial.pedidos_pagamento_comentarios (pedido_id, created_at);

-- ---------------------------------------------------------------------------
-- 3. Anexos (foto da nota / cupom / boleto)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financial.pedidos_pagamento_anexos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       uuid NOT NULL REFERENCES financial.pedidos_pagamento(id) ON DELETE CASCADE,
  bar_id          integer NOT NULL,
  nome_original   varchar,
  tipo_arquivo    varchar,
  tamanho_bytes   bigint,
  caminho_storage varchar NOT NULL,
  url_publica     varchar,
  uploadado_por   varchar,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_pag_anexos_pedido
  ON financial.pedidos_pagamento_anexos (pedido_id);

-- ---------------------------------------------------------------------------
-- 4. Histórico de edições / transições (auditoria)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financial.pedidos_pagamento_historico (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       uuid NOT NULL REFERENCES financial.pedidos_pagamento(id) ON DELETE CASCADE,
  bar_id          integer NOT NULL,
  autor_id        varchar,
  autor_nome      varchar,
  campo           varchar,            -- nome do campo alterado, ou 'status'
  valor_anterior  text,
  valor_novo      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_pag_hist_pedido
  ON financial.pedidos_pagamento_historico (pedido_id, created_at);

-- ---------------------------------------------------------------------------
-- Trigger updated_at (função compartilhada public.update_updated_at_column)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_pedidos_pagamento_updated_at ON financial.pedidos_pagamento;
CREATE TRIGGER update_pedidos_pagamento_updated_at
  BEFORE UPDATE ON financial.pedidos_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Grants pro PostgREST enxergar (mesmo padrão das outras tabelas em financial)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA financial TO authenticated, service_role, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON financial.pedidos_pagamento             TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON financial.pedidos_pagamento_comentarios TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON financial.pedidos_pagamento_anexos      TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON financial.pedidos_pagamento_historico   TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
