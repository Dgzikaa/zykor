# Preflight — perf/02-rls-initplan

Findings `auth_rls_initplan` no advisor (raw, com duplicatas): **58**
Policies distintas (apos dedup): **58**

## Buckets

| Bucket | Count |
|---|---:|
| FIX APLICAVEL | 58 |
| JA ENVELOPADA (falso positivo do advisor) | 0 |
| NAO ENCONTRADA (policy ausente em pg_policies) | 0 |
| CASO NAO-TRIVIAL (revisao manual) | 0 |
| **Total (distintas)** | **58** |

## Amostra de 3 ALTER POLICY (FIX APLICAVEL)
Os 3 primeiros (ordem alfabetica) — pra validacao da forma.

### `agent_ai.agent_insights_v2` :: `agent_insights_v2_bar_access` (1 substituicoes)
**Antes (snapshot pg_policies):**
```sql
USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = auth.uid()))))
```
**Depois (gerado):**
```sql
ALTER POLICY "agent_insights_v2_bar_access" ON "agent_ai"."agent_insights_v2"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));
```

### `agent_ai.agente_alertas` :: `Users can access their bar data` (2 substituicoes)
**Antes (snapshot pg_policies):**
```sql
USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = auth.uid()))))
WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = auth.uid()))))
```
**Depois (gerado):**
```sql
ALTER POLICY "Users can access their bar data" ON "agent_ai"."agente_alertas"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));
```

### `agent_ai.agente_aprendizado` :: `Users can access their bar data` (2 substituicoes)
**Antes (snapshot pg_policies):**
```sql
USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = auth.uid()))))
WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = auth.uid()))))
```
**Depois (gerado):**
```sql
ALTER POLICY "Users can access their bar data" ON "agent_ai"."agente_aprendizado"
  USING ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))))
  WITH CHECK ((bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = (select auth.uid())))));
```
