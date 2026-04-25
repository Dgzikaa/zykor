# Mapa de Domínios — Zykor

> **Última revisão:** 2026-04-25 (post-medallion migration)
> Counts e tamanhos abaixo são **ordem de magnitude**. Consultar números reais com as queries inline antes de tomar decisões críticas.

---

## 1. Visão Geral do Sistema

```
SGB v2.0 — Sistema de Gestão de Bares
├── Ordinário Bar (bar_id=3) — operação completa, GetIn, ~850 pessoas
└── Deboche Bar (bar_id=4) — operação simplificada, fechado segundas
```

**Stack**: Next.js 15 + Supabase Edge Functions (Deno) + PostgreSQL 17 + pg_cron

---

## 2. Arquitetura de Schemas

> Para a fonte da verdade no frontend, ver [`frontend/src/lib/supabase/table-schemas.ts`](../frontend/src/lib/supabase/table-schemas.ts) — mapa `tabela → schema` usado pelo helper `tbl()` e `schemaOf()`.

Para listar todos os schemas e seus counts atuais:
```sql
SELECT schemaname, COUNT(*) AS tables
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog','information_schema','pg_toast',
  'extensions','graphql','graphql_public','realtime','storage','vault',
  'auth','pgsodium','pgsodium_masks','net','supabase_functions')
GROUP BY schemaname ORDER BY tables DESC;
```

### 2.1 Medallion (`bronze` / `silver` / `gold`)

Camadas de processamento de dados externos (principalmente ContaHub) seguindo o pattern medallion da Databricks. Sentido do fluxo: **bronze → silver → gold → consumo**.

| Schema | ~Tables | Purpose | Exemplos |
|--------|--------:|---------|----------|
| `bronze` | ~35 | Raw data ingerido sem transformação. JSONB blobs ou tabelas estruturadas espelhando a fonte 1:1. Cobre ContaHub, ContaAzul, GetIn, Sympla, Umbler, Yuzer, Google Reviews, Falaê. | `bronze.bronze_contahub_raw_data`, `bronze.bronze_contahub_avendas_porproduto_analitico`, `bronze.bronze_contaazul_lancamentos`, `bronze.bronze_yuzer_eventos` |
| `silver` | ~17 | Bronze processado: tipado, deduplicado, enriquecido com `bar_id`. **Source of truth para queries operacionais.** | `silver.tempos_producao`, `silver.faturamento_pagamentos`, `silver.vendas_item`, `silver.cliente_visitas`, `silver.cliente_estatisticas`, `silver.reservantes_perfil` |
| `gold` | ~5 | Agregações analíticas pré-calculadas pra dashboards. | `gold.gold_contahub_avendas_porproduto_analitico`, `gold.gold_contahub_avendas_vendasperiodo`, `gold.gold_contahub_operacional_stockout`, `gold.gold_contahub_produtos_temposproducao` |

> **Tabelas pré-medallion (extintas)**: `contahub_analitico`, `contahub_tempo`, `contahub_pagamentos`, `contahub_periodo`, `contahub_fatporhora`, `contahub_vendas`, `contahub_stockout` foram **substituídas** pelo medallion. Equivalências aproximadas:
> - `contahub_analitico` → `silver.vendas_item` + `bronze.bronze_contahub_avendas_porproduto_analitico`
> - `contahub_tempo` → `silver.tempos_producao` + `bronze.bronze_contahub_produtos_temposproducao`
> - `contahub_pagamentos` → `silver.faturamento_pagamentos` + `bronze.bronze_contahub_financeiro_pagamentosrecebidos`
> - `contahub_periodo` → `bronze.bronze_contahub_avendas_vendasperiodo`
> - `contahub_stockout` → `gold.gold_contahub_operacional_stockout`

### 2.2 Schemas Operacionais

| Schema | ~Tables | Purpose | Tabelas-chave |
|--------|--------:|---------|---------------|
| `operations` | ~23 | Core operacional do bar — eventos, mesas, contagem, checklist, configurações de bar. | `operations.eventos_base`, `operations.bares`, `operations.bares_config`, `operations.contagem_estoque_insumos`, `operations.checklist_*` |
| `financial` | ~14 | Financeiro: caixa, DRE manual, CMV, orçamentação, PIX. | `financial.dre_manual`, `financial.cmv_semanal`, `financial.cmv_mensal`, `financial.orcamentacao`, `financial.caixa_*`, `financial.pix_enviados` |
| `system` | ~22 | Logs, alertas, notificações, audit trail, sync metadata, uploads. Service-role-heavy. | `system.system_logs`, `system.notificacoes`, `system.cron_heartbeats`, `system.automation_logs`, `system.audit_trail` |
| `integrations` | ~26 | APIs externas: ContaAzul, Umbler, Sympla, Yuzer, GetIn, Google Reviews, Falaê. Cada vendor tem suas próprias tabelas. | `integrations.contaazul_lancamentos`, `integrations.umbler_conversas`, `integrations.sympla_pedidos`, `integrations.yuzer_*`, `integrations.getin_reservations`, `integrations.google_reviews` |
| `meta` | ~11 | Metas, marketing, planejamento estratégico, OKRs. | `meta.metas_anuais`, `meta.metas_desempenho_historico`, `meta.marketing_semanal`, `meta.organizador_okrs`, `meta.semanas_referencia` |
| `agent_ai` | ~15 | AI agent — alertas, conversas, insights, métricas, padrões detectados, memória vetorial. | `agent_ai.agent_insights_v2`, `agent_ai.agente_alertas`, `agent_ai.agente_conversas`, `agent_ai.agente_memoria_vetorial` |
| `crm` | ~8 | CRM — NPS, voz do cliente, segmentação, perfis de consumo. | `crm.nps`, `crm.nps_falae_diario_pesquisa`, `crm.voz_cliente`, `crm.crm_segmentacao` |
| `hr` | ~7 | RH — funcionários, contratos, folha, pesquisa de felicidade, áreas, cargos. | `hr.funcionarios`, `hr.contratos_funcionario`, `hr.folha_pagamento`, `hr.pesquisa_felicidade` |
| `auth_custom` | ~4 | Autenticação custom — usuários da app, vínculo usuário↔bar, empresas, grupos. | `auth_custom.usuarios`, `auth_custom.usuarios_bares`, `auth_custom.empresas` |
| `ops` | 1 | Observability — mapeamento de jobs/edge functions a camadas medallion. Schema novo (criado em commit `13f6072e`, abril/2026). | `ops.job_camada_mapping` |

### 2.3 `public` — Legacy

5 tabelas remanescentes em `public` (de ~229 originais antes da migração de schemas). Não criar novas tabelas aqui.

```sql
SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' ORDER BY relname;
```

| Tabela | Status |
|--------|--------|
| `public.usuarios`, `public.usuarios_bares` | **Espelho** de `auth_custom.usuarios_bares` (conteúdo idêntico — verificado, sem drift). RLS helper `public.user_has_bar_access()` lê daqui. Investigação tracked em task #44 (eventual collapse via view-alias). |
| `public.api_credentials` | Resíduo da migração (também existe em `integrations`). Tracked em task de cleanup. |
| `public.cmv_manual` | Legacy — consolidação CMV manual antiga. |
| `public.view_top_produtos_legacy_snapshot` | Snapshot histórico, marcada como legacy no nome. |

### 2.4 Como descobrir o schema certo

1. **Frontend (browser/server-side TypeScript)**: usar `tbl()` e `schemaOf()` de [`frontend/src/lib/supabase/table-schemas.ts`](../frontend/src/lib/supabase/table-schemas.ts):
   ```ts
   import { tbl } from '@/lib/supabase/table-schemas';
   const { data } = await tbl(supabase, 'eventos_base').select('*').eq('bar_id', barId);
   ```
2. **Backend (edge functions / scripts)**: usar `.schema('<schema>')` explicitamente:
   ```ts
   await supabase.schema('operations').from('eventos_base').select('*');
   ```
3. **SQL direto**: prefixar o schema (`SELECT ... FROM operations.eventos_base`).
4. **Convenções de naming**: ver [`database/CONVENTIONS.md`](CONVENTIONS.md) para prefixos/sufixos.

---

## 3. Fluxo de Dados (5 camadas)

### Camada 1: Ingestão

Dados entram via edge functions chamadas por `pg_cron`.

| Fonte | Edge Function | Frequência | Schema/Tabela Destino | Volume |
|-------|--------------|------------|------------------------|--------|
| ContaHub API | `contahub-sync-automatico` | 2x/dia (04:00, 19:00 BRT) | `bronze.bronze_contahub_raw_data` | ~5K rows (staging JSONB) |
| ContaAzul API | `contaazul-sync` | Periódico | `bronze.bronze_contaazul_lancamentos` → `integrations.contaazul_lancamentos` | ~74K rows |
| GetIn API v2 | `getin-sync-continuous` | Cada 4h | `integrations.getin_reservations` | ~5K rows |
| Google Sheets | `google-sheets-sync` | 1x/dia (02:00 BRT) | `crm.nps`, `crm.nps_reservas`, `crm.voz_cliente`, `hr.pesquisa_felicidade` | ~10K rows |
| Google Sheets | `sync-cmv-sheets` | 1x/dia (05:00 BRT) | `financial.cmv_semanal` | ~163 rows |
| Google Sheets | `sync-contagem-sheets` | 1x/dia | `operations.contagem_estoque_insumos` | ~200K rows |
| Apify (Google Reviews) | `google-reviews-apify-sync` | 1x/dia (06:00 BRT) | `integrations.google_reviews` | ~10K rows |
| Sympla API | `integracao-dispatcher` | On-demand | `integrations.sympla_eventos`, `sympla_pedidos`, `sympla_participantes` | ~30K rows |
| Umbler/WhatsApp | `webhook-dispatcher` | Webhook real-time | `integrations.umbler_conversas`, `umbler_mensagens` | ~50K rows |
| Yuzer | Externo + bronze | Periódico | `bronze.bronze_yuzer_*` → `integrations.yuzer_*` | ~5K rows |
| Manual (frontend) | API routes Next.js | User action | `operations.eventos_base`, `financial.dre_manual`, `hr.folha_pagamento` | Variável |

> **Nota NIBO → ContaAzul**: o sistema migrou de NIBO para ContaAzul em **2026-03-24** (migration `database/migrations/20260324_contaazul_tables.sql`). As tabelas `nibo_agendamentos`, `nibo_categorias`, `nibo_centros_custo`, `nibo_stakeholders`, `nibo_logs_sincronizacao` foram **substituídas** pelo conjunto `integrations.contaazul_*`. Equivalência: `nibo_agendamentos` ≈ `integrations.contaazul_lancamentos`. Quem busca "NIBO" no código provavelmente quer um dos 6 ContaAzul.

### Camada 2: Processamento (Bronze → Silver)

Edge function `contahub-processor` lê do `bronze` e escreve em `silver`. Mesma lógica para ContaAzul, Yuzer, Sympla.

```
bronze.bronze_contahub_raw_data (JSONB blob)
    │
    ├── process_analitico_data()    → silver.vendas_item
    ├── process_tempo_data()        → silver.tempos_producao
    ├── process_pagamentos_data()   → silver.faturamento_pagamentos
    └── process_*_data()            → silver.* (etc)

bronze.bronze_contahub_avendas_porproduto_analitico
    └── (Já tipado, sem processor adicional — bronze já é consumível)

bronze.bronze_yuzer_*           → integrations.yuzer_*  (sync direto)
bronze.bronze_contaazul_*       → integrations.contaazul_* (sync direto)
```

Triggers automáticos em `silver.vendas_item` e equivalentes:
- `set_categoria_mix_*` → categoriza em BEBIDA / COMIDA / DRINK
- `map_categoria_tempo` → mapeia categoria de tempo

### Camada 3: Cálculo por Evento

`calculate_evento_metrics(evento_id)` é chamada manualmente ou por recálculo batch.

```
silver.vendas_item ───────────┐
silver.tempos_producao ───────┤
silver.faturamento_pagamentos ┤
bronze.bronze_contahub_*      ┤──→ calculate_evento_metrics(evento_id)
integrations.contaazul_lancamentos ─┤       │
integrations.yuzer_fatporhora ──────┤       │ calcula 30+ campos:
integrations.yuzer_pagamento ───────┤       │ cl_real, real_r, te_real, tb_real,
integrations.sympla_pedidos ────────┤       │ percent_b/c/d, t_coz, t_bar,
integrations.getin_reservations ────┘       │ fat_19h_percent, c_art, c_prod, …
                                            ▼
                              operations.eventos_base (~960 rows, 71 colunas)
```

Triggers em `operations.eventos_base`:
- `calcular_real_r` → `real_r` = ContaHub + Sympla + Yuzer
- `fill_semana_on_insert` → preenche ISO week number

### Camada 4: Agregação Semanal

`recalcular-desempenho-v2` (edge function, `pg_cron` diário 08:00 BRT).

```
operations.eventos_base ─────┐
integrations.contaazul_lancamentos ─┤
crm.nps_agregado_semanal (VIEW) ────┤
silver.faturamento_pagamentos ──────┤──→ 6 calculators:
                                    │       calc-faturamento, calc-custos,
RPCs:                               │       calc-operacional (4 RPCs),
  calcular_stockout_semanal         │       calc-satisfacao (2 RPCs),
  calcular_mix_vendas               │       calc-distribuicao,
  calcular_tempo_saida              │       calc-clientes (2 RPCs)
  calcular_atrasos_tempo            │           │
  get_google_reviews_stars_by_date  │           ▼
  calcular_nps_semanal_*            │   meta.metas_desempenho_historico
  calcular_metricas_clientes        │   (~130 rows × 147 colunas — god table)
  get_count_base_ativa ─────────────┘
```

Outros agregadores:
- `cmv-semanal-auto` → `financial.cmv_semanal`
- `sync-cmv-mensal` → `financial.cmv_mensal`

### Camada 5: Consumo

```
meta.metas_desempenho_historico ──┬── /estrategico/desempenho
                                  ├── /estrategico/visao-geral
                                  ├── /estrategico/orcamentacao
                                  ├── agente-dispatcher → Gemini AI → Discord
                                  ├── alertas-dispatcher → Discord
                                  └── relatorio-pdf → Discord

operations.eventos_base ──────────┬── /ferramentas/calendario
                                  ├── /analitico/eventos
                                  └── /analitico/atracoes

financial.cmv_semanal ──────────────── /ferramentas/cmv-semanal
integrations.google_reviews ────────── /analitico/ (reviews)
crm.nps + crm.voz_cliente ──────────── /crm/ (CRM dashboards)
integrations.umbler_conversas ──────── /crm/conversas (WhatsApp)
financial.dre_manual ────────────────── /operacional/dre, /ferramentas/dre
```

---

## 4. Tabelas Críticas (Top por volume)

> Volumes mudam diariamente. Consultar atual com:
> ```sql
> SELECT schemaname, relname, n_live_tup,
>        pg_size_pretty(pg_total_relation_size((schemaname||'.'||relname)::regclass)) AS size
> FROM pg_stat_user_tables
> WHERE schemaname IN ('bronze','silver','gold','operations','financial','system','integrations','meta','agent_ai','crm','hr','auth_custom','public','ops')
> ORDER BY n_live_tup DESC LIMIT 20;
> ```

| # | Tabela | ~Rows | ~Size | Por que é crítica |
|---|--------|------:|-------|-------------------|
| 1 | `silver.vendas_item` | 915K | 401 MB | Fonte de faturamento, mix de produtos. |
| 2 | `bronze.bronze_contahub_avendas_porproduto_analitico` | 840K | 221 MB | Bronze do analítico ContaHub. |
| 3 | `silver.tempos_producao` | 645K | 207 MB | Tempos de preparo/entrega. Alimenta atrasos. Tunada em `perf/04` (`scale_factor=0.05`). |
| 4 | `bronze.bronze_contahub_produtos_temposproducao` | 619K | 169 MB | Bronze de tempos. |
| 5 | `silver.faturamento_pagamentos` | 237K | 51 MB | Formas de pagamento. Alimenta `real_r` e DRE. |
| 6 | `bronze.bronze_contahub_avendas_vendasperiodo` | 229K | 55 MB | |
| 7 | `bronze.bronze_contahub_financeiro_pagamentosrecebidos` | 221K | 72 MB | |
| 8 | `silver.cliente_visitas` | 220K | 228 MB | Tunada em `perf/04`. |
| 9 | `operations.contagem_estoque_insumos` | 202K | 65 MB | Alimenta CMV. |
| 10 | `integrations.contaazul_lancamentos` | 75K | 172 MB | Substitui `nibo_agendamentos`. Despesas/receitas. |
| 11 | `gold.gold_contahub_operacional_stockout` | 55K | 163 MB | Stockout pré-agregado. |
| 12 | `meta.metas_desempenho_historico` | ~130 | <1 MB | God table — 147 colunas. Alimenta TUDO downstream. |

---

## 5. Cron Jobs Ativos (pg_cron)

> Snapshot de 2026-04-25. Cron jobs mudam com frequência. Estado real:
> ```sql
> SELECT jobname, schedule, active FROM cron.job WHERE active = true ORDER BY jobname;
> ```

| Horário BRT | Job | Edge Function | Criticidade |
|-------------|-----|--------------|-------------|
| 02:00 | google-sheets-sync | `google-sheets-sync` | MÉDIA |
| 04:00 | contahub-daily-sync | `contahub-sync-automatico` | CRÍTICA |
| 04:10 / 04:25 | contahub-processor-{1,2} | `contahub-processor` | CRÍTICA |
| 05:00 | nibo-sync (legado) / contaazul-sync | `contaazul-sync` | ALTA |
| 05:00 | sync-cmv-sheets | `sync-cmv-sheets` | ALTA |
| 06:00 | google-reviews | `google-reviews-apify-sync` | BAIXA |
| Cada 4h | getin-continuous | `getin-sync-continuous` | ALTA |
| 08:00 | desempenho-v2-diario | `recalcular-desempenho-v2` | CRÍTICA |
| 09:00 seg | desempenho-v2-segunda | `recalcular-desempenho-v2` | CRÍTICA |
| 09:00 | agente-diario | `agente-dispatcher` | MÉDIA |
| 10:00 | sync-eventos | `sync-dispatcher` | ALTA |
| 19:00 | contahub-evening | `contahub-sync-automatico` | CRÍTICA |
| 19:00 | stockout-sync | `contahub-stockout-sync` | ALTA |
| Cada 30min | cron-watchdog | `cron-watchdog` | ALTA |

---

## 6. Regras de Negócio por Bar

> Estas regras estão **hardcoded** em múltiplos arquivos (edge functions, RPCs SQL, frontend). Não existe tabela de configuração por bar. Adicionar um 3º bar hoje requer mudanças em 10+ arquivos. Centralização planejada via `operations.bares_config`.

| Regra | Ordinário (bar_id=3) | Deboche (bar_id=4) |
|-------|---------------------|-------------------|
| Dias operação | Qua-Dom | Ter-Sab |
| Fechado fixo | — | Segunda-feira |
| Locais bar (drinks) | Preshh, Montados, Mexido, Drinks, Drinks Autorais, Shot e Dose, Batidos | Bar |
| Locais cozinha | Cozinha, Cozinha 1, Cozinha 2 | Cozinha, Cozinha 2 |
| Tempo bar usa | t0_t3 | t0_t2 |
| Atraso bar threshold | >600s (10min) | >600s (10min) |
| Atraso cozinha threshold | >1200s (20min) | >1200s (20min) |
| Categorias ContaAzul atração | Atrações Programação, Produção Eventos | Atrações/Eventos |
| GetIn ativo | Sim | Não |
| Agregação semanal | Qui+Sab+Dom | Ter+Qua+Qui e Sex+Sab |

---

## 7. Multi-Tenancy

Toda tabela operacional tem `bar_id`. A cadeia é:

```
auth_custom.empresas (1 row)
  → operations.bares_config (~2 rows)
    → auth_custom.usuarios_bares (~24 rows)  -- ver SELECT abaixo
      → auth_custom.usuarios (~12 rows)
                │
        bar_id = 3 (Ordinário)
        bar_id = 4 (Deboche)
                │
        Presente em ~80 tabelas como FK ou coluna
```

> Counts atuais:
> ```sql
> SELECT 'usuarios_bares' AS tabela, count(*) FROM auth_custom.usuarios_bares
> UNION ALL SELECT 'usuarios', count(*) FROM auth_custom.usuarios
> UNION ALL SELECT 'bares', count(*) FROM operations.bares;
> ```

**Frontend**: `BarContext` gerencia seleção. `UserContext` valida permissões. Troca de bar recarrega página.

**RLS**: helper `public.user_has_bar_access(check_bar_id)` lê de `public.usuarios_bares` (espelho de `auth_custom.usuarios_bares`). Policies multi-tenant usam:
```sql
USING (bar_id IS NULL OR public.user_has_bar_access(bar_id))
WITH CHECK (bar_id IS NOT NULL AND public.user_has_bar_access(bar_id))
```

---

## 8. Como Pesquisar

| Pergunta | Onde achar |
|----------|------------|
| Em qual schema está a tabela X? | [`frontend/src/lib/supabase/table-schemas.ts`](../frontend/src/lib/supabase/table-schemas.ts) |
| Convenções de naming (prefixos, sufixos) | [`database/CONVENTIONS.md`](CONVENTIONS.md) |
| Histórico de mudanças DDL | `database/migrations/` (ordem cronológica por nome) |
| Edge functions e o que cada uma faz | `backend/supabase/functions/` (cada pasta tem `index.ts`) |
| Regras de negócio de cálculo | [`docs/regras-negocio.md`](../docs/regras-negocio.md) |
| Cron jobs ativos | `SELECT jobname, schedule, active FROM cron.job WHERE active = true` |

---

## Histórico de revisões

- **2026-04-25**: Refresh pós-medallion migration (37 dias de drift). Adiciona Seção 2 (arquitetura de schemas), substitui Camadas 1-5 que referenciavam `contahub_analitico/tempo/pagamentos/etc` extintas, adiciona nota NIBO→ContaAzul, transforma counts cravados em ordem-de-magnitude + queries vivas.
- **2026-03-19**: Revisão anterior (snapshot que ficou drifting). Maioria das tabelas ainda em `public`.
