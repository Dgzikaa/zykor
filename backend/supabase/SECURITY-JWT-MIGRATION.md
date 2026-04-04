# 🔒 Migração de Segurança: JWT e Autenticação de Crons

## ⚠️ PROBLEMA IDENTIFICADO

O arquivo `deno.json` tinha `verify_jwt: false`, permitindo que QUALQUER pessoa com a URL da Edge Function pudesse chamá-la sem autenticação.

## ✅ SOLUÇÃO IMPLEMENTADA

### 1. Reabilitar JWT (`verify_jwt: true`)

Arquivo: `backend/supabase/functions/deno.json`

```json
{
  "verify_jwt": true
}
```

### 2. Módulo de Autenticação (`_shared/auth-guard.ts`)

Criado módulo compartilhado com 3 funções principais:

- `validateCronSecret(req)`: Valida header `x-cron-secret`
- `validateWebhookSecret(req, type)`: Valida webhooks externos
- `requireAuth(req)`: Middleware que aceita JWT OU cron secret

### 3. Atualização das Edge Functions

Todas as funções chamadas por cron foram atualizadas para:

```typescript
import { requireAuth } from '../_shared/auth-guard.ts';

serve(async (req) => {
  // Validar autenticação
  const authError = requireAuth(req);
  if (authError) return authError;
  
  // ... resto do código
});
```

## 📋 FUNÇÕES ATUALIZADAS

✅ `agente-dispatcher`
✅ `alertas-dispatcher`
✅ `contahub-sync-automatico`
✅ `contahub-stockout-sync`
✅ `google-sheets-sync`
✅ `google-reviews-apify-sync`
✅ `checklist-auto-scheduler`
✅ `recalcular-desempenho-v2`
✅ `cmv-semanal-auto`
✅ `nibo-sync`
✅ `getin-sync-continuous`
✅ `sync-dispatcher`
✅ `integracao-dispatcher`
✅ `discord-dispatcher`
✅ `webhook-dispatcher`
✅ `unified-dispatcher`
✅ `cron-watchdog`

## 🚀 DEPLOY - PASSO A PASSO

### Passo 1: Configurar CRON_SECRET no Supabase

```bash
# Gerar um secret forte
openssl rand -hex 32

# Configurar no Supabase
supabase secrets set CRON_SECRET=<valor-gerado>
```

### Passo 2: Configurar app.settings no PostgreSQL

```sql
-- Conectar ao banco via Supabase Dashboard > SQL Editor

-- Configurar service_role_key
ALTER DATABASE postgres SET app.settings.service_role_key TO '<sua-service-role-key>';

-- Configurar cron_secret (mesmo valor do Passo 1)
ALTER DATABASE postgres SET app.settings.cron_secret TO '<valor-gerado>';

-- Verificar
SELECT name, setting FROM pg_settings WHERE name LIKE 'app.settings.%';
```

### Passo 3: Aplicar Migration SQL

```sql
-- Executar: backend/supabase/migrations/2026-04-04-security-jwt-cron-auth.sql
-- Cria função: call_edge_function_with_cron_auth()
```

### Passo 4: Deploy das Edge Functions

```bash
# Deploy de todas as funções atualizadas
supabase functions deploy agente-dispatcher
supabase functions deploy alertas-dispatcher
# ... (repetir para todas as 17 funções)
```

### Passo 5: Atualizar Cron Jobs (EXEMPLO)

```sql
-- Exemplo: agente-analise-diaria

-- 1. Desagendar job antigo
SELECT cron.unschedule('agente-analise-diaria');

-- 2. Agendar com nova autenticação
SELECT cron.schedule(
  'agente-analise-diaria',
  '0 10 * * *',
  $$
    SELECT call_edge_function_with_cron_auth(
      'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/agente-dispatcher',
      '{"action": "analise-diaria-v2", "bar_id": 3}'::jsonb
    );
  $$
);
```

## 🧪 TESTES

### Teste 1: Chamada sem autenticação (deve falhar)

```bash
curl -X POST https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/agente-dispatcher \
  -H "Content-Type: application/json" \
  -d '{"action": "analise-diaria-v2", "bar_id": 3}'

# Esperado: 401 Unauthorized
```

### Teste 2: Chamada com JWT válido (deve funcionar)

```bash
curl -X POST https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/agente-dispatcher \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"action": "analise-diaria-v2", "bar_id": 3}'

# Esperado: 200 OK
```

### Teste 3: Chamada com CRON_SECRET (deve funcionar)

```bash
curl -X POST https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/agente-dispatcher \
  -H "x-cron-secret: <cron-secret>" \
  -H "Content-Type: application/json" \
  -d '{"action": "analise-diaria-v2", "bar_id": 3}'

# Esperado: 200 OK
```

### Teste 4: Verificar logs de cron jobs

```sql
SELECT * FROM cron.job_run_details 
WHERE jobname LIKE 'agente%' 
ORDER BY start_time DESC 
LIMIT 10;
```

## 🔐 SEGURANÇA ADICIONAL

### Webhooks Externos

Funções chamadas por webhooks externos (Inter, Umbler, Apify) devem usar `requireWebhookAuth()`:

```typescript
import { requireWebhookAuth } from '../_shared/auth-guard.ts';

serve(async (req) => {
  // Valida x-webhook-secret contra INTER_WEBHOOK_SECRET
  const authError = requireWebhookAuth(req, 'inter');
  if (authError) return authError;
  
  // ... resto do código
});
```

## 📊 MONITORAMENTO

### Métricas a Monitorar

1. **Erros 401** - Chamadas não autorizadas
2. **Logs de cron jobs** - Verificar execuções bem-sucedidas
3. **Alertas Discord** - Notificações de falhas

### Queries Úteis

```sql
-- Cron jobs com erro
SELECT * FROM cron.job_run_details 
WHERE status = 'failed' 
ORDER BY start_time DESC;

-- Últimas execuções
SELECT jobname, status, start_time, end_time 
FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

## 🔄 ROLLBACK (se necessário)

```sql
-- 1. Atualizar deno.json para verify_jwt: false
-- 2. Remover requireAuth() das Edge Functions
-- 3. Voltar cron jobs para formato antigo
-- 4. DROP FUNCTION call_edge_function_with_cron_auth;
```

## ✅ CHECKLIST DE DEPLOY

- [ ] Gerar CRON_SECRET forte
- [ ] Configurar CRON_SECRET no Supabase (secrets)
- [ ] Configurar app.settings no PostgreSQL
- [ ] Aplicar migration SQL
- [ ] Deploy de todas as 17 Edge Functions
- [ ] Atualizar todos os cron jobs
- [ ] Testar chamadas sem auth (deve falhar)
- [ ] Testar chamadas com JWT (deve funcionar)
- [ ] Testar chamadas com CRON_SECRET (deve funcionar)
- [ ] Verificar logs de cron jobs
- [ ] Monitorar erros 401 nas primeiras 24h

## 📝 NOTAS IMPORTANTES

1. **NUNCA** commitar CRON_SECRET no código
2. **SEMPRE** usar HTTPS para chamadas às Edge Functions
3. **MONITORAR** logs de erro após deploy
4. **TESTAR** cada cron job individualmente
5. **DOCUMENTAR** qualquer problema encontrado

---

**Data da Migração**: 04/04/2026  
**Responsável**: Sistema Zykor  
**Status**: ✅ Implementado (aguardando deploy)
