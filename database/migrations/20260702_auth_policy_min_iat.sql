-- "Deslogar todo mundo" reutilizável: corte de emissão de token (min_iat). O authenticateUser
-- rejeita todo token com iat < min_iat (cache 60s) → o usuário cai no /login na próxima chamada
-- de API e refaz o login (passando a registrar sessão). Aciona via botão "Deslogar todos" na aba
-- Acessos (POST /api/configuracoes/auth/deslogar-todos, admin) que seta min_iat = agora.
create table if not exists system.auth_policy (
  id smallint primary key default 1,
  min_iat bigint not null default 0,
  updated_at timestamptz default now()
);
insert into system.auth_policy (id, min_iat) values (1, 0) on conflict (id) do nothing;
revoke all on system.auth_policy from anon, authenticated;
grant select, update on system.auth_policy to service_role;
