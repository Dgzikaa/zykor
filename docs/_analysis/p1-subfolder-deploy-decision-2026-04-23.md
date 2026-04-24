# P1 — Subfolder deploy: decisão (Etapa 4)

> Prompt 05 / Etapa 4 pede teste empírico de deploy com subpastas por camada.
> Executado em 2026-04-23 (sem criar branch Supabase — teste direto em main project com função de debug `test-boot`, não-destrutivo).

## Teste 1 — Default lookup (sem config.toml)

Movido `backend/supabase/functions/test-boot/` → `backend/supabase/functions/bronze/test-boot/`.

```
$ supabase functions deploy test-boot --use-api
WARN: failed to read file: open supabase\functions\test-boot\index.ts: The system cannot find the path specified.
unexpected deploy status 400: {"message":"Entrypoint path does not exist - .../source/supabase/functions/test-boot/index.ts"}
```

❌ CLI assume convenção `supabase/functions/<name>/index.ts`. Sem configuração explícita, não encontra em subpasta.

## Teste 2 — Option C (config.toml com entrypoint override)

Adicionado ao `backend/supabase/config.toml`:

```toml
[functions.test-boot]
entrypoint = "./functions/bronze/test-boot/index.ts"
verify_jwt = false
```

```
$ supabase functions deploy test-boot --use-api
Uploading asset (test-boot): supabase/functions/bronze/test-boot/index.ts
WARN: failed to read file: open supabase\functions\bronze\_shared\calculators\calc-operacional.ts
unexpected deploy status 400: {"message":"Failed to bundle the function (reason: Module not found \"...supabase/functions/bronze/_shared/calculators/calc-operacional.ts\". at .../bronze/test-boot/index.ts:6:33)."}
```

✅ CLI encontrou o arquivo via `entrypoint` do config.toml.
❌ Bundler quebrou porque `test-boot/index.ts` tem `import ... from '../_shared/...'` — ao mover pra `bronze/`, `../_shared/` agora resolve pra `bronze/_shared/` (não existe).

## Consequência

Pra organização em subpastas funcionar com Option C, **todas as funções** precisariam reescrever imports `../_shared/*` pra `../../_shared/*`. São **48 funções**, cada uma com múltiplas imports de `_shared/`. Deno não tem rewrite automático como webpack alias.

## Alternativas comparadas

| Opção | Funciona? | Custo | Observação |
|-------|-----------|-------|------------|
| **A**: Manter flat + README + `ops.job_camada_mapping` | ✅ | Zero | Já está implementado (Prompt 01 migration + README da Etapa 2) |
| **B**: Symlinks (`bronze/contahub-sync-automatico` → `../contahub-sync-automatico`) | Parcial | Quebra no Windows + fragil com git | **Evitar** |
| **C**: config.toml `[functions.*] entrypoint` | Parcialmente | Requer reescrever imports `../_shared/` → `../../_shared/` em **todas** as 48 fns + cada uma acresce ~10 linhas em config.toml | Alto custo pra benefício cosmético |

## Decisão: **Option A**

Manter `backend/supabase/functions/` plano. A organização medallion já é legível via:

1. **`backend/supabase/functions/README.md`** (Prompt 03) — tabela de decisões com camada por função.
2. **`ops.job_camada_mapping`** (migration 2026-04-23-observability-mapping) — source of truth no banco; usado pelo `gold.v_pipeline_health`.
3. **`@camada` header** nos arquivos TS (P2 desta etapa) — rastreabilidade inline.

Subpastas agregariam legibilidade marginal em troca de:
- Reescrever imports em 48 arquivos (fragil, bundling-sensitive).
- Adicionar ~500 linhas ao `config.toml`.
- Quebrar qualquer script externo que assume convention `supabase/functions/<name>/`.

**Revisitar** se:
- Supabase CLI ganhar suporte nativo a glob/subfolder discovery.
- Houver >100 funções (hoje 48).
- Alguém precisar rodar ferramenta que consome a estrutura de pastas diretamente (não é o caso hoje — `job_camada_mapping` cobre).

## Critério de aceite P1

- [x] Rota decidida e documentada → **Option A** (flat + metadata).
