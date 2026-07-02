-- Ferramenta "corrigir dia" da tela de tagging de atrações.
-- Problema: o Conta Azul arquiva o cachê pela data do PAGAMENTO (data_competencia),
-- que atrasa dias/semanas em relação ao dia do SHOW. Aí a grana cai no evento errado
-- e aparece como "CA sem match". Ver memória project_ca_cache_data_pagamento_vs_show.
--
-- Solução: override persistente por lançamento (contaazul_id) que remaneja o cachê
-- pro evento/artista certo. O cachê corrigido é gravado em evento_artistas.c_art
-- (fonte que a análise /analitico/atracoes usa), derivado da soma dos overrides.

create table if not exists operations.ca_atracao_override (
  id             bigserial primary key,
  bar_id         integer not null,
  contaazul_id   uuid    not null,            -- lançamento do CA (estável, aguenta re-sync e parcelas)
  evento_id      integer not null,            -- evento alvo (eventos_base.id)
  data_evento    date    not null,            -- dia do show alvo (redundante, p/ display)
  artista_id     integer not null references operations.bar_artistas(id) on delete cascade,
  valor          numeric not null default 0,  -- valor_liquido do lançamento (p/ derivar o c_art)
  pessoa_nome    text,                         -- favorecido do CA (display)
  descricao      text,                         -- descrição do CA (display)
  data_competencia date,                       -- dia onde o pagamento caía (origem, p/ display/undo)
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create unique index if not exists ca_atracao_override_uq
  on operations.ca_atracao_override (bar_id, contaazul_id);
create index if not exists ca_atracao_override_evento_idx
  on operations.ca_atracao_override (bar_id, evento_id, artista_id);

grant select, insert, update, delete on operations.ca_atracao_override to service_role;
grant usage, select on sequence operations.ca_atracao_override_id_seq to service_role;

-- RPC de lançamentos de atração do CA — agora expõe o contaazul_id (chave do override).
-- Muda o tipo de retorno, então precisa dropar antes de recriar.
drop function if exists operations.fn_ca_atracao_lancamentos(integer, date, date);

create or replace function operations.fn_ca_atracao_lancamentos(
  p_bar_id integer, p_ini date, p_fim date
)
returns table(contaazul_id uuid, data_competencia date, pessoa_nome text, descricao text, valor numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.contaazul_id,
    l.data_competencia::date,
    coalesce(l.pessoa_nome, '')::text,
    coalesce(l.descricao, '')::text,
    sum(coalesce(l.valor_liquido, 0))::numeric
  from bronze.bronze_contaazul_lancamentos l
  where l.bar_id = p_bar_id
    and l.categoria_nome ilike 'Atra%Programa%'
    and l.data_competencia >= p_ini
    and l.data_competencia <= p_fim
    and l.excluido_em is null
  group by l.contaazul_id, l.data_competencia, l.pessoa_nome, l.descricao
  having sum(coalesce(l.valor_liquido, 0)) <> 0;
$$;

revoke all on function operations.fn_ca_atracao_lancamentos(integer, date, date) from public, anon;
grant execute on function operations.fn_ca_atracao_lancamentos(integer, date, date) to service_role;
