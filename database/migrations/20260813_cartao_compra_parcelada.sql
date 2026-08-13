-- Compra parcelada no cartão: memória de quais parcelas já foram lançadas no Conta Azul
--
-- Problema (David, 13/08/2026): a fatura traz uma linha por parcela ("Mp*mercadolivre — Parcela 2 de 6")
-- e TODA parcela carrega a data da compra original (24/06). Como o lançamento usa
-- data_competencia = data_transacao, cada mês entra mais um valor na competência de junho e a DRE de
-- junho cresce pra trás, mês após mês.
--
-- Duas saídas, escolhidas na hora de lançar:
--   modo 'compra' (padrão)  — competência = data da compra pra todas as parcelas. Quem quiser pode
--                             gerar as parcelas que faltam de uma vez (opt-in), aí junho fecha na hora
--                             e para de crescer. Ex.: Mercado Livre parcelado à vista.
--   modo 'mensal'           — competência anda mês a mês a partir de um mês escolhido. Ex.: contrato
--                             SKY em 12x, que hoje cai inteiro em janeiro.
--
-- Esta tabela é o que evita o lançamento em dobro: quando a fatura do mês seguinte trouxer a parcela
-- 3/6, o Zykor vê que ela já está coberta e só VINCULA a linha ao lançamento existente.
create table if not exists financial.cartao_compra_parcelada (
  id uuid primary key default gen_random_uuid(),
  -- identidade da compra entre faturas: banco|final do cartão|data da compra|nº de parcelas|valor
  -- arredondado. Sem a descrição de propósito — ela é editável na tela antes de lançar, e uma edição
  -- na parcela 3 quebraria o vínculo com a 2. Os centavos variam entre parcelas (38,42 / 38,37), por
  -- isso o valor entra arredondado.
  chave text not null unique,
  bar_id integer not null,
  banco text,
  cartao_final text,
  descricao text not null,
  data_transacao date not null,
  total_parcelas integer not null check (total_parcelas > 1),
  valor_parcela numeric(14,2) not null,
  modo_competencia text not null default 'compra' check (modo_competencia in ('compra', 'mensal')),
  competencia_inicial date,                              -- só no modo 'mensal'
  parcelas_lancadas integer[] not null default '{}',     -- quais parcelas já foram pro CA
  contaazul_ids text[] not null default '{}',
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_cartao_compra_parcelada_bar on financial.cartao_compra_parcelada (bar_id, data_transacao desc);

comment on table financial.cartao_compra_parcelada is
  'Compra parcelada no cartão e quais parcelas já foram lançadas no Conta Azul. Impede lançar a mesma parcela duas vezes quando ela reaparece na fatura do mês seguinte.';
comment on column financial.cartao_compra_parcelada.modo_competencia is
  'compra = competência na data da compra (parcelamento à vista, ex. Mercado Livre) · mensal = competência mês a mês (contrato 12x, ex. SKY).';

grant select, insert, update on financial.cartao_compra_parcelada to service_role;
