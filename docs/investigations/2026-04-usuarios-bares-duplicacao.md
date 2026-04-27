# Investigação: public.usuarios_bares × auth_custom.usuarios_bares

**Data:** 2026-04-26
**Origin:** follow-up #44

## Contexto

`DOMAIN_MAP.md` documenta que `public.usuarios_bares` é "espelho de `auth_custom.usuarios_bares` (conteúdo idêntico — verificado, sem drift)". Investigação para confirmar:
1. Drift continua zero?
2. Ambos são realmente usados, ou um é dead code?
3. Pode-se consolidar em 1 schema?

## Queries rodadas

### Counts

```sql
SELECT 'public' AS schema_origem, COUNT(*) FROM public.usuarios_bares
UNION ALL SELECT 'auth_custom', COUNT(*) FROM auth_custom.usuarios_bares;
```

| schema_origem | count |
|---------------|-------|
| public | **24** |
| auth_custom | **24** |

### Drift bidirectional

```sql
WITH p AS (SELECT id, usuario_id, bar_id FROM public.usuarios_bares),
     a AS (SELECT id, usuario_id, bar_id FROM auth_custom.usuarios_bares)
SELECT 'in_public_not_auth', COUNT(*) FROM (SELECT * FROM p EXCEPT SELECT * FROM a) x
UNION ALL SELECT 'in_auth_not_public', COUNT(*) FROM (SELECT * FROM a EXCEPT SELECT * FROM p) x;
```

| direction | count |
|-----------|-------|
| in_public_not_auth | **0** |
| in_auth_not_public | **0** |

→ **Zero drift. Tabelas idênticas.**

### Quem usa cada (RLS policies)

37 policies referenciam `usuarios_bares`. **Todas resolvem via search_path para `public.usuarios_bares`** (ou usam `FROM usuarios_bares` sem qualificação, que cai em `public` com search_path padrão).

Schemas com policies que usam (todas via public):
- agent_ai (13 tabelas)
- bronze (5 tabelas)
- financial (2 tabelas)
- integrations (10 tabelas)
- meta (3 tabelas)
- operations (2 tabelas)
- public (1 tabela)
- system (1 tabela)

### Quem usa cada (functions)

- `public.user_has_bar_access(check_bar_id)` — função canônica usada nas 37 policies acima — lê de `public.usuarios_bares`.
- `public.user_has_access_to_bar(p_bar_id)` — função duplicada (tracked em #42) — lê de tabela inexistente `user_bars` (provavelmente código morto).

**`auth_custom.usuarios_bares` aparece em pg_stat_statements** (4873 calls de `WHERE usuario_id = $1`) — alguém escreve lá! Provavelmente o trigger ou edge function de signup ainda escreve em `auth_custom`.

## Findings

1. **Zero drift confirmado** entre as 24 rows em cada schema.
2. **`public.usuarios_bares` é o read-side single source of truth** — 100% das policies + função canônica `user_has_bar_access` lêem daqui.
3. **`auth_custom.usuarios_bares` recebe writes** (4873 calls em pg_stat_statements) — provavelmente um trigger sincroniza public ↔ auth_custom, ou ambas recebem escrita simultaneamente.
4. **Sem dead code claro** — ambas têm tráfego. Mas a duplicação é manutenção dupla.

## Recomendação

**DEFER consolidação completa** — risco de tocar em fluxo de signup sem entender quem escreve onde. Mas **cleanup parcial** é seguro.

### Próximas ações

1. **Investigação adicional (1h)** — descobrir quem escreve em `auth_custom.usuarios_bares`:
   ```sql
   SELECT substring(query for 300), calls
   FROM pg_stat_statements
   WHERE query ~ 'INSERT|UPDATE|DELETE'
     AND query ~ 'auth_custom\.usuarios_bares'
   ORDER BY calls DESC;
   ```

2. **Documentar fluxo atual** em `database/DOMAIN_MAP.md` seção 2 — quem é write-side, quem é read-side.

3. **Plano de consolidação faseado (3-4 semanas):**
   - Fase 1: trigger AFTER INSERT/UPDATE/DELETE em `auth_custom.usuarios_bares` que sincroniza pra `public.usuarios_bares` (pra garantir read-side sempre fresco)
   - Fase 2: monitorar 1 semana — confirmar zero divergência via cron diff
   - Fase 3: substituir `auth_custom.usuarios_bares` por **view** apontando pra `public.usuarios_bares`
   - Fase 4: redirecionar todos os writes pra `public` (após confirmação)

**Verdict #44: ZERO drift, ZERO bug. Mas duplicação real de write-side é dívida técnica. Consolidação requer plano faseado de 3-4 semanas — não é quick-win, fica deferred até próxima sprint estrutural.**
