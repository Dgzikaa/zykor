-- Tuning de autovacuum/autoanalyze em 2 silver tables high-churn.
-- Pre-flight: database/_advisor_snapshots/2026-04-25-perf04-bloat-before.json
--
-- Cluster default: autovacuum_vacuum_scale_factor=0.2, analyze=0.1.
-- Em tabelas grandes da camada silver isso significa lag enorme antes do
-- autovacuum entrar (45k dead em cliente_visitas, 137k dead em tempos_producao).
--
-- Baseline em 2026-04-25:
--   silver.cliente_visitas    : 228k rows, 13.85% dead, defaults (NULL reloptions)
--   silver.tempos_producao    : 686k rows, 10.63% dead, defaults (NULL reloptions)
--
-- Valores escolhidos (mesmo padrao de operations.eventos_base, ja tunada
-- out-of-band com 0.05/0.02 e operando com dead_pct=0%):
--   autovacuum_vacuum_scale_factor  = 0.05  (dispara a 5% dead, 4x mais cedo)
--   autovacuum_analyze_scale_factor = 0.02  (analyze a 2%, plano sempre fresco)
--
-- Out of scope:
--   - operations.eventos_base: ja esta tunada com mesmos valores (dead_pct=0%).
--     A reloption foi aplicada out-of-band, sem migration no historico
--     (anotado em task #40 pra investigacao).
--   - VACUUM FULL / pg_repack pra bloat fisico: lock pesado, exige janela
--     fora de horario comercial. Ver task #41.
--
-- Validacao imediata: pg_class.reloptions deve mostrar os 2 parametros novos.
-- Validacao 24h: dead_pct deve cair (<5% conforme novo threshold).
-- Snapshot pos: database/_advisor_snapshots/2026-04-26-perf04-bloat-after.json
-- (task #11).

ALTER TABLE silver.cliente_visitas SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE silver.tempos_producao SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);
