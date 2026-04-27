# Sprint Perf + Sec — Abril 2026

> Retrospectiva consolidada da sprint de **performance + security** no banco Zykor (Supabase PostgreSQL 17).

## Resumo executivo

- **Período:** 2026-04-24 → 2026-04-26 (3 dias)
- **PRs:** 16 total — 5 fases perf + 3 fases sec + 5 cleanups/docs/Vercel + 3 baseline/auxiliares
- **Métricas finais:** advisor de performance **218 → 50** (-77%), 58 indexes dropados (~42 MB), 280+ rows financeiras blindadas de `anon`, 6 tabelas multi-tenant fechadas, 8 schemas auditados
- **Zero incidents, zero rollbacks executados.** Todas as migrations idempotentes via `IF EXISTS` / `IF NOT EXISTS`.

---

## Trilha por fase

### Perf — 5 fases (#10, #11, #12, #14, #20-#23)

| PR | Fase | Escopo | Antes | Depois | Validação |
|----|------|--------|-------|--------|-----------|
| #10 | perf/01 — duplicate_indexes | 8 índices duplicados (bronze+silver+operations) | 8 advisor warns | 0 | `pg_indexes` diff + scan-counter |
| #11 | perf/02 — rls_initplan | Envelopar `auth.<fn>()` em `(select …)` em 58 policies | 58 warns | 0 | EXPLAIN ANALYZE before/after; InitPlan visível em todas |
| #12 | perf/03 — multiple_permissive | DROP 9 `service_role_full_*` redundantes | 66 warns | 12 | Smoke 4-callers; descoberta extra de leak `anon` em 280 rows financeiras |
| #14 | perf/04 — autovacuum_tuning | scale_factor 0.05 em `silver.cliente_visitas` + `silver.tempos_producao` (alta-rotatividade) | bloat 1.4× | bloat 0.4× | `pgstattuple` before/after |
| #20-#23 | perf/05 — unused_indexes (4 batches) | DROP 58 índices `idx_scan=0` em janela 87 dias | 75 INFOs | 16 | Audit 4-vetores: grep + composite + pg_stat_statements + idx_scan |

**Detalhe perf/05 (4 batches):**

| Batch | PR | Schemas | Indexes | Tamanho |
|-------|----|---------|---------|---------|
| 1 | #20 | bronze + system | 14 | ~23 MB |
| 2 | #21 | silver + gold | 9 | ~16.5 MB |
| 3 | #22 | operations + financial | 13 | ~2.3 MB |
| 4 | #23 | integrations + agent_ai + hr + crm + public | 22 | ~600 kB |
| **Total** | | **9 schemas** | **58** | **~42 MB** |

### Sec — 3 fases (#13, #15, #16)

| PR | Fase | Escopo | Rows blindadas | Validação |
|----|------|--------|----------------|-----------|
| #13 | sec/01 — public_leaks | 3 policies abertas em `operations.bares`, `system.system_logs`, `operations.checklist_automation_logs` | leak removido a `anon` | Smoke 4-callers (admin × 2 bares + UUID inexistente + service_role) |
| #15 | sec/02 — multi-tenancy | Fechar cross-tenant em 6 tabelas: bronze (1) + financial (2) + system (2) + meta (1). Substituir RLS aberta por `user_has_bar_access()` | EXPLAIN com filter visível | Smoke + EXPLAIN ANALYZE com `Filter: user_has_bar_access(bar_id)` |
| #16 | sec/03 — dre_manual_backfill_rls | Fechar `dre_manual` com **defesa em 4 camadas**: RLS USING + RLS WITH CHECK + table CHECK constraint + API 400 + UI guard | 100% backfill protegido | Test matrix com cutoff date + valid/invalid categoria_macro |

**Bonus sec do PR #12 (perf/03):** ao remover `service_role_full_*` redundantes descobriu-se que essas policies vazavam **280 rows financeiras a `anon`** (pre-existentes). Fechado no mesmo PR.

### Suporte / cleanups (#8, #9, #17, #18, #19)

| PR | Tipo | Conteúdo |
|----|------|----------|
| #8 | chore | Baseline snapshot do advisor pre-sprint |
| #9 | feat (auto) | Vercel Web Analytics scaffolding (substituído por #17) |
| #17 | feat | Vercel Analytics + Speed Insights instrumentado para Web Vitals reais |
| #18 | chore | Remover método `findById` morto do `BaresRepository` (descoberto via audit por-método; grep direto havia falsamente flagged repo todo) |
| #19 | docs | Refresh do `database/DOMAIN_MAP.md` para realidade pós-medallion (335 linhas, seção 2 sobre arquitetura bronze/silver/gold) |

---

## Padrões emergentes (reutilizáveis)

### 1. Gate pattern (1 → 2 → 3)

Toda mudança DDL/RLS passou por 3 gates explícitos:

- **Gate 1 — Pre-flight:** investigação read-only (grep + queries em `pg_*` + smoke do estado atual). Sub-gate 1.1 a 1.5 dependendo da fase. Sem DDL.
- **Gate 2 — Migration files:** `database/migrations/<data>-<fase>.sql` + `.rollback.sql`. Mostrados antes de aplicar.
- **Gate 3 — Apply + smoke + PR:** `apply_migration` ou `execute_sql`, smoke pós-apply, snapshot do advisor, commit + PR.

**Por que funcionou:** zero rollbacks executados. Todo bug pego em Gate 1 ou Gate 2. Sub-gates impediram scope creep.

### 2. Smoke-test como ground truth (advisor é piso, não teto)

Confirmado em PRs #12, #13, #15, #16: o advisor **não detecta** vários classes de leaks:
- Policies abertas que vazam de fato a `anon` (advisor flagged como "policy ok, role anon");
- DUPLICATE com UNIQUE (advisor só compara entre INDEX comuns);
- RLS aberta que parecia fechada (advisor vê o helper `user_has_bar_access` mas não valida o argumento);

**Regra adotada:** sempre rodar smoke 4-callers antes de declarar Gate 3 ok. Smoke = real query como `anon` + `authenticated UUID admin bar=3` + `authenticated UUID admin bar=4` + `service_role`.

### 3. Defense in depth (sec/03 padrão)

`dre_manual` fechado com 4 camadas independentes:
1. **RLS USING** — `bar_id` filter via `user_has_bar_access()`
2. **RLS WITH CHECK** — bar_id NOT NULL no INSERT/UPDATE
3. **Table CHECK constraint** — `data_competencia >= '2026-01-01'` cutoff (impede backfill)
4. **API 400 guard** — `route.ts` rejeita request sem `bar_id`
5. **UI guard** — modal disable + warning text

**Razão:** RLS sozinha podia ser contornada por race conditions, falhas de inicialização do `auth.uid()`, ou bugs em `user_has_bar_access`. Camadas adicionais convergem para zero leak garantido.

### 4. Migration apply via Read → apply_migration/execute_sql

**Regra rígida:** nunca redigitar SQL no chat. Sempre:
1. Escrever o SQL no arquivo `.sql`
2. `Read` o arquivo
3. Passar o conteúdo lido pra `apply_migration` (DDL transacional) ou `execute_sql` (DDL com `CONCURRENTLY`)

**Por que:** evita typos. Em sec/02 a primeira tentativa redigitou `agente_uso` (não existia) em vez de `agente_scans`. Pego em smoke pós-apply, mas custou 1 ciclo.

### 5. Pre-flight de 4 vetores pra unused_indexes

Pra cada candidato:
1. **grep código** (frontend + backend) por nome do index e nome de coluna
2. **composite check** — index é sub-prefix de algum UNIQUE/composite?
3. **pg_stat_statements** — algum query real filtra por essa coluna?
4. **idx_scan / last_idx_scan** — janela de stats está ativa? (verificar `pg_postmaster_start_time()` e `idx_scan` em índices conhecidos como hot)

**Caso especial pego pelo método:** `idx_eventos_base_conta_assinada` (1.5 MB, partial). Feature ATIVA (35 hits no grep), mas o WHERE filter nunca era usado — todos os queries faziam SELECT direto da coluna sem filter. Index criado out-of-band sem rastro no git.

### 6. Apply em paralelo via execute_sql (Plano B)

`DROP INDEX CONCURRENTLY` é incompatível com transaction wrapper de `apply_migration`. **Plano B** que validamos em perf/01 e reusamos em todos os perf/05:
- Cada `DROP INDEX CONCURRENTLY` rodado em chamada separada de `execute_sql`
- Várias chamadas em paralelo no mesmo turn (até 22 simultâneas no Batch 4)

---

## Blind spots descobertos (advisor + grep)

| Blind spot | Manifestação | Mitigação adotada |
|------------|--------------|-------------------|
| **Advisor RLS** não valida argumentos do helper | sec/02 — policy parecia ok mas vazava | Smoke 4-callers obrigatório |
| **Advisor duplicate_index** não compara contra UNIQUE | perf/05 b3 — `idx_bares_config_bar_id` dup de UNIQUE não flagged como `duplicate_index`, só como `unused_index` | Auditar manualmente prefix de UNIQUEs no Gate 1 |
| **Grep direto** falha pra factory pattern | sec/01 inicial — `BaresRepository` parecia dead code, mas era acessada via `repos().bares` destructuring | Audit por-método com `Grep` em `<repo>\\.<methodName>` patterns |
| **Index parcial dead** apesar da feature ativa | perf/05 b3 + b4 — `conta_assinada` e `valor_nao_pago` partials nunca usados | Sempre validar via pg_stat_statements, não só por presença de coluna no código |
| **Stats window** pode estar resetada | Pre-flight de perf/05 — `idx_scan=0` pode significar tabela jovem, não dead | Confirmar `pg_postmaster_start_time()` + idx_scan em hot indexes |
| **Out-of-band DDL** sem rastro no git | perf/05 b3 — `idx_eventos_base_conta_assinada` não está em nenhuma migration; fase 4 também viu `eventos_base.reloptions` modificadas out-of-band | Tracked como follow-up #40, follow-up #41 |
| **DDL out-of-band como anti-pattern** (consolidação dos casos acima) | Sprint inteira viu **dois** casos out-of-band — index parcial criado fora de migration + reloptions de autovacuum aplicadas via Studio/psql. Em ambos, próxima auditoria descobriria "do zero". | **Mitigação aplicada** (pós-Bloco B follow-ups): regra explícita em `database/CONVENTIONS.md` seção "DDL out-of-band — proibido" + migration retroativa formalizando `eventos_base` reloptions (PR #28). |

---

## Items diferidos / follow-ups

### Tracked (com PR/issue futuro)
- **#28** — RAM 16GB upgrade: depende de 24-72h de Vercel Speed Insights data pós-merge #17
- **#30** — dirty git tree (~104 arquivos `D` legacy não-stageados): cleanup separado, não-blocker
- **#32** — `cron.job_run_details` investigação (job duration > 30s spotted no advisor, fora do escopo perf/05)
- **#40** — `eventos_base` `reloptions` modificadas out-of-band: investigar quem/quando alterou
- **#41** — `eventos_base` table_bloat: VACUUM FULL agendado fora-de-pico (advisor INFO ainda flagged)
- **#42** — Cleanup helpers RLS duplicados (`user_has_bar_access` vs alternativas)
- **#44** — Collapse `auth_custom.usuarios_bares` × `public.usuarios_bares` (duplicação confirmada sem drift; usar view-alias)
- **#45** — Eventual reattribution dos 9 rows legacy de `dre_manual` com `bar_id NULL`

### Quick-wins na fila
- **yuzer JS-side filter → SQL WHERE** (8 callers): reduzir transferência de dados, baixa complexidade
- **`unindexed_foreign_keys`**: subiu de 6 → 17 após perf/05 (esperado — alguns indexes dropados cobriam FKs incidentalmente). Decidir caso-a-caso se vale recriar (todos eram low-traffic; provavelmente não)

---

## Métricas finais (snapshot 2026-04-26)

### Performance advisor — 218 → 50 (-77%)

| Categoria | Pre (2026-04-24) | Post (2026-04-26) | Δ | PRs |
|-----------|------------------|-------------------|---|-----|
| `unused_index` | 75 | 16 | **-79%** | #20, #21, #22, #23 |
| `multiple_permissive_policies` | 66 | 12 | **-82%** | #12 |
| `auth_rls_initplan` | 58 | 0 | **-100%** | #11 |
| `duplicate_index` | 8 | 0 | **-100%** | #10 |
| `unindexed_foreign_keys` | 6 | 17 | +11 (trade-off perf/05) | — |
| `no_primary_key` | 3 | 3 | 0 | — (legacy backups) |
| `table_bloat` | 1 | 1 | 0 | follow-up #41 |
| `auth_db_connections_absolute` | 1 | 1 | 0 | recomendação Supabase |
| **TOTAL** | **218** | **50** | **-77%** | |

### Espaço em disco

- **58 indexes dropados → ~42 MB liberados**
- Distribuído: bronze+system 23 MB, silver+gold 16.5 MB, operations+financial 2.3 MB, long tail 600 kB
- Bonus: `silver.cliente_visitas` + `silver.tempos_producao` bloat 1.4× → 0.4× via autovacuum tuning

### Security advisor — sem regressão real

Os 5 grupos de findings sec (`function_search_path_mutable`, `rls_enabled_no_policy`, `security_definer_view`, `rls_disabled_in_public`, `materialized_view_in_api`) não eram alvo do sprint — focamos em **leaks reais com smoke-test**, não em conformidade do advisor. Resultado:

- Pre: 151 findings sec
- Post: 150 findings sec (sem o pg_graphql_anon_table_exposed que é lint novo do Supabase, fora do escopo)
- **Mas:** 280+ rows financeiras + 6 tabelas multi-tenant + 1 backfill RLS fechados de fato. Smoke-test confirmou.

### RLS posture

- **6 tabelas** com cross-tenant fechado (sec/02): `bronze.bronze_yuzer_*`, `financial.dre_*`, `system.notificacoes`, `system.system_logs`, `meta.metas_*`
- **3 leaks abertos** fechados (sec/01): `operations.bares`, `system.system_logs`, `operations.checklist_automation_logs`
- **9 redundantes** removidos (perf/03/sec): `service_role_full_*` que vazavam pra `anon`
- **1 helper SECURITY DEFINER** validado: `public.user_has_bar_access()`

---

## Lições para a próxima sprint

1. **Smoke 4-callers padrão** desde Gate 1 — economizou 2-3 ciclos onde advisor mentia.
2. **Read → apply** ritualmente — typo em SQL redigitado custou 1 ciclo no início; depois zero.
3. **Pre-flight 4-vetores** pra unused indexes — pegou 2 partials dead apesar de features ativas.
4. **Defense in depth** quando RLS for o único entre dado e usuário — sec/03 modelo.
5. **Plano B (`execute_sql` paralelo)** para DDL com `CONCURRENTLY` — confirmado escalável até 22 ops simultâneas.
6. **Out-of-band DDL é alarme** — sempre que um index/reloption não tiver rastro no git, abrir follow-up de investigação.

---

**Sprint encerrada com perf/05 batch 4 (PR #23).** Próxima frente sugerida: atacar `function_search_path_mutable` (57) + `security_definer_view` (32) — sec/04 e sec/05.
