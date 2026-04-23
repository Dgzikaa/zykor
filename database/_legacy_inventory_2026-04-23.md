# Inventário de legacy — 2026-04-23

> Parte offline da Etapa 3 do plano de limpeza (ver `docs/planning/03-exclusao-legacy.md`).
> A parte que precisa do Supabase remoto está com SQLs prontos no final deste doc.

## 1. Código em `database/_archived/` (já arquivado no repo, confirmar no banco)

Arquivos em `database/_archived/` que **não devem estar ativos no banco**. O Cursor precisa rodar os SQLs da seção 4 pra confirmar que nenhum está criado na DB.

### SQL files na raiz de `_archived/`
- `20260319_sync_metadata.sql` — migração antiga
- `calculate_evento_metrics.sql` (v1)
- `calculate_evento_metrics_fixed.sql` (v2 fix)
- `calculate_evento_metrics_with_happy_hour.sql` (v3)
- `fix_nibo_custos.sql`
- `get_resumo_semanal_produtos.sql`
- `view_eventos_complete_fixed.sql`
- `view_eventos_complete_optimized.sql`
- `analise_funcao.txt`

Observação: a versão atual de `calculate_evento_metrics` deve estar em `database/functions/`. O banco tem que ter **apenas essa**, e `nspname.proname` das arquivadas devem retornar 0 linhas.

### Functions em `_archived/functions/`
```
executar_agente_diario.sql
executar_cmv_ambos_bares.sql
executar_recalculo_desempenho_auto.sql
executar_sync_contagem_sheets.sql
process_analitico_data.sql
process_fatporhora_data.sql
process_pagamentos_data.sql
process_periodo_data.sql
process_tempo_data.sql
visao_geral_functions.sql
```

### Views em `_archived/views/`
```
eventos_cache_auto_update.sql
eventos_cache_table.sql
view_eventos_complete.sql
```

## 2. Pastas vazias no frontend (remover)

Grep por `v1|old|legacy|deprecated` em `frontend/src/app/`:

| Caminho | Status | Ação |
|---|---|---|
| `frontend/src/app/api/financeiro/_deprecated_nibo/` | **Pasta VAZIA** | 🚨 remover — já vem marcada "_deprecated", sem arquivos |
| `frontend/src/app/api/agendamento/buscar-stakeholder/` | **Pasta VAZIA** | 🚨 remover — criada 2026-04-04, sem `route.ts` nem sub-pastas |

(Sem ocorrências de pastas "v1", "old", "legacy" além dessas duas.)

## 3. Código legacy no frontend — a rodar (Cursor)

Offline não dá pra inferir 100% o que está morto. Rodar no Cursor:

```bash
cd frontend

# 1. Dead exports (componentes/utils sem importação)
npx ts-prune --ignore "index.ts|route.ts|page.tsx|layout.tsx|.d.ts" > /tmp/dead-exports.txt
wc -l /tmp/dead-exports.txt

# 2. Dependências não usadas
npx depcheck --skip-missing=true

# 3. Componentes em src/components/ sem referência em src/
# (rodar fora do frontend/, na raiz do repo)
cd ../
for f in frontend/src/components/**/*.{ts,tsx}; do
  name=$(basename "$f" | sed 's/\.[^.]*$//')
  count=$(grep -rln "$name" frontend/src --include="*.ts" --include="*.tsx" | grep -v "$f" | wc -l)
  if [ "$count" -eq "0" ]; then echo "ORFÃO: $f"; fi
done

# 4. Rotas em src/app/ que não têm link em navegação
# Listar todas as rotas:
find frontend/src/app -name "page.tsx" | sed 's|frontend/src/app||; s|/page.tsx||'
# Comparar com links em src/components/layout/sidebar* ou nav*
```

Resultado esperado: lista candidata a `git rm`. NÃO deletar sem rodar `npm test` depois.

## 4. SQLs prontos pra o Cursor rodar no Supabase

Copie no SQL Editor do Supabase Dashboard. Salve os resultados em `database/_legacy_inventory_2026-04-23_results.md`.

### 4.1. Todas as tabelas por tamanho (descoberta)
```sql
SELECT schemaname, relname, n_live_tup,
       pg_size_pretty(pg_total_relation_size(schemaname || '.' || relname)) as size
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

### 4.2. Tabelas sem atividade recente (candidatas a arquivar)
```sql
SELECT relname, last_autovacuum, last_analyze, n_live_tup
FROM pg_stat_user_tables
WHERE (last_analyze < NOW() - INTERVAL '30 days' OR last_analyze IS NULL)
  AND n_live_tup < 100
ORDER BY n_live_tup ASC, last_analyze ASC NULLS FIRST;
```

### 4.3. Tabelas com nomes suspeitos (legacy naming)
```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_type = 'BASE TABLE'
  AND (
    table_name ILIKE '%_old%'
    OR table_name ILIKE '%_backup%'
    OR table_name ILIKE '%_v1%'
    OR table_name ILIKE '%_temp%'
    OR table_name ILIKE '%_test%'
    OR table_name ILIKE '%_deprecated%'
  )
ORDER BY table_schema, table_name;
```

### 4.4. Funções arquivadas que ainda estão no banco (BUG)
```sql
SELECT n.nspname, p.proname
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN (
  'executar_agente_diario',
  'executar_cmv_ambos_bares',
  'executar_recalculo_desempenho_auto',
  'executar_sync_contagem_sheets',
  'process_analitico_data',
  'process_fatporhora_data',
  'process_pagamentos_data',
  'process_periodo_data',
  'process_tempo_data'
)
AND n.nspname NOT IN ('pg_catalog','information_schema');
```

Se retornar linhas: essas funções precisam de `DROP FUNCTION` em migration nova.

### 4.5. Views arquivadas no banco
```sql
SELECT table_schema, table_name
FROM information_schema.views
WHERE table_name IN ('eventos_cache', 'view_eventos_complete')
   OR table_name ILIKE '%_fixed%'
   OR table_name ILIKE '%_optimized%';
```

### 4.6. Materialized views sem refresh recente
```sql
SELECT schemaname, matviewname,
       pg_size_pretty(pg_total_relation_size(schemaname || '.' || matviewname)) as size
FROM pg_matviews
ORDER BY schemaname, matviewname;
-- Complementar com logs de refresh se existirem
```

### 4.7. Tabelas com 0 rows
```sql
SELECT schemaname, relname, n_live_tup, last_analyze
FROM pg_stat_user_tables
WHERE n_live_tup = 0
  AND schemaname NOT IN ('auth','storage','realtime','vault','supabase_functions','extensions','graphql','graphql_public','net','pgbouncer')
ORDER BY schemaname, relname;
```

### 4.8. Crons ativos (cruzar com inventário de edge functions)
```sql
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE active = true
ORDER BY jobname;
```

## 5. Regras firmes pra remoção

Antes de qualquer `DROP TABLE`:

1. **Tabelas `contahub_*` nunca** (regra do `CLAUDE.md`).
2. **Tabelas `*_historico` nunca** (auditoria).
3. **Tabelas `*_base` nunca** sem auditoria completa (campos manuais — ver `docs/regras-negocio.md` §10).
4. **Soft-deprecate 7 dias**:
   ```sql
   COMMENT ON TABLE public.TABELA IS 'DEPRECATED since 2026-04-23, drop scheduled 2026-04-30';
   ```
5. Branch Supabase (`supabase branches create cleanup-legacy-2026-04-23`) testada antes de main.
6. Migration com rollback explícito em `database/migrations/2026-04-XX-drop-TABELA.sql`.

## 6. Ações imediatas possíveis (sem Supabase remoto)

Estas podem ir pra commit agora:

- [x] Scripts reorganizados em `_active/` + `_archive/` (148 arquivos triados).
- [ ] Remover `frontend/src/app/api/financeiro/_deprecated_nibo/` (vazia).
- [ ] Remover `frontend/src/app/api/agendamento/buscar-stakeholder/` (vazia).
- [ ] Rodar `npx ts-prune` e arquivar resultado.

As ações destas 3 bullets finais ficam pro Cursor (requerem `git rm` + verificação `npm run build`).

## 7. Histórico deste doc

- 2026-04-23: Criação inicial. Inventário offline concluído. Parte DB depende do Supabase remoto.
- 2026-04-23 (execução Prompt 04): parte DB executada via Supabase MCP — ver seção 8.

---

## 8. Resultados DB — execução Prompt 04 (2026-04-23)

Rodadas as queries da seção 4 no projeto `uqtgsvujwcbymjmvkjhy` via `execute_sql`.

### 8.1. Candidatas diretas a soft-deprecate (naming explícito)

Zero referências em código de runtime. Única menção em `grep` foi comentário histórico em `database/migrations/2026-04-22-fix-etl-desempenho-semanal-v3.sql:7`.

| Objeto | Rows | Tamanho | Sinal | Drop previsto |
|--------|------|---------|-------|---------------|
| `crm.cliente_perfil_consumo_legacy_backup` | 104.111 | **176 MB** | sufixo `_legacy_backup` | 2026-05-01 |
| `crm.nps_falae_diario_legacy_backup` | 37 | 96 kB | sufixo `_legacy_backup` | 2026-05-01 |
| `meta.desempenho_manual_backup_20260422_v2` | 208 | 352 kB | backup 2026-04-22 | 2026-05-01 |
| `meta.desempenho_manual_backup_20260423` | 208 | 344 kB | backup 2026-04-23 | 2026-04-30 |
| `public.view_top_produtos_legacy_snapshot` | 200 | 264 kB | sufixo `_legacy_snapshot` | 2026-05-01 |

Total a liberar: ~177 MB (praticamente todo em `cliente_perfil_consumo_legacy_backup`).

### 8.2. Funções arquivadas que ainda estão no banco (query 4.4)

6 funções têm cópia em `database/_archived/` **e** estão ativas no banco. Mas todas também têm canônica em `database/functions/` — o banco está correto, os `_archived/` são snapshots históricos duplicados do código ativo.

| Função | `_archived/` | `database/functions/` | No banco | Verdict |
|--------|--------------|------------------------|----------|---------|
| `calculate_evento_metrics` | 3 snapshots | ✓ canônica | ✓ | OK |
| `process_analitico_data` | ✓ | ✓ | ✓ | OK |
| `process_fatporhora_data` | ✓ | ✓ | ✓ | OK |
| `process_pagamentos_data` | ✓ | ✓ | ✓ | OK |
| `process_periodo_data` | ✓ | ✓ | ✓ | OK |
| `process_tempo_data` | ✓ | ✓ | ✓ | OK |

Nenhum `DROP FUNCTION` necessário. Limpeza opcional dos snapshots em `database/_archived/` é tarefa à parte.

### 8.3. Materialized views (query 4.6)

```
gold.v_pipeline_health           40 kB   populada  (criada no Prompt 01)
public.view_visao_geral_anual    64 kB   populada  (produção)
```

Ambas saudáveis. Nada a deprecar.

### 8.4. Tabelas vazias (query 4.7) — NÃO deletar sem entrevista

42 tabelas com `n_live_tup=0`. Classificação:

**`agent_ai` (12 vazias)** — provavelmente V1 do AI agent. `agente_historico` (1.414) e `agente_uso` (707) SIM têm dados. Dono do módulo precisa classificar.

**Umbler campaigns (5 vazias)** — `umbler_campanha_destinatarios`, `umbler_campanhas`, `umbler_webhook_logs` (+ bronze correspondentes). Umbler em si está ativo (mensagens/conversas têm dados); só campanhas nunca rodaram.

**`system.*` (5 vazias)** — `insight_events`, `notificacoes`, `security_events` (4.4 MB overhead, sugere TRUNCATE recente), `uploads`, `validacoes_cruzadas`. Provavelmente política de retenção ativa.

**Outras (misc)** — `crm.crm_segmentacao`, `financial.custos_mensais_diluidos`, `hr.contratos_funcionario`, `integrations.bar_api_configs`, `integrations.contaazul_pessoas`, `meta.marketing_mensal`, `operations.bar_notification_configs`, `operations.checklist_automation_logs`, `public.cmv_manual`, `supabase_migrations.seed_files`. Nenhuma com naming legacy; todas parecem "feature configurada mas sem uso ainda".

**Ação proposta:** nenhuma. Flag pra follow-up com donos dos módulos.

### 8.5. `*_historico` e ContaHub

Conforme regras DURAS 1 e 3, intocadas. Confirmadas no inventário:

- `bronze.eventos_historico` (949 rows) — keep
- `operations.eventos_base_auditoria` (2.404 rows) — keep
- Todas `bronze_contahub_*` e `contahub_*` — keep

### 8.6. Migrations geradas nesta execução

Criadas em `database/migrations/` com prefixo `2026-04-23-deprecate-*`:

- `2026-04-23-deprecate-cliente-perfil-consumo-legacy-backup.sql`
- `2026-04-23-deprecate-nps-falae-diario-legacy-backup.sql`
- `2026-04-23-deprecate-desempenho-manual-backup-20260422-v2.sql`
- `2026-04-23-deprecate-desempenho-manual-backup-20260423.sql`
- `2026-04-23-deprecate-view-top-produtos-legacy-snapshot.sql`

Cada uma: `COMMENT ON ... IS 'DEPRECATED ...'` + view alias `<objeto>_DEPRECATED` pro período de observação. Nenhum DROP nesta sessão.
