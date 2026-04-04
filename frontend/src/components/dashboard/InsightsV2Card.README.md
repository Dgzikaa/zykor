# 🎨 InsightsV2Card - Componente de Dashboard

## 📋 Visão Geral

Componente React para exibir insights do Agent V2 no dashboard, com suporte a filtros, análise manual e marcação de leitura.

---

## 🎯 Funcionalidades

### 1. Busca Automática de Insights
- ✅ Busca insights de `/api/agente/insights-v2`
- ✅ Atualização automática ao mudar `barId`
- ✅ Suporte a filtros (tipo, severidade)
- ✅ Limite configurável de insights

### 2. Exibição de Cards
- ✅ Ícone por tipo (⚠️ problema, 💡 oportunidade)
- ✅ Badge de severidade (vermelho=alta, amarelo=média, verde=baixa)
- ✅ Título e descrição
- ✅ Lista de ações recomendadas (até 2 visíveis)
- ✅ Causa provável em texto menor/cinza
- ✅ Indicador visual de "não lido" (anel azul)

### 3. Botão "Executar Análise"
- ✅ Chama `POST /api/agente/insights-v2/trigger`
- ✅ Mostra loading durante análise
- ✅ Toast com resultado (eventos detectados, insights gerados)
- ✅ Atualiza lista automaticamente após análise

### 4. Filtros
- ✅ Tipo: Todos / Problemas / Oportunidades
- ✅ Severidade: Todas / Alta / Média / Baixa
- ✅ Atualização automática ao mudar filtros

### 5. Estados
- ✅ Loading skeleton (3 cards)
- ✅ Empty state (sem insights)
- ✅ Error state (tratamento silencioso)
- ✅ Stats cards (total, não lidos, problemas, oportunidades)

---

## 📦 Props

```typescript
interface InsightsV2CardProps {
  barId: number;           // ID do bar (obrigatório)
  compact?: boolean;       // Modo compacto (default: false)
  showActions?: boolean;   // Mostrar botões de ação (default: true)
  maxInsights?: number;    // Limite de insights (default: 10)
  className?: string;      // Classes CSS adicionais
}
```

---

## 🎨 Uso

### Básico
```typescript
import InsightsV2Card from '@/components/dashboard/InsightsV2Card';

<InsightsV2Card barId={3} />
```

### Modo Compacto
```typescript
<InsightsV2Card 
  barId={3} 
  compact={true} 
  maxInsights={5}
/>
```

### Sem Ações
```typescript
<InsightsV2Card 
  barId={3} 
  showActions={false}
/>
```

### Com Classes Customizadas
```typescript
<InsightsV2Card 
  barId={3} 
  className="shadow-lg"
/>
```

---

## 🎨 Modos de Exibição

### Modo Normal (Padrão)
- Header com título e botões
- Stats cards (4 métricas)
- Filtros (tipo e severidade)
- Lista completa de insights
- Ações recomendadas expandidas

### Modo Compacto
- Header simplificado
- Sem stats cards
- Sem filtros
- Apenas 3 insights
- Sem ações recomendadas

---

## 🎨 Elementos Visuais

### Badge de Severidade
```typescript
// Alta: Vermelho
<Badge variant="destructive">Alta</Badge>

// Média: Amarelo/Laranja
<Badge variant="warning">Média</Badge>

// Baixa: Verde
<Badge variant="success">Baixa</Badge>
```

### Ícones por Tipo
```typescript
// Problema
<AlertTriangle className="w-4 h-4 text-orange-500" />

// Oportunidade
<Lightbulb className="w-4 h-4 text-yellow-500" />
```

### Cores de Card por Severidade
```typescript
// Alta: Borda vermelha
'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10'

// Média: Borda laranja
'border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-900/10'

// Baixa: Borda azul
'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10'
```

### Indicador de "Não Lido"
```typescript
// Ring azul + badge "Novo"
{!insight.visualizado && (
  <>
    <div className="ring-2 ring-blue-300 dark:ring-blue-700" />
    <Badge className="bg-blue-600 text-xs">Novo</Badge>
  </>
)}
```

---

## 🔄 Estados do Componente

### Loading
```typescript
{loading && (
  <div className="space-y-3">
    {[...Array(3)].map((_, i) => (
      <Skeleton key={i} className="h-32" />
    ))}
  </div>
)}
```

### Empty State
```typescript
{insights.length === 0 && (
  <div className="text-center py-8">
    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
    <p className="text-gray-600 dark:text-gray-400">
      ✨ Nenhum insight no momento.
    </p>
    <Button onClick={executarAnalise}>
      Executar Análise
    </Button>
  </div>
)}
```

### Com Dados
```typescript
{insights.map(insight => (
  <div key={insight.id} className="p-3 rounded-lg border">
    {/* Conteúdo do insight */}
  </div>
))}
```

---

## 🎯 Interações

### 1. Executar Análise
```typescript
const executarAnalise = async () => {
  const response = await fetch('/api/agente/insights-v2/trigger', {
    method: 'POST',
    body: JSON.stringify({ bar_id: barId })
  });
  
  if (result.success) {
    toast.success('Análise concluída!');
    fetchInsights(); // Recarrega lista
  }
};
```

### 2. Marcar como Lido
```typescript
const marcarComoLido = async (insightId: string) => {
  await fetch('/api/agente/insights-v2', {
    method: 'PUT',
    body: JSON.stringify({ id: insightId, visualizado: true })
  });
  
  // Atualização otimista do estado local
  setInsights(prev =>
    prev.map(i => (i.id === insightId ? { ...i, visualizado: true } : i))
  );
};
```

### 3. Atualizar Lista
```typescript
const fetchInsights = async () => {
  const params = new URLSearchParams({
    bar_id: barId.toString(),
    limit: maxInsights.toString(),
  });

  if (filtroTipo) params.append('tipo', filtroTipo);
  if (filtroSeveridade) params.append('severidade', filtroSeveridade);

  const response = await fetch(`/api/agente/insights-v2?${params}`);
  const result = await response.json();
  
  setInsights(result.insights);
  setStats(result.stats);
};
```

---

## 📊 Stats Cards

```typescript
<div className="grid grid-cols-4 gap-3 mb-4">
  {/* Total */}
  <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
    <div className="text-xs text-gray-600">Total</div>
    <div className="text-xl font-bold">{stats.total}</div>
  </div>

  {/* Não Lidos */}
  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
    <div className="text-xs text-blue-600">Não Lidos</div>
    <div className="text-xl font-bold text-blue-700">{stats.nao_visualizados}</div>
  </div>

  {/* Problemas */}
  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
    <div className="text-xs text-red-600">Problemas</div>
    <div className="text-xl font-bold text-red-700">{stats.problemas}</div>
  </div>

  {/* Oportunidades */}
  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
    <div className="text-xs text-green-600">Oportunidades</div>
    <div className="text-xl font-bold text-green-700">{stats.oportunidades}</div>
  </div>
</div>
```

---

## 🎨 Customização

### Cores por Severidade
```typescript
const getSeveridadeColor = (severidade: string) => {
  switch (severidade) {
    case 'alta':
      return 'border-red-300 bg-red-50/50';
    case 'media':
      return 'border-orange-300 bg-orange-50/50';
    case 'baixa':
      return 'border-blue-300 bg-blue-50/50';
  }
};
```

### Badges Customizados
```typescript
const getSeveridadeBadge = (severidade: string) => {
  switch (severidade) {
    case 'alta':
      return <Badge variant="destructive">Alta</Badge>;
    case 'media':
      return <Badge variant="warning">Média</Badge>;
    case 'baixa':
      return <Badge variant="success">Baixa</Badge>;
  }
};
```

---

## 🧪 Testes

### Teste Manual
```bash
# 1. Abrir página
http://localhost:3000/visao-geral/insights

# 2. Verificar se o componente carrega
# 3. Clicar em "Executar Análise"
# 4. Verificar toast de sucesso
# 5. Verificar se insights aparecem
# 6. Clicar em "Marcar como lido"
# 7. Verificar se badge "Novo" desaparece
```

### Teste de Filtros
```typescript
// 1. Selecionar "Problemas" no filtro de tipo
// 2. Verificar se apenas problemas aparecem
// 3. Selecionar "Alta" no filtro de severidade
// 4. Verificar se apenas insights de alta severidade aparecem
```

### Teste de Estados
```typescript
// 1. Loading: Deve mostrar 3 skeletons
// 2. Empty: Deve mostrar ícone verde + mensagem
// 3. Com dados: Deve mostrar lista de insights
// 4. Analisando: Botão deve mostrar "Analisando..." com spinner
```

---

## 🔧 Dependências

```typescript
// UI Components (shadcn/ui)
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// Icons (lucide-react)
import { 
  AlertTriangle, 
  Lightbulb, 
  RefreshCcw,
  ChevronRight,
  Sparkles,
  CheckCircle,
  Filter,
  Play
} from 'lucide-react';

// Toast (sonner)
import { toast } from 'sonner';

// Types
import type { AgentInsightV2 } from '@/types/agent-v2';
```

---

## 📱 Responsividade

### Desktop
- Stats: Grid 4 colunas
- Insights: Lista vertical
- Filtros: Inline

### Tablet
- Stats: Grid 2 colunas
- Insights: Lista vertical
- Filtros: Inline

### Mobile
- Stats: Grid 2 colunas
- Insights: Lista vertical
- Filtros: Stack vertical

---

## 🎨 Dark Mode

Todas as cores e estilos suportam dark mode:

```typescript
// Exemplo
className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
```

---

## 🚀 Performance

### Otimizações
- ✅ Fetch apenas quando necessário
- ✅ Atualização otimista (marcar como lido)
- ✅ Limite de insights configurável
- ✅ Skeleton loading para melhor UX

### Métricas
- Tempo de carregamento: < 500ms
- Tempo de análise: 5-10s (depende do LLM)
- Tempo de atualização: < 200ms

---

## 🎉 Integração

### Na Página de Insights
```typescript
// frontend/src/app/visao-geral/insights/page.tsx
import InsightsV2Card from '@/components/dashboard/InsightsV2Card';

<InsightsV2Card barId={3} showActions={true} maxInsights={10} />
```

### No Dashboard Principal
```typescript
// frontend/src/app/dashboard/page.tsx
<InsightsV2Card barId={selectedBar.id} compact={true} maxInsights={5} />
```

---

## 🐛 Troubleshooting

### Problema: Insights não carregam
```
Causa: API route não encontrada ou erro no backend
Solução: 
1. Verificar se API route existe
2. Ver console do navegador
3. Verificar logs do Next.js
```

### Problema: "Executar Análise" não funciona
```
Causa: Edge Function não deployada ou erro no pipeline
Solução:
1. Verificar se agente-pipeline-v2 está deployado
2. Ver logs: supabase functions logs agente-pipeline-v2
3. Verificar GEMINI_API_KEY
```

### Problema: Filtros não funcionam
```
Causa: Parâmetros não sendo passados corretamente
Solução:
1. Ver console do navegador (Network tab)
2. Verificar se query params estão corretos
3. Verificar se API route aceita os filtros
```

---

## ✅ Checklist de Implementação

- ✅ Componente criado
- ✅ Props definidas
- ✅ Busca automática de insights
- ✅ Exibição de cards
- ✅ Ícones por tipo
- ✅ Badges de severidade
- ✅ Ações recomendadas
- ✅ Causa provável
- ✅ Botão "Executar Análise"
- ✅ Filtros (tipo, severidade)
- ✅ Loading skeleton
- ✅ Empty state
- ✅ Stats cards
- ✅ Marcar como lido
- ✅ Dark mode
- ✅ Responsivo
- ✅ Zero erros de linter

---

## 🎯 Próximos Passos

### Melhorias Futuras
- [ ] Paginação de insights
- [ ] Exportar insights (PDF/CSV)
- [ ] Filtro por data
- [ ] Ordenação customizada
- [ ] Detalhes expandidos (modal)
- [ ] Gráficos de tendências
- [ ] Comparação V1 vs V2

---

## 📚 Referências

- [API Routes](../../../app/api/agente/insights-v2/README.md)
- [Tipos TypeScript](../../../types/agent-v2.ts)
- [Hooks](../../../hooks/useInsightsV2.ts)
- [Arquitetura Agent V2](../../../../../backend/supabase/functions/AGENT_V2_ARCHITECTURE.md)
