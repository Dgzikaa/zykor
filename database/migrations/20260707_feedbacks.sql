-- ============================================================================
-- Widget de Feedback — mensagens da equipe por tela
-- ----------------------------------------------------------------------------
-- Qualquer usuário envia feedback pelo widget flutuante; grava quem + a tela
-- (rota) + a mensagem. Admin revisa em /configuracoes/feedbacks.
-- Escrito por /api/feedback (service role). Aplicada em prod 07/jul/2026.
-- ============================================================================

create table if not exists system.feedbacks (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid,
  usuario_nome  text,
  email         text,
  bar_id        integer,
  rota          text,               -- tela onde a pessoa estava (pathname)
  mensagem      text not null,
  user_agent    text,
  status        text not null default 'novo',  -- novo | lido | resolvido | descartado
  resposta      text,               -- nota interna do admin (opcional)
  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);

create index if not exists idx_feedbacks_status on system.feedbacks (status, criada_em desc);

comment on table system.feedbacks is
  'Feedbacks enviados pelos usuários pelo widget flutuante (capta quem + tela + mensagem). Escrito por /api/feedback.';

alter table system.feedbacks enable row level security;
grant select, insert, update on system.feedbacks to service_role;
