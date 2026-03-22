# Zykor (SGB)

Sistema de gestão para bares. Multi-bar, desacoplado de POS.

## Stack

- **Frontend:** Next.js 14 (App Router)
- **Backend:** Supabase (Edge Functions, Postgres, Cron)
- **POS:** ContaHub (desacoplado via tabelas de domínio)
- **Financeiro:** NIBO
- **Reservas:** GetIn
- **Surveys:** Google Sheets → google-sheets-sync

## Estrutura do Projeto

```
zykor/
├── frontend/                    # Next.js app
│   ├── src/app/api/             # API routes (server-side)
│   ├── src/app/                 # Páginas
│   └── src/lib/                 # Libs compartilhadas
├── backend/
│   └── supabase/
│       └── functions/           # Edge functions (26 ativas)
├── database/
│   ├── functions/               # SQL functions (120 arquivos)
│   ├── views/                   # Views (30 arquivos)
│   ├── triggers/                # Triggers
│   └── migrations/              # Migrations
└── SGB_MASTER_BLUEPRINT.md      # Documento mestre da arquitetura
```

## Conceitos Chave

### Tabelas de Domínio (source of truth)

| Tabela | Descrição |
|--------|-----------|
| `vendas_item` | Vendas por item/produto |
| `visitas` | Visitas por mesa/comanda (CRM) |
| `tempos_producao` | Tempos de preparo |
| `faturamento_hora` | Faturamento por hora |
| `faturamento_pagamentos` | Pagamentos |
| `eventos_base` | Agregação diária |
| `desempenho_semanal` | Métricas semanais |
| `cmv_semanal` | CMV por semana |

### Config Centralizada (por bar)

| Tabela | Conteúdo |
|--------|----------|
| `bar_regras_negocio` | Constantes de cálculo (cmv_fator, ano_inicio, tempo_metrica) |
| `bar_categorias_custo` | Categorias NIBO por bar |
| `bar_metas_periodo` | Metas M1/TE/TB por dia da semana |
| `bar_local_mapeamento` | Locais POS → categorias |
| `bares_config` | Dias de operação, horários |

### Regras Fundamentais

```
⛔ NUNCA ler contahub_* diretamente em código de negócio (usar tabelas de domínio)
⛔ NUNCA hardcodar bar_id (usar tabelas de config)
⛔ NUNCA usar fallbacks — se config ausente, é erro explícito
✅ Para adicionar bar: 6 INSERTs em tabelas de config. Zero código.
```

## Pipeline Diário (BRT)

```
05:00  google-sheets-sync      → nps, voz_cliente, pesquisa_felicidade, nps_reservas
07:00  contahub-sync-7h-ambos  → contahub_raw_data
08:00  contahub-update-eventos → process_* → staging → domain tables → eventos_base
08:00  nibo-sync-08h           → nibo_agendamentos
08:30  sync-contagem           → contagem_estoque_insumos
08:30  auto-recalculo-eventos  → calculate_evento_metrics
09:00  alertas + agente        → Discord + AI
09:00  desempenho-v2-diario    → desempenho_semanal
09:00  cmv-semanal-auto        → cmv_semanal
09:30  sync-cmv-sheets         → cmv_semanal (planilha)
```

## Edge Functions (26 ativas)

| Categoria | Functions |
|-----------|-----------|
| **Dispatchers** | agente, alertas, integracao, sync, discord, webhook |
| **Sync** | contahub-sync-automatico, google-sheets-sync, nibo-sync, getin-sync-continuous, umbler-sync-incremental, google-reviews-apify-sync, sync-contagem-sheets, sync-cmv-sheets, sync-cmv-mensal, sync-cmo-planilha, contahub-stockout-sync |
| **Processamento** | recalcular-desempenho-v2, cmv-semanal-auto |
| **Ferramentas** | relatorio-pdf, monitor-concorrencia, atualizar-fichas-tecnicas, api-clientes-externa |
| **Auth/Webhook** | login, inter-auth, inter-webhook-config, inter-pix-webhook, google-reviews-auth, google-reviews-callback, umbler-send |
| **Infra** | cron-watchdog, checklist-auto-scheduler |

## Como Rodar

```bash
cd frontend
npm install
npm run dev
```

## Workflow de Desenvolvimento

```
Claude  → analisa, audita, desenha, entrega prompts prontos
Cursor  → executa (1 prompt por chat novo, até 3 em paralelo)
Claude  → valida resultado via SQL, entrega próximo prompt
```

**Blueprint:** `SGB_MASTER_BLUEPRINT.md`

## Arquitetura de Dados

```
FONTES EXTERNAS
  ContaHub │ POS X │ NIBO │ GetIn │ Google Sheets

━━━━ INGESTION ━━━━
  contahub-sync-automatico → contahub_raw_data → process_*

━━━━ NORMALIZATION (staging → domínio) ━━━━
  contahub_analitico   → adapter → vendas_item
  contahub_periodo     → adapter → visitas
  contahub_tempo       → adapter → tempos_producao
  contahub_fatporhora  → adapter → faturamento_hora
  contahub_pagamentos  → adapter → faturamento_pagamentos

━━━━ DOMAIN ━━━━
  vendas_item, visitas, tempos_producao, faturamento_hora, faturamento_pagamentos
  eventos_base, desempenho_semanal, cmv_semanal

━━━━ CONFIG ━━━━
  bar_regras_negocio, bar_categorias_custo, bar_metas_periodo
  bar_local_mapeamento, bares_config, api_credentials
```
