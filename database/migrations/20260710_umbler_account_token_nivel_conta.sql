-- ============================================================================
-- Token da Umbler é da CONTA (uma conta serve os 2 bares; a diferença por bar/
-- finalidade é o CANAL/número, não a conta). Singleton id=1 com organization_id
-- + api_token. O resolver (frontend/src/lib/umbler.ts → getUmblerToken) lê daqui
-- com fallback pro env UMBLER_API_TOKEN.
--
-- Contexto: antes o token vinha de umbler_config.api_token por bar, que ficou
-- STALE (401) por volta de abr/26 (o sync de umbler_mensagens congelou em 16/04).
-- Migrado pra conta única, gerenciável na tela /configuracoes/integracoes/umbler.
-- ============================================================================
create table if not exists integrations.umbler_account (
  id smallint primary key default 1,
  organization_id text,
  api_token text not null default '',
  updated_at timestamptz not null default now(),
  constraint umbler_account_singleton check (id = 1)
);

-- Seed: org conhecida; token vazio (cai no env até colarem um na tela).
insert into integrations.umbler_account (id, organization_id, api_token)
values (1, 'aDjKophL8jEd_D8m', '')
on conflict (id) do nothing;

-- A API usa o service role client (bypassa RLS). Grants explícitos por garantia.
grant usage on schema integrations to service_role;
grant all on integrations.umbler_account to service_role;

-- PostgREST precisa recarregar o schema pra enxergar a tabela nova.
notify pgrst, 'reload schema';
