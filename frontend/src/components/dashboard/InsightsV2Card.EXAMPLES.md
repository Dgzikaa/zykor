# 💡 Exemplos - InsightsV2Card

## 📱 Exemplos de Uso

### 1. Uso Básico no Dashboard

```typescript
// app/dashboard/page.tsx
import InsightsV2Card from '@/components/dashboard/InsightsV2Card';

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <InsightsV2Card barId={3} />
    </div>
  );
}
```

---

### 2. Modo Compacto na Sidebar

```typescript
// components/layout/Sidebar.tsx
import InsightsV2Card from '@/components/dashboard/InsightsV2Card';

export function Sidebar() {
  return (
    <aside className="w-64 p-4">
      <InsightsV2Card 
        barId={3} 
        compact={true} 
        maxInsights={5}
        showActions={false}
      />
    </aside>
  );
}
```

---

### 3. Página Dedicada de Insights

```typescript
// app/agente-v2/page.tsx
import InsightsV2Card from '@/components/dashboard/InsightsV2Card';

export default function AgentV2Page() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Agent V2 - Insights</h1>
      
      <InsightsV2Card 
        barId={3} 
        showActions={true}
        maxInsights={50}
        className="shadow-lg"
      />
    </div>
  );
}
```

---

### 4. Grid com Múltiplos Bares

```typescript
// app/insights-comparacao/page.tsx
import InsightsV2Card from '@/components/dashboard/InsightsV2Card';

export default function ComparacaoPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
      <div>
        <h2 className="text-xl font-bold mb-4">Zykor Pub</h2>
        <InsightsV2Card barId={3} maxInsights={10} />
      </div>
      
      <div>
        <h2 className="text-xl font-bold mb-4">Zykor Club</h2>
        <InsightsV2Card barId={4} maxInsights={10} />
      </div>
    </div>
  );
}
```

---

### 5. Com Seletor de Bar Dinâmico

```typescript
// app/insights-dinamico/page.tsx
'use client';

import { useState } from 'react';
import InsightsV2Card from '@/components/dashboard/InsightsV2Card';

export default function InsightsDinamicoPage() {
  const [barId, setBarId] = useState(3);

  return (
    <div className="p-6">
      <div className="mb-4">
        <select 
          value={barId} 
          onChange={(e) => setBarId(Number(e.target.value))}
          className="px-4 py-2 border rounded"
        >
          <option value={3}>Zykor Pub</option>
          <option value={4}>Zykor Club</option>
        </select>
      </div>

      <InsightsV2Card barId={barId} />
    </div>
  );
}
```

---

### 6. Widget de Notificações

```typescript
// components/layout/NotificationWidget.tsx
'use client';

import { useState } from 'react';
import InsightsV2Card from '@/components/dashboard/InsightsV2Card';
import { Bell } from 'lucide-react';

export function NotificationWidget() {
  const [showInsights, setShowInsights] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setShowInsights(!showInsights)}
        className="p-2 hover:bg-gray-100 rounded"
      >
        <Bell className="w-5 h-5" />
      </button>

      {showInsights && (
        <div className="absolute right-0 top-12 w-96 z-50">
          <InsightsV2Card 
            barId={3} 
            compact={true}
            maxInsights={5}
            showActions={false}
          />
        </div>
      )}
    </div>
  );
}
```

---

### 7. Tabs com V1 e V2

```typescript
// app/insights-comparacao-v1-v2/page.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InsightsCard from '@/components/dashboard/InsightsCard';
import InsightsV2Card from '@/components/dashboard/InsightsV2Card';

export default function ComparacaoV1V2Page() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Comparação V1 vs V2</h1>
      
      <Tabs defaultValue="v2">
        <TabsList>
          <TabsTrigger value="v1">Agent V1 (Monolítico)</TabsTrigger>
          <TabsTrigger value="v2">Agent V2 (Modular)</TabsTrigger>
        </TabsList>

        <TabsContent value="v1">
          <InsightsCard />
        </TabsContent>

        <TabsContent value="v2">
          <InsightsV2Card barId={3} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

### 8. Dashboard com Auto-Refresh

```typescript
// app/insights-live/page.tsx
'use client';

import { useEffect, useState } from 'react';
import InsightsV2Card from '@/components/dashboard/InsightsV2Card';

export default function InsightsLivePage() {
  const [key, setKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setKey(prev => prev + 1);
    }, 60000); // Atualizar a cada 1 minuto

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        Insights em Tempo Real
        <span className="text-sm text-gray-500 ml-2">
          (atualiza a cada 1 min)
        </span>
      </h1>
      
      <InsightsV2Card key={key} barId={3} />
    </div>
  );
}
```

---

### 9. Com Filtros Externos

```typescript
// app/insights-filtros-externos/page.tsx
'use client';

import { useState } from 'react';
import InsightsV2Card from '@/components/dashboard/InsightsV2Card';

export default function InsightsFiltrosPage() {
  const [barId, setBarId] = useState(3);
  const [maxInsights, setMaxInsights] = useState(10);

  return (
    <div className="p-6">
      <div className="flex gap-4 mb-6">
        <select 
          value={barId} 
          onChange={(e) => setBarId(Number(e.target.value))}
          className="px-4 py-2 border rounded"
        >
          <option value={3}>Zykor Pub</option>
          <option value={4}>Zykor Club</option>
        </select>

        <select 
          value={maxInsights} 
          onChange={(e) => setMaxInsights(Number(e.target.value))}
          className="px-4 py-2 border rounded"
        >
          <option value={5}>5 insights</option>
          <option value={10}>10 insights</option>
          <option value={20}>20 insights</option>
          <option value={50}>50 insights</option>
        </select>
      </div>

      <InsightsV2Card barId={barId} maxInsights={maxInsights} />
    </div>
  );
}
```

---

### 10. Modal de Detalhes

```typescript
// components/InsightDetailModal.tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AgentInsightV2 } from '@/types/agent-v2';

interface Props {
  insight: AgentInsightV2;
  open: boolean;
  onClose: () => void;
}

export function InsightDetailModal({ insight, open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{insight.titulo}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Descrição</h3>
            <p className="text-gray-700">{insight.descricao}</p>
          </div>

          {insight.causa_provavel && (
            <div>
              <h3 className="font-semibold mb-2">Causa Provável</h3>
              <p className="text-gray-700">{insight.causa_provavel}</p>
            </div>
          )}

          {insight.acoes_recomendadas.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Ações Recomendadas</h3>
              <ul className="list-disc ml-6 space-y-1">
                {insight.acoes_recomendadas.map((acao, i) => (
                  <li key={i}>{acao}</li>
                ))}
              </ul>
            </div>
          )}

          {insight.resumo_geral && (
            <div>
              <h3 className="font-semibold mb-2">Resumo Geral</h3>
              <p className="text-gray-700">{insight.resumo_geral}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Uso com InsightsV2Card
export default function InsightsComModalPage() {
  const [selectedInsight, setSelectedInsight] = useState<AgentInsightV2 | null>(null);

  return (
    <div className="p-6">
      <InsightsV2Card barId={3} />
      
      {selectedInsight && (
        <InsightDetailModal 
          insight={selectedInsight}
          open={!!selectedInsight}
          onClose={() => setSelectedInsight(null)}
        />
      )}
    </div>
  );
}
```

---

### 11. Com Paginação

```typescript
// app/insights-paginado/page.tsx
'use client';

import { useState } from 'react';
import InsightsV2Card from '@/components/dashboard/InsightsV2Card';
import { Button } from '@/components/ui/button';

export default function InsightsPaginadoPage() {
  const [page, setPage] = useState(1);
  const limit = 10;

  return (
    <div className="p-6">
      <InsightsV2Card 
        barId={3} 
        maxInsights={limit}
      />

      <div className="flex justify-center gap-4 mt-6">
        <Button 
          onClick={() => setPage(prev => Math.max(1, prev - 1))}
          disabled={page === 1}
        >
          ← Anterior
        </Button>
        
        <span className="px-4 py-2">Página {page}</span>
        
        <Button onClick={() => setPage(prev => prev + 1)}>
          Próxima →
        </Button>
      </div>
    </div>
  );
}
```

---

### 12. Com Exportação

```typescript
// components/InsightsV2WithExport.tsx
'use client';

import { useState, useEffect } from 'react';
import InsightsV2Card from '@/components/dashboard/InsightsV2Card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export function InsightsV2WithExport({ barId }: { barId: number }) {
  const [insights, setInsights] = useState([]);

  const exportarCSV = () => {
    const csv = [
      'Data,Título,Tipo,Severidade,Descrição',
      ...insights.map(i => 
        `${i.data},"${i.titulo}",${i.tipo},${i.severidade},"${i.descricao}"`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insights-v2-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={exportarCSV} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      <InsightsV2Card barId={barId} />
    </div>
  );
}
```

---

### 13. Com Gráfico de Tendências

```typescript
// app/insights-com-grafico/page.tsx
'use client';

import { useState, useEffect } from 'react';
import InsightsV2Card from '@/components/dashboard/InsightsV2Card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function InsightsComGraficoPage() {
  const [stats, setStats] = useState([]);

  useEffect(() => {
    async function fetchStats() {
      const response = await fetch('/api/agente/insights-v2?bar_id=3');
      const data = await response.json();
      
      if (data.success) {
        setStats([
          { name: 'Alta', value: data.stats.por_severidade.alta },
          { name: 'Média', value: data.stats.por_severidade.media },
          { name: 'Baixa', value: data.stats.por_severidade.baixa },
        ]);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Gráfico */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Severidade</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Insights */}
      <InsightsV2Card barId={3} />
    </div>
  );
}
```

---

### 14. Com Filtros Avançados Externos

```typescript
// app/insights-filtros-avancados/page.tsx
'use client';

import { useState } from 'react';
import InsightsV2Card from '@/components/dashboard/InsightsV2Card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function InsightsFiltrosAvancadosPage() {
  const [filtros, setFiltros] = useState({
    tipo: '',
    severidade: '',
    dataInicio: '',
    dataFim: '',
  });

  return (
    <div className="p-6 space-y-6">
      {/* Filtros Avançados */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Tipo</label>
              <select 
                value={filtros.tipo}
                onChange={(e) => setFiltros(prev => ({ ...prev, tipo: e.target.value }))}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">Todos</option>
                <option value="problema">Problemas</option>
                <option value="oportunidade">Oportunidades</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Severidade</label>
              <select 
                value={filtros.severidade}
                onChange={(e) => setFiltros(prev => ({ ...prev, severidade: e.target.value }))}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">Todas</option>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Data Início</label>
              <input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => setFiltros(prev => ({ ...prev, dataInicio: e.target.value }))}
                className="w-full px-3 py-2 border rounded"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Data Fim</label>
              <input
                type="date"
                value={filtros.dataFim}
                onChange={(e) => setFiltros(prev => ({ ...prev, dataFim: e.target.value }))}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={() => setFiltros({ tipo: '', severidade: '', dataInicio: '', dataFim: '' })}>
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <InsightsV2Card barId={3} />
    </div>
  );
}
```

---

### 15. Com Análise Retroativa

```typescript
// components/AnalisarPeriodoButton.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
  barId: number;
  onComplete: () => void;
}

export function AnalisarPeriodoButton({ barId, onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [progresso, setProgresso] = useState(0);
  const [total, setTotal] = useState(0);

  async function analisarPeriodo() {
    if (!dataInicio || !dataFim) {
      toast.error('Selecione data início e fim');
      return;
    }

    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    const dias: string[] = [];

    for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
      dias.push(d.toISOString().split('T')[0]);
    }

    setTotal(dias.length);
    setProgresso(0);
    setLoading(true);

    let insightsTotal = 0;

    for (let i = 0; i < dias.length; i++) {
      const data = dias[i];
      
      const response = await fetch('/api/agente/insights-v2/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: barId, data }),
      });

      const result = await response.json();
      
      if (result.success) {
        insightsTotal += result.pipeline?.narrator?.insights_gerados || 0;
      }

      setProgresso(i + 1);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setLoading(false);
    toast.success(`✅ ${insightsTotal} insights gerados em ${dias.length} dias`);
    onComplete();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          className="px-3 py-2 border rounded"
        />
        <input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          className="px-3 py-2 border rounded"
        />
      </div>

      <Button 
        onClick={analisarPeriodo}
        disabled={loading || !dataInicio || !dataFim}
        className="w-full"
      >
        {loading ? `Analisando ${progresso}/${total}...` : 'Analisar Período'}
      </Button>

      {loading && total > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${(progresso / total) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

// Uso
export default function InsightsComRetroativoPage() {
  const [refresh, setRefresh] = useState(0);

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Análise Retroativa</CardTitle>
        </CardHeader>
        <CardContent>
          <AnalisarPeriodoButton 
            barId={3}
            onComplete={() => setRefresh(prev => prev + 1)}
          />
        </CardContent>
      </Card>

      <InsightsV2Card key={refresh} barId={3} />
    </div>
  );
}
```

---

## 🎨 Customização de Estilos

### Cores Customizadas
```typescript
<InsightsV2Card 
  barId={3}
  className="border-purple-300 bg-purple-50"
/>
```

### Tamanho Customizado
```typescript
<InsightsV2Card 
  barId={3}
  className="max-w-2xl mx-auto"
/>
```

### Sombra Customizada
```typescript
<InsightsV2Card 
  barId={3}
  className="shadow-2xl"
/>
```

---

## 🔧 Troubleshooting

### Problema: Componente não renderiza
```
Solução: Verificar se barId é válido e se API route existe
```

### Problema: Filtros não funcionam
```
Solução: Verificar se API route aceita os parâmetros de filtro
```

### Problema: "Executar Análise" não funciona
```
Solução: Verificar se Edge Function está deployada
```

---

## 📚 Referências

- [Componente Principal](./InsightsV2Card.tsx)
- [README](./InsightsV2Card.README.md)
- [Testes](./InsightsV2Card.test.tsx)
- [API Routes](../../app/api/agente/insights-v2/README.md)
