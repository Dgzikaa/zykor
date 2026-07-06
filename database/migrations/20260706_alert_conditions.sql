-- ============================================================================
-- Construtor de Alertas (no-code) — regras de CONDIÇÃO montadas pelo admin
-- ----------------------------------------------------------------------------
-- Estende as Regras da Central de Notificações com condições sobre "sinais"
-- (métricas curadas): sinal + operador + limite (+ alvo) → dispara pelo
-- dispatchNotification (reusa canais/WhatsApp/inbox/alertas).
-- O admin cria/edita pela UI; o motor avalia e dispara com cooldown (anti-spam).
-- ============================================================================

create table if not exists system.alert_conditions (
  id              uuid primary key default gen_random_uuid(),
  bar_id          integer not null,
  signal_key      text not null,                    -- código do sinal (catálogo em signals.ts)
  operador        text not null default 'lt',       -- lt | lte | gt | gte | eq
  limite          numeric,                          -- valor de comparação (X); null p/ sinais sem limite
  alvo_id         text,                             -- alvo específico opcional (ex: código do insumo)
  alvo_label      text,                             -- rótulo do alvo (UI/mensagem)
  titulo          text,                             -- título custom do alerta (senão gera do sinal)
  severidade      text not null default 'alerta',   -- info|sucesso|alerta|critico
  canais          text[] not null default '{in_app}',
  target_roles    text[] not null default '{}',
  target_user_ids uuid[] not null default '{}',
  cooldown_horas  integer not null default 12,      -- não re-dispara o mesmo alvo dentro dessa janela
  ativo           boolean not null default true,
  criada_por      text,
  criada_em       timestamptz not null default now(),
  atualizada_em   timestamptz not null default now()
);

create index if not exists idx_alert_conditions_bar_ativo
  on system.alert_conditions (bar_id, ativo);

comment on table system.alert_conditions is
  'Regras de condição do construtor de alertas no-code (sinal+operador+limite+alvo → dispatchNotification).';

-- Estado de disparo p/ cooldown: última vez que cada (condição, alvo) disparou.
create table if not exists system.alert_condition_fires (
  condition_id  uuid not null references system.alert_conditions(id) on delete cascade,
  alvo_key      text not null default '',           -- entidade que disparou (ex: cód. insumo); '' = global
  last_fired_at timestamptz not null default now(),
  primary key (condition_id, alvo_key)
);

comment on table system.alert_condition_fires is
  'Cooldown do motor de alertas: quando cada (condição, alvo) disparou pela última vez.';

-- Só a service role (motor/API server) escreve/lê. RLS sem policies = nega anon/authenticated.
alter table system.alert_conditions enable row level security;
alter table system.alert_condition_fires enable row level security;
grant select, insert, update, delete on system.alert_conditions to service_role;
grant select, insert, update, delete on system.alert_condition_fires to service_role;
