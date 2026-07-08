-- Item 2 (reunião Produção 07/07): Trocas de insumo entre bares.
--
-- Quando um bar empresta/manda insumo pra outro (ex.: Deboche → 3 caixas de cerveja → Ordinário),
-- o estoque sai de um e entra no outro. Sem registrar, o desvio acusa perda falsa no emissor e
-- sobra falsa no recebedor (a mercadoria não está nas compras do VMarket). A Troca registra a
-- saída no emissor + entrada no recebedor e (passo 4) lança no CA (receita a receber no emissor /
-- despesa a pagar no recebedor). Quem ENVIA registra; valor = custo dos insumos.

create table if not exists financial.trocas (
  id uuid primary key default gen_random_uuid(),
  bar_origem      integer not null,      -- quem ENVIOU/emprestou (o emissor registra)
  bar_destino     integer not null,      -- quem RECEBEU (e paga)
  data_competencia date not null,
  descricao       text,
  valor           numeric(12,2) not null default 0,   -- Σ dos itens (custo)
  status          text not null default 'registrada', -- registrada | ca_lancado | cancelada
  ca_lancamento_receita_id  text,        -- lançamento CA do emissor (a receber) — passo 4
  ca_lancamento_despesa_id  text,        -- lançamento CA do recebedor (a pagar) — passo 4
  criado_por      text,
  created_at      timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create table if not exists financial.troca_itens (
  id uuid primary key default gen_random_uuid(),
  troca_id        uuid not null references financial.trocas(id) on delete cascade,
  insumo_codigo   text not null,
  quantidade      numeric not null,
  custo_unitario  numeric(12,4) not null default 0,
  subtotal        numeric(12,2) not null default 0
);

create index if not exists idx_troca_itens_troca   on financial.troca_itens(troca_id);
create index if not exists idx_trocas_origem_data   on financial.trocas(bar_origem, data_competencia);
create index if not exists idx_trocas_destino_data  on financial.trocas(bar_destino, data_competencia);