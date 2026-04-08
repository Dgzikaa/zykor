# PROMPTS — REVISÃO 05/04/2026

**Data**: 05/04/2026
**Status**: 🔴 EXECUTAR — 5 prompts para corrigir build quebrado, segurança de crons e limpeza final
**Contexto**: Auditoria de revisão pós-correções revelou build quebrado, JWT hardcoded em 29 crons, e limpeza NIBO incompleta

> Execute cada prompt em um chat separado no Cursor.

---

## REV-1 — URGENTE: Corrigir build quebrado no Vercel

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA URGENTE: O último deploy no Vercel está em estado ERROR. O build compila com sucesso mas FALHA na etapa de linting ("Failed to compile"). Os warnings de ESLint estão sendo tratados como errors.

O commit que quebrou: "fix: otimizar frequencia do cron-watchdog de 5min para 15min" (f7f2857)
A produção está OK (deploy anterior), mas NENHUM novo push vai funcionar até corrigir.

TAREFA:
1. Rode `npm run build` localmente e veja os erros exatos

2. Os warnings são de dois tipos:
   - `react-hooks/exhaustive-deps` — missing dependencies em useEffect/useCallback
   - `jsx-a11y/label-has-associated-control` — labels sem controles associados

   Arquivos afetados (lista parcial):
   - src/app/analitico/atracoes/page.tsx (linha 82)
   - src/app/analitico/clientes/components/ClientesDataTable.tsx (linhas 267-342)
   - src/app/analitico/clientes/page.tsx (linhas 801-952)
   - src/app/analitico/produtos/page.tsx (linha 102)
   - src/app/analitico/socios/page.tsx (linha 51)
   - src/app/checklists/abertura/page.tsx (linha 26)
   - src/app/crm/churn-prediction/page.tsx (linha 152)
   - src/app/crm/conversas/page.tsx (linha 113)
   - src/app/crm/inteligente/page.tsx (linha 137)
   - src/app/crm/ltv-engajamento/page.tsx (linha 105)
   - src/app/crm/padroes-comportamento/page.tsx (linha 89)
   - src/app/crm/umbler/page.tsx (linhas 1241-1335)

3. OPÇÃO A (recomendada): Corrigir TODOS os warnings de lint:
   - Para `react-hooks/exhaustive-deps`: adicionar as dependências faltantes ao array ou usar useCallback com as deps corretas
   - Para `jsx-a11y/label-has-associated-control`: adicionar htmlFor nos labels ou envolver o input dentro do label

4. OPÇÃO B (rápida, se Opção A demorar muito): Adicionar no `next.config.js`:
   ```javascript
   eslint: {
     ignoreDuringBuilds: true,
   }
   ```
   ⚠️ Isso desabilita lint no build — use apenas temporariamente.

5. Após corrigir, verifique que `npm run build` passa localmente

6. IMPORTANTE: Verifique se o commit do watchdog (f7f2857) NÃO incluiu acidentalmente modificações em arquivos frontend. Se incluiu, pode ser a causa.

VALIDAÇÃO: `npm run build` deve completar sem erros. Push para main e confirmar que o deploy no Vercel fica READY.

NÃO crie arquivos .md.

COMMIT: "fix: corrigir lint warnings que quebravam build no Vercel"
```

---

## REV-2 — Migrar 29 cron jobs de JWT hardcoded para current_setting

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA DE SEGURANÇA: 29 dos 51 cron jobs têm o service_role_key JWT hardcoded diretamente no SQL do pg_cron. Isso é um risco:
- O JWT fica exposto na tabela cron.job (visível a qualquer admin)
- Se a key for rotacionada, TODOS os 29 jobs quebram
- Inconsistência: 4 jobs já usam current_setting() corretamente

Jobs com JWT hardcoded (29):
agente-analise-mensal, agente-analise-semanal, alertas-proativos-manha, alertas-proativos-tarde, cmv-semanal-auto-diario, contahub-resync-semanal-deboche, contahub-resync-semanal-ordinario, getin-sync-continuo, google-reviews-daily-sync, google-sheets-sync-diario, monitor-concorrencia-diario, processar-alertas-discord, relatorio-matinal-discord, relatorio-metas-semanal, stockout-processar-auto-deboche, stockout-processar-auto-ordinario, stockout-sync-diario-correto-v2, stockout-sync-diario-deboche, sympla-sync-semanal, sync-cliente-estatisticas-diario, sync-cmv-sheets-diario, sync-conhecimento-diario, sync-contagem-deboche, sync-contagem-ordinario, sync-eventos-diario, sync-marketing-meta-diario, umbler-sync-diario-11h-20h, watchdog-15min, yuzer-sync-semanal

Jobs que JÁ usam current_setting (modelo correto, 4):
analise-diaria-v2-bar3, analise-diaria-v2-bar4, agent-v2-bar-3-daily, agent-v2-bar-4-daily

TAREFA:
1. Crie uma migration SQL que atualiza TODOS os 29 jobs para usar current_setting.

2. O padrão correto é:
   ```sql
   -- ANTES (inseguro):
   headers := jsonb_build_object(
     'Authorization', 'Bearer eyJhbGciOi...'
   )

   -- DEPOIS (seguro):
   headers := jsonb_build_object(
     'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
   )
   ```

   Para a URL do Supabase, também migrar:
   ```sql
   -- ANTES:
   url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/...'

   -- DEPOIS:
   url := current_setting('app.settings.supabase_url') || '/functions/v1/...'
   ```

3. Para cada job, gere o SQL de UPDATE usando cron.alter_job() ou unschedule + reschedule:
   ```sql
   -- Para cada job:
   SELECT cron.unschedule('nome-do-job');
   SELECT cron.schedule('nome-do-job', 'SCHEDULE_ORIGINAL', $$NOVO_COMMAND_COM_CURRENT_SETTING$$);
   ```

4. IMPORTANTE: Mantenha EXATAMENTE o mesmo schedule e body de cada job. Mude APENAS o header de Authorization e opcionalmente a URL.

5. Verifique que `current_setting('app.settings.service_role_key')` está configurado no Supabase (já está — os 4 jobs existentes usam isso).

Salve como: `database/migrations/20260405_migrar_crons_jwt_para_current_setting.sql`

VALIDAÇÃO:
```sql
-- Nenhum job deve ter JWT hardcoded:
SELECT COUNT(*) FROM cron.job WHERE command ILIKE '%eyJhbGciOi%';
-- Deve retornar 0

-- Todos devem usar current_setting:
SELECT COUNT(*) FROM cron.job WHERE command ILIKE '%current_setting%';
-- Deve retornar >= 33 (29 migrados + 4 existentes)
```

NÃO crie arquivos .md.

COMMIT: "security: migrar 29 cron jobs de JWT hardcoded para current_setting"
```

---

## REV-3 — Deletar edge function nibo-sync do Supabase

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA: A edge function `nibo-sync` (versão 16) AINDA ESTÁ DEPLOYED e ATIVA no Supabase, mesmo com todo o código NIBO deletado do repositório.

TAREFA:
1. Verifique que NÃO há nenhum cron job que chama nibo-sync:
   ```sql
   SELECT jobname, schedule, command FROM cron.job WHERE command ILIKE '%nibo%';
   ```
   Se encontrar algum, delete com:
   ```sql
   SELECT cron.unschedule('nome-do-job');
   ```

2. Delete a edge function via CLI:
   ```bash
   supabase functions delete nibo-sync --project-ref uqtgsvujwcbymjmvkjhy
   ```

3. Se não tiver acesso ao CLI do Supabase, faça via Dashboard:
   - Acesse https://supabase.com/dashboard/project/uqtgsvujwcbymjmvkjhy/functions
   - Encontre `nibo-sync`
   - Delete a function

VALIDAÇÃO: A função não deve mais aparecer na lista de edge functions.

NÃO crie arquivos .md.
```

---

## REV-4 — Limpar tabelas NIBO deprecated do banco

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA: 6 tabelas NIBO deprecated ainda existem no banco, ocupando ~53MB:

| Tabela | Linhas | Tamanho |
|--------|--------|---------|
| nibo_agendamentos | 47.153 | 52 MB |
| nibo_centros_custo | 3.325 | 504 kB |
| nibo_logs_sincronizacao | 457 | 176 kB |
| nibo_categorias | 124 | 168 kB |
| nibo_background_jobs | 110 | 64 kB |
| nibo_stakeholders | 0 | 32 kB |

TAREFA:
1. ANTES de deletar, verifique se alguma view ou function DEPENDE dessas tabelas:
   ```sql
   SELECT DISTINCT
     dependent_ns.nspname as dependent_schema,
     dependent_view.relname as dependent_view,
     source_ns.nspname as source_schema,
     source_table.relname as source_table
   FROM pg_depend
   JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid
   JOIN pg_class as dependent_view ON pg_rewrite.ev_class = dependent_view.oid
   JOIN pg_class as source_table ON pg_depend.refobjid = source_table.oid
   JOIN pg_namespace dependent_ns ON dependent_view.relnamespace = dependent_ns.oid
   JOIN pg_namespace source_ns ON source_table.relnamespace = source_ns.oid
   WHERE source_table.relname IN (
     'nibo_agendamentos', 'nibo_centros_custo', 'nibo_logs_sincronizacao',
     'nibo_categorias', 'nibo_background_jobs', 'nibo_stakeholders'
   );
   ```

2. Verifique se view_dre depende de nibo_categorias:
   ```sql
   SELECT pg_get_viewdef('view_dre'::regclass, true);
   ```
   Se sim, atualize a view PRIMEIRO para não usar nibo_categorias.

3. Se nenhuma dependência crítica for encontrada, PRIMEIRO faça backup e depois delete:
   ```sql
   -- BACKUP: Exportar dados para JSON antes de deletar (opcional, por segurança)
   -- Recomendo fazer um pg_dump das tabelas antes

   -- Deletar tabelas sem dependências (ordem importa por FK):
   DROP TABLE IF EXISTS nibo_stakeholders CASCADE;
   DROP TABLE IF EXISTS nibo_background_jobs CASCADE;
   DROP TABLE IF EXISTS nibo_logs_sincronizacao CASCADE;
   DROP TABLE IF EXISTS nibo_centros_custo CASCADE;
   DROP TABLE IF EXISTS nibo_agendamentos CASCADE;
   DROP TABLE IF EXISTS nibo_categorias CASCADE;  -- CUIDADO: verificar view_dre primeiro!
   ```

4. Se view_dre depende de nibo_categorias, NÃO delete nibo_categorias por enquanto. Marque como TODO.

Salve como: `database/migrations/20260405_drop_tabelas_nibo_deprecated.sql`

VALIDAÇÃO:
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'nibo_%';
-- Deve retornar vazio (ou apenas nibo_categorias se view_dre depender dela)
```

NÃO crie arquivos .md.

COMMIT: "cleanup: remover tabelas NIBO deprecated do banco (~53MB liberados)"
```

---

## REV-5 — Otimizar tabelas pesadas com VACUUM e espaço morto

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA: Auditoria identificou 2 tabelas potencialmente inchadas:

| Tabela | Linhas | Tamanho | Observação |
|--------|--------|---------|------------|
| tempos_producao | 636.597 | 207 MB | Sem VACUUM, sem ANALYZE |
| contahub_tempo | 24.061 | 191 MB | Último VACUUM dez/2025 |

tempos_producao: 636K linhas em 207MB parece razoável, mas nunca teve VACUUM.
contahub_tempo: 24K linhas em 191MB é DESPROPORCIONAL — ~8KB por linha, provavelmente tem muitas dead tuples.

TAREFA:
1. Verifique dead tuples e bloat:
   ```sql
   SELECT
     relname,
     n_live_tup,
     n_dead_tup,
     ROUND(n_dead_tup::numeric / GREATEST(n_live_tup, 1) * 100, 1) as pct_dead,
     pg_size_pretty(pg_total_relation_size('public.' || relname)) as tamanho
   FROM pg_stat_user_tables
   WHERE relname IN ('tempos_producao', 'contahub_tempo', 'contahub_raw_data', 'eventos_base')
   ORDER BY n_dead_tup DESC;
   ```

2. Se contahub_tempo tiver muitas dead tuples ou bloat:
   ```sql
   -- VACUUM FULL reconstrói a tabela (LOCK exclusivo, mas libera espaço real)
   VACUUM FULL ANALYZE contahub_tempo;
   ```

3. Execute ANALYZE nas tabelas sem estatísticas recentes:
   ```sql
   ANALYZE tempos_producao;
   ANALYZE contahub_tempo;
   ANALYZE eventos_base;
   ```

4. Verifique se `contahub_raw_data` (7K rows, 180MB = ~25KB/row) pode ser limpo:
   ```sql
   -- Verificar se os dados brutos já foram processados
   SELECT
     COUNT(*) as total,
     COUNT(*) FILTER (WHERE processado = true) as processados,
     MIN(created_at) as mais_antigo,
     MAX(created_at) as mais_recente
   FROM contahub_raw_data;
   ```
   Se todos já foram processados e são antigos, considere deletar dados com mais de 60 dias.

5. Verifique tabelas com bloat alto (índice vs tamanho real):
   ```sql
   SELECT
     relname,
     pg_size_pretty(pg_total_relation_size('public.' || relname)) as total,
     pg_size_pretty(pg_relation_size('public.' || relname)) as tabela,
     pg_size_pretty(pg_total_relation_size('public.' || relname) - pg_relation_size('public.' || relname)) as indices_toast
   FROM pg_stat_user_tables
   WHERE schemaname = 'public'
     AND pg_total_relation_size('public.' || relname) > 50 * 1024 * 1024  -- > 50MB
   ORDER BY pg_total_relation_size('public.' || relname) DESC;
   ```

VALIDAÇÃO: Após VACUUM, verificar que contahub_tempo reduziu de tamanho significativamente.

NÃO crie arquivos .md.

COMMIT: "perf: VACUUM e cleanup de tabelas com bloat excessivo"
```

---

## ORDEM DE EXECUÇÃO

```
REV-1 → Build quebrado no Vercel (URGENTE — bloqueia deploys)
REV-2 → Migrar JWT hardcoded (SEGURANÇA)
REV-3 → Deletar nibo-sync do Supabase (LIMPEZA)
REV-4 → Limpar tabelas NIBO (LIMPEZA/ESPAÇO)
REV-5 → VACUUM e otimização de espaço (PERFORMANCE)
```
