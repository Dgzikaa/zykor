-- Idempotência de verdade contra duplo/triplo submit em /operacional/producoes (internet ruim +
-- retry na cozinha). A chave é gerada no cliente (1 por instância de execução) e enviada no POST;
-- o unique index (bar_id, idempotencia_key) faz duas requisições concorrentes colidirem no banco
-- (a 2ª pega 23505 → a API devolve a 1ª como sucesso idempotente). O guard anterior (pré-check por
-- janela de 5 min) tinha race de TOCTOU: dois requests simultâneos passavam os dois pela checagem
-- e inseriam ambos. Mesma lição do incidente PIX 3x (guard em memória/pré-check sempre vaza).

alter table operations.producao_execucao add column if not exists idempotencia_key text;

create unique index if not exists uq_producao_execucao_idem
  on operations.producao_execucao (bar_id, idempotencia_key)
  where idempotencia_key is not null;
