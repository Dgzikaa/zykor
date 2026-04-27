-- ROLLBACK B.3 — restaurar defaults do cluster (sem reloptions custom)
-- ATENÇÃO: rollback aqui faz a tabela perder o tuning aggressive e voltar
-- a usar os defaults globais. Bloat tende a subir. Só fazer se realmente
-- necessário desfazer.

ALTER TABLE operations.eventos_base RESET (
  autovacuum_vacuum_threshold,
  autovacuum_vacuum_scale_factor,
  autovacuum_analyze_scale_factor
);
