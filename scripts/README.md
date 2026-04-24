> Última atualização: 2026-04-23
> Reorganização feita na Etapa 3 do plano de limpeza (`docs/planning/03-exclusao-legacy.md`).

# scripts/

Utilitários de operação do Zykor — separados em dois grupos:

## `_active/` (5 arquivos)

Scripts reutilizáveis que ainda fazem sentido executar hoje. Antes de adicionar algo aqui, pergunte: **"vou rodar isso de novo nos próximos 30 dias?"** Se sim, fica. Se não, vai pra `_archive/`.

Atuais:
- `atualizar-frontend-completo.ps1` — deploy/setup do frontend.
- `calcular-semana.ts` — lógica de numeração de semanas (reusável via import).
- `sync-range.js` / `sync-range.ps1` — sync genérico por range de datas.
- `update-cors-all-functions.py` — propaga CORS config em todas as edge functions.

## `_archive/` (143 arquivos)

One-off históricos. Mantidos pra referência, **não devem ser executados**. Organizados por categoria:

| Pasta | Conteúdo | Qtde |
|---|---|---|
| `fix/` | Hotfixes pontuais (`fix-*.js`) | 8 |
| `debug-investigar/` | Scripts de debug e investigação (`debug-*`, `investigar-*`, `encontrar-*`, `diagnostico-*`) | 14 |
| `comparar-verificar/` | Comparações e verificações pontuais (`comparar-*`, `verificar-*`, `validar-*`) | 21 |
| `recalcular/` | Recálculos por semana/dia específico (`recalcular-semana-12.js`, etc.) | 14 |
| `reprocessar/` | Reprocessamentos pontuais (`reprocessar-*`, `processar-dias-*`) | 11 |
| `sync-oneoff/` | Syncs datados (2025, 2026, março, semana-14) — NÃO são o sync recorrente, que roda via edge function | 23 |
| `test/` | Scripts de teste manual (`test-*`, `testar-*`) | 29 |
| `misc-oneoff/` | Scripts ad-hoc que não entraram em outra categoria (backfills, updates de schema, inserção manual de eventos, etc.) | 23 |

## Regra pra adicionar novos scripts

Escreveu um script novo? Pergunta-checagem:

1. **Vai rodar mais de uma vez por semana**, contra qualquer bar, sem precisar editar o código? → `_active/`
2. **É one-off** (fixa uma semana específica, um dia, um backfill histórico, um debug)? → `_archive/<categoria>/`
3. **Em dúvida?** Vai pra `_archive/misc-oneoff/`. É mais seguro arquivar do que acumular lixo em `_active/`.

## Regra pra remover do repo

Scripts em `_archive/` podem ser deletados **depois de 6 meses** sem ninguém consultar. Enquanto isso, ficam como histórico de operação (útil pra reconstituir decisões de dados).

## O que NÃO está aqui

- **Edge functions**: `backend/supabase/functions/`
- **SQL functions**: `database/functions/`
- **Migrations**: `database/migrations/`
- **Scripts de build do frontend**: `frontend/package.json` (`npm run *`)
