# Mapa de Domínios — Zykor

## Visão Geral do Sistema

```
SGB v2.0 — Sistema de Gestão de Bares
├── Ordinário Bar (bar_id=3) — operação completa, GetIn, 850 pessoas
└── Deboche Bar (bar_id=4) — operação simplificada, fechado segundas
```

**Stack**: Next.js 15 + Supabase Edge Functions (Deno) + PostgreSQL + pg_cron

---

## Fluxo de Dados (5 camadas)

```
CAMADA 1: INGESTÃO (APIs externas → banco)
    │
CAMADA 2: PROCESSAMENTO (raw → tipado)
    │
CAMADA 3: CÁLCULO (tipado → métricas por evento)
    │
CAMADA 4: AGREGAÇÃO (métricas → KPIs semanais)
    │
CAMADA 5: CONSUMO (KPIs → dashboards, AI, relatórios)
```

---

## Camada 1: Ingestão

Dados entram via edge functions chamadas por pg_cron.

> Horários abaixo são do snapshot de 2026-03-19. Podem mudar — verificar com `SELECT * FROM cron.job WHERE active = true`.

| Fonte | Edge Function | Frequência | Tabela Destino | Volume |
|-------|--------------|------------|----------------|--------|
| ContaHub API | `contahub-sync-automatico` | 2x/dia (04:00, 19:00 BRT) | `contahub_raw_data` | ~1.2K rows (staging) |
| NIBO API | `nibo-sync` | 2x/dia (05:00, 19:00 BRT) | `nibo_agendamentos` | 50K rows |
| GetIn API v2 | `getin-sync-continuous` | Cada 4h | `getin_reservations` | 5K rows |
| Google Sheets | `google-sheets-sync` | 1x/dia (02:00 BRT) | `nps`, `nps_reservas`, `voz_cliente`, `pesquisa_felicidade` | ~10K rows total |
| Google Sheets | `sync-cmv-sheets` | 1x/dia (05:00 BRT) | `cmv_semanal` | 163 rows |
| Google Sheets | `sync-contagem-sheets` | 1x/dia | `contagem_estoque_insumos` | 199K rows |
| Apify | `google-reviews-apify-sync` | 1x/dia (06:00 BRT) | `google_reviews` | 9.5K rows |
| Sympla API | `integracao-dispatcher` | On-demand | `sympla_eventos`, `sympla_pedidos`, `sympla_participantes` | 30K rows total |
| Umbler/WhatsApp | `webhook-dispatcher` | Webhook real-time | `umbler_conversas`, `umbler_mensagens` | 48K rows total |
| Windsor | Externo | Periódico | `windsor_google`, `windsor_instagram_*` | 24K rows total |
| Manual (frontend) | API routes Next.js | User action | `eventos_base`, `dre_manual`, `folha_pagamento` | Variável |

---

## Camada 2: Processamento

Raw JSON → tabelas tipadas. Chamadas por `contahub-processor` edge function.

```
contahub_raw_data (JSON blob)
    │
    ├── process_analitico_data()  → contahub_analitico   (797K rows, 48MB)
    ├── process_tempo_data()      → contahub_tempo        (603K rows, 36MB)
    ├── process_pagamentos_data() → contahub_pagamentos   (216K rows, 12MB)
    ├── process_periodo_data()    → contahub_periodo       (212K rows, 12MB)
    └── process_fatporhora_data() → contahub_fatporhora    (8K rows, 256KB)
```

Triggers automáticos na inserção:
- `set_categoria_mix_contahub_analitico` → categoriza em BEBIDA/COMIDA/DRINK
- `set_categoria_mix_contahub_stockout` → categoriza stockout
- `map_categoria_tempo` → mapeia categoria de tempo

---

## Camada 3: Cálculo por Evento

`calculate_evento_metrics()` é chamada manualmente ou por recálculo batch — **não por triggers automáticos nas tabelas ContaHub** (os triggers de auto-recálculo via tabelas-fonte que existiam no repo foram removidos de produção).

```
contahub_analitico ────┐
contahub_tempo ────────┤
contahub_pagamentos ───┤
contahub_periodo ──────┤
contahub_fatporhora ───┤──→ calculate_evento_metrics(evento_id)
nibo_agendamentos ─────┤       │
yuzer_fatporhora ──────┤       │ calcula 30+ campos:
yuzer_pagamento ───────┤       │ cl_real, real_r, te_real, tb_real,
sympla_pedidos ────────┤       │ percent_b/c/d, t_coz, t_bar,
getin_reservations ────┘       │ fat_19h_percent, c_art, c_prod,
                               │ percent_art_fat, res_tot, res_p,
                               │ lot_max, sympla_liquido, yuzer_liquido
                               ▼
                         eventos_base (833 rows, 71 colunas)
```

Triggers auxiliares em `eventos_base`:
- `calcular_real_r` → calcula `real_r` (faturamento real = ContaHub + Sympla + Yuzer)
- `fill_semana_on_insert` → preenche `semana` (ISO week number)

---

## Camada 4: Agregação Semanal

`recalcular-desempenho-v2` (edge function, pg_cron diário 08:00 BRT) agrega tudo em KPIs semanais.

```
eventos_base ────────────────┐
nibo_agendamentos ───────────┤
nps_agregado_semanal (VIEW) ─┤
contahub_fatporhora ─────────┤
contahub_cancelamentos ──────┤──→ 6 calculators independentes:
contahub_periodo ────────────┤       calc-faturamento
                             │       calc-custos
RPCs:                        │       calc-operacional (4 RPCs)
  calcular_stockout_semanal ─┤       calc-satisfacao (2 RPCs)
  calcular_mix_vendas ───────┤       calc-distribuicao
  calcular_tempo_saida ──────┤       calc-clientes (2 RPCs)
  calcular_atrasos_tempo ────┤           │
  get_google_reviews_*  ─────┤           ▼
  calcular_nps_semanal_* ────┤   desempenho_semanal
  calcular_metricas_clientes ┤   (128 rows, 147 colunas)
  get_count_base_ativa ──────┘
```

Outros agregadores:
- `cmv-semanal-auto` → `cmv_semanal` (CMV = Est.Inicial + Compras - Est.Final - Consumos + Bonificações)
- `sync-cmv-mensal` → `cmv_mensal` (consolidação mensal)

---

## Camada 5: Consumo

```
desempenho_semanal ──┬── /estrategico/desempenho (dashboard principal)
                     ├── /estrategico/visao-geral (overview executivo)
                     ├── /estrategico/orcamentacao (budgeting)
                     ├── agente-dispatcher → Gemini AI → Discord (análise diária/semanal/mensal)
                     ├── alertas-dispatcher → Discord (alertas proativos)
                     └── relatorio-pdf → Discord (relatórios PDF)

eventos_base ────────┬── /ferramentas/calendario (calendário operacional)
                     ├── /analitico/eventos (análise de eventos)
                     └── /analitico/atracoes (análise de atrações)

cmv_semanal ─────────── /ferramentas/cmv-semanal (dashboard CMV)

google_reviews ──────── /analitico/ (reviews)

nps + voz_cliente ───── /crm/ (CRM dashboards)

umbler_conversas ────── /crm/conversas (WhatsApp)
```

---

## Tabelas Críticas (Top 10 por impacto — snapshot 2026-03-19)

> Volumes crescem diariamente. Consultar tamanhos atuais com:
> ```sql
> SELECT relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid))
> FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY n_live_tup DESC LIMIT 15;
> ```

| # | Tabela | Rows (mar/26) | Colunas | Tamanho | Por que é crítica |
|---|--------|------|---------|---------|-------------------|
| 1 | `contahub_analitico` | 797K | 29 | 48MB | Maior tabela. Fonte de faturamento, mix, categorias. |
| 2 | `contahub_tempo` | 603K | 39 | 36MB | Tempos de preparo e entrega. Alimenta atrasos. |
| 3 | `contahub_pagamentos` | 216K | 29 | 12MB | Formas de pagamento. Alimenta real_r e DRE. |
| 4 | `contahub_periodo` | 212K | 28 | 12MB | Público, couvert, comissão. Alimenta cl_real. |
| 5 | `contagem_estoque_insumos` | 199K | 23 | 18MB | Contagem de estoque. Alimenta CMV. |
| 6 | `contahub_vendas` | 135K | 72 | 8.2MB | Detalhamento de vendas por produto. |
| 7 | `cliente_estatisticas` | 84K | 17 | 2.5MB | Estatísticas de clientes (CRM). |
| 8 | `nibo_agendamentos` | 50K | 50 | 3.2MB | Despesas e receitas. Alimenta custo_atracao. |
| 9 | `contahub_stockout` | 37K | 49 | 2.1MB | Disponibilidade de produtos. |
| 10 | `desempenho_semanal` | 128 | **147** | 256KB | God table. 147 colunas. Alimenta TUDO downstream. |

---

## Cadeia de Dependências Completa

```
NIVEL 0: Triggers de categorização
  set_categoria_mix_contahub_analitico    ← contahub_analitico INSERT/UPDATE
  set_categoria_mix_contahub_stockout     ← contahub_stockout INSERT/UPDATE
  map_categoria_tempo                     ← contahub_tempo INSERT/UPDATE

NIVEL 1: Triggers em eventos_base
  calcular_real_r                         ← eventos_base INSERT/UPDATE
  fill_semana_on_insert                   ← eventos_base INSERT/UPDATE

NIVEL 2: Cálculo por evento
  calculate_evento_metrics(evento_id)     ← chamado por triggers ou manual
    Lê: contahub_analitico, contahub_tempo, contahub_pagamentos,
        contahub_periodo, contahub_fatporhora, nibo_agendamentos,
        yuzer_fatporhora, yuzer_pagamento, sympla_pedidos, getin_reservations
    Escreve: eventos_base (30+ campos calculados)

NIVEL 3: Agregação semanal
  recalcular-desempenho-v2 (edge function)
    Lê: eventos_base, nibo_agendamentos, nps_agregado_semanal,
        contahub_fatporhora, contahub_cancelamentos, contahub_periodo
    Chama 8 RPCs: calcular_stockout_semanal, calcular_mix_vendas,
                  calcular_tempo_saida, calcular_atrasos_tempo,
                  get_google_reviews_stars_by_date,
                  calcular_nps_semanal_por_pesquisa,
                  calcular_metricas_clientes, get_count_base_ativa
    Escreve: desempenho_semanal (147 colunas)

NIVEL 4: Consumo
  dashboards, AI agents, relatórios, alertas
    Lê: desempenho_semanal, eventos_base, cmv_semanal
```

Se NIVEL 0 falha → NIVEL 2 calcula errado → NIVEL 3 propaga → NIVEL 4 mostra dados falsos.

---

## Cron Jobs Ativos (pg_cron)

> **Esta tabela é um snapshot de 2026-03-19.** Cron jobs mudam com frequência. Para ver o estado real, executar:
> ```sql
> SELECT jobname, schedule, active FROM cron.job WHERE active = true ORDER BY jobname;
> ```

| Horário BRT | Job | Edge Function | Criticidade |
|-------------|-----|--------------|-------------|
| 02:00 | google-sheets-sync | `google-sheets-sync` | MEDIA |
| 04:00 | contahub-daily-sync | `contahub-sync-automatico` | CRITICA |
| 04:10 | contahub-processor-1 | `contahub-processor` | CRITICA |
| 04:25 | contahub-processor-2 | `contahub-processor` | CRITICA |
| 05:00 | nibo-sync | `nibo-sync` | ALTA |
| 05:00 | sync-cmv-sheets | `sync-cmv-sheets` | ALTA |
| 06:00 | google-reviews | `google-reviews-apify-sync` | BAIXA |
| Cada 4h | getin-continuous | `getin-sync-continuous` | ALTA |
| 08:00 | desempenho-v2-diario | `recalcular-desempenho-v2` | CRITICA |
| 09:00 seg | desempenho-v2-segunda | `recalcular-desempenho-v2` | CRITICA |
| 09:00 | agente-diario | `agente-dispatcher` | MEDIA |
| 10:00 | sync-eventos | `sync-dispatcher` | ALTA |
| 19:00 | contahub-evening | `contahub-sync-automatico` | CRITICA |
| 19:00 | stockout-sync | `contahub-stockout-sync` | ALTA |
| Cada 30min | cron-watchdog | `cron-watchdog` | ALTA |

> **Nota**: Os jobs `desempenho-auto-diario` e `desempenho-auto-segunda` (v1) foram desativados em 2026-03-19 após cutover para v2.

---

## Regras de Negócio por Bar

> **Estado atual**: Estas regras estão **hardcoded** em múltiplos arquivos (edge functions, RPCs SQL, frontend). Não existe tabela de configuração por bar. Adicionar um 3o bar hoje requer mudanças em 10+ arquivos. Centralização planejada via tabela `bar_config` (não implementada).

| Regra | Ordinário (bar_id=3) | Deboche (bar_id=4) |
|-------|---------------------|-------------------|
| Dias operação | Qua-Dom | Ter-Sab |
| Fechado fixo | - | Segunda-feira |
| Locais bar (drinks) | Preshh, Montados, Mexido, Drinks, Drinks Autorais, Shot e Dose, Batidos | Bar |
| Locais cozinha | Cozinha, Cozinha 1, Cozinha 2 | Cozinha, Cozinha 2 |
| Tempo bar usa | t0_t3 | t0_t2 |
| Atraso bar threshold | >600s (10min) | >600s (10min) |
| Atraso cozinha threshold | >1200s (20min) | >1200s (20min) |
| Categorias NIBO atração | Atrações Programação, Produção Eventos | Atrações/Eventos |
| GetIn ativo | Sim | Não |
| Agregação semanal | Qui+Sab+Dom | Ter+Qua+Qui e Sex+Sab |

---

## Multi-Tenancy

Toda tabela operacional tem `bar_id`. A cadeia é:

```
empresas (1 row) → bares_config (2 rows) → usuarios_bares (22 rows) → usuarios (12 rows)
                         │
                    bar_id = 3 (Ordinário)
                    bar_id = 4 (Deboche)
                         │
                    Presente em 82 tabelas como FK
```

Frontend: `BarContext` gerencia seleção. `UserContext` valida permissões. Troca de bar recarrega página.
