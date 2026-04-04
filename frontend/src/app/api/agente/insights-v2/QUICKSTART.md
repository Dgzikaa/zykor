# 🚀 Quickstart - API Insights V2

Guia rápido para começar a usar as APIs do Agent V2.

---

## 📦 Instalação

Nenhuma instalação necessária! As APIs já estão prontas para uso.

---

## 🎯 Uso Básico

### 1. Buscar Insights

```typescript
// No seu componente React
import { useInsightsV2 } from '@/hooks/useInsightsV2';

function MeuComponente() {
  const { insights, stats, loading } = useInsightsV2({ barId: 3 });

  if (loading) return <div>Carregando...</div>;

  return (
    <div>
      <h2>Insights ({stats?.nao_visualizados} novos)</h2>
      {insights.map(insight => (
        <div key={insight.id}>
          <h3>{insight.titulo}</h3>
          <p>{insight.descricao}</p>
        </div>
      ))}
    </div>
  );
}
```

### 2. Disparar Análise Manual

```typescript
import { useTriggerPipeline } from '@/hooks/useInsightsV2';

function BotaoAnalisar() {
  const { trigger, loading } = useTriggerPipeline();

  async function analisar() {
    const result = await trigger(3); // bar_id = 3
    if (result) {
      alert(`✅ ${result.pipeline.narrator?.insights_gerados || 0} insights gerados`);
    }
  }

  return (
    <button onClick={analisar} disabled={loading}>
      {loading ? 'Analisando...' : 'Analisar Dia'}
    </button>
  );
}
```

### 3. Marcar como Lido

```typescript
const { marcarComoLido } = useInsightsV2({ barId: 3 });

// Marcar insight como lido
await marcarComoLido('insight-uuid-123');
```

### 4. Arquivar Insight

```typescript
const { arquivar } = useInsightsV2({ barId: 3 });

// Arquivar insight
await arquivar('insight-uuid-123');
```

---

## 🔍 Filtros

### Buscar Insights Críticos

```typescript
const { insights } = useInsightsV2({
  barId: 3,
  filters: { severidade: 'alta' }
});
```

### Buscar Problemas

```typescript
const { insights } = useInsightsV2({
  barId: 3,
  filters: { tipo: 'problema' }
});
```

### Buscar por Período

```typescript
const { insights } = useInsightsV2({
  barId: 3,
  filters: {
    data_inicio: '2026-03-01',
    data_fim: '2026-03-31'
  }
});
```

---

## 🎨 Componentes Prontos

### Card de Insight

```typescript
import { InsightCardV2 } from '@/components/InsightCardV2';

<InsightCardV2 
  insight={insight}
  onMarcarLido={() => marcarComoLido(insight.id)}
  onArquivar={() => arquivar(insight.id)}
/>
```

### Timeline de Eventos

```typescript
import { EventosTimeline } from '@/components/EventosTimeline';

<EventosTimeline barId={3} data="2026-03-30" />
```

### Filtros

```typescript
import { InsightsFilters } from '@/components/InsightsFilters';

<InsightsFilters 
  onFilterChange={(filters) => setFilters(filters)}
/>
```

---

## 🔧 API Direta (sem hooks)

### Buscar Insights

```typescript
const response = await fetch('/api/agente/insights-v2?bar_id=3&severidade=alta');
const { insights, stats } = await response.json();
```

### Disparar Pipeline

```typescript
const response = await fetch('/api/agente/insights-v2/trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bar_id: 3, data: '2026-03-30' })
});
const result = await response.json();
```

### Atualizar Status

```typescript
await fetch('/api/agente/insights-v2', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: 'uuid-123', visualizado: true })
});
```

---

## 📊 Stats e Métricas

```typescript
const { stats } = useInsightsV2({ barId: 3 });

console.log('Total:', stats?.total);
console.log('Não visualizados:', stats?.nao_visualizados);
console.log('Problemas:', stats?.problemas);
console.log('Oportunidades:', stats?.oportunidades);
console.log('Críticos:', stats?.por_severidade.alta);
```

---

## 🎯 Helpers

### Formatação

```typescript
import { 
  getSeveridadeIcon, 
  getTipoIcon,
  formatEventType 
} from '@/types/agent-v2';

const icon = getSeveridadeIcon('alta');     // '🔴'
const tipoIcon = getTipoIcon('problema');   // '⚠️'
const label = formatEventType('queda_ticket_medio'); // 'Queda no Ticket Médio'
```

### Priorização

```typescript
import { sortInsightsByPriority, isInsightCritico } from '@/types/agent-v2';

// Ordenar por prioridade
const ordenados = sortInsightsByPriority(insights);

// Verificar se é crítico
if (isInsightCritico(insight)) {
  alert('🔴 Insight crítico!');
}
```

---

## 🐛 Troubleshooting

### Problema: "bar_id é obrigatório"
```
Solução: Passar bar_id na query string ou body
GET /api/agente/insights-v2?bar_id=3
```

### Problema: "Erro ao executar pipeline v2"
```
Solução: Verificar logs da Edge Function
supabase functions logs agente-pipeline-v2
```

### Problema: Nenhum insight retornado
```
Solução: 
1. Verificar se há dados em agent_insights_v2
2. Remover filtros e buscar tudo
3. Rodar pipeline manualmente
```

---

## 📚 Documentação Completa

- **README.md** - Documentação completa das APIs
- **TEST.md** - Testes e validações
- **EXAMPLES.md** - Exemplos práticos avançados
- **IMPLEMENTATION.md** - Detalhes da implementação

---

## 🎉 Pronto!

Agora você pode:
- ✅ Buscar insights com filtros avançados
- ✅ Disparar análises manuais
- ✅ Marcar insights como lidos
- ✅ Arquivar insights
- ✅ Buscar eventos detectados
- ✅ Monitorar stats em tempo real

**Próximo passo:** Criar o dashboard visual (Prompt 6)! 🚀
