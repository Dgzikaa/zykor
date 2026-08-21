-- Cachê automático do artista (21/08/2026, Gonza).
--
-- "A gente ter ali na aba de artistas um lugar onde a gente salva qual a negociação de cada
--  artista — Breno: 15% do fat / Doze: 8.000 ou 15% do fat — aí ele já calcula o cachê
--  automaticamente com base no faturamento/bilheteria etc. E fica igual àqueles lançamentos, só
--  com o botão confirmar e subir o pagamento pro financeiro."
--
-- Hoje o cachê só existe DEPOIS: o financeiro lança no Conta Azul e o Zykor lê de volta em
-- eventos_base.c_art. Não havia nada que dissesse quanto DEVERIA ser — logo, nada pra conferir
-- e ninguém sabia o valor sem abrir a conversa do WhatsApp.

-- ---------------------------------------------------------------------------
-- 1) A negociação vive no cadastro do artista (bar_artistas), por BAR.
--    O mesmo artista pode ter acordo diferente em cada casa — bar_artistas já é por bar.
-- ---------------------------------------------------------------------------
alter table operations.bar_artistas
  -- Sobre o que o % incide. eventos_base garante real_r = faturamento_entrada + faturamento_bar,
  -- então as três bases fecham entre si e não inventam número novo.
  --   'total'   = real_r            (faturamento da noite inteira)
  --   'entrada' = faturamento_entrada (couvert/bilheteria)
  --   'bar'     = faturamento_bar
  add column if not exists base_calculo text,
  -- Dados de pagamento: é o que o pedido precisa pra virar PIX no Inter + conta a pagar no CA.
  -- Fica aqui e não em financial.beneficiarios porque quem cadastra artista é a programação,
  -- na tela dela — obrigar a criar um beneficiário antes mataria o fluxo de 1 clique.
  add column if not exists favorecido_nome text,   -- quem RECEBE, quando != nome artístico (produtora, empresário)
  add column if not exists chave_pix text,
  add column if not exists tipo_chave text,
  add column if not exists cpf_cnpj text,
  add column if not exists contaazul_pessoa_id text;

-- tipo_acordo ganha vocabulário fechado. Estava livre e 100% nulo (202 linhas), então não há
-- valor legado pra migrar. Os dois casos do Gonza viram: Breno = 'percentual' 15 / base total;
-- Doze = 'maior' com cachet_combinado 8000 e percentual 15 ("8.000 OU 15%, o que for maior").
do $$ begin
  alter table operations.bar_artistas add constraint bar_artistas_tipo_acordo_ck
    check (tipo_acordo is null or tipo_acordo in
      ('fixo','percentual','maior','menor','fixo_mais_percentual'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table operations.bar_artistas add constraint bar_artistas_base_calculo_ck
    check (base_calculo is null or base_calculo in ('total','entrada','bar'));
exception when duplicate_object then null; end $$;

comment on column operations.bar_artistas.tipo_acordo is
  'fixo | percentual | maior (o maior entre fixo e %) | menor | fixo_mais_percentual';

-- ---------------------------------------------------------------------------
-- 2) O lançamento: liga (evento, artista) ao pedido de pagamento gerado.
--
-- A UNIQUE (evento_id, artista_id) é o ponto da tabela: é ela que impede pagar o mesmo show duas
-- vezes. Sem isso, dois cliques no Confirmar viram dois PIX — o mesmo erro que já aconteceu com
-- boleto duplicado em julho.
--
-- Guarda o SNAPSHOT da regra e das bases (`regra`, `base_valor`): a negociação muda com o tempo e
-- o faturamento é recalculado por cron; sem congelar, um cachê pago em julho passaria a "não
-- bater" com a conta de hoje e ninguém saberia explicar o valor que já saiu.
-- ---------------------------------------------------------------------------
create table if not exists operations.artista_cache_lancamento (
  id uuid primary key default gen_random_uuid(),
  bar_id integer not null,
  evento_id integer not null references operations.eventos_base(id) on delete cascade,
  artista_id integer not null references operations.bar_artistas(id) on delete cascade,
  data_evento date not null,
  valor numeric not null check (valor > 0),
  base_valor numeric,            -- quanto era a base no momento do cálculo
  regra jsonb,                   -- { tipo_acordo, cachet_combinado, percentual, base_calculo, formula }
  pedido_id uuid,                -- financial.pedidos_pagamento.id (sem FK: outro schema/domínio)
  criado_em timestamptz not null default now(),
  criado_por text
);
create unique index if not exists uq_artista_cache_lancamento
  on operations.artista_cache_lancamento (evento_id, artista_id);
create index if not exists idx_artista_cache_lancamento_bar
  on operations.artista_cache_lancamento (bar_id, data_evento desc);

grant select, insert, update, delete on operations.artista_cache_lancamento to service_role;
