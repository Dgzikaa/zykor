# Investigação: cron.job_run_details — autovacuum aparentemente travado

**Data:** 2026-04-26
**Origin:** follow-up #32

## Contexto

Durante o pre-flight de `perf/04` (autovacuum_tuning), notou-se que `cron.job_run_details` tinha `last_autovacuum = 2026-02-09`, ~75 dias atrás. Suspeita: autovacuum travou ou tabela está sendo escrita sem nunca atingir threshold.

## Queries rodadas

### Estado atual da tabela

```sql
SELECT relname, last_autovacuum, last_autoanalyze, last_vacuum, last_analyze,
       n_dead_tup, n_live_tup,
       round(n_dead_tup::numeric / NULLIF(n_live_tup, 0) * 100, 2) AS dead_pct,
       autovacuum_count, vacuum_count, autoanalyze_count, analyze_count,
       pg_size_pretty(pg_total_relation_size('cron.job_run_details'::regclass)) AS total_size
FROM pg_stat_user_tables
WHERE schemaname = 'cron' AND relname = 'job_run_details';
```

| campo | valor |
|-------|-------|
| last_autovacuum | 2026-02-09 02:01:42 (~75 dias atrás) |
| last_autoanalyze | 2026-02-09 02:00:42 |
| last_analyze (manual) | 2026-04-17 12:33:56 |
| n_dead_tup | 2.621 |
| n_live_tup | 26.035 |
| dead_pct | **10.07%** |
| autovacuum_count (lifetime) | 29 |
| autoanalyze_count (lifetime) | 38 |
| total_size | 17 MB |
| reloptions | NULL (defaults do cluster) |

## Findings

1. **Não está travado.** O autovacuum rodou 29 vezes ao longo da vida da tabela. Está apenas **abaixo do threshold** com defaults do cluster:
   - Default `autovacuum_vacuum_scale_factor = 0.20` → dispara quando `dead_pct >= 20%`
   - Atual: `dead_pct = 10.07%` → ainda não atingiu o gatilho
   - Threshold absoluto: `50 + 0.20 × 26035 ≈ 5257 dead_tup`. Atual 2.621 → metade do threshold.

2. **Análise manual recente (2026-04-17)** sugere que alguém rodou `ANALYZE` direto, possivelmente investigando esse mesmo sintoma.

3. **Tabela cresce sem retention.** O `pg_cron` por default mantém histórico infinito de execuções. Com 26k rows em ~3 meses de uso, tendência: ~100k+ rows/ano. Não é problema de performance hoje (17 MB), mas é dívida técnica.

## Recomendação

**KEEP** — não é incidente. Mas duas ações tracked como follow-ups:

### Imediato (low priority)
- **Não tunar autovacuum** dessa tabela. Default OK pra log-only.

### Quando a tabela passar de ~100 MB ou ~500k rows
- **Setup de retention** via cron job próprio:
  ```sql
  SELECT cron.schedule('cleanup-job-run-details', '0 3 * * 0',
    $$DELETE FROM cron.job_run_details WHERE start_time < now() - interval '90 days'$$);
  ```
- **Alternativa**: `cron.log_run = off` no `postgresql.conf` (perde rastreabilidade de execuções).

### Próximas ações
- Adicionar query monitor mensal pra `cron.job_run_details` size em `database/queries/monitoring/`.
- Re-investigar se `dead_pct` passar de 25% sem dispatch de autovacuum (aí seria sinal real de travamento).

**Verdict #32: KEEP, follow-up convertido em monitoring task de baixa prioridade.**
