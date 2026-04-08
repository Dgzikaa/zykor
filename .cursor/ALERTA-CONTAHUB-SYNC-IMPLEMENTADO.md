# 🚨 Sistema de Alerta ContaHub Sync - IMPLEMENTADO

**Data:** 06 de Abril de 2026  
**Status:** ✅ Ativo

---

## 📋 O QUE FOI IMPLEMENTADO

### 1. Função de Verificação Diária

**Nome:** `verificar_contahub_sync_diario()`

**O que faz:**
- Verifica se os dados do ContaHub foram coletados para ambos os bares (3 e 4)
- Checa se os registros foram criados hoje para a data de ontem
- Só executa após 08:00 BRT (para dar tempo do sync das 07:00 rodar)
- Envia alerta no Discord se detectar falha

**Lógica:**
```sql
-- Verifica se existe registro em contahub_raw_data
-- para bar_id 3 e 4, data_date = ontem, created_at = hoje
```

**Alerta enviado quando:**
- ❌ Bar 3 não foi coletado
- ❌ Bar 4 não foi coletado
- ❌ Nenhum dos dois foi coletado

---

### 2. Função de Sync Melhorada

**Nome:** `sync_contahub_ambos_bares()` (atualizada)

**Melhorias:**
- ✅ Timeout aumentado de 60s para 120s
- ✅ Captura erros de cada bar individualmente
- ✅ Detecta quando `request_id` retorna NULL (timeout/erro de rede)
- ✅ Envia alerta IMEDIATO ao Discord quando há erro
- ✅ Registra warnings no log do PostgreSQL

**Alertas enviados:**
- ⚠️ Erro ao chamar edge function (exception)
- ⚠️ Request ID nulo (timeout ou erro de rede)

---

### 3. Cron Job de Monitoramento

**Nome:** `alerta-contahub-sync-falhou`  
**ID:** 412  
**Schedule:** `0 11,17 * * *` (08:00 e 14:00 BRT)

**Horários de verificação:**
- **08:00 BRT** - 1 hora após o sync automático (07:00)
- **14:00 BRT** - Segunda verificação (caso tenha sido rodado manualmente)

**Comando:**
```sql
SELECT verificar_contahub_sync_diario();
```

---

## 🎯 TIPOS DE ALERTA

### Alerta Tipo 1: Erro Imediato (durante sync)

**Quando:** A função `sync_contahub_ambos_bares()` detecta erro ao chamar a edge function

**Mensagem:**
```
⚠️ ContaHub Sync - Erro Detectado

📅 Data: 2026-04-05
⏰ Horário: 07:00:15 BRT

Erros:
• Bar 3: Request ID nulo - possível timeout ou erro de rede
• Bar 4: [erro específico]

Ação: Verificar logs da edge function `contahub-sync-automatico`
```

**Cor:** 🟠 Laranja (warning)

---

### Alerta Tipo 2: Dados Não Coletados (verificação posterior)

**Quando:** Às 08:00 ou 14:00, o watchdog detecta que os dados não foram coletados

**Mensagem:**
```
🚨 ALERTA: ContaHub Sync Falhou

📅 Data esperada: 2026-04-05
⏰ Horário verificação: 08:00:00 BRT

Status:
• Bar 3 (Ordinário): ❌ NÃO COLETADO
• Bar 4 (Deboche): ✅ Coletado

Ação necessária: Verificar logs e executar sync manual se necessário.
Comando: `SELECT sync_contahub_ambos_bares();`
```

**Cor:** 🔴 Vermelho (erro)

---

## 📊 FLUXO DE MONITORAMENTO

```
07:00 BRT - Cron executa sync_contahub_ambos_bares()
    |
    ├─> ✅ Sucesso: Nenhum alerta
    |
    └─> ❌ Erro: Alerta IMEDIATO enviado (Tipo 1)
    
08:00 BRT - Watchdog verifica se dados foram coletados
    |
    ├─> ✅ Dados OK: Nenhum alerta
    |
    └─> ❌ Dados faltando: Alerta enviado (Tipo 2)
    
14:00 BRT - Segunda verificação do watchdog
    |
    ├─> ✅ Dados OK: Nenhum alerta
    |
    └─> ❌ Ainda faltando: Alerta enviado novamente (Tipo 2)
```

---

## 🔧 COMANDOS ÚTEIS

### Testar verificação manual
```sql
SELECT verificar_contahub_sync_diario();
```

### Executar sync manual
```sql
SELECT sync_contahub_ambos_bares();
```

### Ver status do cron job
```sql
SELECT jobid, jobname, schedule, active 
FROM cron.job 
WHERE jobname = 'alerta-contahub-sync-falhou';
```

### Ver últimas execuções do cron
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = 412 
ORDER BY start_time DESC 
LIMIT 5;
```

### Ver últimos alertas enviados
```sql
SELECT id, status_code, LEFT(content::text, 200) as preview, created
FROM net._http_response
WHERE created >= current_date
  AND content::text ILIKE '%ContaHub Sync%'
ORDER BY created DESC
LIMIT 10;
```

### Verificar dados coletados hoje
```sql
SELECT bar_id, data_type, data_date, 
       MIN(created_at) as primeira_coleta,
       COUNT(*) as total_tipos
FROM contahub_raw_data
WHERE created_at >= current_date
GROUP BY bar_id, data_date
ORDER BY bar_id, data_date;
```

---

## 🎯 VARIÁVEIS DE AMBIENTE NECESSÁRIAS

As seguintes variáveis devem estar configuradas no Supabase:

- `DISCORD_WEBHOOK_ALERTAS` - Webhook do canal de alertas
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (já configurada)

---

## 📝 LOGS E DEBUGGING

### Ver logs do PostgreSQL (NOTICE/WARNING)
Os logs são gravados automaticamente pelo PostgreSQL quando a função executa.

**Mensagens esperadas:**
- ✅ `Sincronizando ContaHub para 2026-04-05 (ambos bares)`
- ✅ `ContaHub Ordinário - Request ID: 22934`
- ✅ `ContaHub Deboche - Request ID: 22935`
- ⚠️ `Erro ContaHub Ordinário: [mensagem de erro]`
- ⚠️ `ContaHub Ordinário - Request ID nulo`

### Ver logs da Edge Function
No Supabase Dashboard:
1. Edge Functions → `contahub-sync-automatico`
2. Logs → Filtrar por horário (07:00-07:05)

---

## 🔄 HISTÓRICO DE PROBLEMAS

### 06/04/2026 - Sync falhou às 07:00
**Sintoma:** Dados não coletados no horário esperado  
**Causa:** Chamadas `net.http_post()` não registradas (possível timeout)  
**Resolução:** 
- Dados coletados manualmente às 14:25 ✅
- Sistema de alerta implementado ✅
- Timeout aumentado de 60s para 120s ✅

---

## ✅ PRÓXIMOS PASSOS (OPCIONAL)

1. **Retry automático**: Se o sync falhar às 07:00, tentar novamente às 07:30
2. **Métricas**: Registrar tempo de execução e taxa de sucesso
3. **Dashboard**: Criar página de monitoramento de syncs
4. **Alerta preventivo**: Detectar lentidão antes de timeout

---

## 📞 CONTATO

Em caso de problemas persistentes:
1. Verificar logs no Supabase Dashboard
2. Executar sync manual: `SELECT sync_contahub_ambos_bares();`
3. Verificar status do ContaHub (pode estar fora do ar)
4. Verificar credenciais em `api_credentials` (bar_id 3 e 4)

---

**Documento criado:** 06/04/2026 16:35 BRT  
**Última atualização:** 06/04/2026 16:35 BRT
