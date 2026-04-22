# Zykor — Sistema de Gestao de Bares (SGB)

> Plataforma de gestao operacional e financeira para bares (Ordinario Bar `bar_id=3`, Deboche Bar `bar_id=4`).

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Radix UI, Recharts |
| Backend | Supabase Edge Functions (Deno/TypeScript), ~48 functions |
| Database | PostgreSQL (Supabase), pg_cron |
| Deploy | Vercel (frontend), Supabase (functions + DB) |
| AI | Anthropic SDK, OpenAI SDK |
| Monitoring | Sentry |

## Project Structure

```
zykor/
  frontend/           # Next.js app (port 3001)
    src/
      app/             # App Router pages + API routes
      components/      # Shared UI components
      hooks/           # Custom React hooks
      lib/             # Services, API client, AI modules
      contexts/        # React contexts
      types/           # TypeScript types
  backend/
    supabase/functions/  # Edge Functions (Deno)
    _shared/             # Shared utils across functions
  database/
    functions/         # SQL functions
    migrations/        # DB migrations
    triggers/          # DB triggers
    views/             # DB views
    silver/            # Silver-layer transforms
  scripts/             # ~130 utility scripts (JS/TS/PS1/Python)
  supabase/            # Root-level Supabase config
  docs/                # Business rules, changelogs, architecture docs
```

## Architecture — Data Pipeline (5 Layers)

```
1. INGESTAO   — APIs externas (ContaHub, NIBO, GetIn, Google Sheets, Apify, Sympla, Umbler) -> raw tables
2. PROCESSAMENTO — raw JSON -> typed tables (contahub-processor)
3. CALCULO    — typed tables -> metrics per event (calculate_evento_metrics)
4. AGREGACAO  — metrics -> weekly KPIs (desempenho_semanal)
5. CONSUMO    — KPIs -> dashboards, AI, reports
```

## Critical Rules

1. **SEMPRE filtrar por `bar_id`** em todas as queries. NUNCA assumir um bar.
2. **NUNCA deletar dados das tabelas ContaHub.** Base de clientes e critica, triggers de protecao aplicados.
3. **Campos manuais nunca sobrescrever** — consultar `docs/regras-negocio.md` secao 10.
4. **Data real vs dt_gerencial**: ContaHub corrige data por hora (>=15h usa dataLancamento), pagamentos usam apenas dt_gerencial.
5. **Categorias de produto**: cerveja/bebida -> `bebida`, drink -> `drink`, outros -> `comida`.

## Database Conventions

- Tables use domain prefixes: `contahub_`, `nibo_`, `getin_`, `cmv_`, `cmo_`, `checklist_`, etc.
- Suffixes: `_base` (editable), `_cache` (regenerable), `_historico` (audit), `_logs`, `_config`, `_raw_data` (staging).
- New views use `v_` prefix, materialized views use `mv_`.
- Views-alias (no prefix) exist for backwards compat — e.g., `analitico` -> `contahub_analitico`.
- Full conventions: `database/CONVENTIONS.md`, domain map: `database/DOMAIN_MAP.md`.

## Development

```bash
# Frontend
cd frontend && npm run dev     # localhost:3001

# Deploy edge function
cd backend && supabase functions deploy <function-name>

# Tests
cd frontend && npm test
```

## Key Files

- Business rules: `docs/regras-negocio.md`
- Database conventions: `database/CONVENTIONS.md`
- Domain map: `database/DOMAIN_MAP.md`
- Vercel crons: `frontend/vercel.json`
- Supabase crons: `backend/create_cron_jobs.sql`

## Language

- Code: English (variables, functions, types)
- UI text, docs, business rules, commit messages: Portuguese (pt-BR)
