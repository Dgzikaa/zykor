# 🚀 Deployment - Agent V2 Pipeline

## Pré-requisitos

### 1. Variáveis de Ambiente
```bash
# Supabase (já configuradas)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Gemini API (necessária para narrator)
GEMINI_API_KEY=AIza...

# Discord (opcional, para notificações)
DISCORD_WEBHOOK_AGENTES=https://discord.com/api/webhooks/...
```

### 2. Tabelas do Banco
```sql
-- Rodar migração (Prompt 1)
\i database/migrations/20260401_agent_v2_tables.sql

-- Verificar tabelas criadas
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('insight_events', 'agent_insights_v2');
```

### 3. Edge Functions
```bash
# Deploy das 3 funções
supabase functions deploy agente-detector
supabase functions deploy agente-narrator
supabase functions deploy agente-pipeline-v2
```

## Ordem de Deploy

### Passo 1: Criar Tabelas
```bash
# Conectar ao Supabase
supabase db push

# Ou via SQL Editor no dashboard
# Copiar conteúdo de: database/migrations/20260401_agent_v2_tables.sql
```

### Passo 2: Deploy Detector
```bash
cd backend/supabase
supabase functions deploy agente-detector

# Verificar
curl -X POST https://project.supabase.co/functions/v1/agente-detector \
  -H "Authorization: Bearer ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3, "data": "2026-03-30"}'
```

### Passo 3: Deploy Narrator
```bash
supabase functions deploy agente-narrator

# Verificar
curl -X POST https://project.supabase.co/functions/v1/agente-narrator \
  -H "Authorization: Bearer ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3, "data": "2026-03-30"}'
```

### Passo 4: Deploy Orchestrator
```bash
supabase functions deploy agente-pipeline-v2

# Verificar
curl -X POST https://project.supabase.co/functions/v1/agente-pipeline-v2 \
  -H "Authorization: Bearer ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3, "data": "2026-03-30"}'
```

## Configuração de Secrets

### Via Supabase CLI
```bash
# Gemini API Key
supabase secrets set GEMINI_API_KEY=AIza...

# Discord Webhook (opcional)
supabase secrets set DISCORD_WEBHOOK_AGENTES=https://discord.com/api/webhooks/...

# Listar secrets
supabase secrets list
```

### Via Dashboard
1. Ir para **Settings** → **Edge Functions**
2. Clicar em **Manage secrets**
3. Adicionar:
   - `GEMINI_API_KEY`
   - `DISCORD_WEBHOOK_AGENTES` (opcional)

## Testes Pós-Deploy

### Teste 1: Detector Isolado
```bash
curl -X POST https://project.supabase.co/functions/v1/agente-detector \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3, "data": "2026-03-30"}'

# Verificar eventos criados
SELECT * FROM insight_events WHERE data = '2026-03-30' AND processed = false;
```

### Teste 2: Narrator Isolado
```bash
curl -X POST https://project.supabase.co/functions/v1/agente-narrator \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3, "data": "2026-03-30"}'

# Verificar insights criados
SELECT * FROM agent_insights_v2 WHERE data = '2026-03-30';
```

### Teste 3: Pipeline Completo
```bash
curl -X POST https://project.supabase.co/functions/v1/agente-pipeline-v2 \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3, "data": "2026-03-30"}'

# Verificar:
# 1. Eventos detectados e processados
SELECT COUNT(*) FROM insight_events WHERE data = '2026-03-30' AND processed = true;

# 2. Insights gerados
SELECT * FROM agent_insights_v2 WHERE data = '2026-03-30';

# 3. Heartbeat registrado
SELECT * FROM cron_heartbeats WHERE job_name = 'agente-pipeline-v2' ORDER BY started_at DESC LIMIT 1;
```

## Configuração do Cron (Prompt 5)

### Criar Jobs para Ambos os Bares
```sql
-- Ordinário Bar (bar_id = 3)
SELECT cron.schedule(
  'agente-pipeline-v2-ordinario',
  '0 9 * * *',  -- 09:00 UTC (06:00 BRT) - ajustar conforme timezone
  $$
  SELECT net.http_post(
    url := 'https://project.supabase.co/functions/v1/agente-pipeline-v2',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object('bar_id', 3)
  ) AS request_id;
  $$
);

-- Deboche Bar (bar_id = 4)
SELECT cron.schedule(
  'agente-pipeline-v2-deboche',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project.supabase.co/functions/v1/agente-pipeline-v2',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object('bar_id', 4)
  ) AS request_id;
  $$
);
```

## Monitoramento

### Dashboard de Métricas
```sql
-- Últimas execuções
SELECT 
  job_name,
  bar_id,
  status,
  records_affected as insights_gerados,
  duration_ms,
  started_at,
  response_summary
FROM cron_heartbeats
WHERE job_name = 'agente-pipeline-v2'
ORDER BY started_at DESC
LIMIT 20;

-- Taxa de sucesso (últimos 30 dias)
SELECT 
  status,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentual
FROM cron_heartbeats
WHERE job_name = 'agente-pipeline-v2'
  AND started_at > NOW() - INTERVAL '30 days'
GROUP BY status;

-- Insights gerados por dia
SELECT 
  DATE(created_at) as data,
  bar_id,
  COUNT(*) as total_insights,
  SUM(CASE WHEN severidade = 'alta' THEN 1 ELSE 0 END) as criticos,
  SUM(CASE WHEN tipo = 'problema' THEN 1 ELSE 0 END) as problemas,
  SUM(CASE WHEN tipo = 'oportunidade' THEN 1 ELSE 0 END) as oportunidades
FROM agent_insights_v2
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), bar_id
ORDER BY data DESC;
```

## Rollback

### Reverter para V1 (Se Necessário)
```sql
-- Desabilitar cron jobs V2
SELECT cron.unschedule('agente-pipeline-v2-ordinario');
SELECT cron.unschedule('agente-pipeline-v2-deboche');

-- Reabilitar cron jobs V1 (se existirem)
SELECT cron.schedule('agente-dispatcher-ordinario', ...);
```

### Manter Ambas as Versões (Transição)
```sql
-- V1 e V2 podem coexistir
-- Tabelas são diferentes:
--   V1: agente_insights
--   V2: agent_insights_v2

-- Frontend pode consumir ambas durante transição
```

## Troubleshooting

### Erro: "GEMINI_API_KEY não configurada"
```bash
# Configurar secret
supabase secrets set GEMINI_API_KEY=AIza...

# Verificar
supabase secrets list
```

### Erro: "Detector retornou 500"
```bash
# Ver logs do detector
supabase functions logs agente-detector --tail

# Testar detector isoladamente
curl -X POST .../agente-detector -d '{"bar_id": 3}'
```

### Erro: "Narrator retornou 500"
```bash
# Ver logs do narrator
supabase functions logs agente-narrator --tail

# Verificar quota do Gemini
# https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
```

### Erro: "Discord webhook não configurado"
```sql
-- Verificar webhooks no banco
SELECT * FROM discord_webhooks WHERE tipo = 'agentes';

-- Ou configurar via env
supabase secrets set DISCORD_WEBHOOK_AGENTES=https://...
```

## Custos Estimados

### Por Execução
- Detector: R$ 0 (regras puras)
- Narrator: R$ 0,001 (se houver eventos)
- Notificações: R$ 0 (Discord grátis)
- **Total**: R$ 0 - R$ 0,001

### Mensal (2 bares × 30 dias)
- Execuções: 60
- Custo médio: R$ 0,06
- Custo máximo: R$ 0,06 (se todos os dias tiverem eventos)

### Comparação
- **V1**: R$ 3,00/mês
- **V2**: R$ 0,06/mês
- **Economia**: 98% 🎉

## Checklist de Deploy

- [ ] Migração de tabelas aplicada
- [ ] GEMINI_API_KEY configurada
- [ ] agente-detector deployado
- [ ] agente-narrator deployado
- [ ] agente-pipeline-v2 deployado
- [ ] Teste manual executado com sucesso
- [ ] Cron jobs configurados (Prompt 5)
- [ ] Monitoramento configurado
- [ ] Discord webhook configurado (opcional)
- [ ] Frontend atualizado (Prompt 6)

## Próximos Passos

1. ✅ Deploy das 3 Edge Functions
2. ⏳ Configurar cron jobs (Prompt 5)
3. ⏳ Criar frontend para visualização (Prompt 6)
4. ⏳ Monitorar primeiras execuções
5. ⏳ Ajustar thresholds baseado em feedback
