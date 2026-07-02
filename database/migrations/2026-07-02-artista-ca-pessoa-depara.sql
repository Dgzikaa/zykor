-- De-para favorecido do Conta Azul -> artista do cadastro.
-- Resolve os casos em que o pagamento sai no nome de pessoa física / produtora
-- (ex: "Ana Paula Martins Produções Ltda" = banda "7 na Roda"), que o casamento
-- por nome nunca pega. Mapeado uma vez na tela de tagging, vale pra eventos futuros.
create table if not exists operations.artista_ca_pessoa (
  id bigserial primary key,
  bar_id integer not null,
  ca_pessoa_nome text not null,
  artista_id integer not null references operations.bar_artistas(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists artista_ca_pessoa_uq
  on operations.artista_ca_pessoa (bar_id, lower(ca_pessoa_nome));

grant select, insert, update, delete on operations.artista_ca_pessoa to service_role;
grant usage, select on sequence operations.artista_ca_pessoa_id_seq to service_role;
