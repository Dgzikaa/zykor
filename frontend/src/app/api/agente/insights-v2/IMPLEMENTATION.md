# ✅ Prompt 5 - API Routes Frontend (Implementado)

## 📋 Resumo

Criadas as API routes no frontend para expor os insights do Agent V2, permitindo que componentes React consumam os dados do sistema de forma estruturada e segura.

---

## 📁 Arquivos Criados

### API Routes
1. **`frontend/src/app/api/agente/insights-v2/route.ts`** (6.1 KB)
   - GET: Buscar insights com filtros
   - PUT: Atualizar status (visualizado/arquivado)
   - POST: Disparar pipeline v2 manualmente

2. **`frontend/src/app/api/agente/insights-v2/events/route.ts`** (3.1 KB)
   - GET: Buscar eventos detectados

3. **`frontend/src/app/api/agente/insights-v2/trigger/route.ts`** (1.9 KB)
   - POST: Endpoint dedicado para disparar pipeline

### Tipos TypeScript
4. **`frontend/src/types/agent-v2.ts`** (3.8 KB)
   - Interfaces completas para insights, eventos, responses
   - Helpers para formatação e priorização
   - Constants para labels, cores e ícones

### Hooks React
5. **`frontend/src/hooks/useInsightsV2.ts`** (4.2 KB)
   - `useInsightsV2`: Hook principal para buscar e gerenciar insights
   - `useTriggerPipeline`: Hook para disparar análises manuais
   - `useInsightEvents`: Hook para buscar eventos detectados

### Documentação
6. **`frontend/src/app/api/agente/insights-v2/README.md`** (10.6 KB)
   - Documentação completa de todos os endpoints
   - Exemplos de uso
   - Integração com React

7. **`frontend/src/app/api/agente/insights-v2/TEST.md`** (8.4 KB)
   - Testes manuais com cURL
   - Testes automatizados (Jest)
   - Fluxo completo de integração

**Total:** 7 arquivos, ~38 KB de código

---

## 🔌 Endpoints Implementados

### GET `/api/agente/insights-v2`
```typescript
// Buscar insights com filtros
GET /api/agente/insights-v2?bar_id=3&severidade=alta&limit=20

Response: {
  success: true,
  insights: AgentInsightV2[],
  stats: {
    total: number,
    nao_visualizados: number,
    problemas: number,
    oportunidades: number,
    por_severidade: { alta, media, baixa }
  }
}
```

**Filtros disponíveis:**
- `bar_id` (obrigatório)
- `data_inicio`, `data_fim` (range de datas)
- `tipo` ('problema' | 'oportunidade')
- `severidade` ('baixa' | 'media' | 'alta')
- `limit` (default: 50)

---

### GET `/api/agente/insights-v2/events`
```typescript
// Buscar eventos detectados
GET /api/agente/insights-v2/events?bar_id=3&processed=false

Response: {
  success: true,
  eventos: InsightEvent[],
  stats: {
    total: number,
    processados: number,
    nao_processados: number,
    por_tipo: Record<string, number>,
    por_severidade: { alta, media, baixa }
  }
}
```

**Filtros disponíveis:**
- `bar_id` (obrigatório)
- `data` (data específica)
- `processed` (true | false)
- `event_type` (tipo do evento)
- `severity` ('baixa' | 'media' | 'alta')
- `limit` (default: 100)

---

### POST `/api/agente/insights-v2/trigger`
```typescript
// Disparar pipeline manualmente
POST /api/agente/insights-v2/trigger
Body: { bar_id: 3, data?: '2026-03-30' }

Response: {
  success: true,
  data_analise: '2026-03-30',
  pipeline: {
    detector: { eventos_detectados, eventos_salvos },
    narrator: { eventos_processados, insights_gerados, insights_salvos },
    notificacoes: { enviadas }
  },
  insights: [...],
  resumo_geral: '...'
}
```

---

### PUT `/api/agente/insights-v2`
```typescript
// Atualizar status do insight
PUT /api/agente/insights-v2
Body: { id: 'uuid', visualizado?: true, arquivado?: false }

Response: {
  success: true,
  data: AgentInsightV2
}
```

---

## 🪝 Hooks React

### `useInsightsV2`
Hook principal para gerenciar insights

```typescript
import { useInsightsV2 } from '@/hooks/useInsightsV2';

function MeuComponente() {
  const { 
    insights, 
    stats, 
    loading, 
    error,
    refetch,
    marcarComoLido,
    arquivar,
    atualizar
  } = useInsightsV2({
    barId: 3,
    autoFetch: true,
    filters: { severidade: 'alta' }
  });

  if (loading) return <Spinner />;
  if (error) return <Error message={error} />;

  return (
    <div>
      <h2>Insights ({stats?.nao_visualizados} novos)</h2>
      {insights.map(insight => (
        <InsightCard 
          key={insight.id} 
          insight={insight}
          onMarcarLido={() => marcarComoLido(insight.id)}
          onArquivar={() => arquivar(insight.id)}
        />
      ))}
    </div>
  );
}
```

### `useTriggerPipeline`
Hook para disparar análises manuais

```typescript
import { useTriggerPipeline } from '@/hooks/useInsightsV2';

function BotaoAnalisar({ barId }: { barId: number }) {
  const { trigger, loading, error } = useTriggerPipeline();

  async function handleClick() {
    const result = await trigger(barId);
    if (result) {
      toast.success(`${result.pipeline.narrator?.insights_gerados || 0} insights gerados`);
    }
  }

  return (
    <button onClick={handleClick} disabled={loading}>
      {loading ? 'Analisando...' : '🔍 Analisar Dia'}
    </button>
  );
}
```

### `useInsightEvents`
Hook para buscar eventos detectados

```typescript
import { useInsightEvents } from '@/hooks/useInsightsV2';

function EventosLista({ barId, data }: Props) {
  const { eventos, stats, loading, error, refetch } = useInsightEvents(barId, data);

  return (
    <div>
      <h3>Eventos Detectados ({stats?.nao_processados} não processados)</h3>
      {eventos.map(evento => (
        <EventoCard key={evento.id} evento={evento} />
      ))}
    </div>
  );
}
```

---

## 📦 Tipos TypeScript

### Principais Interfaces

```typescript
// Insight gerado pelo Narrator
interface AgentInsightV2 {
  id: string;
  bar_id: number;
  data: string;
  titulo: string;
  descricao: string;
  severidade: 'baixa' | 'media' | 'alta';
  tipo: 'problema' | 'oportunidade';
  causa_provavel: string | null;
  acoes_recomendadas: string[];
  eventos_relacionados: string[];
  resumo_geral: string | null;
  source: string;
  visualizado: boolean;
  arquivado: boolean;
  created_at: string;
}

// Evento detectado pelo Detector
interface InsightEvent {
  id: string;
  bar_id: number;
  data: string;
  event_type: string;
  severity: 'baixa' | 'media' | 'alta';
  evidence_json: string[];
  processed: boolean;
  created_at: string;
}
```

### Helpers Disponíveis

```typescript
import { 
  getSeveridadeColor,
  getSeveridadeIcon,
  getTipoIcon,
  formatEventType,
  isInsightCritico,
  isInsightNovo,
  sortInsightsByPriority
} from '@/types/agent-v2';

// Usar nos componentes
const color = getSeveridadeColor(insight.severidade); // 'red', 'orange', 'blue'
const icon = getSeveridadeIcon(insight.severidade);   // '🔴', '🟠', '🔵'
const sorted = sortInsightsByPriority(insights);      // Ordenar por prioridade
```

---

## 🎯 Padrões Seguidos

### 1. Autenticação
- ✅ Usa `SUPABASE_SERVICE_ROLE_KEY` para bypass RLS
- ✅ Segue padrão de `frontend/src/app/api/agente/insights/route.ts`

### 2. Estrutura de Response
```typescript
{
  success: boolean,
  data?: any,
  error?: string,
  stats?: { ... }
}
```

### 3. Validações
- ✅ `bar_id` obrigatório em todos os endpoints
- ✅ Validação de campos obrigatórios no PUT
- ✅ Tratamento de erros com status codes apropriados

### 4. Error Handling
```typescript
try {
  // Operação
} catch (error) {
  console.error('Erro:', error);
  return NextResponse.json(
    { success: false, error: 'Mensagem amigável' },
    { status: 500 }
  );
}
```

### 5. Dynamic Routes
```typescript
export const dynamic = 'force-dynamic';
```
Garante que os dados sempre sejam buscados frescos do banco.

---

## 🧪 Testes

### Teste Manual Rápido
```bash
# 1. Buscar insights
curl "http://localhost:3000/api/agente/insights-v2?bar_id=3"

# 2. Buscar eventos
curl "http://localhost:3000/api/agente/insights-v2/events?bar_id=3&processed=false"

# 3. Disparar pipeline
curl -X POST "http://localhost:3000/api/agente/insights-v2/trigger" \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3}'

# 4. Marcar como lido
curl -X PUT "http://localhost:3000/api/agente/insights-v2" \
  -H "Content-Type: application/json" \
  -d '{"id": "uuid-123", "visualizado": true}'
```

### Fluxo Completo
Ver `TEST.md` para testes automatizados e fluxos de integração completos.

---

## 📊 Comparação com V1

| Aspecto | V1 (`/api/agente/insights`) | V2 (`/api/agente/insights-v2`) |
|---------|----------------------------|--------------------------------|
| **Tabela** | `agente_insights` | `agent_insights_v2` |
| **Eventos** | ❌ Não separados | ✅ `insight_events` |
| **Filtros** | Básicos (tipo, limite) | Avançados (data range, severidade, tipo) |
| **Stats** | Por tipo e impacto | Por severidade, tipo, visualização |
| **Pipeline** | Monolítico | Modular (detector + narrator) |
| **Trigger** | Via `agente-dispatcher` | Via `agente-pipeline-v2` |
| **Eventos** | ❌ Não exposto | ✅ `/events` endpoint |

---

## 🚀 Próximos Passos

### Prompt 6: Criar Frontend (Dashboard)
- [ ] Criar página `/agente-v2`
- [ ] Componente `InsightsV2Dashboard`
- [ ] Componente `InsightCard`
- [ ] Componente `EventosTimeline`
- [ ] Filtros interativos
- [ ] Botão de análise manual
- [ ] Notificações in-app

### Integração
- [ ] Adicionar link no menu lateral
- [ ] Integrar com sistema de notificações
- [ ] Adicionar badges de insights não lidos

---

## 🎉 Status

✅ **Prompt 5 Concluído**

- ✅ API route principal (`/api/agente/insights-v2`)
- ✅ API route de eventos (`/events`)
- ✅ API route de trigger (`/trigger`)
- ✅ Tipos TypeScript completos
- ✅ Hooks React customizados
- ✅ Documentação completa
- ✅ Testes e exemplos

**Pronto para Prompt 6: Criar o dashboard no frontend!**
