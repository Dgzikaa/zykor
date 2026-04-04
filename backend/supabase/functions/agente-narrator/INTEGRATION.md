# 🔗 Integração Detector + Narrator

## Fluxo Completo

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO AGENT V2                            │
└─────────────────────────────────────────────────────────────┘

1️⃣ DETECÇÃO (agente-detector)
   ┌──────────────────────┐
   │  eventos_base        │
   │  vendas_item         │
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │  Aplica 8 regras     │
   │  (sem LLM)           │
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │  insight_events      │
   │  (processed=false)   │
   └──────────┬───────────┘
              │
              │
2️⃣ NARRATIVA (agente-narrator)
              │
              ▼
   ┌──────────────────────┐
   │  Busca eventos       │
   │  não processados     │
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │  Monta prompt +      │
   │  contexto do dia     │
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │  Chama Gemini        │
   │  (LLM)               │
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │  agent_insights_v2   │
   │  (insights finais)   │
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │  Marca eventos como  │
   │  processed=true      │
   └──────────────────────┘
```

## Modos de Operação

### Modo 1: Automático (Orquestrado)
```typescript
// Orchestrator chama detector
POST /agente-detector { bar_id: 3, data: "2026-03-30" }
// → Salva eventos em insight_events

// Orchestrator chama narrator
POST /agente-narrator { bar_id: 3, data: "2026-03-30" }
// → Busca eventos não processados
// → Gera insights
// → Marca como processados
```

### Modo 2: Manual (Reprocessamento)
```typescript
// Buscar eventos específicos
const eventos = await supabase
  .from('insight_events')
  .select('*')
  .eq('bar_id', 3)
  .eq('data', '2026-03-30');

// Reprocessar com narrator
POST /agente-narrator { 
  bar_id: 3, 
  data: "2026-03-30",
  eventos: eventos 
}
```

### Modo 3: Teste (Eventos Sintéticos)
```typescript
// Testar narrator sem rodar detector
POST /agente-narrator {
  bar_id: 3,
  eventos: [
    { event_type: "queda_ticket_medio", severity: "alta", ... }
  ]
}
```

## Estrutura de Dados

### Input: InsightEvent
```typescript
{
  id: string;              // UUID do evento
  event_type: string;      // ex: "queda_ticket_medio"
  severity: string;        // "baixa" | "media" | "alta"
  evidence_json: string[]; // Array de evidências
  data: string;            // Data do evento (YYYY-MM-DD)
}
```

### Output: InsightGerado
```typescript
{
  titulo: string;                    // Ex: "Queda Crítica no Ticket Médio"
  severidade: "baixa|media|alta";
  tipo: "problema|oportunidade";
  descricao: string;                 // Análise detalhada
  causa_provavel: string;            // Hipótese de causa
  acoes_recomendadas: string[];      // Lista de ações práticas
}
```

### Salvo em: agent_insights_v2
```typescript
{
  id: UUID;
  bar_id: number;
  data: DATE;
  titulo: string;
  descricao: string;
  severidade: "baixa|media|alta";
  tipo: "problema|oportunidade";
  causa_provavel: string;
  acoes_recomendadas: JSONB;         // Array de strings
  eventos_relacionados: UUID[];      // Refs aos insight_events
  resumo_geral: string;
  source: "zykor_agent";
  visualizado: boolean;              // false (para frontend)
  arquivado: boolean;                // false
  created_at: timestamp;
}
```

## Exemplo de Transformação

### Input (Eventos Detectados)
```json
[
  {
    "event_type": "queda_ticket_medio",
    "severity": "alta",
    "evidence_json": [
      "ticket_medio_dia: R$ 78.50",
      "media_ultimas_4_semanas: R$ 92.00",
      "variacao: -14.7%"
    ]
  },
  {
    "event_type": "aumento_custo",
    "severity": "media",
    "evidence_json": [
      "custo_total_dia: R$ 3500.00",
      "media_ultimas_4_semanas: R$ 2800.00",
      "variacao: +25.0%"
    ]
  }
]
```

### Output (Insight Gerado pelo LLM)
```json
{
  "titulo": "Queda no Ticket Médio com Custos Elevados - Margem Comprometida",
  "severidade": "alta",
  "tipo": "problema",
  "descricao": "O ticket médio caiu 14.7% (R$ 78.50 vs R$ 92.00 histórico) enquanto os custos subiram 25% (R$ 3.500 vs R$ 2.800). Isso indica uma compressão severa de margem que precisa ser corrigida imediatamente.",
  "causa_provavel": "Possíveis causas: (1) Mix de vendas deslocado para produtos de menor valor, (2) Promoções agressivas não planejadas, (3) Atração com custo alto mas baixa conversão em consumo.",
  "acoes_recomendadas": [
    "Revisar imediatamente o mix de vendas do dia - identificar se houve mudança nos produtos mais vendidos",
    "Avaliar se a atração justifica o custo elevado (R$ 3.500) dado o ticket médio baixo",
    "Considerar ajustar estratégia de precificação ou promoções para próximos eventos similares",
    "Analisar se houve problemas operacionais que impactaram o consumo (ex: filas, tempo de espera)"
  ]
}
```

## Vantagens do Narrator

### ✅ Contextualização
- Não apenas reporta números
- Explica o que os números significam
- Relaciona eventos entre si

### ✅ Acionabilidade
- Sugere ações concretas
- Prioriza o que importa
- Foca em causas prováveis

### ✅ Linguagem Natural
- Insights legíveis para não-técnicos
- Tom profissional e direto
- Sem jargão desnecessário

### ✅ Economia
- Só roda quando há eventos
- Custo ~R$ 0,001 por execução
- Muito mais barato que análise humana

## Casos de Uso

### 1. Análise Diária Automática
```
09:00 BRT → Cron dispara orchestrator
09:01 BRT → Detector roda (2s)
09:02 BRT → Narrator roda (3s)
09:03 BRT → Insights disponíveis no dashboard
```

### 2. Análise Sob Demanda
```
Usuário clica "Analisar Dia" no dashboard
→ Frontend chama detector + narrator
→ Insights aparecem em tempo real
```

### 3. Reprocessamento
```
Eventos já detectados mas não processados
→ Chama narrator com processed=false
→ Gera insights retroativos
```

## Monitoramento

### Métricas Chave
- Eventos processados por execução
- Insights gerados por execução
- Taxa de sucesso do LLM
- Tempo de resposta do Gemini

### Alertas
- Falha ao chamar Gemini
- JSON inválido retornado
- Erro ao salvar insights

## Manutenção

### Ajustar System Prompt
- Editar `SYSTEM_PROMPT` no código
- Testar com eventos reais
- Validar qualidade dos insights

### Ajustar Temperatura
- Aumentar (0.5-0.7): Mais criativo
- Diminuir (0.1-0.3): Mais determinístico

### Ajustar Max Tokens
- Aumentar: Insights mais detalhados
- Diminuir: Respostas mais concisas

## Testes

### Teste Local
```bash
supabase functions serve agente-narrator

curl -X POST http://localhost:54321/functions/v1/agente-narrator \
  -H "Content-Type: application/json" \
  -d @backend/supabase/functions/agente-narrator/test-payload.json
```

### Teste de Qualidade
1. Rodar com eventos reais
2. Avaliar se insights são acionáveis
3. Verificar se causas são plausíveis
4. Validar se ações são executáveis
