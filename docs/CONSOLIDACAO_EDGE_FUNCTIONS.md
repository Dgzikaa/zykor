# 📦 Consolidação de Edge Functions - Zykor

## Data: 2026-02-10

## Resumo

Este documento descreve a consolidação das Edge Functions do sistema Zykor, reduzindo a quantidade de funções separadas através da criação de **dispatchers unificados**.

---

## 🎯 Objetivo

Consolidar múltiplas Edge Functions relacionadas em dispatchers únicos, mantendo a compatibilidade com o código existente e facilitando a manutenção.

---

## ✅ Consolidações Realizadas

### 1. Google Sheets Sync (`google-sheets-sync`)

**Funções consolidadas:**
- `sync-nps` → `action: 'nps'`
- `sync-nps-reservas` → `action: 'nps-reservas'`
- `sync-voz-cliente` → `action: 'voz-cliente'`
- `sync-pesquisa-felicidade` → `action: 'pesquisa-felicidade'`

**Tipo:** Consolidação COMPLETA (lógica unificada em 1 arquivo)

**Arquivo:** `backend/supabase/functions/google-sheets-sync/index.ts`

**Uso:**
```json
POST /functions/v1/google-sheets-sync
{
  "action": "nps",
  "bar_id": 3  // opcional
}
```

**Módulos compartilhados criados:**
- `_shared/google-auth.ts` - Autenticação Google Service Account
- `_shared/supabase-client.ts` - Cliente Supabase e helpers
- `_shared/cors.ts` - Headers CORS e responses padronizadas

---

### 2. ContaHub Sync (`contahub-sync`)

**Funções consolidadas (via dispatcher):**
- `contahub-sync-automatico` → `action: 'sync'`
- `contahub-processor` → `action: 'process'`
- `contahub-stockout-sync` → `action: 'stockout'`
- `contahub-prodporhora` → `action: 'prodporhora'`
- `contahub-sync-retroativo` → `action: 'retroativo'`

**Tipo:** DISPATCHER (roteia para funções existentes)

**Motivo:** Código muito complexo (+800 linhas cada), consolidação física seria arriscada.

**Arquivo:** `backend/supabase/functions/contahub-sync/index.ts`

**Uso:**
```json
POST /functions/v1/contahub-sync
{
  "action": "sync",
  "bar_id": 3,
  "data_date": "2026-02-09"
}
```

---

### 3. Alertas Unified (`alertas-unified`)

**Funções consolidadas (via dispatcher):**
- `alertas-discord` → `action: 'discord'`
- `alertas-proativos` → `action: 'proativos'`
- `alertas-inteligentes` → `action: 'inteligentes'`
- `discord-notification` → `action: 'notification'`

**Tipo:** DISPATCHER (roteia para funções existentes)

**Arquivo:** `backend/supabase/functions/alertas-unified/index.ts`

**Uso:**
```json
POST /functions/v1/alertas-unified
{
  "action": "discord",
  "barId": 3
}
```

---

## 🔄 Atualizações de Cron Jobs

Os seguintes cron jobs foram atualizados para usar as novas funções:

| Cron Antigo | Cron Novo | Action |
|-------------|-----------|--------|
| `sync-nps-diario` | `google-sheets-nps-diario` | `nps` |
| `sync-nps-reservas-diario` | `google-sheets-nps-reservas-diario` | `nps-reservas` |
| `sync-voz-cliente-diario` | `google-sheets-voz-cliente-diario` | `voz-cliente` |
| `sync-pesquisa-felicidade-semanal` | `google-sheets-pesquisa-felicidade-semanal` | `pesquisa-felicidade` |

---

## 🗄️ Database Functions Atualizadas

| Função | Atualização |
|--------|-------------|
| `contahub_historical_sync` | Usa `contahub-sync` com `action: 'sync'` |
| `trigger_google_sheets_sync` | Nova função helper para `google-sheets-sync` |
| `trigger_alertas_unified` | Nova função helper para `alertas-unified` |

---

## 📁 Arquivos do Frontend Atualizados

- `frontend/src/app/api/nps/sync/route.ts`
- `frontend/src/app/api/nps/sync-reservas/route.ts`
- `frontend/src/app/api/ferramentas/nps/sync-manual/route.ts`
- `frontend/src/app/api/contahub/sync-manual/route.ts`
- `frontend/src/app/api/contahub/sync-diario/route.ts`
- `frontend/src/app/api/contahub/sync-retroativo-real/route.ts`

---

## 📊 Métricas

| Antes | Depois |
|-------|--------|
| 68 Edge Functions locais | 68 + 3 dispatchers |
| 13 funções de sync fragmentadas | 3 endpoints consolidados |
| Código duplicado (auth, CORS) | Módulos compartilhados |

---

## ⚠️ Funções NÃO Consolidadas (por design)

1. **sync-contagem-sheets** - Lógica muito diferente das outras syncs de planilha
2. **Google Reviews** - Usa OAuth diferente (não Service Account)
3. **Funções de Agente IA** - Serão ativadas gradualmente

---

## 🚀 Deploy

Para fazer deploy das novas funções:

```bash
# Deploy das novas Edge Functions
cd backend/supabase
supabase functions deploy google-sheets-sync
supabase functions deploy contahub-sync
supabase functions deploy alertas-unified
```

**IMPORTANTE:** As funções antigas continuam funcionando! Os dispatchers roteiam para elas quando necessário. A migração pode ser gradual.

---

## 🔙 Rollback

Se necessário reverter:

1. Os crons antigos podem ser reativados via SQL
2. As funções antigas não foram removidas
3. O frontend pode voltar a usar URLs antigas

---

## 📝 Notas

- Type-check passou sem erros ✅
- Migrações aplicadas no banco ✅
- Crons atualizados ✅
- Frontend atualizado ✅
