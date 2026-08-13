-- =============================================================================
-- escala_dia.funcionario_id: uuid -> integer (o id do RH e integer) — 13/08/2026
-- =============================================================================
--
-- BUG em producao no de-para: "invalid input syntax for type uuid: 60".
--
-- A coluna nasceu ESPECULATIVA na migration do modulo ("o vinculo com funcionario/ponto
-- fica pra depois") e o tipo foi um chute: uuid. Mas hr.funcionarios.id e INTEGER — todo
-- o RH usa serial. Enquanto ninguem vinculava, o erro dormiu; apareceu no primeiro
-- "Aceitar as sugestoes".
--
-- Conversao e trivial: 0 das 10.273 linhas tem vinculo. Nada se perde.
--
-- A FK entra junto de proposito. Ela e o que impede a proxima versao deste mesmo erro:
-- com ela, apontar pra um funcionario que nao existe passa a estourar na hora em vez de
-- gravar um id orfao que so apareceria meses depois numa tela vazia.
-- ON DELETE SET NULL porque apagar um funcionario nao pode apagar a escala dele — o
-- historico da pessoa continua valendo pro planejado x realizado.
-- =============================================================================

alter table operations.escala_dia
  alter column funcionario_id type integer using (null::integer);

alter table operations.escala_dia
  drop constraint if exists escala_dia_funcionario_id_fkey;

alter table operations.escala_dia
  add constraint escala_dia_funcionario_id_fkey
  foreign key (funcionario_id) references hr.funcionarios(id) on delete set null;

create index if not exists idx_escala_dia_funcionario
  on operations.escala_dia (funcionario_id) where funcionario_id is not null;

comment on column operations.escala_dia.funcionario_id is
  'Vinculo com hr.funcionarios (INTEGER, nao uuid). Preenchido pelo de-para da tela de '
  'Escala. E o que traz genero e dias_trabalho_semana para a automacao de escala.';
