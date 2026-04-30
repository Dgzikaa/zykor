# Arquitetura Medallion — Zykor

> Snapshot 2026-04-30. Fluxo bronze → silver → gold por fonte externa.

## 📥 Fontes externas (sync → bronze)

| Fonte | Cron | Edge function / RPC | Tabelas bronze |
|---|---|---|---|
| ContaHub | 7h BRT (298) + retry 14h (410) | `contahub-sync-7h-ambos`, `processar_raw_data_pendente` | `bronze_contahub_avendas_*`, `bronze_contahub_financeiro_*`, `bronze_contahub_produtos_*`, `bronze_contahub_operacional_stockout_raw`, `bronze_contahub_raw_data` |
| ContaAzul | 8h, 16h, 0h (354) + 9h integrations→bronze (466) | `contaazul-sync`, `sync_contaazul_integrations_to_bronze` | `bronze_contaazul_lancamentos`, `bronze_contaazul_categorias`, `bronze_contaazul_centros_custo`, `bronze_contaazul_contas_financeiras` |
| Falae | edge function | `falae-sync` | `bronze_falae_respostas` |
| Getin | a cada 2h (394) | `integracao-dispatcher` (Getin mode) | `bronze_getin_reservations`, `bronze_getin_units` |
| Google Reviews | 8h BRT (397) | `google-reviews-apify-sync` | `bronze_google_reviews` |
| Sympla | semanal segunda 5h (395) | `integracao-dispatcher` (Sympla) | `bronze_sympla_eventos`, `bronze_sympla_participantes`, `bronze_sympla_pedidos` |
| Yuzer | discovery 3h (442) + sync diário | `yuzer_cron_descobrir_eventos` | `bronze_yuzer_*` |
| Umbler | 11h, 20h BRT (401) | `umbler-sync-incremental` | `bronze_umbler_conversas`, `bronze_umbler_mensagens` |
| Stockout | 19h BRT (404/405) | `contahub-stockout-sync` | `bronze_contahub_operacional_stockout_raw` |
| Sheets (manual) | 5h BRT (398) | `google-sheets-sync` | (popula `financial.cmv_semanal` direto) |

## 🔄 bronze → silver (8h-8:45 BRT)

| Bronze | Silver | Cron |
|---|---|---|
| `bronze_contahub_avendas_vendasperiodo` | `silver.cliente_visitas` | 446 (silver-cliente-visitas-diario) |
| `bronze_contahub_avendas_vendasperiodo` | `silver.faturamento_pagamentos` | parte do mesmo ETL |
| `bronze_contahub_avendas_porproduto_analitico` | `silver.vendas_item` | adapters-diarios (449) |
| `bronze_contahub_avendas_vendasdiahoraanalitico` | `silver.faturamento_hora` | adapters-diarios |
| `bronze_contahub_produtos_temposproducao` | `silver.tempos_producao` | adapters-diarios |
| `bronze_contahub_operacional_stockout_raw` | `silver.silver_contahub_operacional_stockout_processado` | 402/403 (stockout-processar 19h) |
| `bronze_contahub_raw_data` | `operations.eventos_base` | 427 (processar_raw_data_pendente) |
| `integrations.contaazul_lancamentos` | `silver.contaazul_lancamentos_diarios` | 454 (silver-contaazul-diario) |
| `bronze_falae_respostas` | `silver.nps_diario` | 453 |
| `bronze_getin_reservations` | `silver.getin_reservas_diarias` + `operations.eventos_base` | 451 + calculate_evento_metrics |
| `bronze_google_reviews` | `silver.google_reviews_diario` | 450 |
| `bronze_sympla_participantes` | `silver.sympla_bilheteria_diaria` | 452 |
| `bronze_yuzer_pagamentos_evento` | `silver.yuzer_pagamentos_evento` | 455 |
| `bronze_yuzer_produtos_evento` | `silver.yuzer_produtos_evento` | 455 |

## 🥇 silver → gold (8:50-9:00 BRT)

| Silver(s) | Gold | Cron |
|---|---|---|
| `silver.cliente_visitas` + `silver.sympla_bilheteria_diaria` + `silver.yuzer_pagamentos_evento` + `silver.faturamento_hora` + `operations.eventos_base` | `gold.planejamento` | 460 (etl_gold_planejamento_all_bars) |
| `silver.tempos_producao` + `silver.silver_..._stockout_processado` + `silver.contaazul_lancamentos_diarios` + `silver.nps_diario` + `silver.google_reviews_diario` + `silver.vendas_item` + `gold.planejamento` + `gold.clientes_diario` + `gold.cmv` + `bronze_falae_respostas` + `bronze_contahub_avendas_vendasperiodo` | `gold.desempenho` | 462 (etl_gold_desempenho_all_bars 14d) |
| `silver.contaazul_lancamentos_diarios` + `financial.cmv_semanal` | `gold.cmv` | 461 (gold-cmv) |
| `silver.cliente_estatisticas` | `gold.clientes_diario` | 459 (gold-clientes-diario) |
| `gold.desempenho` + `gold.planejamento` + `gold.cmv` | `gold.v_pipeline_health` (matview) | 464 (refresh */5min) |

## 🖥️ gold → telas

| Tela | Lê de | Atualizada |
|---|---|---|
| `/estrategico/desempenho` (semanal/mensal) | `gold.desempenho` + `meta.desempenho_manual` (overrides) | 9h BRT |
| `/estrategico/planejamento-comercial` | `gold.planejamento` + `operations.eventos_base` (manual) | 8:50 BRT |
| `/ferramentas/cmv-semanal/tabela` | `financial.cmv_semanal` | 9h BRT (cmv-semanal-auto) |
| CMV mensal | `financial.cmv_mensal` | 12:30 BRT (cmv-mensal-auto-diario) |
| `/ferramentas/stockout` | `silver.silver_..._stockout_processado` | 19:30 BRT |
| `/configuracoes/monitoramento` | `gold.v_pipeline_health` + RPCs | refresh */5min |
| `/ferramentas/consultas` (Dedo Duro) | `integrations.contaazul_lancamentos` | quase tempo real (sync 8h/16h/0h) |

## ⚠️ Tabelas legacy / órfãs (candidatas drop)

- `gold.gold_contahub_operacional_stockout` (163 MB) — legacy, ETL semanal antigo. Hoje ferramenta + ETL semanal usam silver. Drop seguro.
- `bronze.bronze_contaazul_lancamentos` (422 MB) — duplica `integrations.contaazul_lancamentos`. Verificar se algum cron ainda escreve aqui.
- `bronze.bronze_umbler_campanhas` + `_destinatarios` — feature campanhas removida em PR #56.
- `bronze.eventos` + `bronze.eventos_historico` — substituídos por `operations.eventos_base`.
- 12 tabelas `agent_ai.*` vazias — features de IA em desenvolvimento.

## 📊 Tabelas grandes (>100 MB)

| Tabela | Size | Status |
|---|---|---|
| `silver.vendas_item` | 401 MB | OK, usada pelo mix |
| `bronze.bronze_contaazul_lancamentos` | 422 MB | duplicação suspeita |
| `bronze.bronze_contahub_avendas_porproduto_analitico` | 222 MB | source de vendas_item |
| `silver.cliente_visitas` | 222 MB | usada |
| `bronze.bronze_contahub_raw_data` | 223 MB | dump JSON cru — pode purgar antigo |
| `silver.cliente_estatisticas` | 214 MB | usada |
| `silver.tempos_producao` | 207 MB | usada |
| `bronze.bronze_contahub_produtos_temposproducao` | 169 MB | source de tempos_producao |
| `gold.gold_contahub_operacional_stockout` | 163 MB | **legacy — drop** |

## 🚨 Gaps detectados

1. **`bronze.bronze_contahub_avendas_cancelamentos`** vai DIRETO pro `gold.desempenho` (pulando silver). Funcional, mas viola medallion. Considerar criar `silver.cancelamentos_diarios`.
2. **Yuzer** sync log não tem cron explícito (só descobrir eventos 3h). Pode estar sub-aproveitado.
3. **Sympla** sync semanal apenas — eventos novos ficam até 7 dias sem aparecer.
4. **`bronze.bronze_umbler_conversas/mensagens`** (50 MB) — feature ativa mas sem silver/gold derivado. Dados crus consumidos direto na tela CRM.

## 🔧 Health Check (auto)

`gold.v_pipeline_health` (matview, refresh */5min) — base do `/configuracoes/monitoramento`.

RPC `get_health_dashboard()` — retorna status gold por bar, stockout gap, alertas Discord.

## 📦 Edge functions (snapshot 2026-04-30)

**36 functions** instaladas. **16 chamadas por cron**:
- `agente-dispatcher`, `agente-pipeline-v2`
- `alertas-dispatcher`
- `cmv-semanal-auto`, `sync-cmv-sheets`, `sync-contagem-sheets`
- `contahub-resync-semanal`, `contahub-stockout-sync`
- `cron-watchdog`
- `google-reviews-apify-sync`, `google-sheets-sync`
- `integracao-dispatcher`, `sync-dispatcher`
- `monitor-concorrencia`
- `stockout-processar`
- `umbler-sync-incremental`

**Provavelmente chamadas via API/dispatcher** (não cron direto):
- `agente-detector`, `agente-narrator` (chamados por `agente-dispatcher`)
- `api-clientes-externa` (API externa)
- `atualizar-fichas-tecnicas`
- `checklist-auto-scheduler`
- `contaazul-auth` (OAuth handler)
- `contaazul-sync` (chamado via `integracao-dispatcher`)
- `contahub-processor`
- `discord-dispatcher` (chamado por outras functions)
- `inter-pix-webhook` (webhook PIX)
- `recalcular-desempenho-v2` (chamado por SQL via `executar_recalculo_desempenho_v2`)
- `relatorio-pdf` (on demand)
- `silver-processor`
- `sync-cliente-perfil-consumo`, `sync-faturamento-hora`
- `unified-dispatcher`, `webhook-dispatcher`

**🟡 Candidatos drop** (não usados ou substituídos):
- `sync-cmv-mensal` → substituída por `agregar_cmv_mensal_auto()` SQL (cron 467)
- `sync-cmo-planilha` → CMO removido como feature
- `contahub-sync-automatico` → legacy, agora cron usa `sync_contahub_ambos_bares()` SQL function
- `getin-sync-continuous` → legacy, agora `integracao-dispatcher`

Antes de drop, confirmar via Supabase logs (últimas 30d sem invocação = drop seguro).

## 🚀 Boas práticas — recomendações priorizadas

### Curto prazo (alto valor, baixo esforço)
1. **CI checks obrigatórios** — habilitar typecheck + lint + test no Vercel preview antes do merge.
   - Adicionar `pnpm typecheck && pnpm lint` no script de build.
   - Configurar branch protection no GitHub: PR só pode mergear se Vercel build verde.

2. **Migration `.rollback.sql` obrigatória** — todas migrations de DDL devem ter par `.rollback.sql`.
   - Hoje: ~30% das migrations têm rollback.
   - Padronizar via convenção de nome + lint manual.

3. **Documentar `cron_jobs` em arquivo** — `database/cron_jobs.sql` versionado.
   - Hoje os 60+ crons só existem no banco. Se DR (disaster recovery), perde tudo.
   - Script de export `pg_dump --schema-only --table=cron.job` num cron mensal.

### Médio prazo (médio esforço)
4. **Testes E2E de telas críticas** — Playwright cobrindo:
   - `/estrategico/desempenho` (semanal/mensal)
   - `/estrategico/planejamento-comercial`
   - `/ferramentas/cmv-semanal/tabela`
   - `/ferramentas/stockout`
   - Smoke: login → navega → render OK → KPIs > 0.

5. **Backup testado mensal** — Supabase faz backup automático mas restore foi testado?
   - Cron mensal: criar branch staging → restore último backup → smoke test → drop branch.

6. **Feature flags** (LaunchDarkly ou `operations.feature_flags`) — pra rollouts graduais (ex: novo ETL CMV que vai pra 50% dos meses primeiro).

### Longo prazo
7. **Observability dashboards** — Sentry já existe; integrar com tela `/configuracoes/monitoramento` (lista erros recentes inline).

8. **Pipeline as code** — declarar crons em SQL versionado (`database/migrations/cron_*.sql`) em vez de criar via UI.

9. **Type-safety end-to-end** — gerar types do Supabase via `supabase gen types typescript`.
   - Hoje muitos `as any` em rotas. PR de type-gen mensal.

## 🔑 Vercel env vars — checklist

(Precisa input do user pra mapear.)

Variáveis críticas esperadas (validar via Vercel dashboard):
- `NEXT_PUBLIC_SUPABASE_URL` — URL projeto
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — key publishable
- `SUPABASE_SERVICE_ROLE_KEY` — key service role (server-only!)
- `CONTAAZUL_CLIENT_ID`, `CONTAAZUL_CLIENT_SECRET`, `CONTAAZUL_REDIRECT_URI`
- `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY` (agentes IA)
- `CRON_SECRET` (auth de chamadas internas)
- `DISCORD_WEBHOOK_*` (alertas)

Checklist de auditoria:
1. Listar todas as env vars no Vercel.
2. `grep -rln "process.env" frontend/src` → mapear quais são usadas.
3. Cruzar lista A vs B → identificar órfãs (no Vercel mas não usadas) e faltantes (usadas mas não setadas).
4. Sensíveis devem estar marcadas como "Production only" (não ir pro preview).
5. `NEXT_PUBLIC_*` são expostas no browser — confirmar que nada secreto vazou ali.
