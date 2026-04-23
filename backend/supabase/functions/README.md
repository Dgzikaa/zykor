> Última atualização: 2026-04-23
> Status: Etapa 2 executada — ver seção "Auditoria 2026-04-23" abaixo.

# Edge Functions — Inventário

## Auditoria 2026-04-23 — Etapa 2 (decisões executadas)

Executado o audit de 13 funções "suspeitas" definidas em `docs/planning/02-limpeza-edge-functions.md`. Para cada uma: (1) cron? (2) callers em outras edge functions? (3) callers no frontend? Classificação final:

| Função | Cron | Backend caller | Frontend caller | Deployed | Decisão | Evidência |
|---|---|---|---|---|---|---|
| `test-boot` | não | não | não | v9 | 📦 archived | função de debug, sem callers |
| `debug-cmv-mensal-sheets` | não | não | não | v2 | 📦 archived | função de debug |
| `execute-sql` | não | não | não | **não** | 📦 archived | anti-pattern + orphan no repo (não deployada) |
| `google-reviews-callback` | não | não | não | v11 | 📦 archived | OAuth antigo; `google-reviews-auth` v9 é a substituta |
| `google-reviews-retroativo` | não | self-only | não | v2 | 📦 archived | backfill one-off |
| `cmv-propagar-estoque` | não | não | não | v2 | 📦 archived | sem callers detectados |
| `atualizar-fichas-tecnicas` | não | não | **sim** (`api/fichas-tecnicas/atualizar/route.ts:15`) | v14 | ✅ keep | consumido pelo frontend |
| `relatorio-pdf` | não | **sim** (`discord-dispatcher:24`, `unified-dispatcher:40`) | **sim** (`api/relatorio/route.ts:12,48`) | v13 | ✅ keep (consumo) | multi-caller |
| `cmv-semanal-auto` | **sim** (daily 12h) | self | **sim** (5 chamadas: `create-cron`, `sync-retroativo`, `recalcular-auto`, `DesempenhoClient`, `ferramentas/cmv-semanal/page`) | v57 | ✅ keep (consumo/ops) | 72 execuções registradas |
| `contaazul-auth` | não | não | **sim** (`api/financeiro/contaazul/{status,oauth/callback,credentials}/route.ts`) | v5 | ✅ keep (ops) | fluxo OAuth ativo |
| `api-clientes-externa` | não | não | não (é API pública) | v31, `verify_jwt=false` | ⚠️ keep — flag | não verificável daqui; precisa confirmar se há consumer externo ativo |
| `nibo-export-excel` | — | — | — | não | ➖ já removida | folder local e remote já não existem |
| `cmv-ajustar-rowmap-deboche` | — | — | — | não | ➖ já removida | folder local e remote já não existem |

**Ações aplicadas neste commit:**
- 6 `git mv` para `_archived/` (listadas como "archived" acima).
- Nenhum `supabase functions delete` feito — exige 48h de observação após cron disable (e nenhum cron precisou ser desativado: só `cmv-semanal-auto` tinha um, e é keep).
- Nenhum cron desativado.

**Pendente (fora do escopo deste commit):**
- `api-clientes-externa` — confirmar consumo externo antes de decidir keep/archive.
- 48h após 2026-04-25: avaliar `supabase functions delete` para as 6 archived.
- Bugs colaterais vistos no grep: `frontend/src/app/api/.../*` chama `contahub_processor` (underscore) que não bate com o folder `contahub-processor`; `frontend/src/app/api/checklists/notifications/*` chama `whatsapp-send` que não existe. Registrar para investigação separada.

---

## Inventário geral

48 funções no diretório. Esta tabela classifica cada uma por camada medallion, uso e recomendação.

## Legenda

- **Camada**: `bronze` (ingestão de API externa → raw), `silver` (raw → tipado), `gold` (tipado → métrica), `consumo` (dashboard / relatório), `ops` (dispatcher, watchdog, alerta, webhook, auth), `lixo` (vazio / debug / perigoso).
- **Status sugerido**:
  - ✅ **manter** — em uso, nome e camada OK.
  - ✏️ **renomear** — útil mas nome não reflete camada (ex: mover pra prefixo `bronze-*`).
  - 📦 **arquivar** — não usada; mover pra `_archived/`.
  - 🚨 **remover** — vazia ou perigosa; remover do repo + do Supabase remoto.
  - 🔒 **revisar** — ambígua; decidir caso a caso antes de agir.

## Pré-validação antes de qualquer ação

Para cada função na tabela, confirmar no Supabase remoto se ela está:
1. Deployada (`supabase functions list`).
2. Agendada por cron (`SELECT jobname, command FROM cron.job WHERE active=true`).
3. Chamada por outra função (grep `functions.invoke('NOME')` no repo).
4. Chamada pelo frontend (grep `supabase.functions.invoke('NOME')` em `frontend/src/`).

**Se não estiver em 1–4, é candidata a arquivar.**

---

## Tabela por camada

### 🥉 Bronze — Ingestão (API externa → tabela raw)

| Função | Destino principal | Frequência (suposta) | Status |
|---|---|---|---|
| `contahub-sync-automatico` | `contahub_raw_data` | cron a cada 2h (ver `create_cron_jobs.sql`) | ✅ |
| `contahub-stockout-sync` | `contahub_raw_data` (stockout) | diário | ✅ |
| `contahub-resync-semanal` | `contahub_raw_data` (retroativo) | semanal | ✅ |
| `contaazul-sync` | `contaazul_*` | cron diário | ✅ |
| `getin-sync-continuous` | `getin_reservas_raw` | cron de 15m | ✅ |
| `google-sheets-sync` | múltiplas sheets | cron diário | ✅ |
| `google-reviews-apify-sync` | `google_reviews_raw` | cron 6h | ✅ |
| `umbler-sync-incremental` | `umbler_*` | cron 15m | ✅ |
| `sync-contagem-sheets` | `checklist_contagem_*` | cron | ✅ |
| `sync-cmv-sheets` | `cmv_*` | cron | ✅ |
| `sync-cmv-mensal` | `cmv_mensal` | cron mensal | ✅ |
| `sync-cmo-planilha` | `cmo_*` | cron | ✅ |

### 🥈 Silver — Processamento (raw → tipado)

| Função | Destino principal | Gatilho | Status |
|---|---|---|---|
| `contahub-processor` | `contahub_analitico`, `contahub_pagamentos`, etc. | invocada após sync | ✅ |
| `silver-processor` | silver genérico | invocada por pipeline | ✅ |
| `stockout-processar` | `contahub_estoque_diario` | invocada após stockout-sync | ✅ |

### 🥇 Gold — Cálculo & Agregação

| Função | Destino | Gatilho | Status |
|---|---|---|---|
| `recalcular-desempenho-v2` | `gold.desempenho_semanal`, `eventos_base` | manual / cron semanal | ✅ |
| `sync-faturamento-hora` | `gold.faturamento_hora` | cron | ✅ |
| `sync-cliente-perfil-consumo` | `gold.cliente_perfil_consumo` | cron | ✅ |

### 🧾 Consumo — Relatório / Export

| Função | Output | Chamada por | Status |
|---|---|---|---|
| `relatorio-pdf` | PDF binário | frontend (botões de export) | ✅ |

### ⚙️ Ops — Dispatcher / Watchdog / Webhook / Auth

| Função | Papel | Status |
|---|---|---|
| `alertas-dispatcher` | Dispara alertas (Discord / WhatsApp) baseado em regras | ✅ |
| `agente-detector` | Detecta eventos para os agentes AI | ✅ |
| `agente-dispatcher` | Roteia tarefa pro agente correto | ✅ |
| `agente-narrator` | Gera narração textual (AI) | ✅ |
| `agente-pipeline-v2` | Pipeline de execução dos agentes | ✅ |
| `checklist-auto-scheduler` | Agenda checklists automáticos | ✅ |
| `cron-watchdog` | Verifica crons atrasados | ✅ |
| `discord-dispatcher` | Envio unificado ao Discord | ✅ |
| `integracao-dispatcher` | Roteia callback de integrações | ✅ |
| `inter-pix-webhook` | Recebe webhook do Banco Inter (PIX) | ✅ |
| `monitor-concorrencia` | Scraping / coleta de concorrência (chamado por `/api/concorrencia/monitorar`) | ✅ |
| `sync-dispatcher` | Orquestra syncs | ✅ |
| `unified-dispatcher` | Roteamento genérico | 🔒 revisar (duplicado com sync-dispatcher?) |
| `webhook-dispatcher` | Recebe webhooks diversos | ✅ |
| `cmv-propagar-estoque` | Propaga estoque entre datas | ✅ |
| `cmv-semanal-auto` | Cálculo semanal de CMV | ✅ |
| `atualizar-fichas-tecnicas` | Atualiza fichas a partir de sheets (251 linhas) | ✅ |
| `contaazul-auth` | OAuth2 callback Conta Azul | ✅ |
| `api-clientes-externa` | API pública para terceiros (576 linhas) | 🔒 revisar (quem consome?) |

### 🚨 Suspeitas / Vazias / Perigosas

| Função | Conteúdo | Recomendação |
|---|---|---|
| `cmv-ajustar-rowmap-deboche` | **VAZIA** (sem `index.ts`, sem arquivos) | 🚨 remover folder |
| `contaazul-sync-cron` | **VAZIA** (sem `index.ts`, sem arquivos) | 🚨 remover folder + confirmar que `contaazul-sync` basta |
| `nibo-export-excel` | **VAZIA** (sem `index.ts`, sem arquivos) | 🚨 remover folder |
| `test-boot` | Teste de boot (21 linhas) | 📦 arquivar em `_archived/` se não for usado em CI |
| `debug-cmv-mensal-sheets` | Script de debug (186 linhas) | 📦 arquivar; não deveria estar deployado em prod |
| `execute-sql` | Executa SQL arbitrário (77 linhas) | 🚨 **remover** — anti-padrão de segurança. Confirmar quem chama antes de deletar. |
| `google-reviews-callback` | Callback OAuth Google (175 linhas) | 🔒 confirmar se ainda é usado (temos `-apify-sync`) |
| `google-reviews-retroativo` | Resync histórico de reviews (209 linhas) | 🔒 one-off? Se sim, arquivar. |

---

## Ações imediatas (pré-Etapa 2 commit)

1. **Remover folders vazios** (3): `cmv-ajustar-rowmap-deboche`, `contaazul-sync-cron`, `nibo-export-excel` — sem risco, não há código.
2. **Auditar `execute-sql`** — buscar usos e planejar remoção. Esta é prioridade de segurança.
3. **Auditar `unified-dispatcher` vs `sync-dispatcher`** — decidir se um substitui o outro.
4. **Auditar `api-clientes-externa`** — 576 linhas de API pública. Quem consome? Rate-limit existe?
5. **Auditar `monitor-concorrencia`** — ainda roda? Destino? LGPD?

## Próximos passos (Etapa 4 — reorganização)

Quando Etapa 4 rodar, esta estrutura vira:

```
backend/supabase/functions/
  _shared/
  _archived/
  bronze/    ← todas as de ingestão
  silver/    ← processadoras
  gold/      ← calculadoras/agregadoras
  consumo/   ← relatorio-pdf e futuros
  ops/       ← dispatchers, watchdogs, webhooks, auth
```

A migração é só `git mv` — `supabase functions deploy NOME` usa o nome, não o path, então deploys continuam funcionando.

## Consumidores reais — grep no frontend (2026-04-23)

Grep em `frontend/src/` por `functions.invoke(...)` retornou **apenas 5 chamadas**:

| Chamada no código | Função invocada | Folder existe? | Observação |
|---|---|---|---|
| `preencher-sequencial`, `preencher-lacunas`, `preencher-direto` | `contahub_processor` (**underscore**) | ❌ Pasta é `contahub-processor` (hyphen) | **BUG / mismatch**: confirmar se o Supabase remoto tem uma função `contahub_processor` separada OU se o frontend está chamando nome errado. |
| `checklists/notifications` | `whatsapp-send` | ❌ Não existe no repo | Chamada quebrada OU função deployada de outro repo. **Investigar urgente.** |
| `concorrencia/monitorar` | `monitor-concorrencia` | ✅ | Uso confirmado → **manter**, reclassificar de 🔒 revisar → ✅. |

### Implicações
1. `monitor-concorrencia` sai de "revisar" e vira **✅ manter**.
2. Nenhuma outra função é chamada diretamente pelo frontend. Isso significa que **TODAS as demais** são chamadas via:
   - `pg_cron` (SQL do banco) — verificar `SELECT command FROM cron.job WHERE active=true`
   - Outras edge functions (dispatchers chamando workers)
   - Webhooks externos (Conta Azul, Inter, Sympla, etc.)
   - Nada — podem ser zumbis.

3. `execute-sql` **não tem caller no código** do monorepo. Se ninguém fora chama, é forte candidata a remover. Checar Supabase Dashboard logs antes.

## Pendências de informação

Para completar este inventário com 100% de confiança, precisamos rodar no Supabase remoto:

```sql
-- Crons ativos
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE active = true
ORDER BY jobname;

-- Último log por função (requer logs habilitados)
SELECT function_name, MAX(executed_at) as last_run
FROM function_logs  -- ou equivalente
GROUP BY function_name
ORDER BY last_run DESC NULLS LAST;
```

E no frontend:

```bash
# Quais funções o frontend chama?
cd frontend && grep -rn "functions.invoke(" src/ | sort -u
```

Preencher a coluna "Frequência" e "Status" definitivo após esse levantamento.
