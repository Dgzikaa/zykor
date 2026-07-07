-- =====================================================================================
-- Rascunho de execução de produção — autosave server-side do cronômetro
-- =====================================================================================
-- Motivo (incidente cozinha, jul/2026): a produção em andamento (tempo + peso mestre/bruto +
-- rendimento + anotações) vivia SÓ no localStorage do tablet até clicar em "Encerrar".
-- Reload por deploy, descarte da aba pelo SO do tablet (pressão de memória) ou localStorage
-- cheio (QuotaExceeded, engolido silenciosamente) ZERAVAM tudo — a receita "sumia" do nada.
--
-- Agora a tela (aba Executar) faz autosave a cada ~10s aqui e ao reabrir HIDRATA daqui.
-- Chave estável = idempotencia_key (UUID gerado 1x por instância de produção no cliente, o
-- mesmo usado no anti-duplo-submit da execução final). Escopo por device_id: cada tablet só
-- recupera o que ele mesmo começou (evita um tablet "adotar"/finalizar produção de outro).
--
-- Tabela separada da producao_execucao de propósito: a final alimenta baselines/desvios/CMV.
-- Misturar rascunho lá exigiria filtrar status='rascunho' em N consumidores (frágil). Aqui é
-- isolado — some quando a produção é finalizada (backstop no POST) ou descartada.

CREATE TABLE IF NOT EXISTS operations.producao_execucao_rascunho (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bar_id           integer     NOT NULL,
  idempotencia_key text        NOT NULL,
  device_id        text,
  secao            text,
  producao_id      bigint,
  responsavel_id   integer,
  rodando          boolean     NOT NULL DEFAULT false,
  duracao_seg      integer,                       -- elapsed no último autosave (observabilidade)
  estado           jsonb       NOT NULL,          -- ActiveProd completo = fonte de hidratação
  atualizado_em    timestamptz NOT NULL DEFAULT now(),
  criado_em        timestamptz NOT NULL DEFAULT now(),
  criado_por       text,
  CONSTRAINT producao_execucao_rascunho_uk UNIQUE (bar_id, idempotencia_key)
);

-- kind distingue a origem: 'producao' (aba Executar) x 'alimentacao' (jantas da equipe).
-- Mesma mecânica de autosave/hidratação nas duas; o estado completo vai no jsonb.
ALTER TABLE operations.producao_execucao_rascunho
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'producao';

CREATE INDEX IF NOT EXISTS idx_prod_exec_rascunho_bar_device
  ON operations.producao_execucao_rascunho (bar_id, device_id);

-- Só service_role (via API autenticada) acessa. RLS on sem policy = deny-by-default para
-- anon/authenticated, alinhado ao hardening de grants (project_seguranca_anon_grants_hardening_2026_06).
ALTER TABLE operations.producao_execucao_rascunho ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON operations.producao_execucao_rascunho TO service_role;
