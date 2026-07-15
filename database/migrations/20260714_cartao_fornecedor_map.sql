-- Fornecedor do cartão = TITULAR do cartão (decisão do sócio). De-para por cartao_final →
-- fornecedor do Conta Azul (pessoa). Mapeia uma vez por cartão e reusa em toda fatura.
-- A descrição do lançamento continua sendo o gasto/estabelecimento (linha.descricao).
create table if not exists financial.cartao_fornecedor_map (
  id bigint generated always as identity primary key,
  bar_id integer not null,
  cartao_final text not null,
  banco text,
  titular_nome text,
  contaazul_pessoa_id text not null,
  nome text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (bar_id, cartao_final)
);

grant select, insert, update, delete on financial.cartao_fornecedor_map to service_role;

notify pgrst, 'reload schema';
