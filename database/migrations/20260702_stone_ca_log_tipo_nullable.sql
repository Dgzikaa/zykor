-- Stone→CA log: os lançamentos do DIA (TAXA/COMPENSACAO) não têm tipo de cartão
-- (crédito/débito/pix) → gravam tipo=null. Como a coluna era NOT NULL, o insert do log
-- da taxa falhava em silêncio → a taxa não entrava no log → a tela mostrava "pendente"
-- mesmo tendo sido criada no CA. Torna tipo nullable.
alter table financial.stone_ca_lancamento_log alter column tipo drop not null;
