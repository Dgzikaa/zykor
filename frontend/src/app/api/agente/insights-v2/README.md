# 🔌 API Routes - Agent V2 Insights

API routes para consumir insights do Agent V2 no frontend.

## Endpoints

### 1. GET `/api/agente/insights-v2`
Busca insights com filtros

#### Query Parameters
| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `bar_id` | number | ✅ | ID do bar |
| `data_inicio` | string | ❌ | Data início (YYYY-MM-DD) |
| `data_fim` | string | ❌ | Data fim (YYYY-MM-DD) |
| `tipo` | string | ❌ | 'problema' ou 'oportunidade' |
| `severidade` | string | ❌ | 'baixa', 'media' ou 'alta' |
| `limit` | number | ❌ | Limite de resultados (default: 50) |

#### Exemplo de Request
```typescript
const response = await fetch(
  '/api/agente/insights-v2?bar_id=3&severidade=alta&limit=10'
);
const { insights, stats } = await response.json();
```

#### Response
```json
{
  "success": true,
  "insights": [
    {
      "id": "uuid",
      "bar_id": 3,
      "data": "2026-03-31",
      "titulo": "Queda Crítica no Ticket Médio",
      "descricao": "...",
      "severidade": "alta",
      "tipo": "problema",
      "causa_provavel": "...",
      "acoes_recomendadas": ["...", "..."],
      "eventos_relacionados": ["uuid1", "uuid2"],
      "resumo_geral": "...",
      "visualizado": false,
      "arquivado": false,
      "created_at": "2026-04-01T09:00:00Z"
    }
  ],
  "stats": {
    "total": 15,
    "nao_visualizados": 8,
    "problemas": 10,
    "oportunidades": 5,
    "por_severidade": {
      "alta": 3,
      "media": 8,
      "baixa": 4
    }
  }
}
```

---

### 2. GET `/api/agente/insights-v2/events`
Busca eventos detectados pelo detector

#### Query Parameters
| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `bar_id` | number | ✅ | ID do bar |
| `data` | string | ❌ | Data específica (YYYY-MM-DD) |
| `processed` | boolean | ❌ | Filtrar por processado |
| `event_type` | string | ❌ | Tipo do evento |
| `severity` | string | ❌ | 'baixa', 'media' ou 'alta' |
| `limit` | number | ❌ | Limite de resultados (default: 100) |

#### Exemplo de Request
```typescript
const response = await fetch(
  '/api/agente/insights-v2/events?bar_id=3&processed=false'
);
const { eventos, stats } = await response.json();
```

#### Response
```json
{
  "success": true,
  "eventos": [
    {
      "id": "uuid",
      "bar_id": 3,
      "data": "2026-03-31",
      "event_type": "queda_ticket_medio",
      "severity": "alta",
      "evidence_json": [
        "ticket_medio_dia: R$ 78.50",
        "media_ultimas_4_semanas: R$ 92.00",
        "variacao: -14.7%"
      ],
      "processed": true,
      "created_at": "2026-04-01T09:00:00Z"
    }
  ],
  "stats": {
    "total": 25,
    "processados": 20,
    "nao_processados": 5,
    "por_tipo": {
      "queda_ticket_medio": 5,
      "queda_faturamento": 8,
      "aumento_custo": 7,
      "baixa_reserva": 3,
      "performance_atracao_boa": 2
    },
    "por_severidade": {
      "alta": 6,
      "media": 15,
      "baixa": 4
    }
  }
}
```

---

### 3. POST `/api/agente/insights-v2/trigger`
Dispara o pipeline v2 manualmente

#### Body
```json
{
  "bar_id": 3,
  "data": "2026-03-30"  // Opcional, default = ontem
}
```

#### Exemplo de Request
```typescript
const response = await fetch('/api/agente/insights-v2/trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bar_id: 3, data: '2026-03-30' })
});
const result = await response.json();
```

#### Response
```json
{
  "success": true,
  "data_analise": "2026-03-30",
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
  "insights": [...],
  "resumo_geral": "..."
}
```

---

### 4. PUT `/api/agente/insights-v2`
Atualiza status de um insight

#### Body
```json
{
  "id": "uuid",
  "visualizado": true,    // Opcional
  "arquivado": false      // Opcional
}
```

#### Exemplo de Request
```typescript
// Marcar como visualizado
await fetch('/api/agente/insights-v2', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: 'uuid-123', visualizado: true })
});

// Arquivar insight
await fetch('/api/agente/insights-v2', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: 'uuid-123', arquivado: true })
});
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "visualizado": true,
    "arquivado": false,
    ...
  }
}
```

---

## Exemplos de Uso

### Buscar Insights Não Visualizados
```typescript
const response = await fetch(
  `/api/agente/insights-v2?bar_id=${barId}&limit=20`
);
const { insights, stats } = await response.json();

const naoVistos = insights.filter(i => !i.visualizado);
console.log(`${stats.nao_visualizados} insights não visualizados`);
```

### Buscar Insights Críticos
```typescript
const response = await fetch(
  `/api/agente/insights-v2?bar_id=${barId}&severidade=alta`
);
const { insights } = await response.json();

// Mostrar alertas críticos
insights.forEach(i => {
  alert(`🔴 ${i.titulo}`);
});
```

### Buscar Insights de um Período
```typescript
const response = await fetch(
  `/api/agente/insights-v2?bar_id=${barId}&data_inicio=2026-03-01&data_fim=2026-03-31`
);
const { insights, stats } = await response.json();

console.log(`${stats.total} insights em março`);
console.log(`${stats.problemas} problemas, ${stats.oportunidades} oportunidades`);
```

### Buscar Eventos Não Processados
```typescript
const response = await fetch(
  `/api/agente/insights-v2/events?bar_id=${barId}&processed=false`
);
const { eventos, stats } = await response.json();

console.log(`${stats.nao_processados} eventos aguardando processamento`);
```

### Disparar Análise Manual
```typescript
const response = await fetch('/api/agente/insights-v2/trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bar_id: 3, data: '2026-03-30' })
});

const result = await response.json();

if (result.success) {
  console.log(`✅ ${result.pipeline.narrator?.insights_gerados || 0} insights gerados`);
  console.log(`📊 ${result.pipeline.detector.eventos_detectados} eventos detectados`);
}
```

### Marcar Insight como Lido
```typescript
async function marcarComoLido(insightId: string) {
  await fetch('/api/agente/insights-v2', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: insightId, visualizado: true })
  });
}
```

### Arquivar Insight
```typescript
async function arquivarInsight(insightId: string) {
  await fetch('/api/agente/insights-v2', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: insightId, arquivado: true })
  });
}
```

## Integração com Componentes React

### Hook Customizado
```typescript
// hooks/useInsightsV2.ts
export function useInsightsV2(barId: number) {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    async function fetchInsights() {
      const response = await fetch(`/api/agente/insights-v2?bar_id=${barId}`);
      const data = await response.json();
      
      if (data.success) {
        setInsights(data.insights);
        setStats(data.stats);
      }
      setLoading(false);
    }
    
    fetchInsights();
  }, [barId]);

  return { insights, stats, loading };
}
```

### Componente de Lista
```typescript
// components/InsightsV2List.tsx
export function InsightsV2List({ barId }: { barId: number }) {
  const { insights, stats, loading } = useInsightsV2(barId);

  if (loading) return <Spinner />;

  return (
    <div>
      <h2>Insights ({stats.nao_visualizados} novos)</h2>
      
      {insights.map(insight => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </div>
  );
}
```

### Botão de Análise Manual
```typescript
// components/AnalisarDiaButton.tsx
export function AnalisarDiaButton({ barId, data }: Props) {
  const [loading, setLoading] = useState(false);

  async function analisar() {
    setLoading(true);
    try {
      const response = await fetch('/api/agente/insights-v2/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: barId, data }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(
          `${result.pipeline.narrator?.insights_gerados || 0} insights gerados`
        );
      } else {
        toast.error('Erro ao analisar dia');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={analisar} disabled={loading}>
      {loading ? 'Analisando...' : '🔍 Analisar Dia'}
    </button>
  );
}
```

## Tratamento de Erros

### Erro 400 (Bad Request)
```json
{
  "success": false,
  "error": "bar_id é obrigatório"
}
```

### Erro 500 (Internal Server Error)
```json
{
  "success": false,
  "error": "Erro ao buscar insights",
  "details": "..."
}
```

### Erro na Edge Function
```json
{
  "success": false,
  "error": "Erro ao executar pipeline v2",
  "details": "Detector retornou 500: ..."
}
```

## Segurança

- ✅ Usa `SUPABASE_SERVICE_ROLE_KEY` para bypass RLS
- ✅ Validação de parâmetros obrigatórios
- ✅ Error handling completo
- ✅ Logs estruturados

## Performance

### Cache
```typescript
// Adicionar cache para insights (opcional)
export const revalidate = 60; // Revalidar a cada 60s

// Ou usar force-dynamic para sempre buscar dados frescos
export const dynamic = 'force-dynamic';
```

### Paginação
```typescript
// Buscar com paginação
const page = 1;
const limit = 20;

const response = await fetch(
  `/api/agente/insights-v2?bar_id=${barId}&limit=${limit}`
);
```

## Próximos Passos

1. ✅ API routes criadas
2. ⏳ Criar componentes React (Prompt 6)
3. ⏳ Criar dashboard de insights
4. ⏳ Integrar com sistema de notificações
