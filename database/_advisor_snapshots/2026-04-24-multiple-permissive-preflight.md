# Preflight — perf/03-multiple-permissive-policies

Findings raw: **66**, parse failures: **0**
Tabelas distintas afetadas: **11**

## Sumario por bucket

| Bucket | Tabelas | Significado |
|---|---:|---|
| A — DROP service_role redundante | 9 | service_role tem BYPASSRLS=true; policy USING(auth.role()='service_role') OR USING(true) eh no-op. DROP eh seguro. |
| B — Roles distintos | 0 | Policies com roles diferentes; pode ser intencional. |
| C — Read/write split / complexo | 2 | Cmds diferentes; merge nao trivial. Precisa decisao. |
| **Total** | **11** | |

## Premissa critica (verificada via pg_roles)

```
rolname            rolbypassrls
anon               false
authenticated      false
authenticator      false
dashboard_user     false
postgres           true
service_role       true   <-- bypassa RLS
supabase_admin     true
```

Conclusao: policies do tipo `service_role_full_*` com `USING (auth.role()='service_role')`
ou `USING (true)` sao redundantes — `service_role` ja bypassa qualquer RLS por default.
DROP dessas policies NAO altera comportamento de service_role.

Bonus: 2 das policies a dropar (contaazul_*) tem `roles={public}` + `USING (true)`,
o que vazava SELECT pra TODOS os roles (incluindo `anon`). DROP fortalece seguranca.

## Bucket A — DROP service_role policy redundante

Pattern: DROP POLICY <service_role_*> + manter <usuarios_leem_*> intacta.

**SEM ALTER POLICY** na que fica — ela ja esta correta.
**COM DROP POLICY** na redundante (bypass RLS torna inutil).

### `crm.crm_segmentacao` (6 findings)

**Atual:**
```sql
-- DROP candidate (redundante por BYPASSRLS):
--   service_role_full_crm_segmentacao                  cmd=ALL    permissive=PERMISSIVE
--     roles: {public}
--     qual:  (( SELECT auth.role() AS role) = 'service_role'::text)

-- KEEP (policy real do usuario):
--   usuarios_leem_crm_segmentacao                      cmd=SELECT permissive=PERMISSIVE
--     roles: {public}
--     qual:  ((( SELECT auth.role() AS role) = 'authenticated'::text) AND user_has_bar_access(bar_id))
```

**SQL proposto:**
```sql
DROP POLICY "service_role_full_crm_segmentacao" ON "crm"."crm_segmentacao";
```

### `crm.nps_falae_diario_legacy_backup` (6 findings)

**Atual:**
```sql
-- DROP candidate (redundante por BYPASSRLS):
--   service_role_full_nps_falae_diario                 cmd=ALL    permissive=PERMISSIVE
--     roles: {public}
--     qual:  (( SELECT auth.role() AS role) = 'service_role'::text)

-- KEEP (policy real do usuario):
--   usuarios_leem_nps_falae_diario                     cmd=SELECT permissive=PERMISSIVE
--     roles: {public}
--     qual:  ((( SELECT auth.role() AS role) = 'authenticated'::text) AND user_has_bar_access(bar_id))
```

**SQL proposto:**
```sql
DROP POLICY "service_role_full_nps_falae_diario" ON "crm"."nps_falae_diario_legacy_backup";
```

### `crm.nps_falae_diario_pesquisa` (6 findings)

**Atual:**
```sql
-- DROP candidate (redundante por BYPASSRLS):
--   service_role_full_nps_falae_diario_pesquisa        cmd=ALL    permissive=PERMISSIVE
--     roles: {public}
--     qual:  (( SELECT auth.role() AS role) = 'service_role'::text)

-- KEEP (policy real do usuario):
--   usuarios_leem_nps_falae_diario_pesquisa            cmd=SELECT permissive=PERMISSIVE
--     roles: {public}
--     qual:  ((( SELECT auth.role() AS role) = 'authenticated'::text) AND user_has_bar_access(bar_id))
```

**SQL proposto:**
```sql
DROP POLICY "service_role_full_nps_falae_diario_pesquisa" ON "crm"."nps_falae_diario_pesquisa";
```

### `financial.cmv_mensal` (6 findings)

**Atual:**
```sql
-- DROP candidate (redundante por BYPASSRLS):
--   service_role_full_cmv_mensal                       cmd=ALL    permissive=PERMISSIVE
--     roles: {public}
--     qual:  (( SELECT auth.role() AS role) = 'service_role'::text)

-- KEEP (policy real do usuario):
--   usuarios_leem_cmv_mensal                           cmd=SELECT permissive=PERMISSIVE
--     roles: {public}
--     qual:  ((( SELECT auth.role() AS role) = 'authenticated'::text) AND user_has_bar_access(bar_id))
```

**SQL proposto:**
```sql
DROP POLICY "service_role_full_cmv_mensal" ON "financial"."cmv_mensal";
```

### `integrations.contaazul_categorias` (6 findings)

**Atual:**
```sql
-- DROP candidate (redundante por BYPASSRLS):
--   service_role_full_access                           cmd=ALL    permissive=PERMISSIVE
--     roles: {public}
--     qual:  true
--     with_check: true

-- KEEP (policy real do usuario):
--   authenticated_select_bar_access                    cmd=SELECT permissive=PERMISSIVE
--     roles: {public}
--     qual:  ((( SELECT auth.role() AS role) = 'authenticated'::text) AND (bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = ( SELECT auth.uid() AS uid)))))
```

**SQL proposto:**
```sql
DROP POLICY "service_role_full_access" ON "integrations"."contaazul_categorias";
```

⚠️ **Nota seguranca**: esta policy tinha `USING (true)` + `roles={public}`,
permitindo SELECT por TODOS os roles incluindo `anon`. DROP corrige bug de seguranca
que ja existia. service_role continua acessando via BYPASSRLS.

### `integrations.contaazul_centros_custo` (6 findings)

**Atual:**
```sql
-- DROP candidate (redundante por BYPASSRLS):
--   service_role_full_access                           cmd=ALL    permissive=PERMISSIVE
--     roles: {public}
--     qual:  true
--     with_check: true

-- KEEP (policy real do usuario):
--   authenticated_select_bar_access                    cmd=SELECT permissive=PERMISSIVE
--     roles: {public}
--     qual:  ((( SELECT auth.role() AS role) = 'authenticated'::text) AND (bar_id IN ( SELECT usuarios_bares.bar_id
   FROM usuarios_bares
  WHERE (usuarios_bares.usuario_id = ( SELECT auth.uid() AS uid)))))
```

**SQL proposto:**
```sql
DROP POLICY "service_role_full_access" ON "integrations"."contaazul_centros_custo";
```

⚠️ **Nota seguranca**: esta policy tinha `USING (true)` + `roles={public}`,
permitindo SELECT por TODOS os roles incluindo `anon`. DROP corrige bug de seguranca
que ja existia. service_role continua acessando via BYPASSRLS.

### `meta.metas_desempenho_historico` (6 findings)

**Atual:**
```sql
-- DROP candidate (redundante por BYPASSRLS):
--   service_role_full_metas_desempenho_historico       cmd=ALL    permissive=PERMISSIVE
--     roles: {public}
--     qual:  (( SELECT auth.role() AS role) = 'service_role'::text)

-- KEEP (policy real do usuario):
--   usuarios_leem_metas_desempenho_historico           cmd=SELECT permissive=PERMISSIVE
--     roles: {public}
--     qual:  ((( SELECT auth.role() AS role) = 'authenticated'::text) AND user_has_bar_access(bar_id))
```

**SQL proposto:**
```sql
DROP POLICY "service_role_full_metas_desempenho_historico" ON "meta"."metas_desempenho_historico";
```

### `system.sync_contagem_historico` (6 findings)

**Atual:**
```sql
-- DROP candidate (redundante por BYPASSRLS):
--   service_role_full_sync_contagem_historico          cmd=ALL    permissive=PERMISSIVE
--     roles: {public}
--     qual:  (( SELECT auth.role() AS role) = 'service_role'::text)

-- KEEP (policy real do usuario):
--   usuarios_leem_sync_contagem_historico              cmd=SELECT permissive=PERMISSIVE
--     roles: {public}
--     qual:  ((( SELECT auth.role() AS role) = 'authenticated'::text) AND user_has_bar_access(bar_id))
```

**SQL proposto:**
```sql
DROP POLICY "service_role_full_sync_contagem_historico" ON "system"."sync_contagem_historico";
```

### `system.sync_metadata` (6 findings)

**Atual:**
```sql
-- DROP candidate (redundante por BYPASSRLS):
--   service_role_full_sync_metadata                    cmd=ALL    permissive=PERMISSIVE
--     roles: {public}
--     qual:  (( SELECT auth.role() AS role) = 'service_role'::text)

-- KEEP (policy real do usuario):
--   usuarios_leem_sync_metadata                        cmd=SELECT permissive=PERMISSIVE
--     roles: {public}
--     qual:  ((( SELECT auth.role() AS role) = 'authenticated'::text) AND user_has_bar_access(bar_id))
```

**SQL proposto:**
```sql
DROP POLICY "service_role_full_sync_metadata" ON "system"."sync_metadata";
```

## Bucket C — Read/write split (precisa decisao)

Estas tabelas tem 2 policies PERMISSIVE com cmds diferentes (uma SELECT, outra ALL).
Overlap so existe em SELECT. NAO da pra simplesmente DROP — perde funcionalidade.

Opcoes possiveis (escolher por tabela):
1. **Adiar** — manter como esta. Overhead de 2 policies em SELECT eh pequeno.
2. **Split cmd** — DROP a policy ALL + CREATE 3 novas (INSERT, UPDATE, DELETE).
   Mantem semantica, satisfaz advisor. Mas viola 'no DROP+CREATE' (cria 3 novas).
3. **Merge cmd=ALL com USING e WITH CHECK separados** — DROP read + ALTER write
   pra `USING (read_cond OR write_cond) WITH CHECK (write_cond)`. Funciona em
   SELECT/INSERT/UPDATE mas DELETE so checa USING (vaza permissao de delete!).
   ⚠️ Risco de regressao de seguranca em DELETE.

### `operations.config_metas_planejamento`

**Policies envolvidas:**
```sql
-- config_metas_read_by_bar                           cmd=SELECT roles={public}
--   qual: user_has_bar_access(bar_id)
--
-- config_metas_write_admin                           cmd=ALL    roles={public}
--   qual: is_user_admin()
--   with_check: is_user_admin()
--
```

**Recomendacao**: opcao 1 (adiar) por default. Opcao 2 se voce quiser
eliminar todos os warnings. Opcao 3 NAO recomendada (risco DELETE).

### `ops.job_camada_mapping`

**Policies envolvidas:**
```sql
-- job_camada_read_auth                               cmd=SELECT roles={public}
--   qual: (( SELECT auth.role() AS role) = 'authenticated'::text)
--
-- job_camada_write_admin                             cmd=ALL    roles={public}
--   qual: is_user_admin()
--   with_check: is_user_admin()
--
```

**Recomendacao**: opcao 1 (adiar) por default. Opcao 2 se voce quiser
eliminar todos os warnings. Opcao 3 NAO recomendada (risco DELETE).
