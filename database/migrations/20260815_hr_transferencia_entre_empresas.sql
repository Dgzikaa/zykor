-- =============================================================================
-- Transferencia de funcionario entre empresas do grupo — 15/08/2026
-- =============================================================================
--
-- Pedido do Rodrigo: "pode acontecer de 1 funcionario estar trabalhando no ordinario e
-- daqui um tempo ir pro deboche, ai tem que ter essa parte que registramos a transferencia".
--
-- Ate aqui mudar alguem de empresa seria um UPDATE no bar_id: a pessoa simplesmente somia de
-- um bar e aparecia no outro, sem data e sem motivo. Quem olhasse o historico depois nao teria
-- como saber que houve transferencia — pareceria que ela sempre esteve la.
--
-- Serve tambem para a mudanca que motivou isso: as cadeiras administrativas estao penduradas
-- no bar 3 (Ordinario) e sao do bar 7 (Escritorio Central). Mover por aqui deixa rastro.
-- =============================================================================

create table if not exists hr.transferencias (
  id              uuid primary key default gen_random_uuid(),
  funcionario_id  integer not null references hr.funcionarios(id) on delete cascade,
  bar_origem      integer not null,
  bar_destino     integer not null,
  data            date not null default current_date,
  motivo          text,
  registrado_por  uuid,
  criado_em       timestamptz not null default now(),
  constraint transferencia_bares_diferentes check (bar_origem <> bar_destino)
);

create index if not exists idx_hr_transferencias_func
  on hr.transferencias (funcionario_id, data desc);

comment on table hr.transferencias is
  'Mudanca de empresa do grupo (ex.: Ordinario -> Deboche, ou -> Escritorio Central). O bar_id '
  'atual continua em hr.funcionarios; esta tabela e o RASTRO de como ele chegou nesse valor.';

-- -----------------------------------------------------------------------------
-- A TRAVA CONTRA A SYNC DO TANGERINO
--
-- `fn_tangerino_sync_funcionarios` resolve o bar pelo NOME do workplace ("...Ordinario" -> 3,
-- "...Deboche" -> 4) e faz `bar_id = COALESCE(workplace, atual)`. Sem uma trava, transferir
-- alguem que bate ponto seria desfeito na proxima sincronizacao, CALADO — que e o pior tipo
-- de bug: o usuario faz a acao, ve funcionar, e ela se desfaz sozinha horas depois.
--
-- Caso concreto ja identificado: DIEGO GALDINO e NATALIA DIAS estao no workplace "Producao
-- Ordinario" do Tangerino. Se forem pro Escritorio Central, voltariam sozinhos.
--
-- `bar_manual` marca "este bar foi decidido por uma pessoa, nao pelo workplace". A transferencia
-- liga a flag; a sync passa a respeitar.
-- -----------------------------------------------------------------------------
alter table hr.funcionarios
  add column if not exists bar_manual boolean not null default false;

comment on column hr.funcionarios.bar_manual is
  'true = o bar veio de uma transferencia registrada e a sync do Tangerino NAO pode sobrescrever. '
  'Sem isso, transferir quem bate ponto se desfaz sozinho na proxima sincronizacao.';
