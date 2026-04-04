# 🎭 Orchestrator - Agent V2 Pipeline

Edge Function que **coordena o pipeline completo** de análise de insights.

## Arquitetura

```
┌─────────────────────┐
│ agente-pipeline-v2  │
│   (Orchestrator)    │
└──────────┬──────────┘
           │
           ├─► 1. Chama agente-detector
           │   └─► Detecta eventos (regras puras)
           │
           ├─► 2. Chama agente-narrator (se houver eventos)
           │   └─► Gera insights (LLM)
           │
           └─► 3. Envia notificações Discord (se crítico)
               └─► Alerta insights de severidade alta
```

## Request

```json
{
  "bar_id": 3,
  "data": "2026-03-31"  // Opcional, default = ontem
}
```

## Response

```json
{
  "success": true,
  "data_analise": "2026-03-31",
  "pipeline": {
    "detector": {
      "eventos_detectados": 3,
      "eventos_salvos": 3
    },
    "narrator": {
      "eventos_processados": 3,
      "insights_gerados": 1,
      "insights_salvos": 1
    },
    "notificacoes": {
      "enviadas": 1
    }
  },
  "insights": [
    {
      "titulo": "Queda Crítica no Ticket Médio",
      "severidade": "alta",
      "tipo": "problema",
      "descricao": "...",
      "causa_provavel": "...",
      "acoes_recomendadas": ["...", "..."]
    }
  ],
  "resumo_geral": "Dia com performance abaixo do esperado..."
}
```

## Fluxo Detalhado

### Etapa 1: Detector
```typescript
POST ${SUPABASE_URL}/functions/v1/agente-detector
{
  "bar_id": 3,
  "data": "2026-03-31"
}

→ Retorna: { eventos_detectados: 3, eventos: [...] }
```

### Etapa 2: Narrator (Condicional)
```typescript
if (eventos_detectados > 0) {
  POST ${SUPABASE_URL}/functions/v1/agente-narrator
  {
    "bar_id": 3,
    "data": "2026-03-31"
  }
  
  → Retorna: { insights_gerados: 1, insights: [...] }
}
```

### Etapa 3: Notificações (Condicional)
```typescript
if (insights.some(i => i.severidade === 'alta')) {
  // Envia para Discord
  POST ${DISCORD_WEBHOOK}
  {
    "embeds": [{
      "title": "🔴 [Bar Nome] Insight Crítico",
      "description": "Título do insight...",
      "fields": [...]
    }]
  }
}
```

## Casos de Uso

### 1. Execução Diária Automática (Cron)
```sql
-- Configurar no Supabase (Prompt 5)
SELECT cron.schedule(
  'agente-pipeline-v2-ordinario',
  '0 9 * * *',  -- 09:00 BRT todo dia
  $$
  SELECT net.http_post(
    url := 'https://project.supabase.co/functions/v1/agente-pipeline-v2',
    headers := '{"Authorization": "Bearer KEY"}'::jsonb,
    body := '{"bar_id": 3}'::jsonb
  );
  $$
);
```

### 2. Análise Manual (Dashboard)
```typescript
// Frontend chama orchestrator
const response = await fetch('/api/agente/analisar', {
  method: 'POST',
  body: JSON.stringify({ bar_id: 3, data: '2026-03-30' })
});

// Retorna insights em tempo real (~5s)
```

### 3. Reprocessamento Histórico
```typescript
// Rodar para múltiplas datas
for (const data of ['2026-03-25', '2026-03-26', '2026-03-27']) {
  await fetch('/functions/v1/agente-pipeline-v2', {
    body: JSON.stringify({ bar_id: 3, data })
  });
}
```

## Lógica de Decisão

### Quando Chamar Narrator?
```typescript
if (detector.eventos_detectados > 0) {
  // Chama narrator
} else {
  // Pula narrator (economia)
}
```

### Quando Enviar Notificação?
```typescript
if (narrator.insights.some(i => i.severidade === 'alta')) {
  // Envia Discord
} else {
  // Não notifica
}
```

## Notificações Discord

### Formato do Embed

```
┌─────────────────────────────────────────┐
│ 🔴 [Ordinário Bar] Insight Crítico      │
├─────────────────────────────────────────┤
│ Queda Crítica no Ticket Médio           │
│                                         │
│ O ticket médio caiu 14.7% em relação   │
│ à média das últimas 4 semanas...       │
│                                         │
│ 🎯 Tipo: ⚠️ Problema                    │
│ 📊 Severidade: 🔴 Alta                  │
│                                         │
│ 💡 Causa Provável:                      │
│ Mix de vendas deslocado para produtos  │
│ de menor valor...                       │
│                                         │
│ ✅ Ações Recomendadas:                  │
│ 1. Revisar estratégia de precificação  │
│ 2. Analisar mix de vendas do dia       │
│ 3. Verificar promoções não planejadas  │
│                                         │
│ Zykor Agent V2                          │
└─────────────────────────────────────────┘
```

### Configuração do Webhook

O orchestrator busca o webhook na seguinte ordem:
1. Tabela `discord_webhooks` (tipo='agentes', bar_id específico)
2. Variável de ambiente `DISCORD_WEBHOOK_AGENTES`
3. Variável de ambiente `DISCORD_WEBHOOK_URL` (fallback)

## Observabilidade

### Heartbeat
```typescript
{
  job_name: 'agente-pipeline-v2',
  action: 'orchestrate',
  bar_id: 3,
  status: 'success',
  records_affected: 1,  // Total de insights gerados
  response_summary: {
    eventos_detectados: 3,
    insights_gerados: 1,
    notificacoes_enviadas: 1,
    data_analise: '2026-03-31'
  }
}
```

### Logs
```
🎭 Iniciando pipeline v2 para bar_id=3, data=2026-03-31
🔍 Chamando agente-detector para bar_id=3, data=2026-03-31
✅ Detector: 3 eventos detectados
📖 Chamando agente-narrator para bar_id=3, data=2026-03-31
✅ Narrator: 1 insights gerados
📢 1 notificações críticas enviadas
```

## Tratamento de Erros

### Erro no Detector
```typescript
if (!detectorResult.success) {
  throw new Error('Detector falhou');
}
// Pipeline para, retorna erro 500
```

### Erro no Narrator
```typescript
if (!narratorResult.success) {
  throw new Error('Narrator falhou');
}
// Pipeline para, retorna erro 500
// Eventos ficam com processed=false (retry possível)
```

### Erro no Discord
```typescript
try {
  await enviarNotificacao(...);
} catch (error) {
  console.error('Erro ao enviar notificação:', error);
  // Continua execução (notificação não é crítica)
}
```

## Performance

### Tempo Esperado
- Detector: ~2s
- Narrator: ~3s (se houver eventos)
- Notificações: ~0.5s (se houver críticos)
- **Total**: ~5.5s (com eventos) ou ~2s (sem eventos)

### Otimizações
- Narrator só roda se houver eventos
- Notificações só enviam se houver críticos
- Chamadas internas usam service_role (sem RLS)

## Integração com Cron

### Configuração (Prompt 5)
```sql
-- Rodar para ambos os bares às 09:00 BRT
SELECT cron.schedule(
  'agente-pipeline-v2-ordinario',
  '0 9 * * *',
  $$SELECT net.http_post(...)$$
);

SELECT cron.schedule(
  'agente-pipeline-v2-deboche',
  '0 9 * * *',
  $$SELECT net.http_post(...)$$
);
```

### Monitoramento do Cron
```sql
-- Ver últimas execuções
SELECT * FROM cron_heartbeats 
WHERE job_name = 'agente-pipeline-v2'
ORDER BY started_at DESC 
LIMIT 10;
```

## Testes

### Teste Local
```bash
supabase functions serve agente-pipeline-v2

curl -X POST http://localhost:54321/functions/v1/agente-pipeline-v2 \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3, "data": "2026-03-30"}'
```

### Teste de Integração
```bash
# 1. Verificar que não há eventos não processados
SELECT COUNT(*) FROM insight_events WHERE processed = false;

# 2. Rodar orchestrator
curl -X POST .../agente-pipeline-v2 -d '{"bar_id": 3}'

# 3. Verificar resultados
SELECT COUNT(*) FROM insight_events WHERE processed = true;
SELECT COUNT(*) FROM agent_insights_v2 WHERE visualizado = false;
```

## Manutenção

### Ajustar Fluxo
- Adicionar etapas no pipeline (ex: validações, pós-processamento)
- Modificar condições de chamada (ex: sempre chamar narrator)
- Adicionar novos tipos de notificação

### Debug
```typescript
// Adicionar logs detalhados
console.log('Detector response:', JSON.stringify(detectorResult));
console.log('Narrator response:', JSON.stringify(narratorResult));
```

### Retry Logic (Futuro)
```typescript
// Se narrator falhar, tentar novamente
let retries = 3;
while (retries > 0) {
  try {
    narratorResult = await chamarNarrator(...);
    break;
  } catch (error) {
    retries--;
    if (retries === 0) throw error;
    await sleep(1000);
  }
}
```

## Próximos Passos

1. ✅ Criar orchestrator (este prompt)
2. ⏳ Configurar cron job (Prompt 5)
3. ⏳ Criar frontend (Prompt 6)
