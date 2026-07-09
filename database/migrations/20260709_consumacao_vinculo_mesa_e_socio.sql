-- 2026-07-09 — Consumação: vínculo por MESA (pessoa) + override de categoria.
-- Objetivo: agrupar/consolidar consumações da mesma pessoa e corrigir categoria errada na
-- origem (ex.: "X Dj Jess" veio com motivo "Funcionário Operação" mas é artista). O vínculo é
-- por mesa NORMALIZADA (colapsa "X Fidelidade"/"X-Fidelidade"/"XFidelidade") — a normalização é
-- feita na API (upper + só alfanumérico), então aqui a coluna só guarda a string normalizada.
--
-- Não mexe no classificador pesado (classificar_consumo_padrao): a categoria efetiva é resolvida
-- na rota da tela (override > tipo do vínculo > motivo original).

-- cadastro de sócios (espelha operations.bar_artistas)
create table if not exists financial.consumo_socio (
  id bigint generated always as identity primary key,
  bar_id int not null,
  nome text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index if not exists ux_consumo_socio_bar_nome
  on financial.consumo_socio(bar_id, lower(nome));

-- vínculo por mesa normalizada → entidade cadastrada + override de categoria
create table if not exists financial.consumo_mesa_vinculo (
  bar_id int not null,
  mesa_norm text not null,          -- mesa normalizada (chave)
  mesa_label text,                  -- grafia mais recente (exibição)
  tipo text,                        -- artista | socio | funcionario | cliente | outro
  artista_id bigint,                -- ref operations.bar_artistas (quando tipo=artista)
  socio_id bigint,                  -- ref financial.consumo_socio (quando tipo=socio)
  entidade_nome text,               -- nome canônico exibido
  categoria_override text,          -- uma das 9 chaves da consumação, opcional
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (bar_id, mesa_norm)
);
create index if not exists ix_consumo_mesa_vinculo_bar on financial.consumo_mesa_vinculo(bar_id);

grant select, insert, update, delete on financial.consumo_socio to service_role, authenticated;
grant select, insert, update, delete on financial.consumo_mesa_vinculo to service_role, authenticated;
