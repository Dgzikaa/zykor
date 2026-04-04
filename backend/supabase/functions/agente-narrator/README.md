# 📖 Narrator LLM - Agent V2

Edge Function que transforma eventos detectados em **insights acionáveis** usando LLM (Gemini).

## Arquitetura

```
┌─────────────────┐
│ agente-narrator │
│   (Edge Func)   │
└────────┬────────┘
         │
         ├─► Busca eventos não processados (insight_events)
         ├─► Busca contexto do dia (eventos_base)
         ├─► Monta prompt para Gemini
         ├─► Gera insights com LLM
         ├─► Salva em agent_insights_v2
         └─► Marca eventos como processed
```

## Request

```json
{
  "bar_id": 3,
  "data": "2026-03-31",  // Opcional, default = ontem
  "eventos": [           // Opcional, se não vier busca do banco
    {
      "id": "uuid-123",
      "event_type": "queda_ticket_medio",
      "severity": "alta",
      "evidence_json": ["ticket_medio_dia: R$ 78.50", "..."],
      "data": "2026-03-31"
    }
  ]
}
```

## Response

```json
{
  "success": true,
  "data_analise": "2026-03-31",
  "eventos_processados": 2,
  "insights_gerados": 1,
  "insights_salvos": 1,
  "insights": [
    {
      "titulo": "Queda Crítica no Ticket Médio e Custos Elevados",
      "severidade": "alta",
      "tipo": "problema",
      "descricao": "O ticket médio caiu 14.7% em relação à média das últimas 4 semanas...",
      "causa_provavel": "Possível mudança no mix de produtos ou promoções agressivas...",
      "acoes_recomendadas": [
        "Revisar estratégia de precificação",
        "Analisar mix de vendas do dia",
        "Verificar se houve promoções não planejadas"
      ]
    }
  ],
  "resumo_geral": "Dia com performance abaixo do esperado. Faturamento e ticket médio em queda..."
}
```

## System Prompt

O Narrator usa um **system prompt especializado** que instrui o LLM a:

- ✅ Agir como analista sênior (operações + financeiro + growth)
- ✅ Gerar insights acionáveis (não apenas descrever dados)
- ✅ Explicar causas prováveis
- ✅ Sugerir ações práticas e executáveis
- ✅ Comparar com histórico
- ✅ Priorizar o que importa
- ✅ Identificar oportunidades (não só problemas)

## Configuração do LLM

- **Model**: `gemini-2.0-flash-exp`
- **Temperature**: `0.3` (mais determinístico)
- **Max Tokens**: `2048`
- **Output**: JSON estruturado

## Fluxo Detalhado

### 1. Buscar Eventos
```typescript
// Se eventos não vierem no request, busca do banco
const eventos = await buscarEventosNaoProcessados(supabase, bar_id, data);
// Filtra: processed=false, bar_id, data
// Ordena: por severity (alta → baixa)
```

### 2. Buscar Contexto
```typescript
// Busca dados do dia para enriquecer o prompt
const contexto = await buscarContextoDia(supabase, bar_id, data);
// Retorna: evento completo + config do bar
```

### 3. Montar Prompt
```typescript
const prompt = `
${SYSTEM_PROMPT}

EVENTOS DETECTADOS: [...]
CONTEXTO DO DIA: [...]

Analise e gere insights em JSON.
`;
```

### 4. Chamar Gemini
```typescript
const response = await generateGeminiResponse(prompt, {
  model: 'gemini-2.0-flash-exp',
  temperature: 0.3,
  maxOutputTokens: 2048,
});
```

### 5. Parsear e Validar
```typescript
const parsed = extractJsonFromGemini<NarratorResponse>(response);
// Remove markdown, valida JSON, extrai estrutura
```

### 6. Salvar Insights
```typescript
// Para cada insight gerado:
await supabase.from('agent_insights_v2').insert({
  bar_id, data, titulo, descricao, severidade, tipo,
  causa_provavel, acoes_recomendadas, eventos_relacionados,
  resumo_geral, source: 'zykor_agent'
});
```

### 7. Marcar Eventos Processados
```typescript
await supabase.from('insight_events')
  .update({ processed: true })
  .in('id', eventosIds);
```

## Tabelas Utilizadas

### Input
- `insight_events`: Eventos detectados pelo detector
- `eventos_base`: Contexto do dia (métricas)
- `bares_config`: Informações do bar

### Output
- `agent_insights_v2`: Insights gerados (destino final)
- `insight_events`: Atualiza `processed=true`

## Integração

### Chamado Por
- **Orchestrator**: Após o detector rodar
- **Cron diário**: Via orchestrator às 9h BRT
- **API manual**: Para reprocessar eventos específicos

### Chama
- **Gemini API**: Para geração de insights
- **Detector**: Não chama diretamente (recebe eventos já detectados)

## Exemplo de Uso

### Caso 1: Processar Eventos Automático
```bash
curl -X POST https://project.supabase.co/functions/v1/agente-narrator \
  -H "Authorization: Bearer KEY" \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3, "data": "2026-03-30"}'
```
→ Busca eventos não processados do banco

### Caso 2: Processar Eventos Específicos
```bash
curl -X POST https://project.supabase.co/functions/v1/agente-narrator \
  -H "Authorization: Bearer KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "bar_id": 3,
    "data": "2026-03-30",
    "eventos": [...]
  }'
```
→ Processa eventos fornecidos no request

## Observabilidade

- **Heartbeats**: Registrados em `cron_heartbeats`
- **Logs**: Console logs estruturados
- **Métricas**: Eventos processados, insights gerados, insights salvos

## Tratamento de Erros

### Sem Eventos
- Retorna `success: true` com `insights: []`
- Não chama LLM (economia)

### Erro no LLM
- Registra erro no heartbeat
- Retorna erro 500 com detalhes
- Eventos não são marcados como processados (retry possível)

### JSON Inválido
- Tenta extrair JSON da resposta
- Se falhar, lança erro e registra no heartbeat

## Próximos Passos

1. ✅ Criar detector determinístico (Prompt 2)
2. ✅ Criar narrator LLM (este prompt)
3. ⏳ Criar orchestrator (Prompt 4)
4. ⏳ Configurar cron job (Prompt 5)
5. ⏳ Criar frontend para visualização (Prompt 6)

## Custos Estimados

- **Gemini 2.0 Flash**: ~$0.10 por 1M tokens
- **Média por execução**: ~1000 tokens input + 500 tokens output
- **Custo por execução**: ~$0.0002 (R$ 0,001)
- **Custo mensal** (30 dias × 2 bares): ~R$ 0,06

Extremamente econômico! 💰
