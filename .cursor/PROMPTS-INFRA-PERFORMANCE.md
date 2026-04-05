# PROMPTS — INFRAESTRUTURA E PERFORMANCE

**Data**: 04/04/2026
**Status**: 🟡 EXECUTAR — 4 prompts para corrigir erros de infra e melhorar performance
**Contexto**: Problemas encontrados nos logs do Supabase e auditoria de performance do banco

> Execute cada prompt em um chat separado no Cursor.

---

## INFRA-1 — Corrigir agente-dispatcher retornando HTTP 500

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA: A edge function `agente-dispatcher` está retornando HTTP 500 intermitentemente (2 erros nas últimas 24h). Esta função é chamada pelo cron `analise-diaria-v2-bar3` (12:00 UTC) e `analise-diaria-v2-bar4` (12:05 UTC).

TAREFA:
1. Abra `backend/supabase/functions/agente-dispatcher/index.ts`

2. Verifique:
   - Se todos os imports estão corretos (especialmente _shared/)
   - Se as variáveis de ambiente necessárias estão sendo validadas com `validateFunctionEnv()`
   - Se existe try/catch adequado no handler principal
   - Se a função retorna CORS headers em caso de erro

3. Adicione logging detalhado no catch principal:
   ```typescript
   catch (error) {
     console.error('❌ agente-dispatcher erro:', {
       message: error.message,
       stack: error.stack,
       timestamp: new Date().toISOString()
     });
     return new Response(JSON.stringify({
       error: error.message,
       timestamp: new Date().toISOString()
     }), {
       status: 500,
       headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
     });
   }
   ```

4. Verifique se a função chama APIs externas (Gemini, Discord) e se essas chamadas usam `withRetry()`:
   ```typescript
   const result = await withRetry(() => fetchGeminiAPI(...), {
     maxRetries: 3,
     initialDelay: 1000
   });
   ```

5. Verifique o timeout — se a função faz operações pesadas, pode estar dando timeout (150s max no Supabase).

6. DEPLOY: Após corrigir, faça deploy da edge function:
   ```bash
   supabase functions deploy agente-dispatcher --project-ref uqtgsvujwcbymjmvkjhy
   ```

VALIDAÇÃO: Monitorar logs nas próximas 24h para confirmar que os 500s pararam.

NÃO crie arquivos .md.

COMMIT: "fix: melhorar error handling e retry no agente-dispatcher"
```

---

## INFRA-2 — Corrigir timeout no contaazul-sync

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA: A edge function `contaazul-sync` teve um timeout de 504 (150.325ms = 2min30s) nas últimas 24h. O limite do Supabase é 150s para edge functions.

A função sincroniza dados do Conta Azul (API externa) para `contaazul_lancamentos`. Se a API do Conta Azul demora ou retorna muitos dados, pode exceder o timeout.

TAREFA:
1. Abra `backend/supabase/functions/contaazul-sync/index.ts`

2. Verifique:
   - Quantos registros a função tenta sincronizar por execução
   - Se usa paginação ao buscar da API do Conta Azul
   - Se faz batch inserts no banco

3. Implemente paginação/chunking se não existir:
   ```typescript
   // Limitar a 500 registros por execução
   const MAX_RECORDS_PER_SYNC = 500;

   // Se houver mais registros, salvar o cursor/offset para próxima execução
   if (totalRecords > MAX_RECORDS_PER_SYNC) {
     console.warn(`⚠️ contaazul-sync: ${totalRecords} registros, processando apenas ${MAX_RECORDS_PER_SYNC}. Próxima execução continuará.`);
     // Salvar offset em tabela de controle
     await supabase.from('sync_control').upsert({
       sync_type: 'contaazul',
       last_offset: currentOffset + MAX_RECORDS_PER_SYNC,
       updated_at: new Date().toISOString()
     });
   }
   ```

4. Adicione um timeout interno antes do timeout do Supabase:
   ```typescript
   const SAFE_TIMEOUT = 120000; // 120s (30s antes do limite de 150s)
   const startTime = Date.now();

   // Em cada iteração de sync, verificar tempo
   if (Date.now() - startTime > SAFE_TIMEOUT) {
     console.warn('⚠️ Approaching timeout, saving progress and stopping');
     break;
   }
   ```

5. Se a função faz INSERT de muitos registros, use batch de 500:
   ```typescript
   for (let i = 0; i < records.length; i += 500) {
     const batch = records.slice(i, i + 500);
     await supabase.from('contaazul_lancamentos').upsert(batch, { onConflict: 'lancamento_id' });
   }
   ```

6. DEPLOY após corrigir.

NÃO crie arquivos .md.

COMMIT: "fix: adicionar paginação e timeout safety no contaazul-sync"
```

---

## INFRA-3 — Adicionar índices faltantes nas tabelas com full scan

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA: Auditoria de performance identificou tabelas com alto número de sequential scans (full table scan) e baixo uso de índices:

| Tabela | Linhas | Tamanho | % Índice | Seq Scans |
|--------|--------|---------|----------|-----------|
| checklist_automation_logs | 6.103 | 2.8 MB | 0.2% | 435 |
| audit_trail | 10.067 | 18 MB | 25.8% | 164 |
| checklist_agendamentos | 6.103 | 1.8 MB | 44.1% | 12.631 |
| getin_reservations | 5.135 | 9.8 MB | 85.5% | 140.809 |

TAREFA: Criar uma migration SQL adicionando índices:

```sql
-- 1. checklist_automation_logs (0.2% index usage - CRÍTICO)
CREATE INDEX IF NOT EXISTS idx_checklist_automation_logs_created_at
  ON checklist_automation_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checklist_automation_logs_tipo
  ON checklist_automation_logs (tipo_automacao, bar_id);

-- 2. audit_trail (25.8% index usage)
CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at
  ON audit_trail (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user_action
  ON audit_trail (user_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity
  ON audit_trail (entity_type, entity_id);

-- 3. checklist_agendamentos (44.1% index usage)
CREATE INDEX IF NOT EXISTS idx_checklist_agendamentos_bar_data
  ON checklist_agendamentos (bar_id, data_agendamento);
CREATE INDEX IF NOT EXISTS idx_checklist_agendamentos_status
  ON checklist_agendamentos (status, bar_id);

-- 4. getin_reservations (85.5% mas 140K seq scans)
-- Verificar que índices já existem e criar os que faltam
CREATE INDEX IF NOT EXISTS idx_getin_reservations_bar_data
  ON getin_reservations (bar_id, data_reserva);
CREATE INDEX IF NOT EXISTS idx_getin_reservations_status
  ON getin_reservations (status, bar_id);
```

ANTES de criar, verifique os nomes corretos das colunas:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'checklist_automation_logs' ORDER BY ordinal_position;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'audit_trail' ORDER BY ordinal_position;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'checklist_agendamentos' ORDER BY ordinal_position;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'getin_reservations' ORDER BY ordinal_position;
```

Adapte os nomes das colunas conforme o resultado.

Salve como: `database/migrations/20260404_add_missing_indexes_performance.sql`

VALIDAÇÃO: Após executar a migration, verificar:
```sql
SELECT
  relname as tabela,
  idx_scan as buscas_indice,
  seq_scan as buscas_seq,
  ROUND(idx_scan::numeric / GREATEST(seq_scan + idx_scan, 1) * 100, 1) as pct_indice
FROM pg_stat_user_tables
WHERE relname IN ('checklist_automation_logs', 'audit_trail', 'checklist_agendamentos', 'getin_reservations');
```
(Os números vão resetar, confirme que os índices existem com `\di`)

NÃO crie arquivos .md.

COMMIT: "perf: adicionar índices faltantes em tabelas com alto sequential scan"
```

---

## INFRA-4 — Remover nibo-sync do Supabase e otimizar cron-watchdog

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA DUPLO:

A) A edge function `nibo-sync` foi deletada do código mas CONTINUA DEPLOYED no Supabase. Precisa ser removida.

B) O `cron-watchdog` roda a cada ~5 minutos com execução de ~35 segundos cada. Isso é excessivo — são ~288 execuções/dia × 35s = ~2.8 horas de compute/dia só no watchdog.

TAREFA PARTE A — Remover nibo-sync:

1. Verificar se existe algum cron job que chama nibo-sync:
   ```sql
   SELECT jobname, schedule, command FROM cron.job WHERE command ILIKE '%nibo%';
   ```

2. Se encontrar, desativar:
   ```sql
   SELECT cron.unschedule('nome-do-job');
   ```

3. A remoção da edge function do Supabase precisa ser feita via CLI:
   ```bash
   supabase functions delete nibo-sync --project-ref uqtgsvujwcbymjmvkjhy
   ```
   Se não tiver acesso ao CLI, documente que precisa ser feito manualmente no dashboard do Supabase.

TAREFA PARTE B — Otimizar cron-watchdog:

1. Abra `backend/supabase/functions/cron-watchdog/index.ts`

2. Analise o que o watchdog faz:
   - Se monitora saúde dos outros crons → pode rodar a cada 15min em vez de 5min
   - Se faz heartbeat → pode rodar a cada 10min
   - Se faz algo crítico em tempo real → manter 5min mas otimizar o código

3. Reduza a frequência para no máximo a cada 10-15 minutos:
   ```sql
   -- Atualizar o cron schedule
   SELECT cron.unschedule('cron-watchdog-job-name');
   SELECT cron.schedule(
     'cron-watchdog',
     '*/15 * * * *',  -- A cada 15 minutos (era */5)
     $$SELECT ... $$
   );
   ```

4. Dentro da função, otimize:
   - Se faz queries pesadas, adicione caching
   - Se verifica muitos crons, use uma única query em vez de múltiplas

5. ALVO: Reduzir de ~2.8h/dia para ~1h/dia de compute no watchdog.

VALIDAÇÃO:
```sql
-- Verificar que nibo-sync não tem mais cron jobs
SELECT COUNT(*) FROM cron.job WHERE command ILIKE '%nibo%';
-- Deve retornar 0

-- Verificar novo schedule do watchdog
SELECT jobname, schedule FROM cron.job WHERE jobname ILIKE '%watchdog%';
-- Deve mostrar */15 ou similar
```

NÃO crie arquivos .md.

COMMIT: "fix: remover nibo-sync orphan + otimizar frequência do cron-watchdog"
```

---

## ORDEM DE EXECUÇÃO

```
INFRA-1 → agente-dispatcher 500s (fix urgente — afeta análise diária)
INFRA-2 → contaazul-sync timeout (fix importante — afeta sync financeiro)
INFRA-3 → Índices de performance (melhoria)
INFRA-4 → Cleanup nibo-sync + otimizar watchdog (melhoria de custo)
```
