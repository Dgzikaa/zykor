# 🏗️ Arquitetura - API Routes Insights V2

## 📐 Visão Geral

As API routes do Agent V2 seguem uma arquitetura RESTful modular, expondo os insights e eventos do sistema backend para o frontend React.

---

## 🗺️ Mapa de Rotas

```
/api/agente/insights-v2/
│
├── GET    /                    → Buscar insights com filtros
├── PUT    /                    → Atualizar status (visualizado/arquivado)
├── POST   /                    → Disparar pipeline (alias)
│
├── GET    /events              → Buscar eventos detectados
│
└── POST   /trigger             → Disparar pipeline v2
```

---

## 🔄 Fluxo de Dados

### Fluxo 1: Buscar Insights

```
┌─────────────┐
│  Frontend   │
│  Component  │
└──────┬──────┘
       │ useInsightsV2({ barId: 3 })
       ↓
┌──────────────────────────────────────┐
│  Hook: useInsightsV2                 │
│  - Gerencia estado (loading, error)  │
│  - Faz fetch para API                │
└──────┬───────────────────────────────┘
       │ GET /api/agente/insights-v2?bar_id=3
       ↓
┌──────────────────────────────────────┐
│  API Route: route.ts (GET)           │
│  - Valida bar_id                     │
│  - Aplica filtros                    │
│  - Busca de agent_insights_v2        │
│  - Calcula stats                     │
└──────┬───────────────────────────────┘
       │ SELECT * FROM agent_insights_v2 WHERE...
       ↓
┌──────────────────────────────────────┐
│  Supabase Database                   │
│  - Tabela: agent_insights_v2         │
│  - RLS: user_bar_access              │
└──────┬───────────────────────────────┘
       │ { insights: [...], stats: {...} }
       ↓
┌──────────────────────────────────────┐
│  Frontend Component                  │
│  - Renderiza insights                │
│  - Mostra stats                      │
└──────────────────────────────────────┘
```

---

### Fluxo 2: Disparar Pipeline

```
┌─────────────┐
│  Frontend   │
│  Button     │
└──────┬──────┘
       │ onClick → trigger(3, '2026-03-30')
       ↓
┌──────────────────────────────────────┐
│  Hook: useTriggerPipeline            │
│  - Gerencia loading                  │
│  - Faz POST para API                 │
└──────┬───────────────────────────────┘
       │ POST /api/agente/insights-v2/trigger
       │ Body: { bar_id: 3, data: '2026-03-30' }
       ↓
┌──────────────────────────────────────┐
│  API Route: trigger/route.ts         │
│  - Valida bar_id                     │
│  - Faz fetch para Edge Function      │
└──────┬───────────────────────────────┘
       │ POST /functions/v1/agente-pipeline-v2
       │ Headers: Authorization: Bearer SERVICE_KEY
       ↓
┌──────────────────────────────────────┐
│  Edge Function: agente-pipeline-v2   │
│  1. Chama agente-detector            │
│  2. Chama agente-narrator (se eventos)│
│  3. Envia Discord (se crítico)       │
└──────┬───────────────────────────────┘
       │ { success: true, pipeline: {...}, insights: [...] }
       ↓
┌──────────────────────────────────────┐
│  Frontend Component                  │
│  - Mostra notificação                │
│  - Recarrega lista de insights       │
└──────────────────────────────────────┘
```

---

### Fluxo 3: Atualizar Status

```
┌─────────────┐
│  Frontend   │
│  Card       │
└──────┬──────┘
       │ onMarcarLido(insightId)
       ↓
┌──────────────────────────────────────┐
│  Hook: useInsightsV2                 │
│  - marcarComoLido(id)                │
│  - Atualiza estado local             │
└──────┬───────────────────────────────┘
       │ PUT /api/agente/insights-v2
       │ Body: { id: 'uuid', visualizado: true }
       ↓
┌──────────────────────────────────────┐
│  API Route: route.ts (PUT)           │
│  - Valida ID                         │
│  - Valida campos                     │
│  - UPDATE agent_insights_v2          │
└──────┬───────────────────────────────┘
       │ UPDATE agent_insights_v2 SET visualizado = true WHERE id = 'uuid'
       ↓
┌──────────────────────────────────────┐
│  Supabase Database                   │
│  - Atualiza registro                 │
└──────┬───────────────────────────────┘
       │ { success: true, data: {...} }
       ↓
┌──────────────────────────────────────┐
│  Frontend Component                  │
│  - UI atualizada (badge removido)    │
└──────────────────────────────────────┘
```

---

## 🧩 Componentes da Arquitetura

### 1. API Routes (Next.js)
**Responsabilidade:** Expor dados do Supabase para o frontend

**Características:**
- ✅ Validação de inputs
- ✅ Error handling
- ✅ Logs estruturados
- ✅ Response pattern consistente

**Segurança:**
- Usa `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- Não expõe secrets no frontend
- RLS habilitado nas tabelas

---

### 2. Hooks React
**Responsabilidade:** Abstrair lógica de fetch e estado

**Características:**
- ✅ Gerenciamento de estado (loading, error, data)
- ✅ Auto-fetch opcional
- ✅ Refetch manual
- ✅ Funções de atualização

**Vantagens:**
- Reutilizável em múltiplos componentes
- Type-safe
- Reduz boilerplate

---

### 3. Tipos TypeScript
**Responsabilidade:** Type-safety e intellisense

**Características:**
- ✅ Interfaces completas
- ✅ Types para requests/responses
- ✅ Helpers de formatação
- ✅ Funções utilitárias

**Vantagens:**
- Autocomplete no IDE
- Detecção de erros em tempo de desenvolvimento
- Documentação inline

---

## 🎯 Padrões de Design

### 1. RESTful API
```
GET    /resource       → Listar
POST   /resource       → Criar/Disparar
PUT    /resource       → Atualizar
DELETE /resource       → Deletar (não implementado)
```

### 2. Response Pattern
```typescript
{
  success: boolean,
  data?: T,
  error?: string,
  stats?: Stats
}
```

### 3. Error Handling
```typescript
try {
  // Operação
} catch (error) {
  console.error('Contexto:', error);
  return NextResponse.json(
    { success: false, error: 'Mensagem amigável' },
    { status: 500 }
  );
}
```

### 4. Validação de Inputs
```typescript
if (!requiredParam) {
  return NextResponse.json(
    { success: false, error: 'Campo obrigatório' },
    { status: 400 }
  );
}
```

---

## 🔐 Segurança

### Camadas de Proteção

```
┌─────────────────────────────────────┐
│  1. Frontend (Client-side)          │
│  - Não tem acesso direto ao DB      │
│  - Usa API routes                   │
└─────────────┬───────────────────────┘
              │
              ↓
┌─────────────────────────────────────┐
│  2. API Routes (Server-side)        │
│  - Validação de inputs              │
│  - Usa SERVICE_ROLE_KEY             │
└─────────────┬───────────────────────┘
              │
              ↓
┌─────────────────────────────────────┐
│  3. Supabase Database               │
│  - RLS habilitado                   │
│  - Policies por bar_id              │
└─────────────────────────────────────┘
```

### RLS Policies
```sql
-- insight_events
CREATE POLICY "insight_events_bar_access" 
ON insight_events FOR ALL 
USING (bar_id IN (
  SELECT bar_id FROM user_bar_access WHERE user_id = auth.uid()
));

-- agent_insights_v2
CREATE POLICY "agent_insights_v2_bar_access" 
ON agent_insights_v2 FOR ALL 
USING (bar_id IN (
  SELECT bar_id FROM user_bar_access WHERE user_id = auth.uid()
));
```

**Nota:** APIs usam `SERVICE_ROLE_KEY` que bypassa RLS, mas validam `bar_id` manualmente.

---

## 📊 Performance

### Otimizações Implementadas

1. **Índices no Banco**
   ```sql
   CREATE INDEX idx_insight_events_bar_data ON insight_events(bar_id, data);
   CREATE INDEX idx_agent_insights_v2_bar_data ON agent_insights_v2(bar_id, data);
   ```

2. **Limit Padrão**
   - GET insights: limit 50
   - GET events: limit 100

3. **Force Dynamic**
   ```typescript
   export const dynamic = 'force-dynamic';
   ```
   Garante dados sempre frescos.

4. **Stats Calculadas no Backend**
   - Reduz processamento no frontend
   - Retorna agregações prontas

---

## 🔄 Ciclo de Vida

### 1. Inicialização
```typescript
// Hook auto-fetch
useInsightsV2({ barId: 3, autoFetch: true })
  ↓
GET /api/agente/insights-v2?bar_id=3
  ↓
SELECT * FROM agent_insights_v2 WHERE bar_id = 3
  ↓
{ insights: [...], stats: {...} }
```

### 2. Atualização Manual
```typescript
// Usuário clica "Analisar Dia"
trigger(3, '2026-03-30')
  ↓
POST /api/agente/insights-v2/trigger
  ↓
POST /functions/v1/agente-pipeline-v2
  ↓
Detector → Narrator → Discord
  ↓
{ pipeline: {...}, insights: [...] }
  ↓
refetch() // Recarrega lista
```

### 3. Interação do Usuário
```typescript
// Usuário marca como lido
marcarComoLido('uuid-123')
  ↓
PUT /api/agente/insights-v2
  ↓
UPDATE agent_insights_v2 SET visualizado = true
  ↓
Estado local atualizado (otimistic update)
```

---

## 🧪 Testes de Arquitetura

### Teste de Integração End-to-End

```typescript
async function testarArquiteturaCompleta() {
  console.log('🧪 Testando arquitetura completa...\n');

  // 1. Disparar pipeline
  console.log('1️⃣ Disparando pipeline...');
  const triggerRes = await fetch('/api/agente/insights-v2/trigger', {
    method: 'POST',
    body: JSON.stringify({ bar_id: 3, data: '2026-03-30' }),
  });
  const triggerData = await triggerRes.json();
  console.log('✅ Pipeline:', triggerData.pipeline);

  // 2. Buscar insights gerados
  console.log('\n2️⃣ Buscando insights...');
  const insightsRes = await fetch('/api/agente/insights-v2?bar_id=3');
  const insightsData = await insightsRes.json();
  console.log('✅ Insights:', insightsData.stats);

  // 3. Buscar eventos detectados
  console.log('\n3️⃣ Buscando eventos...');
  const eventsRes = await fetch('/api/agente/insights-v2/events?bar_id=3');
  const eventsData = await eventsRes.json();
  console.log('✅ Eventos:', eventsData.stats);

  // 4. Atualizar insight
  console.log('\n4️⃣ Atualizando insight...');
  if (insightsData.insights.length > 0) {
    const insight = insightsData.insights[0];
    const updateRes = await fetch('/api/agente/insights-v2', {
      method: 'PUT',
      body: JSON.stringify({ id: insight.id, visualizado: true }),
    });
    const updateData = await updateRes.json();
    console.log('✅ Atualizado:', updateData.success);
  }

  console.log('\n🎉 Arquitetura validada com sucesso!');
}
```

---

## 📦 Camadas da Arquitetura

### Camada 1: Apresentação (React Components)
```typescript
// Componentes visuais
<InsightCardV2 />
<EventosTimeline />
<InsightsFilters />
<AnalisarDiaButton />
```

**Responsabilidade:** UI/UX

---

### Camada 2: Lógica de Estado (React Hooks)
```typescript
// Hooks customizados
useInsightsV2()
useTriggerPipeline()
useInsightEvents()
```

**Responsabilidade:** Gerenciamento de estado e fetch

---

### Camada 3: API Routes (Next.js)
```typescript
// Routes do Next.js
GET  /api/agente/insights-v2
POST /api/agente/insights-v2/trigger
PUT  /api/agente/insights-v2
GET  /api/agente/insights-v2/events
```

**Responsabilidade:** Validação, autenticação, proxy para Supabase

---

### Camada 4: Edge Functions (Supabase)
```typescript
// Edge Functions Deno
agente-detector       // Detectar eventos
agente-narrator       // Gerar insights
agente-pipeline-v2    // Orquestrar
```

**Responsabilidade:** Lógica de negócio, processamento

---

### Camada 5: Banco de Dados (PostgreSQL)
```sql
-- Tabelas
insight_events        -- Eventos detectados
agent_insights_v2     -- Insights gerados
```

**Responsabilidade:** Persistência de dados

---

## 🔗 Integrações

### Frontend ↔ API Routes
```typescript
// Frontend chama API routes
fetch('/api/agente/insights-v2?bar_id=3')
  ↓
// API route valida e busca no Supabase
supabase.from('agent_insights_v2').select('*')
  ↓
// Retorna dados para frontend
{ success: true, insights: [...] }
```

### API Routes ↔ Edge Functions
```typescript
// API route chama Edge Function
fetch(`${SUPABASE_URL}/functions/v1/agente-pipeline-v2`, {
  headers: { Authorization: `Bearer ${SERVICE_KEY}` }
})
  ↓
// Edge Function processa
Detector → Narrator → Discord
  ↓
// Retorna resultado
{ pipeline: {...}, insights: [...] }
```

### Edge Functions ↔ Database
```typescript
// Edge Function salva no banco
supabase.from('insight_events').insert(eventos)
  ↓
// Banco persiste dados
INSERT INTO insight_events (...)
  ↓
// Retorna confirmação
{ data: [...], error: null }
```

---

## 🎯 Decisões de Design

### 1. Separação de Rotas
**Decisão:** Criar rotas separadas para `/events` e `/trigger`

**Motivo:**
- Clareza de responsabilidade
- Facilita manutenção
- Permite permissões diferentes no futuro

**Alternativa rejeitada:** Tudo em uma única rota com query params

---

### 2. Stats no Response
**Decisão:** Calcular stats no backend e retornar junto com os dados

**Motivo:**
- Reduz processamento no frontend
- Consistência de cálculos
- Performance (uma query vs múltiplas)

**Alternativa rejeitada:** Frontend calcular stats localmente

---

### 3. Hooks Customizados
**Decisão:** Criar 3 hooks especializados

**Motivo:**
- Reutilização de lógica
- Separação de concerns
- Type-safety
- Melhor DX (Developer Experience)

**Alternativa rejeitada:** Componentes fazerem fetch diretamente

---

### 4. Service Role Key
**Decisão:** Usar `SUPABASE_SERVICE_ROLE_KEY` nas API routes

**Motivo:**
- Bypass RLS (necessário para admin)
- Simplifica lógica de autenticação
- Seguro (server-side only)

**Alternativa rejeitada:** Usar anon key com RLS

---

## 📈 Escalabilidade

### Paginação (Futuro)
```typescript
// Adicionar offset e cursor-based pagination
GET /api/agente/insights-v2?bar_id=3&limit=20&offset=40

// Ou cursor-based
GET /api/agente/insights-v2?bar_id=3&limit=20&cursor=uuid-123
```

### Cache (Futuro)
```typescript
// Adicionar cache com React Query
import { useQuery } from '@tanstack/react-query';

function useInsightsV2(barId: number) {
  return useQuery({
    queryKey: ['insights-v2', barId],
    queryFn: () => fetchInsights(barId),
    staleTime: 60000, // 1 minuto
  });
}
```

### Rate Limiting (Futuro)
```typescript
// Adicionar rate limiting nas APIs
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por IP
});
```

---

## 🔄 Comparação com V1

### Arquitetura V1 (Monolítica)
```
Frontend → API Route → Edge Function (monolítica) → Database
                            ↓
                       Tudo em uma função
                       (buscar + detectar + narrar)
```

**Problemas:**
- ❌ Difícil de debugar
- ❌ Sempre chama LLM (caro)
- ❌ Timeout em casos complexos
- ❌ Difícil de testar

---

### Arquitetura V2 (Modular)
```
Frontend → API Routes → Orchestrator → Detector → Database
                            ↓              ↓
                        Narrator ← Eventos detectados
                            ↓
                        Discord (se crítico)
```

**Vantagens:**
- ✅ Fácil de debugar (cada componente isolado)
- ✅ LLM só quando necessário (barato)
- ✅ Timeout improvável (componentes rápidos)
- ✅ Fácil de testar (unit + integration)

---

## 🎉 Conclusão

A arquitetura das API routes do Agent V2 segue princípios de:

- ✅ **Modularidade:** Rotas separadas por responsabilidade
- ✅ **Type-safety:** TypeScript em todo o código
- ✅ **Reutilização:** Hooks customizados
- ✅ **Performance:** Otimizações de query e cache
- ✅ **Segurança:** RLS + validações
- ✅ **Manutenibilidade:** Código limpo e documentado

**Sistema pronto para escalar e evoluir!** 🚀
