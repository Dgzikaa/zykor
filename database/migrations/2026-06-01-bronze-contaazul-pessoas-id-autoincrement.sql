-- ============================================================================
-- bronze_contaazul_pessoas.id: integer NOT NULL SEM default
--
-- Causava "null value in column id violates not-null constraint" em todo INSERT
-- de pessoa nova -> o sync de fornecedores (contaazul-sync) e o cadastro avulso
-- gravavam local de forma quebrada (batch upsert e all-or-nothing). Resultado:
-- fornecedor cadastrado no Conta Azul nao aparecia no Zykor e bloqueava o pagamento.
--
-- Anexa uma sequence comecando acima do max atual. JA APLICADA EM PRODUCAO
-- (via MCP) em 2026-06-01 — arquivo para registro/historico.
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS bronze.bronze_contaazul_pessoas_id_seq
  OWNED BY bronze.bronze_contaazul_pessoas.id;

SELECT setval(
  'bronze.bronze_contaazul_pessoas_id_seq',
  COALESCE((SELECT max(id) FROM bronze.bronze_contaazul_pessoas), 0) + 1,
  false
);

ALTER TABLE bronze.bronze_contaazul_pessoas
  ALTER COLUMN id SET DEFAULT nextval('bronze.bronze_contaazul_pessoas_id_seq');
