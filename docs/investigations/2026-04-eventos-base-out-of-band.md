# Investigação: operations.eventos_base — tuning out-of-band

**Data:** 2026-04-26
**Origin:** follow-up #40

## Contexto

Durante perf/04 (autovacuum_tuning), descobriu-se que `operations.eventos_base` já tinha reloptions de autovacuum aggressive (`scale_factor=0.05`, `analyze_scale_factor=0.02`) **sem qualquer migration correspondente no histórico do git**. Mesmo padrão depois flagged em perf/05 batch 3 com o `idx_eventos_base_conta_assinada` (parcial criado out-of-band).

Suspeita: alguém aplicou tuning manual via Supabase Studio ou `psql` direto, sem registrar.

## Queries rodadas

### Reloptions atuais

```sql
SELECT relname, reloptions FROM pg_class
WHERE relnamespace = 'operations'::regnamespace AND relname = 'eventos_base';
```

| relname | reloptions |
|---------|------------|
| eventos_base | `{autovacuum_vacuum_threshold=50, autovacuum_vacuum_scale_factor=0.05, autovacuum_analyze_scale_factor=0.02}` |

### Indexes atuais (pós perf/05 batch 3)

| index | def |
|-------|-----|
| `eventos_base_pkey` | UNIQUE (id) |
| `eventos_base_data_evento_bar_id_key` | UNIQUE (data_evento, bar_id) |
| `idx_eventos_base_bar_data` | btree (bar_id, data_evento DESC) |
| `idx_eventos_base_data` | btree (data_evento) |
| `idx_eventos_base_pendentes` | btree (id, data_evento) WHERE precisa_recalculo=true |

### Triggers

| name | def |
|------|-----|
| `trigger_fill_semana` | BEFORE INSERT/UPDATE → `fill_semana_on_insert()` |

### Cross-check com migrations conhecidas

Grep em `database/migrations/`:
- ✓ `complete_eventos_base_structure.sql` — cria a tabela (não menciona reloptions)
- ✓ `2026-04-25-perf04-autovacuum-tuning.sql` — explicitamente nota: *"operations.eventos_base já está tunada com mesmos valores (dead_pct=0%). A reloption foi aplicada out-of-band, sem migration no histórico"*
- ✗ Nenhuma migration aplica os reloptions atuais em `operations.eventos_base`

## Findings

1. **Reloptions corretas, sem migration:** os valores aggressive (`0.05/0.02`) são os MESMOS que aplicamos em silver tables via perf/04 — provavelmente alguém antecipou esse tuning manualmente vendo bloat alto. Resultado é positivo (`dead_pct = 0%`), só falta rastro.

2. **Index out-of-band também:** o `idx_eventos_base_conta_assinada` (dropado em perf/05 batch 3) também não tinha rastro no git. Confirma o padrão de mudanças manuais via Studio/psql.

3. **Trigger ok:** `trigger_fill_semana` está documentado em `database/triggers/` (preenche campo `semana` automaticamente).

## Recomendação

**REBASELINE** — criar migration retroativa que documenta os reloptions atuais, sem alterar comportamento.

### Próximas ações

1. **Criar migration `database/migrations/2026-04-26-rebaseline-eventos-base-reloptions.sql`:**
   ```sql
   -- Rebaseline: operations.eventos_base reloptions tuning
   -- Aplicado out-of-band antes do tracking via migrations.
   -- Valores idênticos aos atuais; migration é DECLARATIVA pra alinhar repo ↔ DB.
   ALTER TABLE operations.eventos_base SET (
     autovacuum_vacuum_threshold = 50,
     autovacuum_vacuum_scale_factor = 0.05,
     autovacuum_analyze_scale_factor = 0.02
   );
   ```
   Esta migration é idempotente — `SET` em valores iguais não muda nada, mas documenta intent.

2. **Adicionar regra em `database/CONVENTIONS.md`:**
   - Toda mudança em `pg_class.reloptions` deve ser via migration
   - Toda criação de index deve ser via migration
   - Out-of-band = bloqueador de merge

3. **Setup de drift detection** (low priority): script que compara `pg_class.reloptions` real vs declarado em migrations, executado em CI semanal.

**Verdict #40: REBASELINE em PR separado + adicionar regra em CONVENTIONS. Investigação não revelou problema operacional, só dívida de processo.**
