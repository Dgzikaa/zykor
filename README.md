# Zykor — Sistema de Gestão de Bares

> Plataforma de gestão operacional e financeira para **Ordinário Bar** (`bar_id=3`) e **Deboche Bar** (`bar_id=4`).

## Arquitetura medallion

```
┌──────────────┐     ┌───────────────┐     ┌─────────────┐     ┌──────────┐
│   BRONZE     │ →   │    SILVER     │ →   │    GOLD     │ →   │ CONSUMO  │
│  ingestão    │     │   tipado      │     │  calculado  │     │ frontend │
│  raw JSON    │     │ tabelas mapas │     │ métricas    │     │ AI/PDFs  │
└──────────────┘     └───────────────┘     └─────────────┘     └──────────┘
  APIs externas      contahub_analitico    gold.desempenho_     Dashboards
  ContaHub, NIBO,    contahub_pagamentos   semanal,             Agentes IA
  GetIn, Apify, ...  getin_reservas        gold.planejamento    Relatórios
```

Ingestão é 100% via edge function. Cálculos são 100% no banco (funções SQL). Frontend só consome e apresenta.

## Onde está o quê?

| Responsabilidade | Pasta |
|---|---|
| Edge functions (Deno) | `backend/supabase/functions/` |
| SQL funções, views, triggers | `database/functions/`, `database/views/`, `database/triggers/` |
| Migrations do banco | `database/migrations/` |
| Frontend (Next.js 15) | `frontend/src/` |
| Client medallion tipado | `frontend/src/lib/medallion/` |
| Scripts utilitários | `scripts/_active/` (ativos) e `scripts/_archive/` (históricos) |
| Regras de negócio | `docs/regras-negocio.md` |
| Guia para Claude/Cursor | `CLAUDE.md` |
| Plano de limpeza em execução | `docs/planning/MASTER_PLAN.md` |
| Docs por domínio | `docs/domains/` |

## Start rápido

```bash
# Frontend (porta 3001)
cd frontend && npm install && npm run dev

# Deploy de edge function (autenticar antes: supabase login)
cd backend && supabase functions deploy <nome-da-funcao>

# Testes do frontend
cd frontend && npm test
```

## Regras invioláveis

1. **SEMPRE filtrar por `bar_id`** em todas as queries. Nunca assumir um único bar.
2. **NUNCA deletar dados ContaHub**. Triggers de proteção aplicados.
3. **Campos manuais jamais sobrescrever** — ver `docs/regras-negocio.md` §10.
4. **Data real ≠ dt_gerencial** em ContaHub: `>=15h` usa `dataLancamento`, pagamentos usam apenas `dt_gerencial`.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind, Radix, Recharts |
| Backend | Supabase Edge Functions (Deno/TS) — ~48 funções |
| Banco | PostgreSQL (Supabase) + pg_cron |
| Deploy | Vercel (frontend), Supabase (funções + DB) |
| IA | Anthropic SDK, OpenAI SDK |
| Monitoramento | Sentry |

## Limpeza em andamento

Estamos executando um plano de 7 etapas (2026-04-23 → ~2 semanas) para consolidar docs, reorganizar pastas em medallion explícito, remover legacy e criar observabilidade central. Acompanhe em `docs/planning/MASTER_PLAN.md`.

## Licença e contexto

Projeto privado do Grupo Menos É Mais. Código em inglês, docs e UI em pt-BR.
