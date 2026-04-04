# ✅ CHECKLIST DE VALIDAÇÃO - Segurança JWT

## PRÉ-DEPLOY

### 1. Configuração de Secrets
- [ ] Gerar CRON_SECRET forte (`openssl rand -hex 32`)
- [ ] Configurar no Supabase: `supabase secrets set CRON_SECRET=<valor>`
- [ ] Configurar app.settings no PostgreSQL
- [ ] Verificar que secrets estão configurados: `SELECT name, setting FROM pg_settings WHERE name LIKE 'app.settings.%';`

### 2. Migration SQL
- [ ] Aplicar: `backend/supabase/migrations/2026-04-04-security-jwt-cron-auth.sql`
- [ ] Verificar função criada: `SELECT proname FROM pg_proc WHERE proname = 'call_edge_function_with_cron_auth';`
- [ ] Testar função manualmente

### 3. Deploy de Edge Functions
- [ ] Deploy de todas as 17 funções atualizadas
- [ ] Verificar logs de deploy (sem erros)
- [ ] Confirmar que deno.json foi aplicado (`verify_jwt: true`)

## PÓS-DEPLOY

### 4. Testes de Autenticação

#### Teste 1: Sem autenticação (deve FALHAR)
```bash
curl -X POST https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/agente-dispatcher \
  -H "Content-Type: application/json" \
  -d '{"action": "analise-diaria-v2", "bar_id": 3}'
```
- [ ] Retornou 401 Unauthorized ✅

#### Teste 2: Com JWT válido (deve FUNCIONAR)
```bash
curl -X POST https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/agente-dispatcher \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"action": "analise-diaria-v2", "bar_id": 3}'
```
- [ ] Retornou 200 OK ✅

#### Teste 3: Com CRON_SECRET (deve FUNCIONAR)
```bash
curl -X POST https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/agente-dispatcher \
  -H "x-cron-secret: <cron-secret>" \
  -H "Content-Type: application/json" \
  -d '{"action": "analise-diaria-v2", "bar_id": 3}'
```
- [ ] Retornou 200 OK ✅

### 5. Validação de Cron Jobs

#### Atualizar Cron Jobs (EXEMPLO)
```sql
-- Para cada cron job, atualizar para usar call_edge_function_with_cron_auth()

SELECT cron.unschedule('agente-analise-diaria');

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

#### Cron Jobs a Atualizar (17 total)
- [ ] agente-analise-diaria
- [ ] agente-analise-semanal
- [ ] agente-analise-mensal
- [ ] alertas-proativos
- [ ] contahub-sync-7h-ambos
- [ ] contahub-stockout-sync
- [ ] google-sheets-sync-diario
- [ ] google-reviews-apify-sync
- [ ] checklist-auto-scheduler
- [ ] desempenho-auto-diario
- [ ] cmv-semanal-auto
- [ ] nibo-sync
- [ ] getin-sync-continuous
- [ ] sync-dispatcher (vários)
- [ ] integracao-dispatcher (vários)
- [ ] discord-dispatcher
- [ ] cron-watchdog

### 6. Monitoramento (Primeiras 24h)

#### Verificar Logs de Erro
```sql
-- Erros de autenticação (401)
SELECT * FROM cron.job_run_details 
WHERE status = 'failed' 
  AND start_time > NOW() - INTERVAL '24 hours'
ORDER BY start_time DESC;
```
- [ ] Nenhum erro 401 nos cron jobs ✅

#### Verificar Execuções Bem-Sucedidas
```sql
-- Últimas 20 execuções
SELECT jobname, status, start_time, end_time 
FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```
- [ ] Todos os jobs executando normalmente ✅

#### Verificar Alertas Discord
- [ ] Nenhum alerta de falha de autenticação ✅
- [ ] Notificações normais funcionando ✅

### 7. Validação de Webhooks Externos

#### Inter PIX Webhook
- [ ] Testar webhook do Inter
- [ ] Verificar que valida INTER_WEBHOOK_SECRET
- [ ] Confirmar que rejeita sem secret

#### Umbler Webhook
- [ ] Testar webhook do Umbler
- [ ] Verificar que valida UMBLER_WEBHOOK_SECRET
- [ ] Confirmar que rejeita sem secret

#### Apify Webhook
- [ ] Testar webhook do Apify
- [ ] Verificar que valida APIFY_WEBHOOK_SECRET
- [ ] Confirmar que rejeita sem secret

## PROBLEMAS COMUNS

### Erro 401 em Cron Jobs
**Causa**: Cron job não atualizado para usar `call_edge_function_with_cron_auth()`
**Solução**: Atualizar cron job com nova função

### Erro "CRON_SECRET não configurado"
**Causa**: Secret não configurado no Supabase ou app.settings
**Solução**: Configurar em ambos os lugares

### Webhook externo retorna 401
**Causa**: Secret específico não configurado
**Solução**: Configurar `<TIPO>_WEBHOOK_SECRET` no Supabase

## ROLLBACK

Se houver problemas críticos:

1. **Reverter deno.json**
   ```json
   {
     "verify_jwt": false
   }
   ```

2. **Remover auth-guard das funções**
   - Comentar linha `const authError = requireAuth(req);`

3. **Voltar cron jobs para formato antigo**
   - Usar `net.http_post()` direto

4. **Deploy das funções revertidas**

## CONCLUSÃO

- [ ] Todos os testes passaram ✅
- [ ] Todos os cron jobs atualizados ✅
- [ ] Monitoramento configurado ✅
- [ ] Documentação completa ✅
- [ ] Equipe notificada ✅

**Data de Validação**: ___/___/2026
**Validado por**: _________________
**Status**: [ ] APROVADO [ ] PENDENTE [ ] ROLLBACK
