# Auditoria sec/01 — policies com `roles=public` + `USING true|NULL`

Data: 2026-04-24 (apos merges de perf/01, perf/02, perf/03)
Metodo: 2 queries em `pg_policies` + count como `anon` em cada candidato.
Escopo: diagnostico-only. Nada aplicado.

## Sumario executivo

| Severidade | Tabelas | Rows expostas a anon |
|---|---:|---:|
| **CRITICO** | 2 | **17** rows com PII e logs internos |
| **MEDIO** | 1 | 0 (vazia, mas policy aberta — bug latente) |
| FALSO POSITIVO / OK | varios | 0 (INSERT policies com qual=NULL — comportamento normal) |

**Recomendacao**: abrir `sec/01-fix-public-leaks` ANTES da Fase 4 — bug em prod tem prioridade.

---

## CRITICO

### `operations.bares` — anon vê CNPJ + endereço dos 2 bares

**Policy:** `bars_select_policy` — PERMISSIVE, cmd=SELECT, roles={public}, qual=`true`

**Anon count:** 2 / 2 rows expostas.

**Sample lido como anon (PII confirmada em prod):**
```
[
  {"id": 4, "nome": "Deboche Bar", "cnpj": "98.765.432/0001-10", "endereco": "Endereço do Deboche Bar", "ativo": true},
  {"id": 3, "nome": "Ordinário Bar", "cnpj": "12.345.678/0001-90", "endereco": "Endereço do Ordinário Bar", "ativo": true}
]
```

**Por que e critico:**
- `cnpj` e PII fiscal — qualquer um com a `anon_key` publica do projeto consegue listar os CNPJs dos clientes Zykor.
- `endereco` revela localizacao operacional.
- Tambem expoe `config` (jsonb) e `metas` (jsonb) — regras de negocio internas (a query nao buscou esses dois mas estao na tabela).

**Causa provavel:**
Policy criada quando o app precisava listar bares na tela de login antes do auth (selecionar qual bar acessar). Mas o `qual=true` retorna campos sensiveis junto com os necessarios pra UI.

**Opcoes de fix:**
1. Restringir `qual` pra so retornar `(id, nome, ativo)` via VIEW publica + dropar a policy SELECT na tabela base.
2. Mudar `qual` pra exigir `auth.uid() IS NOT NULL` (so logado).
3. Trocar `roles={public}` pra `roles={authenticated}` apenas.

---

### `system.system_logs` — anon vê 15 logs internos do sistema

**Policy:** `system_logs_select` — PERMISSIVE, cmd=SELECT, roles={public}, qual=`true`

**Anon count:** 15 / 15 rows expostas.

**Sample lido como anon (logs de sync NIBO em prod):**
```json
{
  "tipo": "nibo_sync",
  "mensagem": "Sincronização NIBO concluída: 2 bar(es)",
  "detalhes": {
    "resultados": [
      {"bar_id": 4, "bar_nome": "Deboche Bar", "categorias": {"total": 107, ...}, "stakeholders": {"error": "Error: NIBO API Error: 500"}, ...},
      {"bar_id": 3, "bar_nome": "Ordinário Bar", "categorias": {"total": 101, ...}, ...}
    ],
    "duration_ms": 12741
  }
}
```

**Por que e critico:**
- Vaza arquitetura interna (NIBO sync, contagem de categorias, IDs de bar, durations).
- Vaza `error: "NIBO API Error: 500"` — sinaliza problemas internos pra atacante.
- Em rows futuras, pode incluir stack traces, tokens, IDs sensiveis (depende do que o codigo loga).
- Nao tem credenciais em texto plano nos samples atuais, mas o padrao e perigoso — qualquer log futuro fica exposto.

**Causa provavel:**
Tabela de logs internos. Policy provavelmente queria que `service_role` lesse (nao precisa, ja bypass) e ficou com `qual=true` por engano — mesmo padrao do bug fechado em contaazul (Fase 3).

**Opcoes de fix:**
1. DROP policy — service_role bypass RLS, ninguem mais precisa ler logs.
2. Restringir `qual` pra `(select auth.role()) = 'service_role'` — redundante mas explicito.
3. Limitar a admins via `is_user_admin()`.

---

## MEDIO

### `operations.checklist_automation_logs` — policy aberta, tabela vazia

**Policy:** `checklist_logs_select` — PERMISSIVE, cmd=SELECT, roles={public}, qual=`true`

**Anon count:** 0 (tabela vazia).

**Por que e medio:**
- Sem leak hoje. Mas qualquer linha inserida amanha fica visivel a anon.
- Mesmo padrao das tabelas CRITICO. Bug latente.

**Recomendacao:** mesmo fix dos `system_logs` (DROP policy ou restringir qual).

---

## INSERT policies com `qual=NULL` (FALSO POSITIVO)

A query 1 retornou 24 INSERT policies com `qual=NULL`. Isso e **comportamento normal**:
- INSERT nao verifica `qual` (USING e checado em SELECT/UPDATE/DELETE existentes).
- O que importa pra INSERT e `with_check`. Todas essas tinham `with_check` restritivo (`user_has_access_to_bar(bar_id)` ou similar).
- Anon nao consegue inserir porque `auth.uid()` retorna NULL e os checks falham.

Nao precisa fix.

Tabelas afetadas (nao fazem nada errado): `auth_custom.empresa_usuarios`, `auth_custom.empresas`, `crm.voz_cliente`, `financial.caixa_*`, `hr.areas/cargos/contratos/folha/funcionarios/provisoes`, `integrations.falae_respostas/google_reviews`, `meta.marketing_semanal/metas_anuais`, `operations.bares (insert)/checklist_*/eventos_concorrencia`, `public.usuarios`, `storage.objects`, `system.system_logs (insert)`.

---

## Findings da Query 2 (cmd != SELECT, with_check NULL/true)

Query 2 retornou 30 policies. Maioria tem `qual` restritiva (`user_has_access_to_bar`, `auth.uid() = ...`) que bloqueia anon — sem leak imediato.

**Mas** ha um problema multi-tenant em algumas (nao explorable por anon, exige usuario autenticado): policies com `cmd=ALL`, `qual=auth.role()='authenticated'` (sem restricao de bar_id), `with_check=NULL`. Significam: **qualquer authenticated user pode INSERT/UPDATE/DELETE em qualquer bar**.

Tabelas com este padrao:
- `bronze.bronze_contahub_raw_data` — `qual=auth.role()='authenticated'`
- `financial.dre_manual` — `qual=auth.uid() IS NOT NULL`
- `financial.orcamentacao` — `qual=auth.role()='authenticated'`
- `meta.semanas_referencia` — `qual=auth.uid() IS NOT NULL`
- `system.automation_logs` — `qual=auth.role()='authenticated'`
- `system.execucoes_automaticas` — `qual=auth.uid() IS NOT NULL`
- `system.uploads` — `qual=auth.role()='authenticated'`

**Severidade:** MEDIO — exige usuario autenticado, mas viola multi-tenancy (user de bar 3 pode escrever em row de bar 4). Nao explora por anon — fora do escopo desta auditoria. Anotar como follow-up.

---

## Decisao recomendada

**Abrir `sec/01-fix-public-leaks` ANTES da Fase 4** com escopo:
1. `operations.bares` — fix da policy `bars_select_policy` (opcao 1 ou 2).
2. `system.system_logs` — DROP da policy `system_logs_select` (service_role bypassa).
3. `operations.checklist_automation_logs` — DROP da policy `checklist_logs_select`.

Risco da Fase 4 (autovacuum) e tuning local de tabelas; o leak afeta producao agora. Prioridade: leak primeiro.

Multi-tenancy bugs do Query 2 ficam como `sec/02` separado — exigem decisao caso a caso (some podem ser intencionais pra service_role, mas o problema e usar `auth.role()='authenticated'` que cobre demais).
