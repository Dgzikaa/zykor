-- Encerrar sessão de UM usuário (ex.: notebook esquecido logado). auth_custom.usuarios é VIEW →
-- não dá pra adicionar coluna; usa-se uma tabela própria de cortes por usuário. Poucas linhas; o
-- authenticateUser carrega o mapa inteiro cacheado (60s), sem custo por request. Botão "encerrar"
-- na aba Acessos → POST /api/configuracoes/auth/encerrar-sessao seta min_iat=agora pra o email.
create table if not exists system.user_token_cutoff (
  email text primary key,
  min_iat bigint not null,
  updated_at timestamptz default now()
);
revoke all on system.user_token_cutoff from anon, authenticated;
grant select, insert, update, delete on system.user_token_cutoff to service_role;
