# 📚 Exemplos Práticos - Agent V2 Pipeline

## Exemplo 1: Execução Básica

### Request
```bash
curl -X POST https://project.supabase.co/functions/v1/agente-pipeline-v2 \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "bar_id": 3,
    "data": "2026-03-30"
  }'
```

### Response (Sem Eventos)
```json
{
  "success": true,
  "data_analise": "2026-03-30",
  "pipeline": {
    "detector": {
      "eventos_detectados": 0,
      "eventos_salvos": 0
    },
    "narrator": null,
    "notificacoes": {
      "enviadas": 0
    }
  },
  "insights": [],
  "resumo_geral": "Sem anomalias detectadas."
}
```

## Exemplo 2: Dia com Anomalias Leves

### Request
```bash
curl -X POST https://project.supabase.co/functions/v1/agente-pipeline-v2 \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "bar_id": 3,
    "data": "2026-03-28"
  }'
```

### Response (Com Eventos, Sem Críticos)
```json
{
  "success": true,
  "data_analise": "2026-03-28",
  "pipeline": {
    "detector": {
      "eventos_detectados": 2,
      "eventos_salvos": 2
    },
    "narrator": {
      "eventos_processados": 2,
      "insights_gerados": 1,
      "insights_salvos": 1
    },
    "notificacoes": {
      "enviadas": 0
    }
  },
  "insights": [
    {
      "titulo": "Leve Queda no Ticket Médio - Monitorar Tendência",
      "severidade": "media",
      "tipo": "problema",
      "descricao": "O ticket médio apresentou queda de 12% em relação à média das últimas 4 semanas (R$ 81 vs R$ 92). Embora não seja crítico, vale monitorar se a tendência continua.",
      "causa_provavel": "Possível mudança no mix de produtos ou promoções pontuais. Também pode ser sazonalidade natural do dia da semana.",
      "acoes_recomendadas": [
        "Monitorar ticket médio nos próximos 3 dias",
        "Comparar mix de vendas com semanas anteriores",
        "Verificar se houve promoções não planejadas"
      ]
    }
  ],
  "resumo_geral": "Dia com leve queda no ticket médio. Não é crítico, mas vale monitorar a tendência nos próximos dias."
}
```

## Exemplo 3: Dia com Anomalias Críticas

### Request
```bash
curl -X POST https://project.supabase.co/functions/v1/agente-pipeline-v2 \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "bar_id": 3,
    "data": "2026-03-25"
  }'
```

### Response (Com Eventos Críticos + Notificação)
```json
{
  "success": true,
  "data_analise": "2026-03-25",
  "pipeline": {
    "detector": {
      "eventos_detectados": 4,
      "eventos_salvos": 4
    },
    "narrator": {
      "eventos_processados": 4,
      "insights_gerados": 2,
      "insights_salvos": 2
    },
    "notificacoes": {
      "enviadas": 1
    }
  },
  "insights": [
    {
      "titulo": "Queda Crítica no Faturamento e Ticket Médio - Ação Urgente",
      "severidade": "alta",
      "tipo": "problema",
      "descricao": "Sexta-feira teve faturamento 22% abaixo da média (R$ 11.800 vs R$ 15.200 esperado). Ticket médio caiu 16% (R$ 77 vs R$ 92). Público também reduziu 8% (153 vs 166 clientes). Trata-se de uma queda generalizada que precisa de atenção imediata.",
      "causa_provavel": "Múltiplos fatores: (1) Atração pode não ter atraído o público esperado, (2) Divulgação insuficiente, (3) Concorrência com outros eventos na região, (4) Possível problema operacional (ex: demora no atendimento, falta de produtos).",
      "acoes_recomendadas": [
        "URGENTE: Revisar estratégia de booking - avaliar fit da atração com o público",
        "Analisar divulgação do evento - comparar com eventos de sucesso",
        "Verificar se houve problemas operacionais (filas, rupturas de estoque, reclamações)",
        "Considerar promoções para próxima sexta para recuperar público",
        "Fazer pesquisa rápida com clientes sobre o evento"
      ]
    },
    {
      "titulo": "Mudança no Mix de Vendas - Produto Top Diferente",
      "severidade": "media",
      "tipo": "oportunidade",
      "descricao": "O produto mais vendido mudou de 'Gin Tônica' para 'Caipirinha'. Isso pode indicar uma mudança no perfil do público ou uma oportunidade de ajustar o cardápio.",
      "causa_provavel": "Possível mudança no perfil do público da noite ou promoção específica de caipirinhas. Também pode ser influência da atração (público mais jovem prefere caipirinhas).",
      "acoes_recomendadas": [
        "Analisar perfil do público da noite (idade, gênero)",
        "Verificar se houve promoção de caipirinhas",
        "Considerar criar combos com o novo produto top",
        "Avaliar margem de contribuição: Gin Tônica vs Caipirinha"
      ]
    }
  ],
  "resumo_geral": "Sexta-feira com performance significativamente abaixo do esperado. Queda generalizada em faturamento, ticket médio e público. Requer ação urgente para identificar causas e corrigir para próximos eventos. Ponto positivo: mudança no mix de vendas pode ser uma oportunidade."
}
```

### Notificação Discord Enviada
```
┌─────────────────────────────────────────────────────────┐
│ 🔴 [Ordinário Bar] Insight Crítico                      │
├─────────────────────────────────────────────────────────┤
│ Queda Crítica no Faturamento e Ticket Médio            │
│                                                         │
│ Sexta-feira teve faturamento 22% abaixo da média       │
│ (R$ 11.800 vs R$ 15.200 esperado). Ticket médio caiu  │
│ 16% (R$ 77 vs R$ 92). Público também reduziu 8%...    │
│                                                         │
│ 🎯 Tipo: ⚠️ Problema                                    │
│ 📊 Severidade: 🔴 Alta                                  │
│                                                         │
│ 💡 Causa Provável:                                      │
│ Múltiplos fatores: (1) Atração pode não ter atraído   │
│ o público esperado, (2) Divulgação insuficiente...    │
│                                                         │
│ ✅ Ações Recomendadas:                                  │
│ 1. URGENTE: Revisar estratégia de booking              │
│ 2. Analisar divulgação do evento                       │
│ 3. Verificar problemas operacionais                    │
│                                                         │
│ Zykor Agent V2 • 01/04/2026 09:04                      │
└─────────────────────────────────────────────────────────┘
```

## Exemplo 4: Performance Excepcional (Oportunidade)

### Request
```bash
curl -X POST https://project.supabase.co/functions/v1/agente-pipeline-v2 \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "bar_id": 4,
    "data": "2026-03-29"
  }'
```

### Response (Oportunidade Detectada)
```json
{
  "success": true,
  "data_analise": "2026-03-29",
  "pipeline": {
    "detector": {
      "eventos_detectados": 1,
      "eventos_salvos": 1
    },
    "narrator": {
      "eventos_processados": 1,
      "insights_gerados": 1,
      "insights_salvos": 1
    },
    "notificacoes": {
      "enviadas": 0
    }
  },
  "insights": [
    {
      "titulo": "Performance Excepcional - Replicar Estratégia",
      "severidade": "baixa",
      "tipo": "oportunidade",
      "descricao": "Sábado teve performance 25% acima da média histórica. Faturamento por cliente foi R$ 112 vs R$ 89 esperado. Público também foi 15% maior que a média.",
      "causa_provavel": "Combinação de fatores positivos: (1) Atração com ótimo fit com o público, (2) Divulgação eficaz, (3) Possível boca a boca de eventos anteriores, (4) Mix de produtos bem ajustado.",
      "acoes_recomendadas": [
        "Documentar o que funcionou: atração, divulgação, promoções",
        "Tentar replicar a estratégia em próximos sábados",
        "Considerar aumentar frequência dessa atração",
        "Analisar mix de vendas para identificar produtos que performaram bem",
        "Usar como case de sucesso na divulgação"
      ]
    }
  ],
  "resumo_geral": "Sábado excepcional! Performance 25% acima da média. Vale documentar e replicar a estratégia."
}
```

## Exemplo 5: Múltiplos Dias (Batch)

### Script de Reprocessamento
```bash
#!/bin/bash

# Reprocessar últimos 7 dias para bar_id 3
for i in {0..6}; do
  data=$(date -d "-$i days" +%Y-%m-%d)
  
  echo "Processando $data..."
  
  curl -X POST https://project.supabase.co/functions/v1/agente-pipeline-v2 \
    -H "Authorization: Bearer SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"bar_id\": 3, \"data\": \"$data\"}" \
    -s | jq '.pipeline'
  
  echo "---"
  sleep 2
done
```

### Output Esperado
```
Processando 2026-03-31...
{
  "detector": { "eventos_detectados": 0 },
  "narrator": null,
  "notificacoes": { "enviadas": 0 }
}
---
Processando 2026-03-30...
{
  "detector": { "eventos_detectados": 2 },
  "narrator": { "insights_gerados": 1 },
  "notificacoes": { "enviadas": 0 }
}
---
...
```

## Exemplo 6: Integração com Frontend

### API Route (Next.js)
```typescript
// frontend/src/app/api/agente/analisar/route.ts

export async function POST(request: Request) {
  const { bar_id, data } = await request.json();
  
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/agente-pipeline-v2`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bar_id, data }),
    }
  );
  
  const result = await response.json();
  return Response.json(result);
}
```

### Componente React
```typescript
// frontend/src/components/agente/AnalisarDiaButton.tsx

export function AnalisarDiaButton({ barId, data }: Props) {
  const [loading, setLoading] = useState(false);
  
  async function analisar() {
    setLoading(true);
    try {
      const response = await fetch('/api/agente/analisar', {
        method: 'POST',
        body: JSON.stringify({ bar_id: barId, data }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`${result.pipeline.narrator?.insights_gerados || 0} insights gerados`);
      }
    } catch (error) {
      toast.error('Erro ao analisar dia');
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <button onClick={analisar} disabled={loading}>
      {loading ? 'Analisando...' : 'Analisar Dia'}
    </button>
  );
}
```

## Exemplo 7: Monitoramento em Tempo Real

### Query de Monitoramento
```sql
-- Ver execuções em andamento
SELECT 
  id,
  job_name,
  bar_id,
  started_at,
  EXTRACT(EPOCH FROM (NOW() - started_at)) as segundos_rodando,
  status
FROM cron_heartbeats
WHERE job_name = 'agente-pipeline-v2'
  AND status = 'running'
ORDER BY started_at DESC;

-- Ver última execução por bar
SELECT DISTINCT ON (bar_id)
  bar_id,
  status,
  duration_ms,
  response_summary->>'insights_gerados' as insights,
  started_at
FROM cron_heartbeats
WHERE job_name = 'agente-pipeline-v2'
ORDER BY bar_id, started_at DESC;
```

## Exemplo 8: Debug de Erro

### Cenário: Pipeline Falhou
```bash
# 1. Ver logs do orchestrator
supabase functions logs agente-pipeline-v2 --tail

# 2. Ver último heartbeat
SELECT * FROM cron_heartbeats 
WHERE job_name = 'agente-pipeline-v2' 
ORDER BY started_at DESC 
LIMIT 1;

# 3. Se erro no detector
supabase functions logs agente-detector --tail

# 4. Se erro no narrator
supabase functions logs agente-narrator --tail

# 5. Verificar eventos não processados
SELECT * FROM insight_events WHERE processed = false;

# 6. Reprocessar manualmente
curl -X POST .../agente-pipeline-v2 -d '{"bar_id": 3, "data": "2026-03-30"}'
```

## Exemplo 9: Análise Retroativa

### Reprocessar Semana Inteira
```typescript
// Script Node.js
const dates = [
  '2026-03-24', // Segunda
  '2026-03-25', // Terça
  '2026-03-26', // Quarta
  '2026-03-27', // Quinta
  '2026-03-28', // Sexta
  '2026-03-29', // Sábado
  '2026-03-30', // Domingo
];

for (const data of dates) {
  console.log(`Processando ${data}...`);
  
  const response = await fetch('/functions/v1/agente-pipeline-v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bar_id: 3, data }),
  });
  
  const result = await response.json();
  console.log(`✅ ${result.pipeline.narrator?.insights_gerados || 0} insights`);
  
  // Aguardar 2s entre requests
  await new Promise(resolve => setTimeout(resolve, 2000));
}
```

## Exemplo 10: Comparação Semanal

### Query de Análise
```sql
-- Insights gerados por dia da semana (últimos 30 dias)
SELECT 
  TO_CHAR(data, 'Day') as dia_semana,
  COUNT(*) as total_insights,
  SUM(CASE WHEN severidade = 'alta' THEN 1 ELSE 0 END) as criticos,
  SUM(CASE WHEN tipo = 'problema' THEN 1 ELSE 0 END) as problemas,
  SUM(CASE WHEN tipo = 'oportunidade' THEN 1 ELSE 0 END) as oportunidades
FROM agent_insights_v2
WHERE data > CURRENT_DATE - INTERVAL '30 days'
  AND bar_id = 3
GROUP BY TO_CHAR(data, 'Day'), EXTRACT(DOW FROM data)
ORDER BY EXTRACT(DOW FROM data);

-- Resultado esperado:
-- Monday    | 8  | 2 | 6 | 2
-- Tuesday   | 5  | 1 | 4 | 1
-- Wednesday | 6  | 0 | 5 | 1
-- Thursday  | 7  | 1 | 5 | 2
-- Friday    | 12 | 4 | 9 | 3  ← Sextas têm mais problemas
-- Saturday  | 10 | 3 | 7 | 3
-- Sunday    | 6  | 1 | 4 | 2
```

## Exemplo 11: Webhook Discord Customizado

### Configurar Webhook Específico por Bar
```sql
-- Inserir webhook específico para Ordinário Bar
INSERT INTO discord_webhooks (tipo, bar_id, webhook_url, ativo)
VALUES ('agentes', 3, 'https://discord.com/api/webhooks/ordinario/...', true);

-- Inserir webhook específico para Deboche Bar
INSERT INTO discord_webhooks (tipo, bar_id, webhook_url, ativo)
VALUES ('agentes', 4, 'https://discord.com/api/webhooks/deboche/...', true);

-- Orchestrator vai usar o webhook específico de cada bar
```

## Exemplo 12: Teste de Carga

### Rodar Pipeline para Múltiplos Dias e Bares
```bash
#!/bin/bash

# Testar últimos 30 dias para ambos os bares
for bar_id in 3 4; do
  echo "=== Bar $bar_id ==="
  
  for i in {0..29}; do
    data=$(date -d "-$i days" +%Y-%m-%d)
    
    curl -X POST https://project.supabase.co/functions/v1/agente-pipeline-v2 \
      -H "Authorization: Bearer SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"bar_id\": $bar_id, \"data\": \"$data\"}" \
      -s -w "\nTempo: %{time_total}s\n" \
      | jq -c '{data: .data_analise, eventos: .pipeline.detector.eventos_detectados, insights: .pipeline.narrator.insights_gerados}'
    
    sleep 1
  done
  
  echo ""
done

# Output esperado:
# === Bar 3 ===
# {"data":"2026-03-31","eventos":0,"insights":null}
# Tempo: 2.1s
# {"data":"2026-03-30","eventos":2,"insights":1}
# Tempo: 5.3s
# ...
```

## Exemplo 13: Análise de Custos

### Calcular Custo Real do Pipeline
```sql
-- Assumindo:
-- - Gemini 2.0 Flash: $0.10 por 1M tokens
-- - Média: 1000 tokens input + 500 tokens output por execução

WITH execucoes AS (
  SELECT 
    DATE(started_at) as data,
    COUNT(*) as total_execucoes,
    SUM(CASE WHEN response_summary->>'insights_gerados' != '0' THEN 1 ELSE 0 END) as com_llm
  FROM cron_heartbeats
  WHERE job_name = 'agente-pipeline-v2'
    AND started_at > NOW() - INTERVAL '30 days'
  GROUP BY DATE(started_at)
)
SELECT 
  SUM(total_execucoes) as total_execucoes,
  SUM(com_llm) as execucoes_com_llm,
  ROUND(SUM(com_llm) * 0.0015, 4) as custo_tokens_usd,
  ROUND(SUM(com_llm) * 0.0015 * 5.5, 4) as custo_tokens_brl
FROM execucoes;

-- Resultado esperado (30 dias, 2 bares):
-- total_execucoes: 60
-- execucoes_com_llm: 45 (75% dos dias têm eventos)
-- custo_tokens_usd: $0.0675
-- custo_tokens_brl: R$ 0,37
```

## Exemplo 14: Dashboard de Insights (Preview)

### Query para Frontend
```sql
-- Buscar insights não visualizados (para dashboard)
SELECT 
  i.id,
  i.bar_id,
  b.nome_bar,
  i.data,
  i.titulo,
  i.descricao,
  i.severidade,
  i.tipo,
  i.causa_provavel,
  i.acoes_recomendadas,
  i.resumo_geral,
  i.created_at,
  COUNT(e.id) as num_eventos_relacionados
FROM agent_insights_v2 i
JOIN bares_config b ON b.bar_id = i.bar_id
LEFT JOIN LATERAL unnest(i.eventos_relacionados) AS evento_id ON true
LEFT JOIN insight_events e ON e.id::text = evento_id::text
WHERE i.visualizado = false
  AND i.arquivado = false
  AND i.bar_id IN (
    SELECT bar_id FROM user_bar_access WHERE user_id = auth.uid()
  )
GROUP BY i.id, b.nome_bar
ORDER BY 
  CASE i.severidade 
    WHEN 'alta' THEN 1 
    WHEN 'media' THEN 2 
    ELSE 3 
  END,
  i.created_at DESC
LIMIT 20;
```

## Exemplo 15: Teste de Integração Completo

### Script de Teste
```typescript
// test-agent-v2.ts

async function testarPipelineCompleto() {
  const barId = 3;
  const data = '2026-03-30';
  
  console.log('🧪 Iniciando teste do Agent V2...\n');
  
  // 1. Limpar dados anteriores
  console.log('1️⃣ Limpando dados anteriores...');
  await supabase.from('insight_events').delete().eq('data', data);
  await supabase.from('agent_insights_v2').delete().eq('data', data);
  
  // 2. Rodar pipeline
  console.log('2️⃣ Executando pipeline...');
  const response = await fetch('/functions/v1/agente-pipeline-v2', {
    method: 'POST',
    body: JSON.stringify({ bar_id: barId, data }),
  });
  
  const result = await response.json();
  console.log('✅ Pipeline executado:', result.pipeline);
  
  // 3. Verificar eventos criados
  console.log('3️⃣ Verificando eventos...');
  const { data: eventos } = await supabase
    .from('insight_events')
    .select('*')
    .eq('data', data);
  console.log(`✅ ${eventos?.length || 0} eventos criados`);
  
  // 4. Verificar insights criados
  console.log('4️⃣ Verificando insights...');
  const { data: insights } = await supabase
    .from('agent_insights_v2')
    .select('*')
    .eq('data', data);
  console.log(`✅ ${insights?.length || 0} insights criados`);
  
  // 5. Verificar heartbeat
  console.log('5️⃣ Verificando heartbeat...');
  const { data: heartbeat } = await supabase
    .from('cron_heartbeats')
    .select('*')
    .eq('job_name', 'agente-pipeline-v2')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();
  console.log(`✅ Heartbeat: ${heartbeat?.status}, ${heartbeat?.duration_ms}ms`);
  
  console.log('\n🎉 Teste concluído com sucesso!');
}
```

## Próximos Passos

1. ✅ Implementar detector, narrator e orchestrator
2. ⏳ Configurar cron jobs (Prompt 5)
3. ⏳ Criar frontend de visualização (Prompt 6)
4. ⏳ Monitorar primeiras execuções
5. ⏳ Coletar feedback e ajustar
