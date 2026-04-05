# ARQUITETURA ZYKOR — FLUXO DE DADOS COMPLETO

**Atualizado**: 04/04/2026

---

## FLUXO DE DADOS PONTA A PONTA

```
┌─────────────────────────────────────────────────────────────────┐
│                    FONTES EXTERNAS                               │
│                                                                  │
│  ContaHub (POS)          Conta Azul (Financeiro)    GetIn        │
│  ├─ Vendas/Analítico     ├─ Lançamentos             ├─ Reservas  │
│  ├─ Stockout             ├─ Categorias               └─ Clientes │
│  ├─ Cancelamentos        └─ Fornecedores                         │
│  ├─ Pagamentos                                                   │
│  └─ Fat/Hora             Google Reviews    Sympla    Umbler      │
│                          ├─ Avaliações     ├─ Pedidos ├─ WhatsApp│
│                          └─ NPS            └─ Ingressos          │
└──────────────┬───────────────────┬──────────────────┬────────────┘
               │                   │                  │
               ▼                   ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTIONS (Sync)                          │
│                                                                  │
│  contahub-sync-automatico    contaazul-sync     getin-sync       │
│  contahub-stockout-sync      contaazul-auth     umbler-sync      │
│  contahub-processor          google-reviews-apify-sync           │
│  contahub-resync-semanal     sync-contagem-sheets                │
│                              sync-cmv-sheets                     │
│                              sync-cmv-mensal                     │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL (Supabase)                          │
│                                                                  │
│  TABELAS BRUTAS:                                                 │
│  ├─ contahub_analitico (211K rows, 359MB)                       │
│  ├─ contahub_periodo (219K rows, 276MB)                         │
│  ├─ contahub_pagamentos (229K rows, 80MB)                       │
│  ├─ contahub_cancelamentos (raw_data + custototal)              │
│  ├─ contahub_stockout (48K rows, 93MB)                          │
│  ├─ contahub_raw_data (7K rows, 180MB — JSON bruto)             │
│  ├─ contaazul_lancamentos (71K+ rows)                           │
│  ├─ visitas (656K rows, 296MB)                                  │
│  ├─ getin_reservations                                          │
│  └─ cliente_estatisticas (102K rows, 40MB)                      │
│                                                                  │
│  VIEWS:                                                          │
│  ├─ lancamentos_financeiros (sobre contaazul_lancamentos)       │
│  ├─ contahub_stockout_filtrado (filtros de exclusão)            │
│  └─ view_dre (consolidação DRE)                                 │
│                                                                  │
│  TABELAS CALCULADAS:                                             │
│  ├─ desempenho_semanal (170+ colunas, KPIs semanais)           │
│  ├─ cmv_semanal                                                  │
│  ├─ marketing_semanal                                            │
│  ├─ eventos_base (dados diários consolidados)                   │
│  └─ nps_falae_diario                                             │
│                                                                  │
│  MAPEAMENTO:                                                     │
│  ├─ bar_categorias_custo (categoria → tipo_custo)               │
│  └─ bares (id, nome, configurações)                             │
│                                                                  │
│  RPCs:                                                           │
│  └─ calcular_stockout_semanal(bar_id, data_inicio, data_fim)   │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTIONS (Cálculo)                       │
│                                                                  │
│  recalcular-desempenho-v2                                        │
│  ├─ calc-faturamento.ts (faturamento, TM, descontos)           │
│  ├─ calc-custos.ts (atração, cancelamentos, couvert)            │
│  ├─ calc-operacional.ts (stockout via RPC, mix)                 │
│  ├─ calc-satisfacao.ts (NPS, reviews)                           │
│  ├─ calc-distribuicao.ts (horário, dia semana)                  │
│  └─ calc-clientes.ts (métricas de clientes)                    │
│                                                                  │
│  cmv-semanal-auto (cálculo CMV)                                 │
│  agente-dispatcher (análise IA diária com Gemini)               │
│  alertas-dispatcher (alertas Discord)                            │
│  cron-watchdog (monitoramento)                                   │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 15)                          │
│                                                                  │
│  MÓDULOS:                                                        │
│  ├─ /estrategico/desempenho — Dashboard KPIs semanais           │
│  ├─ /estrategico/orcamentacao — Orçamento e planejamento        │
│  ├─ /operacional/dre — DRE (Demonstrativo de Resultado)         │
│  ├─ /ferramentas/stockout — Análise de stockout                 │
│  ├─ /ferramentas/cmv-semanal — CMV semanal                     │
│  ├─ /ferramentas/dre — DRE ferramentas                          │
│  ├─ /ferramentas/agendamento — [EM MIGRAÇÃO]                   │
│  ├─ /analitico/* — Dashboards analíticos                        │
│  └─ /configuracoes/* — Admin e integrações                      │
│                                                                  │
│  API ROUTES:                                                     │
│  ├─ /api/estrategico/desempenho — KPIs semanais                │
│  ├─ /api/financeiro/dre-simples — DRE consolidado              │
│  ├─ /api/analitico/stockout — Dados de stockout                │
│  ├─ /api/cmv-semanal/* — CMV dados e detalhes                  │
│  ├─ /api/exploracao/faturamento — Análise de receita           │
│  └─ /api/health — Health check do sistema                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## CRON JOBS — CADEIA DE EXECUÇÃO DIÁRIA (BRT)

```
07:00  contaazul-sync (Conta Azul → contaazul_lancamentos)
10:00  contahub-sync-automatico (ContaHub → raw_data + tabelas)
10:30  contahub-update-eventos (ContaHub → eventos_base)
11:00  auto-recalculo-eventos (recalcula eventos pós-sync)
11:30  desempenho-auto-diario (recalcular-desempenho-v2)
12:00  cmv-semanal-auto (cálculo CMV)
12:00  agente-dispatcher bar_id=3 (análise IA Ordinário)
12:05  agente-dispatcher bar_id=4 (análise IA Deboche)
12:30  eventos_cache_refresh (atualiza cache)
*/15   cron-watchdog (monitoramento)
*/30   alertas-dispatcher (alertas Discord)
*/4h   getin-sync-continuous (reservas GetIn)
```

---

## INTEGRAÇÕES ATIVAS

| Sistema | Tipo | Edge Function | Tabela Destino |
|---------|------|---------------|----------------|
| ContaHub | POS (vendas) | contahub-sync-automatico | contahub_analitico, contahub_cancelamentos, etc. |
| Conta Azul | Financeiro | contaazul-sync | contaazul_lancamentos |
| GetIn | Reservas | getin-sync-continuous | getin_reservations |
| Google Reviews | NPS | google-reviews-apify-sync | nps, nps_falae_diario |
| Sympla | Ingressos | (via API route) | sympla_pedidos, sympla_participantes |
| Umbler | WhatsApp | umbler-sync-incremental | umbler_conversas |
| Discord | Notificações | alertas-dispatcher | (webhooks diretos) |
| Gemini AI | Análise | agente-dispatcher | analises_diarias |
| Google Sheets | CMV/Contagem | sync-cmv-sheets, sync-contagem-sheets | cmv_semanal |
