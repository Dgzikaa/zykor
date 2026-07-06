-- ============================================================================
-- Central de Alertas — tracking de cliques (atribuição por origem)
-- ----------------------------------------------------------------------------
-- Registra cada abertura da /alertas com um `source` (ex: whatsapp, push, sino).
-- Serve pra medir quantos cliques vieram do WhatsApp (botão do template zykor_alerta).
-- Escrito pela API POST /api/alertas/click (service role). Leitura = admin/relatório.
-- ============================================================================

create table if not exists system.alerta_clicks (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid,
  bar_id      integer,
  source      text not null,          -- 'whatsapp' | 'push' | 'sino' | 'direto' ...
  alerta_id   uuid,                    -- opcional: id da notificação/alerta clicado
  criada_em   timestamptz not null default now()
);

create index if not exists idx_alerta_clicks_source on system.alerta_clicks (source, criada_em desc);
create index if not exists idx_alerta_clicks_bar    on system.alerta_clicks (bar_id, criada_em desc);

comment on table system.alerta_clicks is
  'Cliques/aberturas de alertas por origem (atribuição: whatsapp/push/sino). Escrito por /api/alertas/click.';

-- Só a service role (server) escreve/lê. RLS ligado sem policies = nega anon/authenticated.
alter table system.alerta_clicks enable row level security;
grant select, insert on system.alerta_clicks to service_role;
