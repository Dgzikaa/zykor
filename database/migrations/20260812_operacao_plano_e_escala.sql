-- =============================================================================
-- Módulo OPERAÇÃO: plano operacional + escala — 12/08/2026
-- =============================================================================
--
-- Traz pro Zykor duas planilhas que hoje são a fonte da verdade da operação do Ordinário:
--   "Plano Operacional Semanal - Ordinário" (aba viva: AGOSTO 2026)
--   "ESCALA ORDI!"                          (aba viva: 52 semanas do ano)
--
-- DECISÃO (Rodrigo, 12/08): o Zykor passa a ser a fonte — não é sync de Sheets. O histórico
-- entra por backfill até o fim de agosto e SETEMBRO já é desenhado aqui.
--
-- COMO A PLANILHA CALCULA (fórmulas lidas do arquivo, não deduzidas):
--   publico  = faturamento_previsto / ticket_medio_do_dia
--   pico     = publico / giro                                    (giro = 1,3)
--   total_f  = ARREDONDA.PARA.CIMA(pico / nivel_servico_da_funcao)
--   fixos    -> digitado à mão (é o que a escala passa a alimentar)
--   freelas  = MAX(0, total - fixos)
--   custo_f  = freelas * diaria_da_funcao
--   custo    = soma das funções + segurança
-- O custo projetado é SÓ FREELA — o fixo é CLT e não entra (é o CMO variável).
--
-- DOIS ERROS DA PLANILHA QUE **NÃO** SÃO REPRODUZIDOS AQUI:
--   1. `publico = faturamento / $FA$4` está travado no ticket de SEGUNDA em todos os dias,
--      embora exista ticket por dia da semana logo abaixo. Sexta usava 103 em vez de 113,
--      superestimando o público e escalando gente demais. Aqui o ticket é o do dia.
--   2. A coluna "SÁBADO - NOITE" vinha datada com o domingo. Aqui a data é a data.
--
-- SEMANA NÃO É COLUNA. A planilha tem TRÊS numerações conflitantes (o plano chama 03/08 de
-- "SEMANA 28", a escala de 32, o ISO de 32) e é isso que torna dolorido o mês que começa no
-- dia 03. Aqui a chave é DATA; semana e mês são recortes derivados na leitura.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Catálogo de funções (por bar — cada casa tem a sua operação)
-- -----------------------------------------------------------------------------
create table if not exists operations.operacao_funcao (
  id            uuid primary key default gen_random_uuid(),
  bar_id        integer not null,
  codigo        text    not null,
  nome          text    not null,
  -- Liderança e Produção existem na escala mas ficam FORA do custo projetado: são CLT fixo
  -- e nunca viram freela. Aparecem no headcount e na tela de escala (decisão Rodrigo 12/08).
  entra_no_custo boolean not null default true,
  -- Seções da escala que mapeiam nesta função (a planilha escreve "RECEPÇÃO" pro Host e
  -- "BARTENDER/BACK DRINKS" pro Bartender). Usado pelo importador e pela contagem de fixos.
  aliases_escala text[] not null default '{}',
  ordem         integer not null default 0,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (bar_id, codigo)
);

comment on table operations.operacao_funcao is
  'Funções da operação por bar (garçom, cumim, host...). entra_no_custo=false para quem '
  'aparece na escala mas não entra no custo projetado (Liderança, Produção).';

-- -----------------------------------------------------------------------------
-- 2. Parâmetros — versionados por vigência
--    Mudar o nível de serviço hoje NÃO pode reescrever o custo projetado de junho.
--    Mesma lição do preço as-of do CMV teórico.
-- -----------------------------------------------------------------------------
create table if not exists operations.operacao_parametro (
  id               uuid primary key default gen_random_uuid(),
  bar_id           integer not null,
  vigencia_inicio  date not null,
  vigencia_fim     date,                     -- null = vigente
  giro             numeric(6,3) not null,    -- lotação: público / giro = pico de lugares
  observacao       text,
  criado_por       uuid,
  created_at       timestamptz not null default now(),
  check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);

-- Ticket médio por dia da semana (0=domingo … 6=sábado, igual ao extract(dow)).
create table if not exists operations.operacao_parametro_ticket (
  parametro_id uuid not null references operations.operacao_parametro(id) on delete cascade,
  dia_semana   smallint not null check (dia_semana between 0 and 6),
  ticket_medio numeric(10,2) not null,
  primary key (parametro_id, dia_semana)
);

-- Nível de serviço (quantas pessoas 1 funcionário atende) e diária de freela, por função.
create table if not exists operations.operacao_parametro_funcao (
  parametro_id   uuid not null references operations.operacao_parametro(id) on delete cascade,
  funcao_id      uuid not null references operations.operacao_funcao(id) on delete cascade,
  nivel_servico  numeric(10,2),   -- null = função sem cálculo automático de total
  diaria         numeric(10,2),   -- null = função que não vira freela
  primary key (parametro_id, funcao_id)
);

comment on table operations.operacao_parametro is
  'Parâmetros do plano operacional com vigência. Bloco "Parâmetros - não mexer" da planilha.';

-- -----------------------------------------------------------------------------
-- 3. O dia planejado
--    turno resolve o sábado partido em DIA/NOITE sem inventar data falsa.
-- -----------------------------------------------------------------------------
do $$ begin
  create type operations.operacao_turno as enum ('unico', 'dia', 'noite');
exception when duplicate_object then null; end $$;

create table if not exists operations.operacao_dia (
  id                    uuid primary key default gen_random_uuid(),
  bar_id                integer not null,
  data                  date not null,
  turno                 operations.operacao_turno not null default 'unico',

  -- Entrada manual (branco na planilha)
  faturamento_previsto  numeric(12,2),

  -- Calculado + override (verde / amarelo). O manual nunca apaga o calculado.
  publico_calculado     numeric(10,2),
  publico_manual        numeric(10,2),
  pico_calculado        numeric(10,2),
  pico_manual           numeric(10,2),

  -- Contexto do dia
  programacao_musical   text,
  programacao_esportiva text,
  entrada               text,
  promocao              text,
  plano_chao            text,
  pilula_treinamento    text,
  observacoes           text,

  -- Dia atípico (festival, feriado): permite parâmetro próprio em vez do padrão do dia da semana.
  data_especial         text,
  ticket_medio_manual   numeric(10,2),
  giro_manual           numeric(6,3),

  atualizado_por        uuid,
  created_at            timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  unique (bar_id, data, turno)
);

create index if not exists idx_operacao_dia_bar_data on operations.operacao_dia (bar_id, data);

comment on column operations.operacao_dia.publico_manual is
  'Override do público calculado. Preenchido = célula amarela na tela (automático com input manual).';

-- -----------------------------------------------------------------------------
-- 4. Quadro por função no dia
--    fixos_escala vem contado da escala; fixos_manual sobrepõe quando precisa.
-- -----------------------------------------------------------------------------
create table if not exists operations.operacao_dia_funcao (
  id              uuid primary key default gen_random_uuid(),
  operacao_dia_id uuid not null references operations.operacao_dia(id) on delete cascade,
  funcao_id       uuid not null references operations.operacao_funcao(id),
  total_calculado integer,
  total_manual    integer,
  fixos_escala    integer not null default 0,
  fixos_manual    integer,
  atualizado_em   timestamptz not null default now(),
  unique (operacao_dia_id, funcao_id)
);

-- freelas e custo NÃO são colunas: derivam de total/fixos/diária e mudariam sozinhos se
-- o parâmetro mudasse. Ficam na view v_operacao_dia_custo abaixo.

-- -----------------------------------------------------------------------------
-- 5. Escala — uma linha por pessoa/dia
--    A planilha guarda Entra/Sai/Total e os marcadores FOLGA, FÉRIAS, ABRE, FECHA.
--    O intervalo (1h ou 2h) não é campo: é a diferença entre (sai - entra) e horas.
-- -----------------------------------------------------------------------------
create table if not exists operations.escala_dia (
  id             uuid primary key default gen_random_uuid(),
  bar_id         integer not null,
  data           date not null,
  funcao_id      uuid not null references operations.operacao_funcao(id),
  -- A planilha só tem primeiro nome ("NAYARA", dois "ALEXANDRE" na mesma seção). O vínculo
  -- com funcionário/ponto/Solides fica pra depois (decisão Rodrigo: largar o Excel primeiro).
  pessoa_nome    text not null,
  funcionario_id uuid,
  entra          time,
  sai            time,
  horas          numeric(5,2),        -- total da planilha, já líquido do intervalo
  marcador       text,                -- FOLGA | FERIAS | ABRE | FECHA | ATESTADO...
  turno          operations.operacao_turno not null default 'unico',
  origem         text not null default 'zykor',   -- 'planilha' no backfill
  created_at     timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (bar_id, data, funcao_id, pessoa_nome)
);

create index if not exists idx_escala_dia_bar_data on operations.escala_dia (bar_id, data);

comment on column operations.escala_dia.turno is
  'Derivado do horário de entrada no import (entrada < 14h = dia). Valida contra a planilha: '
  'sábado 08/08 tinha 4 garçons entrando 11:00 e 5 entrando 17:00, e o plano marcava '
  'SÁBADO-DIA=4 / SÁBADO-NOITE=5.';

-- -----------------------------------------------------------------------------
-- 6. View de leitura: resolve calculado x manual e devolve freelas + custo
-- -----------------------------------------------------------------------------
create or replace view operations.v_operacao_dia_funcao as
select
  df.id,
  d.bar_id,
  d.data,
  d.turno,
  d.id                                    as operacao_dia_id,
  f.id                                    as funcao_id,
  f.codigo                                as funcao_codigo,
  f.nome                                  as funcao_nome,
  f.entra_no_custo,
  f.ordem                                 as funcao_ordem,
  df.total_calculado,
  df.total_manual,
  coalesce(df.total_manual, df.total_calculado, 0)                    as total,
  df.fixos_escala,
  df.fixos_manual,
  coalesce(df.fixos_manual, df.fixos_escala, 0)                       as fixos,
  greatest(
    coalesce(df.total_manual, df.total_calculado, 0)
    - coalesce(df.fixos_manual, df.fixos_escala, 0), 0)               as freelas,
  pf.diaria,
  case when f.entra_no_custo then
    greatest(
      coalesce(df.total_manual, df.total_calculado, 0)
      - coalesce(df.fixos_manual, df.fixos_escala, 0), 0) * coalesce(pf.diaria, 0)
  else 0 end                                                          as custo,
  -- Estado da célula pra UI: branco (manual puro) / verde (automático) / amarelo (auto + override)
  case
    when df.total_manual is not null and df.total_calculado is not null then 'amarelo'
    when df.total_calculado is not null                                 then 'verde'
    else 'branco'
  end                                                                 as total_origem
from operations.operacao_dia_funcao df
join operations.operacao_dia    d on d.id = df.operacao_dia_id
join operations.operacao_funcao f on f.id = df.funcao_id
left join lateral (
  select pf.diaria
  from operations.operacao_parametro p
  join operations.operacao_parametro_funcao pf on pf.parametro_id = p.id and pf.funcao_id = f.id
  where p.bar_id = d.bar_id
    and p.vigencia_inicio <= d.data
    and (p.vigencia_fim is null or p.vigencia_fim >= d.data)
  order by p.vigencia_inicio desc
  limit 1
) pf on true;

comment on view operations.v_operacao_dia_funcao is
  'Leitura do quadro por função: resolve calculado x manual, deriva freelas e custo com a '
  'diária VIGENTE NA DATA (parâmetro versionado — mudar hoje não reescreve o passado).';

-- -----------------------------------------------------------------------------
-- 7. Seed do Ordinário (bar 3) — funções e parâmetros lidos da planilha
-- -----------------------------------------------------------------------------
insert into operations.operacao_funcao (bar_id, codigo, nome, entra_no_custo, aliases_escala, ordem)
values
  (3, 'garcom',    'Garçom',           true,  array['GARÇOM','GARCOM'],                        1),
  (3, 'cumim',     'Cumim',            true,  array['CUMIM'],                                  2),
  (3, 'host',      'Host',             true,  array['RECEPÇÃO','RECEPCAO','HOST'],             3),
  (3, 'asg',       'ASG',              true,  array['ASG'],                                    4),
  (3, 'bartender', 'Bartender',        true,  array['BARTENDER/BACK DRINKS','BARTENDER'],      5),
  (3, 'barback',   'Barback',          true,  array['BARBACK'],                                6),
  (3, 'cozinha',   'Cozinha',          true,  array['COZINHA'],                                7),
  (3, 'seguranca', 'Segurança',        true,  array['SEGURANÇA','SEGURANCA'],                  8),
  (3, 'brigadista','Brigadista',       true,  array['BRIGADA','BRIGADISTA'],                   9),
  (3, 'lideranca', 'Liderança',        false, array['LIDERANÇA','LIDERANCA'],                 10),
  (3, 'producao',  'Produção',         false, array['PRODUÇÃO','PRODUCAO'],                   11)
on conflict (bar_id, codigo) do nothing;

-- Parâmetros vigentes do Ordinário (bloco FA da aba AGOSTO 2026).
with p as (
  insert into operations.operacao_parametro (bar_id, vigencia_inicio, giro, observacao)
  select 3, date '2026-01-01', 1.3,
         'Importado do bloco "Parâmetros - não mexer" da planilha Plano Operacional (aba AGOSTO 2026).'
  where not exists (
    select 1 from operations.operacao_parametro where bar_id = 3 and vigencia_fim is null
  )
  returning id
)
insert into operations.operacao_parametro_ticket (parametro_id, dia_semana, ticket_medio)
select p.id, v.dow, v.ticket
from p, (values (1,103.00),(2,103.00),(3,106.00),(4,105.00),(5,113.00),(6,103.00),(0,105.00))
        as v(dow, ticket);

insert into operations.operacao_parametro_funcao (parametro_id, funcao_id, nivel_servico, diaria)
select p.id, f.id, v.nivel, v.diaria
from operations.operacao_parametro p
join (values
        ('garcom',     38.0, 170.00),
        ('cumim',      47.0, 130.00),
        ('host',      150.0, 120.00),
        ('asg',       125.0, 130.00),
        ('bartender', 150.0, 160.00),
        ('barback',   150.0, 130.00),
        ('cozinha',   150.0, 130.00),
        ('seguranca', 200.0, 190.00),
        ('brigadista',600.0, 190.00)
     ) as v(codigo, nivel, diaria) on true
join operations.operacao_funcao f on f.bar_id = p.bar_id and f.codigo = v.codigo
where p.bar_id = 3 and p.vigencia_fim is null
on conflict (parametro_id, funcao_id) do nothing;

-- -----------------------------------------------------------------------------
-- 8. Grants — anon NUNCA lê operação (dado sensível de custo de pessoal)
-- -----------------------------------------------------------------------------
revoke all on operations.operacao_funcao,
              operations.operacao_parametro,
              operations.operacao_parametro_ticket,
              operations.operacao_parametro_funcao,
              operations.operacao_dia,
              operations.operacao_dia_funcao,
              operations.escala_dia
  from anon;

revoke all on operations.v_operacao_dia_funcao from anon;
