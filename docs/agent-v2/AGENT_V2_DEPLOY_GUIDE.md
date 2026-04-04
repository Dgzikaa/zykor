# 🚀 Agent V2 - Guia de Deploy Completo

## 📋 Pré-requisitos

### Variáveis de Ambiente
```bash
# Backend (Supabase Edge Functions)
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=https://uqtgsvujwcbymjmvkjhy.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Frontend (Next.js)
NEXT_PUBLIC_SUPABASE_URL=https://uqtgsvujwcbymjmvkjhy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## 🗄️ Passo 1: Deploy do Database

### 1.1. Rodar Migração
```bash
# Via Supabase CLI
supabase db push

# Ou via SQL Editor no Dashboard
# Copiar conteúdo de: database/migrations/20260401_agent_v2_tables.sql
# Colar no SQL Editor e executar
```

### 1.2. Verificar Tabelas Criadas
```sql
-- Verificar tabelas
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('insight_events', 'agent_insights_v2');

-- Verificar RLS
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('insight_events', 'agent_insights_v2');

-- Verificar índices
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('insight_events', 'agent_insights_v2');
```

**Esperado:**
- ✅ 2 tabelas criadas
- ✅ RLS habilitado (rowsecurity = true)
- ✅ 4 índices criados

---

## ⚙️ Passo 2: Deploy das Edge Functions

### 2.1. Configurar Secrets
```bash
# Configurar GEMINI_API_KEY
supabase secrets set GEMINI_API_KEY=your_gemini_api_key

# Verificar secrets
supabase secrets list
```

### 2.2. Deploy agente-detector
```bash
cd backend/supabase/functions

# Deploy
supabase functions deploy agente-detector

# Verificar logs
supabase functions logs agente-detector
```

### 2.3. Testar agente-detector
```bash
curl -X POST "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/agente-detector" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3, "data": "2026-03-30"}'
```

**Esperado:**
```json
{
  "success": true,
  "eventos_detectados": 3,
  "eventos_salvos": 3,
  "eventos": [...]
}
```

---

### 2.4. Deploy agente-narrator
```bash
# Deploy
supabase functions deploy agente-narrator

# Verificar logs
supabase functions logs agente-narrator
```

### 2.5. Testar agente-narrator
```bash
curl -X POST "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/agente-narrator" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3, "data": "2026-03-30"}'
```

**Esperado:**
```json
{
  "success": true,
  "eventos_processados": 3,
  "insights_gerados": 1,
  "insights": [...]
}
```

---

### 2.6. Deploy agente-pipeline-v2
```bash
# Deploy
supabase functions deploy agente-pipeline-v2

# Verificar logs
supabase functions logs agente-pipeline-v2
```

### 2.7. Testar agente-pipeline-v2
```bash
curl -X POST "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/agente-pipeline-v2" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3}'
```

**Esperado:**
```json
{
  "success": true,
  "data_analise": "2026-03-31",
  "pipeline": {
    "detector": { "eventos_detectados": 3, "eventos_salvos": 3 },
    "narrator": { "eventos_processados": 3, "insights_gerados": 1 },
    "notificacoes": { "enviadas": 1 }
  },
  "insights": [...],
  "resumo_geral": "..."
}
```

---

## 🌐 Passo 3: Deploy do Frontend

### 3.1. Verificar Variáveis de Ambiente
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://uqtgsvujwcbymjmvkjhy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3.2. Build Frontend
```bash
cd frontend

# Instalar dependências
npm install

# Build
npm run build
```

**Esperado:** Build sem erros

---

### 3.3. Testar Localmente
```bash
# Rodar dev server
npm run dev

# Abrir navegador
http://localhost:3000/visao-geral/insights
```

**Verificar:**
- ✅ Componente InsightsV2Card aparece
- ✅ Stats carregam
- ✅ Filtros funcionam
- ✅ Botão "Executar Análise" funciona

---

### 3.4. Deploy Frontend
```bash
# Via Vercel
vercel --prod

# Ou via seu provedor de hosting
npm run build
# Upload da pasta .next/ ou out/
```

---

## 🧪 Passo 4: Testes Pós-Deploy

### 4.1. Teste Backend (Produção)
```bash
# Pipeline completo
curl -X POST "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/agente-pipeline-v2" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3}'
```

### 4.2. Teste Frontend (Produção)
```bash
# API Route
curl "https://your-domain.com/api/agente/insights-v2?bar_id=3"

# Trigger
curl -X POST "https://your-domain.com/api/agente/insights-v2/trigger" \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3}'
```

### 4.3. Teste Visual
1. Abrir: `https://your-domain.com/visao-geral/insights`
2. Verificar componente InsightsV2Card
3. Clicar "Executar Análise"
4. Verificar toast de sucesso
5. Verificar insights aparecem
6. Testar filtros
7. Clicar "Marcar como lido"

---

## 📊 Passo 5: Monitoramento

### 5.1. Queries de Monitoramento
```sql
-- Insights gerados hoje
SELECT COUNT(*) FROM agent_insights_v2 
WHERE created_at::date = CURRENT_DATE;

-- Eventos detectados hoje
SELECT COUNT(*) FROM insight_events 
WHERE created_at::date = CURRENT_DATE;

-- Taxa de conversão
SELECT 
  COUNT(DISTINCT ie.id) as eventos,
  COUNT(DISTINCT ai.id) as insights,
  ROUND(COUNT(DISTINCT ai.id)::numeric / NULLIF(COUNT(DISTINCT ie.id), 0) * 100, 1) as taxa
FROM insight_events ie
LEFT JOIN agent_insights_v2 ai ON ai.data = ie.data AND ai.bar_id = ie.bar_id
WHERE ie.created_at::date = CURRENT_DATE;

-- Insights não visualizados
SELECT bar_id, COUNT(*) 
FROM agent_insights_v2 
WHERE visualizado = false 
GROUP BY bar_id;

-- Últimas execuções do pipeline
SELECT * FROM cron_heartbeats 
WHERE job_name LIKE '%pipeline-v2%' 
ORDER BY started_at DESC 
LIMIT 10;
```

### 5.2. Logs
```bash
# Backend
supabase functions logs agente-detector --tail
supabase functions logs agente-narrator --tail
supabase functions logs agente-pipeline-v2 --tail

# Frontend
# Ver logs no dashboard do Vercel ou seu provedor
```

---

## ⏰ Passo 6: Configurar Cron (Opcional)

### 6.1. Via Supabase Dashboard
```sql
-- Criar cron job para bar_id 3
SELECT cron.schedule(
  'agent-v2-bar-3',
  '0 9 * * *',  -- 09:00 UTC (06:00 BRT)
  $$
  SELECT net.http_post(
    url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/agente-pipeline-v2',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{"bar_id": 3}'::jsonb
  );
  $$
);

-- Criar cron job para bar_id 4
SELECT cron.schedule(
  'agent-v2-bar-4',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/agente-pipeline-v2',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{"bar_id": 4}'::jsonb
  );
  $$
);
```

### 6.2. Verificar Cron Jobs
```sql
-- Listar cron jobs
SELECT * FROM cron.job WHERE jobname LIKE 'agent-v2%';

-- Ver execuções
SELECT * FROM cron.job_run_details 
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'agent-v2%')
ORDER BY start_time DESC 
LIMIT 10;
```

---

## ✅ Passo 7: Validação Final

### Checklist de Deploy
- [ ] ✅ Migração do banco executada
- [ ] ✅ Tabelas criadas e RLS habilitado
- [ ] ✅ `agente-detector` deployado
- [ ] ✅ `agente-narrator` deployado
- [ ] ✅ `agente-pipeline-v2` deployado
- [ ] ✅ `GEMINI_API_KEY` configurada
- [ ] ✅ Frontend buildado sem erros
- [ ] ✅ Frontend deployado
- [ ] ✅ API routes funcionando
- [ ] ✅ Componente visual funcionando
- [ ] ✅ Testes manuais passando
- [ ] ✅ Monitoramento configurado
- [ ] ✅ Cron jobs configurados (opcional)

---

## 🐛 Troubleshooting

### Problema: "GEMINI_API_KEY não configurada"
```bash
# Solução
supabase secrets set GEMINI_API_KEY=your_key

# Verificar
supabase secrets list
```

### Problema: "Tabelas não encontradas"
```sql
-- Verificar se migração foi executada
SELECT * FROM pg_tables WHERE tablename IN ('insight_events', 'agent_insights_v2');

-- Se não existirem, rodar migração novamente
```

### Problema: "Edge Function retorna 500"
```bash
# Ver logs
supabase functions logs agente-pipeline-v2 --tail

# Verificar se todas as funções estão deployadas
supabase functions list
```

### Problema: "Frontend não conecta com backend"
```bash
# Verificar env vars
cat .env.local

# Verificar se SUPABASE_SERVICE_ROLE_KEY está correta
# Verificar se NEXT_PUBLIC_SUPABASE_URL está correta
```

### Problema: "Componente não aparece"
```typescript
// Verificar se import está correto
import InsightsV2Card from '@/components/dashboard/InsightsV2Card';

// Verificar se componente foi adicionado
<InsightsV2Card barId={3} />
```

---

## 📊 Monitoramento Pós-Deploy

### Métricas a Acompanhar

#### 1. Performance
```sql
-- Tempo médio de execução
SELECT 
  AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) as tempo_medio_segundos
FROM cron_heartbeats 
WHERE job_name = 'agente-pipeline-v2'
AND started_at >= NOW() - INTERVAL '7 days';
```

#### 2. Taxa de Sucesso
```sql
-- Taxa de sucesso do pipeline
SELECT 
  COUNT(*) FILTER (WHERE status = 'success') as sucessos,
  COUNT(*) FILTER (WHERE status = 'error') as erros,
  ROUND(COUNT(*) FILTER (WHERE status = 'success')::numeric / COUNT(*) * 100, 1) as taxa_sucesso
FROM cron_heartbeats 
WHERE job_name = 'agente-pipeline-v2'
AND started_at >= NOW() - INTERVAL '7 days';
```

#### 3. Insights Gerados
```sql
-- Insights por dia (últimos 7 dias)
SELECT 
  data,
  COUNT(*) as insights,
  COUNT(*) FILTER (WHERE severidade = 'alta') as criticos
FROM agent_insights_v2 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY data
ORDER BY data DESC;
```

#### 4. Eventos Detectados
```sql
-- Eventos por tipo (últimos 7 dias)
SELECT 
  event_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE severity = 'alta') as criticos
FROM insight_events 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY total DESC;
```

---

## 🔔 Passo 8: Configurar Alertas (Opcional)

### Alertas de Erro
```sql
-- Criar alerta para falhas no pipeline
CREATE OR REPLACE FUNCTION notify_pipeline_error()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'error' AND NEW.job_name = 'agente-pipeline-v2' THEN
    PERFORM net.http_post(
      url := 'YOUR_DISCORD_WEBHOOK',
      body := jsonb_build_object(
        'content', '🚨 Pipeline V2 falhou: ' || NEW.error_message
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pipeline_error_alert
AFTER INSERT ON cron_heartbeats
FOR EACH ROW
EXECUTE FUNCTION notify_pipeline_error();
```

---

## 📈 Passo 9: Análise Retroativa (Opcional)

### Rodar para Últimos 30 Dias
```bash
# Script para análise retroativa
for i in {0..29}; do
  data=$(date -d "$i days ago" +%Y-%m-%d)
  
  curl -X POST "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/agente-pipeline-v2" \
    -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"bar_id\": 3, \"data\": \"$data\"}"
  
  echo "✅ Analisado: $data"
  sleep 2
done
```

---

## 🎯 Passo 10: Validação Final

### Teste End-to-End
```bash
# 1. Disparar pipeline via API
curl -X POST "https://your-domain.com/api/agente/insights-v2/trigger" \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3}'

# 2. Buscar insights gerados
curl "https://your-domain.com/api/agente/insights-v2?bar_id=3"

# 3. Buscar eventos detectados
curl "https://your-domain.com/api/agente/insights-v2/events?bar_id=3"

# 4. Atualizar insight
curl -X PUT "https://your-domain.com/api/agente/insights-v2" \
  -H "Content-Type: application/json" \
  -d '{"id": "uuid-123", "visualizado": true}'
```

### Teste Visual
1. Abrir dashboard: `https://your-domain.com/visao-geral/insights`
2. Verificar componente InsightsV2Card
3. Clicar "Executar Análise"
4. Verificar toast: "✅ Análise concluída! X eventos detectados, Y insights gerados"
5. Verificar insights aparecem
6. Testar filtros (tipo, severidade)
7. Clicar "Marcar como lido"
8. Verificar badge "Novo" desaparece

---

## 📋 Checklist Final de Deploy

### Backend
- [ ] ✅ Migração executada
- [ ] ✅ Tabelas criadas
- [ ] ✅ RLS habilitado
- [ ] ✅ Índices criados
- [ ] ✅ `agente-detector` deployado
- [ ] ✅ `agente-narrator` deployado
- [ ] ✅ `agente-pipeline-v2` deployado
- [ ] ✅ `GEMINI_API_KEY` configurada
- [ ] ✅ Testes backend passando

### Frontend
- [ ] ✅ Env vars configuradas
- [ ] ✅ Build sem erros
- [ ] ✅ Deploy concluído
- [ ] ✅ API routes funcionando
- [ ] ✅ Componente renderizando
- [ ] ✅ Testes frontend passando

### Monitoramento
- [ ] ✅ Queries de monitoramento testadas
- [ ] ✅ Logs acessíveis
- [ ] ✅ Alertas configurados (opcional)

### Cron (Opcional)
- [ ] ✅ Cron jobs criados
- [ ] ✅ Execuções automáticas funcionando
- [ ] ✅ Monitoramento de execuções

---

## 🎉 Deploy Completo!

Após seguir todos os passos, o sistema Agent V2 estará:

- ✅ **Deployado** em produção
- ✅ **Funcional** e testado
- ✅ **Monitorado** com queries e logs
- ✅ **Automatizado** com cron (opcional)

**Sistema pronto para uso!** 🚀

---

## 📞 Suporte

### Documentação
- [Arquitetura Completa](./backend/supabase/functions/AGENT_V2_ARCHITECTURE.md)
- [Deploy Backend](./backend/supabase/functions/agente-pipeline-v2/DEPLOYMENT.md)
- [API Routes](./frontend/src/app/api/agente/insights-v2/README.md)
- [Componente](./frontend/src/components/dashboard/InsightsV2Card.README.md)

### Exemplos
- [Exemplos Backend](./backend/supabase/functions/agente-pipeline-v2/EXAMPLES.md)
- [Exemplos API](./frontend/src/app/api/agente/insights-v2/EXAMPLES.md)
- [Exemplos Componente](./frontend/src/components/dashboard/InsightsV2Card.EXAMPLES.md)

### Índices
- [Índice Completo](./AGENT_V2_FULL_INDEX.md)
- [Status Final](./AGENT_V2_COMPLETE.md)
