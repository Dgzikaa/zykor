# Convenções de Nomenclatura — Banco Zykor

> **Legenda**: Seções marcadas com *[ESTADO ATUAL]* descrevem padrões já praticados em produção. Seções marcadas com *[REGRA FUTURA]* são convenções a adotar em novos objetos e em consolidações planejadas.

## Tabelas

### Por domínio [ESTADO ATUAL]

| Prefixo | Domínio | Exemplos |
|---------|---------|----------|
| `contahub_` | PDV/Vendas (ContaHub) | `contahub_analitico`, `contahub_tempo`, `contahub_pagamentos`, `contahub_periodo`, `contahub_vendas`, `contahub_stockout`, `contahub_fatporhora`, `contahub_cancelamentos`, `contahub_raw_data` |
| `nibo_` | Financeiro (NIBO) | `nibo_agendamentos`, `nibo_categorias`, `nibo_centros_custo`, `nibo_logs_sincronizacao` |
| `getin_` | Reservas (GetIn) | `getin_reservations` |
| `sympla_` | Eventos (Sympla) | `sympla_eventos`, `sympla_pedidos`, `sympla_participantes` |
| `yuzer_` | POS secundário (Yuzer) | `yuzer_produtos`, `yuzer_fatporhora`, `yuzer_pagamento` |
| `umbler_` | WhatsApp/CRM (Umbler) | `umbler_conversas`, `umbler_mensagens`, `umbler_config` |
| `windsor_` | Marketing/Social (Windsor) | `windsor_google`, `windsor_instagram_stories` |
| `fp_` | Finanças Pessoais (Pluggy) | `fp_transacoes`, `fp_contas`, `fp_categorias` |
| `cmv_` | Custo Mercadoria Vendida | `cmv_semanal`, `cmv_mensal` |
| `cmo_` | Custo Mão de Obra | `cmo_semanal` |
| `checklist_` | Checklists operacionais | `checklist_agendamentos`, `checklist_auto_executions` |
| Sem prefixo | Core do negócio | `eventos_base`, `funcionarios`, `usuarios`, `empresas`, `insumos`, `areas`, `cargos` |

### Qualificadores [ESTADO ATUAL]

| Sufixo | Significado | Exemplo |
|--------|------------|---------|
| `_base` | Tabela principal (editável) | `eventos_base` |
| `_cache` | Cache materializado (regenerável) | `eventos_cache` |
| `_historico` | Histórico/auditoria | `receitas_historico`, `contagem_estoque_historico` |
| `_logs` | Logs de operação | `sync_logs_contahub`, `getin_sync_logs` |
| `_config` | Configuração | `bares_config`, `umbler_config` |
| `_raw_data` | Dados brutos (staging) | `contahub_raw_data` |

### Proibido [REGRA FUTURA — não criar novos objetos com esses padrões]

- `_fixed`, `_optimized`, `_v2` como sufixo de tabela em produção
- Duas tabelas com mesma entidade sem/com prefixo (`analitico` + `contahub_analitico`)
- Mistura pt-BR/en no mesmo domínio (`notificacoes` + `notifications`)
- Tabelas temporárias permanentes (`nibo_temp_agendamentos`)

> **Nota**: Esses anti-patterns existem no banco atual como legado. Não serão corrigidos por renomeação direta (risco de quebra). Serão resolvidos via views-alias ou migração gradual.

---

## Views

### Prefixos em produção [ESTADO ATUAL — 3 padrões coexistem]

| Prefixo atual | Quantidade | Exemplo |
|---------------|-----------|---------|
| `v_` | 5 | `v_contagem_atual`, `v_contagem_com_historico` |
| `view_` | 3 | `view_eventos`, `view_dre`, `view_stockout_por_categoria` |
| `vw_` | 3 | `vw_cmo_historico_completo`, `vw_diagnostico_anos`, `vw_sync_historico` |
| Sem prefixo | 10+ | `analitico`, `getin_reservas`, `nps_agregado_semanal` (views-alias) |
| `mv_` | 0 | Nenhuma usa este prefixo ainda |

### Padrão para novos objetos [REGRA FUTURA]

| Prefixo | Tipo | Usar quando |
|---------|------|------------|
| `v_` | View calculada | Toda nova view regular |
| `mv_` | Materialized view | Toda nova materialized view |
| Sem prefixo | View-alias (redirect) | Apenas para manter compatibilidade com código que usa nome antigo de tabela |

### Consolidação planejada [FUTURO — não executar sem validação de impacto]

A tabela abaixo documenta renomeações desejadas. **Nenhuma foi aplicada.** Cada uma requer verificar todas as queries que a referenciam.

### Views-alias ativas em produção (verificado em 2026-03-19)

Estas "tabelas" no audit são na verdade views:

| Nome | Aponta para | Código lê de |
|------|------------|-------------|
| `analitico` | `contahub_analitico` | Rotas `/analitico/` |
| `periodo` | `contahub_periodo` | Scripts de sync |
| `tempo` | `contahub_tempo` | Relatórios de tempo |
| `eventos` | `eventos_base` | Algumas queries legadas |
| `getin_reservas` | `getin_reservations` | 8 rotas de CRM/campanhas |
| `nps_agregado_semanal` | Cálculo sobre `nps` + `nps_reservas` | `recalcular-desempenho-v2` |
| `contahub_stockout_filtrado` | `contahub_stockout` filtrado | 4 rotas de stockout |
| `sympla_bilheteria` | `sympla_pedidos` | Análise Sympla |
| `yuzer_analitico` | `yuzer_fatporhora` | Análise Yuzer |
| `token_status` | `permanent_tokens` | Verificação de tokens |

### Consolidação planejada de prefixos [FUTURO — não aplicado]

| Atual (produção) | Desejado | Motivo | Impacto estimado |
|-------|--------|--------|
| `view_eventos` | `v_eventos_complete` | Padronizar prefixo | Alto — usada em frontend e triggers |
| `view_dre` | `v_dre` | Padronizar | Médio — 6 rotas DRE |
| `view_stockout_por_categoria` | `v_stockout_por_categoria` | Padronizar | Baixo |
| `view_produtos_agregados` | `mv_produtos_agregados` | É materialized view | Baixo — poucas refs |
| `view_visao_geral_anual` | `mv_visao_geral_anual` | É materialized view | Baixo |
| `view_visao_geral_trimestral` | `mv_visao_geral_trimestral` | É materialized view | Baixo |
| `vw_cmo_historico_completo` | `v_cmo_historico_completo` | Padronizar | Baixo |
| `vw_diagnostico_anos` | `v_diagnostico_anos` | Padronizar | Baixo |
| `vw_sync_historico` | `v_sync_historico` | Padronizar | Baixo |

> **Atenção**: Renomear views em PostgreSQL requer `DROP VIEW + CREATE VIEW` (não existe `ALTER VIEW RENAME`). Isso invalida queries em andamento e pode quebrar frontend. Cada renomeação deve ser precedida de grep completo no codebase.

---

## Functions (PL/pgSQL) [ESTADO ATUAL — padrões extraídos das 116 funções de produção]

| Prefixo | Tipo | Exemplo |
|---------|------|---------|
| `calcular_` | Cálculo que retorna dados (RPC) | `calcular_stockout_semanal`, `calcular_mix_vendas`, `calcular_tempo_saida`, `calcular_atrasos_tempo` |
| `calculate_` | Cálculo completo de entidade (**legado em inglês** — novas funções devem usar `calcular_`) | `calculate_evento_metrics`, `calculate_ticket_medio` |
| `get_` | Consulta/leitura | `get_count_base_ativa`, `get_google_reviews_stars_by_date`, `get_retrospectiva_*` |
| `process_` | Transforma JSON raw → tabela tipada | `process_analitico_data`, `process_tempo_data`, `process_pagamentos_data`, `process_periodo_data`, `process_fatporhora_data` |
| `sync_` | Sincroniza dados entre tabelas | `sync_mesas_getin_to_eventos`, `sync_contahub_ambos_bares` |
| `executar_` | Wrapper PL/pgSQL para chamar edge function via http_post | `executar_recalculo_desempenho_auto`, `executar_nibo_sync_ambos_bares` |
| `trigger_` | Trigger function | `trigger_sync_mesas_after_getin_change`, `trigger_calcular_real_r` |
| `fill_` / `set_` / `map_` | Preenche/categoriza campo automaticamente | `fill_semana_on_insert`, `set_categoria_mix_contahub_analitico`, `map_categoria_tempo` |
| `verificar_` | Verificação de saúde/validação | `verificar_saude_crons`, `verificar_saude_desempenho_auto_alerta_discord` |
| `limpar_` / `cleanup_` | Limpeza de dados antigos | `limpar_logs_antigos`, `limpar_heartbeats_antigos`, `cleanup_old_logs` |
| `admin_` | Operações administrativas (SECURITY DEFINER) | `admin_get_api_credentials`, `admin_upsert_api_credentials` |
| `is_` / `user_has_` | Verificação de permissão | `is_user_admin`, `user_has_access_to_bar` |

---

## Triggers

Nomeação: `trigger_{ação}_{contexto}` ou `trg_{ação}_{tabela}`

| Exemplo | Tabela | Evento |
|---------|--------|--------|
| `trigger_calcular_real_r` | `eventos_base` | BEFORE INSERT/UPDATE |
| `trigger_fill_semana` | `eventos_base` | BEFORE INSERT/UPDATE |
| `trigger_calculate_metrics` | `desempenho_semanal` | BEFORE INSERT/UPDATE |
| `trg_set_categoria_mix_contahub_analitico` | `contahub_analitico` | BEFORE INSERT/UPDATE |
| `sync_mesas_after_getin_insert` | `getin_reservations` | AFTER INSERT |
| `update_*_updated_at` | Várias tabelas | BEFORE UPDATE |

---

## Edge Functions (Deno)

| Padrão | Exemplo | Tipo |
|--------|---------|------|
| `{domínio}-{ação}` | `contahub-sync-automatico`, `nibo-sync`, `getin-sync-continuous` | Sync de dados |
| `{ação}-{domínio}` | `sync-cmv-sheets`, `sync-contagem-sheets` | Sync de sheets |
| `{domínio}-dispatcher` | `agente-dispatcher`, `alertas-dispatcher`, `discord-dispatcher` | Router/dispatcher |
| `recalcular-desempenho-v2` | | Cálculo de KPIs |
| `cron-watchdog` | | Monitoramento |
| `google-sheets-sync` | | Sync unificado |
| `google-reviews-apify-sync` | | Scraping |

### Shared modules (`_shared/`)

| Arquivo | Responsabilidade |
|---------|-----------------|
| `supabase-client.ts` | Supabase client + getBarsAtivos + getApiConfig |
| `cors.ts` | CORS headers + jsonResponse + errorResponse |
| `discord-notifier.ts` | Envio de embeds/mensagens para Discord |
| `heartbeat.ts` | Logging para cron_heartbeats |
| `google-auth.ts` | JWT auth com service account Google |
| `google-sheets-config.ts` | IDs e configs de planilhas |
| `sheets-parsers.ts` | Parsers de dados de planilhas |
| `contahub-client.ts` | Login e fetch de dados ContaHub |
| `gemini-client.ts` | Cliente Google Gemini AI |
| `formatters.ts` | Formatação de moeda, percentual, data |
| `timezone.ts` | Conversão de timezone (BRT) |
| `calculators/` | Módulos de cálculo decompostos (v2) |

---

## Schemas

### Estado atual (2026-03-19)

| Schema | Status | Conteúdo |
|--------|--------|----------|
| `public` | **Ativo** | Todas as 229 tabelas (CORE + SUPORTE + LEGADO + EXPERIMENTAL misturadas) |
| `auth` | **Ativo** | Gerenciado pelo Supabase (não tocar) |
| `storage` | **Ativo** | Gerenciado pelo Supabase (não tocar) |
| `archive` | **Não existe ainda** | Planejado para tabelas LEGADO |
| `staging` | **Não existe ainda** | Planejado para tabelas EXPERIMENTAL |

### Estrutura planejada [FUTURO]

| Schema | Conteúdo | Critério de entrada |
|--------|----------|-------------------|
| `public` | Tabelas CORE + SUPORTE | Tem dados ativos OU código depende |
| `archive` | Tabelas LEGADO | Tripla confirmação: 0 rows + 0 refs ativas + 0 FKs |
| `staging` | Tabelas EXPERIMENTAL | Features não lançadas, 0 rows |

---

## Classificação de Objetos

| Grupo | Critério | Schema atual | Schema planejado |
|-------|----------|-------------|-----------------|
| **CORE** | Dados ativos + código depende + cron/edge function lê/escreve | `public` | `public` |
| **SUPORTE** | Dados ativos OU código referencia, mas sistema funciona sem | `public` | `public` |
| **LEGADO** | 0 rows + 0 refs em código ativo + 0 FKs | `public` | `archive` |
| **EXPERIMENTAL** | 0 rows + feature não lançada | `public` | `staging` |

> **Classificação completa das 229 tabelas**: Realizada em 2026-03-19. Documento de referência na conversa de auditoria (não publicado como arquivo ainda). Será formalizado antes da criação dos schemas.

---

## DDL out-of-band — proibido [REGRA OBRIGATÓRIA]

Toda mudança de schema **DEVE** ser aplicada via migration em `database/migrations/`. Aplica-se a:

- `CREATE / ALTER / DROP TABLE`
- `CREATE / ALTER / DROP INDEX`
- `CREATE / ALTER / DROP CONSTRAINT` (PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK)
- `ALTER TABLE … SET (reloptions)` — incluindo autovacuum tuning, fillfactor, etc.
- `CREATE / ALTER / DROP POLICY` (RLS)
- `GRANT / REVOKE`
- `CREATE OR REPLACE FUNCTION / TRIGGER / VIEW`
- `CREATE / DROP SCHEMA`

### Por quê

Mudanças out-of-band ficam **invisíveis** pra `git history` e induzem auditorias futuras a "redescobrir do zero" o que já foi decidido. Migration history é a única fonte canônica de "por que essa coisa existe e quem decidiu".

**Caso real (sprint perf+sec abril 2026):**
- `operations.eventos_base` tinha `autovacuum_vacuum_scale_factor = 0.05` aplicado out-of-band. Não havia rastro no git. Durante perf/04, redescobriu-se. Tracked como #40 e formalizado retroativamente em PR `chore/formalize-eventos-base-tuning`.
- `idx_eventos_base_conta_assinada` (1.5 MB partial index) também criado out-of-band. Não havia rastro. Dropado em perf/05 batch 3 — sem o index, nenhuma performance regressão (era dead).

Ambos custaram **horas de investigação** que não existiriam se a regra estivesse formalizada.

### Exceção

Apenas operações de manutenção que **não alteram schema**:

- `VACUUM` / `VACUUM ANALYZE` ad-hoc
- `ANALYZE` ad-hoc
- `REINDEX` ad-hoc (recomendado fazer via migration se for parte de um plano)
- `CLUSTER` ad-hoc

Para operações pesadas (`VACUUM FULL`, `pg_repack`), criar issue de planejamento + janela.

### Como detectar drift no futuro

Script de monitoring (low priority, follow-up):
```sql
-- Comparar reloptions reais vs últimas declaradas em migrations
SELECT n.nspname || '.' || c.relname AS table_name, c.reloptions
FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.reloptions IS NOT NULL
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'auth', 'storage')
ORDER BY 1;
```
Cross-check com `database/migrations/` via grep `ALTER TABLE ... SET (`.
