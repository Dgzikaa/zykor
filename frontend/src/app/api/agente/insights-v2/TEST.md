# 🧪 Testes - API Routes Insights V2

## Testes Manuais

### 1. Buscar Insights (GET)

#### Teste Básico
```bash
curl "http://localhost:3000/api/agente/insights-v2?bar_id=3"
```

#### Com Filtros
```bash
# Insights críticos
curl "http://localhost:3000/api/agente/insights-v2?bar_id=3&severidade=alta"

# Problemas do último mês
curl "http://localhost:3000/api/agente/insights-v2?bar_id=3&tipo=problema&data_inicio=2026-03-01&data_fim=2026-03-31"

# Últimos 10 insights
curl "http://localhost:3000/api/agente/insights-v2?bar_id=3&limit=10"
```

#### Validações
```bash
# Sem bar_id (deve retornar 400)
curl "http://localhost:3000/api/agente/insights-v2"
# → { "success": false, "error": "bar_id é obrigatório" }
```

---

### 2. Buscar Eventos (GET /events)

#### Teste Básico
```bash
curl "http://localhost:3000/api/agente/insights-v2/events?bar_id=3"
```

#### Com Filtros
```bash
# Eventos não processados
curl "http://localhost:3000/api/agente/insights-v2/events?bar_id=3&processed=false"

# Eventos de uma data específica
curl "http://localhost:3000/api/agente/insights-v2/events?bar_id=3&data=2026-03-30"

# Eventos de queda de ticket médio
curl "http://localhost:3000/api/agente/insights-v2/events?bar_id=3&event_type=queda_ticket_medio"

# Eventos críticos
curl "http://localhost:3000/api/agente/insights-v2/events?bar_id=3&severity=alta"
```

---

### 3. Disparar Pipeline (POST /trigger)

#### Teste Básico
```bash
curl -X POST "http://localhost:3000/api/agente/insights-v2/trigger" \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3}'
```

#### Com Data Específica
```bash
curl -X POST "http://localhost:3000/api/agente/insights-v2/trigger" \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3, "data": "2026-03-30"}'
```

#### Validações
```bash
# Sem bar_id (deve retornar 400)
curl -X POST "http://localhost:3000/api/agente/insights-v2/trigger" \
  -H "Content-Type: application/json" \
  -d '{}'
# → { "success": false, "error": "bar_id é obrigatório" }
```

---

### 4. Atualizar Insight (PUT)

#### Marcar como Visualizado
```bash
curl -X PUT "http://localhost:3000/api/agente/insights-v2" \
  -H "Content-Type: application/json" \
  -d '{"id": "uuid-123", "visualizado": true}'
```

#### Arquivar
```bash
curl -X PUT "http://localhost:3000/api/agente/insights-v2" \
  -H "Content-Type: application/json" \
  -d '{"id": "uuid-123", "arquivado": true}'
```

#### Atualizar Múltiplos Campos
```bash
curl -X PUT "http://localhost:3000/api/agente/insights-v2" \
  -H "Content-Type: application/json" \
  -d '{"id": "uuid-123", "visualizado": true, "arquivado": false}'
```

#### Validações
```bash
# Sem ID (deve retornar 400)
curl -X PUT "http://localhost:3000/api/agente/insights-v2" \
  -H "Content-Type: application/json" \
  -d '{"visualizado": true}'
# → { "success": false, "error": "ID é obrigatório" }

# Sem campos para atualizar (deve retornar 400)
curl -X PUT "http://localhost:3000/api/agente/insights-v2" \
  -H "Content-Type: application/json" \
  -d '{"id": "uuid-123"}'
# → { "success": false, "error": "Nenhum campo para atualizar" }
```

---

## Testes Automatizados (Jest)

### Setup
```typescript
// __tests__/api/insights-v2.test.ts
import { GET, POST, PUT } from '@/app/api/agente/insights-v2/route';
import { NextRequest } from 'next/server';

describe('API Insights V2', () => {
  // Mock do Supabase
  jest.mock('@supabase/supabase-js');
});
```

### Teste GET
```typescript
describe('GET /api/agente/insights-v2', () => {
  it('deve retornar insights com stats', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/agente/insights-v2?bar_id=3'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.insights).toBeInstanceOf(Array);
    expect(data.stats).toHaveProperty('total');
    expect(data.stats).toHaveProperty('por_severidade');
  });

  it('deve retornar erro sem bar_id', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/agente/insights-v2'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(response.status).toBe(400);
  });
});
```

### Teste POST /trigger
```typescript
describe('POST /api/agente/insights-v2/trigger', () => {
  it('deve disparar pipeline com sucesso', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/agente/insights-v2/trigger',
      {
        method: 'POST',
        body: JSON.stringify({ bar_id: 3 }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.pipeline).toHaveProperty('detector');
    expect(data.pipeline).toHaveProperty('narrator');
  });
});
```

### Teste PUT
```typescript
describe('PUT /api/agente/insights-v2', () => {
  it('deve atualizar insight', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/agente/insights-v2',
      {
        method: 'PUT',
        body: JSON.stringify({ 
          id: 'test-uuid', 
          visualizado: true 
        }),
      }
    );

    const response = await PUT(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.visualizado).toBe(true);
  });
});
```

---

## Testes de Integração

### Fluxo Completo
```typescript
async function testarFluxoCompleto() {
  const barId = 3;
  const data = '2026-03-30';

  console.log('1️⃣ Disparando pipeline...');
  const triggerResponse = await fetch('/api/agente/insights-v2/trigger', {
    method: 'POST',
    body: JSON.stringify({ bar_id: barId, data }),
  });
  const triggerResult = await triggerResponse.json();
  console.log('✅ Pipeline:', triggerResult.pipeline);

  console.log('2️⃣ Buscando insights gerados...');
  const insightsResponse = await fetch(
    `/api/agente/insights-v2?bar_id=${barId}&data_inicio=${data}&data_fim=${data}`
  );
  const insightsResult = await insightsResponse.json();
  console.log('✅ Insights:', insightsResult.insights.length);

  console.log('3️⃣ Buscando eventos detectados...');
  const eventsResponse = await fetch(
    `/api/agente/insights-v2/events?bar_id=${barId}&data=${data}`
  );
  const eventsResult = await eventsResponse.json();
  console.log('✅ Eventos:', eventsResult.eventos.length);

  console.log('4️⃣ Marcando primeiro insight como lido...');
  if (insightsResult.insights.length > 0) {
    const insight = insightsResult.insights[0];
    await fetch('/api/agente/insights-v2', {
      method: 'PUT',
      body: JSON.stringify({ id: insight.id, visualizado: true }),
    });
    console.log('✅ Insight marcado como lido');
  }

  console.log('🎉 Fluxo completo testado com sucesso!');
}
```

---

## Monitoramento

### Logs no Console
```typescript
// Todas as rotas logam operações importantes
console.log('🎭 [API] Disparando pipeline v2...');
console.log('✅ [API] Pipeline v2 concluído: 2 insights gerados');
console.error('❌ [API] Erro na Edge Function:', error);
```

### Métricas
```sql
-- Chamadas à API (via logs do Next.js)
-- Tempo de resposta
-- Taxa de erro
-- Insights gerados por dia
```

---

## Troubleshooting

### Problema: "bar_id é obrigatório"
```
Causa: Query param bar_id não foi passado
Solução: Adicionar ?bar_id=3 na URL
```

### Problema: "Erro ao executar pipeline v2"
```
Causa: Edge Function falhou
Solução: 
1. Ver logs: supabase functions logs agente-pipeline-v2
2. Verificar GEMINI_API_KEY
3. Verificar se tabelas existem
```

### Problema: "Nenhum insight retornado"
```
Causa: Filtros muito restritivos ou sem dados
Solução:
1. Remover filtros e buscar tudo
2. Verificar se há dados em agent_insights_v2
3. Rodar pipeline manualmente
```

---

## Próximos Passos

1. ✅ API routes implementadas
2. ⏳ Criar componentes React (Prompt 6)
3. ⏳ Criar dashboard de visualização
4. ⏳ Integrar com notificações in-app
