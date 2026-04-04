# 💡 Exemplos Práticos - API Insights V2

## 📱 Exemplos de Uso no Frontend

### 1. Dashboard de Insights

```typescript
// app/agente-v2/page.tsx
'use client';

import { useInsightsV2 } from '@/hooks/useInsightsV2';
import { useState } from 'react';

export default function AgentV2Page() {
  const [barId] = useState(3);
  const [severidade, setSeveridade] = useState<string | undefined>();

  const { insights, stats, loading, refetch, marcarComoLido, arquivar } = useInsightsV2({
    barId,
    filters: { severidade, limit: 50 },
  });

  if (loading) return <div>Carregando insights...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          Insights Agent V2
          {stats && stats.nao_visualizados > 0 && (
            <span className="ml-2 px-2 py-1 bg-red-500 text-white rounded-full text-sm">
              {stats.nao_visualizados} novos
            </span>
          )}
        </h1>
        <button 
          onClick={refetch}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          🔄 Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 mb-6">
        <select 
          value={severidade || ''} 
          onChange={(e) => setSeveridade(e.target.value || undefined)}
          className="px-4 py-2 border rounded"
        >
          <option value="">Todas as severidades</option>
          <option value="alta">🔴 Alta</option>
          <option value="media">🟠 Média</option>
          <option value="baixa">🔵 Baixa</option>
        </select>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-gray-100 rounded">
            <div className="text-sm text-gray-600">Total</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="p-4 bg-red-100 rounded">
            <div className="text-sm text-gray-600">Problemas</div>
            <div className="text-2xl font-bold">{stats.problemas}</div>
          </div>
          <div className="p-4 bg-green-100 rounded">
            <div className="text-sm text-gray-600">Oportunidades</div>
            <div className="text-2xl font-bold">{stats.oportunidades}</div>
          </div>
          <div className="p-4 bg-orange-100 rounded">
            <div className="text-sm text-gray-600">Não Lidos</div>
            <div className="text-2xl font-bold">{stats.nao_visualizados}</div>
          </div>
        </div>
      )}

      {/* Lista de Insights */}
      <div className="space-y-4">
        {insights.map(insight => (
          <div 
            key={insight.id} 
            className={`p-4 border rounded ${!insight.visualizado ? 'bg-blue-50' : ''}`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">
                    {insight.severidade === 'alta' ? '🔴' : 
                     insight.severidade === 'media' ? '🟠' : '🔵'}
                  </span>
                  <span className="text-2xl">
                    {insight.tipo === 'problema' ? '⚠️' : '✨'}
                  </span>
                  <h3 className="text-lg font-semibold">{insight.titulo}</h3>
                  {!insight.visualizado && (
                    <span className="px-2 py-1 bg-blue-500 text-white text-xs rounded">
                      NOVO
                    </span>
                  )}
                </div>

                <p className="text-gray-700 mb-2">{insight.descricao}</p>

                {insight.causa_provavel && (
                  <div className="mb-2">
                    <strong>Causa provável:</strong> {insight.causa_provavel}
                  </div>
                )}

                {insight.acoes_recomendadas.length > 0 && (
                  <div className="mb-2">
                    <strong>Ações recomendadas:</strong>
                    <ul className="list-disc ml-6">
                      {insight.acoes_recomendadas.map((acao, i) => (
                        <li key={i}>{acao}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="text-sm text-gray-500">
                  {new Date(insight.created_at).toLocaleString('pt-BR')}
                </div>
              </div>

              <div className="flex gap-2">
                {!insight.visualizado && (
                  <button
                    onClick={() => marcarComoLido(insight.id)}
                    className="px-3 py-1 bg-green-500 text-white rounded text-sm"
                  >
                    ✓ Marcar Lido
                  </button>
                )}
                <button
                  onClick={() => arquivar(insight.id)}
                  className="px-3 py-1 bg-gray-500 text-white rounded text-sm"
                >
                  🗑️ Arquivar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 2. Botão de Análise Manual

```typescript
// components/AnalisarDiaButton.tsx
'use client';

import { useTriggerPipeline } from '@/hooks/useInsightsV2';
import { useState } from 'react';

interface Props {
  barId: number;
  data?: string;
  onSuccess?: () => void;
}

export function AnalisarDiaButton({ barId, data, onSuccess }: Props) {
  const { trigger, loading, error } = useTriggerPipeline();

  async function handleAnalisar() {
    const result = await trigger(barId, data);

    if (result) {
      const insightsGerados = result.pipeline.narrator?.insights_gerados || 0;
      const eventosDetectados = result.pipeline.detector.eventos_detectados;

      alert(`✅ Análise concluída!\n\n` +
            `📊 ${eventosDetectados} eventos detectados\n` +
            `💡 ${insightsGerados} insights gerados`);

      onSuccess?.();
    } else {
      alert(`❌ Erro ao analisar: ${error}`);
    }
  }

  return (
    <div>
      <button
        onClick={handleAnalisar}
        disabled={loading}
        className={`px-4 py-2 rounded ${
          loading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-500 hover:bg-blue-600'
        } text-white`}
      >
        {loading ? '⏳ Analisando...' : '🔍 Analisar Dia'}
      </button>
      {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
    </div>
  );
}
```

---

### 3. Lista de Eventos Detectados

```typescript
// components/EventosTimeline.tsx
'use client';

import { useInsightEvents } from '@/hooks/useInsightsV2';
import { formatEventType, getSeveridadeIcon } from '@/types/agent-v2';

interface Props {
  barId: number;
  data?: string;
}

export function EventosTimeline({ barId, data }: Props) {
  const { eventos, stats, loading, error } = useInsightEvents(barId, data);

  if (loading) return <div>Carregando eventos...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Eventos Detectados</h2>
        {stats && (
          <div className="text-sm text-gray-600">
            {stats.nao_processados} não processados de {stats.total} total
          </div>
        )}
      </div>

      {/* Stats por Tipo */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {Object.entries(stats.por_tipo).map(([tipo, count]) => (
            <div key={tipo} className="p-2 bg-gray-100 rounded text-sm">
              <div className="font-semibold">{formatEventType(tipo as any)}</div>
              <div className="text-gray-600">{count} eventos</div>
            </div>
          ))}
        </div>
      )}

      {/* Lista de Eventos */}
      <div className="space-y-2">
        {eventos.map(evento => (
          <div 
            key={evento.id} 
            className={`p-3 border rounded ${
              !evento.processed ? 'bg-yellow-50 border-yellow-300' : 'bg-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">{getSeveridadeIcon(evento.severity)}</span>
              <div className="flex-1">
                <div className="font-semibold">
                  {formatEventType(evento.event_type)}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {evento.evidence_json.map((evidence, i) => (
                    <div key={i}>• {evidence}</div>
                  ))}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {new Date(evento.created_at).toLocaleString('pt-BR')}
                  {!evento.processed && (
                    <span className="ml-2 px-2 py-0.5 bg-yellow-300 rounded">
                      Aguardando processamento
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 4. Card de Insight Individual

```typescript
// components/InsightCardV2.tsx
'use client';

import { AgentInsightV2 } from '@/types/agent-v2';
import { getSeveridadeIcon, getTipoIcon } from '@/types/agent-v2';

interface Props {
  insight: AgentInsightV2;
  onMarcarLido: () => void;
  onArquivar: () => void;
}

export function InsightCardV2({ insight, onMarcarLido, onArquivar }: Props) {
  return (
    <div className={`p-4 border rounded-lg ${
      !insight.visualizado ? 'bg-blue-50 border-blue-300' : 'bg-white'
    }`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getSeveridadeIcon(insight.severidade)}</span>
          <span className="text-2xl">{getTipoIcon(insight.tipo)}</span>
          <h3 className="text-lg font-bold">{insight.titulo}</h3>
          {!insight.visualizado && (
            <span className="px-2 py-1 bg-blue-500 text-white text-xs rounded">
              NOVO
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {!insight.visualizado && (
            <button
              onClick={onMarcarLido}
              className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
            >
              ✓ Marcar Lido
            </button>
          )}
          <button
            onClick={onArquivar}
            className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
          >
            🗑️ Arquivar
          </button>
        </div>
      </div>

      {/* Descrição */}
      <p className="text-gray-700 mb-3">{insight.descricao}</p>

      {/* Causa Provável */}
      {insight.causa_provavel && (
        <div className="mb-3 p-3 bg-yellow-50 rounded">
          <div className="font-semibold text-sm mb-1">🔍 Causa Provável:</div>
          <div className="text-sm">{insight.causa_provavel}</div>
        </div>
      )}

      {/* Ações Recomendadas */}
      {insight.acoes_recomendadas.length > 0 && (
        <div className="mb-3 p-3 bg-green-50 rounded">
          <div className="font-semibold text-sm mb-2">✅ Ações Recomendadas:</div>
          <ul className="list-disc ml-5 space-y-1">
            {insight.acoes_recomendadas.map((acao, i) => (
              <li key={i} className="text-sm">{acao}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Resumo Geral */}
      {insight.resumo_geral && (
        <div className="mb-3 p-3 bg-gray-50 rounded">
          <div className="font-semibold text-sm mb-1">📝 Resumo:</div>
          <div className="text-sm text-gray-600">{insight.resumo_geral}</div>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center text-xs text-gray-500 mt-3 pt-3 border-t">
        <div>
          {new Date(insight.created_at).toLocaleString('pt-BR')}
        </div>
        <div>
          {insight.eventos_relacionados.length} eventos relacionados
        </div>
      </div>
    </div>
  );
}
```

---

### 5. Filtros Avançados

```typescript
// components/InsightsFilters.tsx
'use client';

import { useState } from 'react';

interface Props {
  onFilterChange: (filters: any) => void;
}

export function InsightsFilters({ onFilterChange }: Props) {
  const [severidade, setSeveridade] = useState<string>('');
  const [tipo, setTipo] = useState<string>('');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');

  function aplicarFiltros() {
    onFilterChange({
      severidade: severidade || undefined,
      tipo: tipo || undefined,
      data_inicio: dataInicio || undefined,
      data_fim: dataFim || undefined,
    });
  }

  function limparFiltros() {
    setSeveridade('');
    setTipo('');
    setDataInicio('');
    setDataFim('');
    onFilterChange({});
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg space-y-4">
      <h3 className="font-semibold">Filtros</h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Severidade */}
        <div>
          <label className="block text-sm font-medium mb-1">Severidade</label>
          <select 
            value={severidade} 
            onChange={(e) => setSeveridade(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">Todas</option>
            <option value="alta">🔴 Alta</option>
            <option value="media">🟠 Média</option>
            <option value="baixa">🔵 Baixa</option>
          </select>
        </div>

        {/* Tipo */}
        <div>
          <label className="block text-sm font-medium mb-1">Tipo</label>
          <select 
            value={tipo} 
            onChange={(e) => setTipo(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">Todos</option>
            <option value="problema">⚠️ Problema</option>
            <option value="oportunidade">✨ Oportunidade</option>
          </select>
        </div>

        {/* Data Início */}
        <div>
          <label className="block text-sm font-medium mb-1">Data Início</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        {/* Data Fim */}
        <div>
          <label className="block text-sm font-medium mb-1">Data Fim</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={aplicarFiltros}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          🔍 Aplicar Filtros
        </button>
        <button
          onClick={limparFiltros}
          className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
        >
          🔄 Limpar
        </button>
      </div>
    </div>
  );
}
```

---

### 6. Widget de Notificações

```typescript
// components/InsightsNotificationWidget.tsx
'use client';

import { useInsightsV2 } from '@/hooks/useInsightsV2';
import { useEffect, useState } from 'react';

interface Props {
  barId: number;
}

export function InsightsNotificationWidget({ barId }: Props) {
  const { insights, stats, loading } = useInsightsV2({
    barId,
    filters: { severidade: 'alta', limit: 5 },
  });

  const [showDropdown, setShowDropdown] = useState(false);

  if (loading) return null;

  const naoVistos = stats?.nao_visualizados || 0;

  return (
    <div className="relative">
      {/* Badge */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 hover:bg-gray-100 rounded"
      >
        <span className="text-2xl">🔔</span>
        {naoVistos > 0 && (
          <span className="absolute top-0 right-0 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
            {naoVistos}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-96 bg-white border rounded-lg shadow-lg z-50">
          <div className="p-4 border-b">
            <h3 className="font-bold">Insights Críticos</h3>
            <div className="text-sm text-gray-600">
              {naoVistos} não visualizados
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {insights.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                Nenhum insight crítico
              </div>
            ) : (
              insights.map(insight => (
                <div 
                  key={insight.id} 
                  className={`p-3 border-b hover:bg-gray-50 cursor-pointer ${
                    !insight.visualizado ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">🔴</span>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{insight.titulo}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        {insight.descricao.substring(0, 100)}...
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(insight.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t">
            <a 
              href="/agente-v2" 
              className="text-sm text-blue-500 hover:underline"
            >
              Ver todos os insights →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### 7. Análise Retroativa

```typescript
// components/AnalisarPeriodoButton.tsx
'use client';

import { useTriggerPipeline } from '@/hooks/useInsightsV2';
import { useState } from 'react';

interface Props {
  barId: number;
}

export function AnalisarPeriodoButton({ barId }: Props) {
  const { trigger, loading } = useTriggerPipeline();
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [progresso, setProgresso] = useState(0);
  const [total, setTotal] = useState(0);

  async function analisarPeriodo() {
    if (!dataInicio || !dataFim) {
      alert('Selecione data início e fim');
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

    let insightsTotal = 0;

    for (let i = 0; i < dias.length; i++) {
      const data = dias[i];
      const result = await trigger(barId, data);
      
      if (result) {
        insightsTotal += result.pipeline.narrator?.insights_gerados || 0;
      }

      setProgresso(i + 1);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    alert(`✅ Análise retroativa concluída!\n\n` +
          `📅 ${dias.length} dias analisados\n` +
          `💡 ${insightsTotal} insights gerados`);

    setProgresso(0);
    setTotal(0);
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <h3 className="font-semibold mb-3">Análise Retroativa</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Data Início</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Data Fim</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        <button
          onClick={analisarPeriodo}
          disabled={loading || !dataInicio || !dataFim}
          className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-400"
        >
          {loading ? `⏳ Analisando ${progresso}/${total}...` : '📊 Analisar Período'}
        </button>

        {loading && total > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-purple-500 h-2 rounded-full transition-all"
              style={{ width: `${(progresso / total) * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### 8. Comparação V1 vs V2

```typescript
// components/InsightsComparison.tsx
'use client';

import { useInsightsV2 } from '@/hooks/useInsightsV2';
import { useState, useEffect } from 'react';

interface Props {
  barId: number;
  data: string;
}

export function InsightsComparison({ barId, data }: Props) {
  const [insightsV1, setInsightsV1] = useState<any[]>([]);
  const { insights: insightsV2, loading } = useInsightsV2({
    barId,
    filters: { data_inicio: data, data_fim: data },
  });

  useEffect(() => {
    async function fetchV1() {
      const response = await fetch(
        `/api/agente/insights?bar_id=${barId}&limite=50`
      );
      const result = await response.json();
      if (result.success) {
        const filtered = result.data.insights.filter((i: any) => 
          i.data_referencia?.startsWith(data)
        );
        setInsightsV1(filtered);
      }
    }
    fetchV1();
  }, [barId, data]);

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* V1 */}
      <div>
        <h3 className="text-lg font-bold mb-4">Agent V1 (Monolítico)</h3>
        <div className="space-y-2">
          {insightsV1.map(insight => (
            <div key={insight.id} className="p-3 border rounded bg-gray-50">
              <div className="font-semibold">{insight.titulo}</div>
              <div className="text-sm text-gray-600">{insight.descricao}</div>
            </div>
          ))}
          {insightsV1.length === 0 && (
            <div className="text-gray-500 text-center">Nenhum insight V1</div>
          )}
        </div>
      </div>

      {/* V2 */}
      <div>
        <h3 className="text-lg font-bold mb-4">Agent V2 (Modular)</h3>
        <div className="space-y-2">
          {insightsV2.map(insight => (
            <div key={insight.id} className="p-3 border rounded bg-blue-50">
              <div className="flex items-center gap-2 mb-1">
                <span>{insight.severidade === 'alta' ? '🔴' : '🟠'}</span>
                <span className="font-semibold">{insight.titulo}</span>
              </div>
              <div className="text-sm text-gray-600">{insight.descricao}</div>
              {insight.acoes_recomendadas.length > 0 && (
                <div className="mt-2 text-xs text-green-700">
                  ✅ {insight.acoes_recomendadas.length} ações recomendadas
                </div>
              )}
            </div>
          ))}
          {insightsV2.length === 0 && (
            <div className="text-gray-500 text-center">Nenhum insight V2</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

### 9. Dashboard Completo

```typescript
// app/agente-v2/page.tsx
'use client';

import { useInsightsV2, useTriggerPipeline } from '@/hooks/useInsightsV2';
import { InsightCardV2 } from '@/components/InsightCardV2';
import { EventosTimeline } from '@/components/EventosTimeline';
import { InsightsFilters } from '@/components/InsightsFilters';
import { AnalisarDiaButton } from '@/components/AnalisarDiaButton';
import { sortInsightsByPriority } from '@/types/agent-v2';
import { useState } from 'react';

export default function AgentV2Dashboard() {
  const [barId] = useState(3);
  const [filters, setFilters] = useState({});
  const [showEventos, setShowEventos] = useState(false);

  const { 
    insights, 
    stats, 
    loading, 
    refetch,
    marcarComoLido,
    arquivar 
  } = useInsightsV2({
    barId,
    filters,
  });

  const insightsOrdenados = sortInsightsByPriority(insights);

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Agent V2 - Insights Inteligentes</h1>
          <p className="text-gray-600">Sistema modular de detecção e análise</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowEventos(!showEventos)}
            className="px-4 py-2 bg-gray-500 text-white rounded"
          >
            {showEventos ? '📊 Ver Insights' : '🔍 Ver Eventos'}
          </button>
          <AnalisarDiaButton 
            barId={barId} 
            onSuccess={refetch}
          />
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="p-4 bg-white border rounded-lg">
            <div className="text-sm text-gray-600">Total</div>
            <div className="text-3xl font-bold">{stats.total}</div>
          </div>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-gray-600">Não Lidos</div>
            <div className="text-3xl font-bold text-blue-600">
              {stats.nao_visualizados}
            </div>
          </div>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm text-gray-600">Problemas</div>
            <div className="text-3xl font-bold text-red-600">
              {stats.problemas}
            </div>
          </div>
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm text-gray-600">Oportunidades</div>
            <div className="text-3xl font-bold text-green-600">
              {stats.oportunidades}
            </div>
          </div>
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="text-sm text-gray-600">Críticos</div>
            <div className="text-3xl font-bold text-orange-600">
              {stats.por_severidade.alta}
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-6">
        <InsightsFilters onFilterChange={setFilters} />
      </div>

      {/* Conteúdo Principal */}
      {showEventos ? (
        <EventosTimeline barId={barId} />
      ) : (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">Carregando insights...</div>
          ) : insightsOrdenados.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Nenhum insight encontrado
            </div>
          ) : (
            insightsOrdenados.map(insight => (
              <InsightCardV2
                key={insight.id}
                insight={insight}
                onMarcarLido={() => marcarComoLido(insight.id)}
                onArquivar={() => arquivar(insight.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 🔧 Utilitários

### Fetch Wrapper com Type-Safety

```typescript
// lib/api/insights-v2.ts
import type { 
  GetInsightsParams, 
  InsightsV2Response,
  TriggerPipelineParams,
  PipelineResponse,
  UpdateInsightParams
} from '@/types/agent-v2';

export async function fetchInsights(
  params: GetInsightsParams
): Promise<InsightsV2Response> {
  const searchParams = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined)
    ) as any
  );

  const response = await fetch(`/api/agente/insights-v2?${searchParams}`);
  return response.json();
}

export async function fetchEvents(barId: number, data?: string) {
  const params = new URLSearchParams({ bar_id: barId.toString() });
  if (data) params.append('data', data);

  const response = await fetch(`/api/agente/insights-v2/events?${params}`);
  return response.json();
}

export async function triggerPipeline(
  params: TriggerPipelineParams
): Promise<PipelineResponse> {
  const response = await fetch('/api/agente/insights-v2/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return response.json();
}

export async function updateInsight(params: UpdateInsightParams) {
  const response = await fetch('/api/agente/insights-v2', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return response.json();
}
```

---

## 📊 Monitoramento

### Logs Estruturados

```typescript
// Todas as APIs logam operações importantes
console.log('🎭 [API] Disparando pipeline v2 para bar_id=3');
console.log('✅ [API] Pipeline v2 concluído: 2 insights gerados');
console.error('❌ [API] Erro na Edge Function:', error);
```

### Queries de Monitoramento

```sql
-- Insights gerados hoje
SELECT COUNT(*) FROM agent_insights_v2 
WHERE created_at::date = CURRENT_DATE;

-- Taxa de conversão (eventos → insights)
SELECT 
  COUNT(DISTINCT ie.id) as eventos,
  COUNT(DISTINCT ai.id) as insights,
  ROUND(COUNT(DISTINCT ai.id)::numeric / NULLIF(COUNT(DISTINCT ie.id), 0) * 100, 1) as taxa_conversao
FROM insight_events ie
LEFT JOIN agent_insights_v2 ai ON ai.data = ie.data AND ai.bar_id = ie.bar_id
WHERE ie.created_at::date = CURRENT_DATE;

-- Insights não visualizados
SELECT bar_id, COUNT(*) 
FROM agent_insights_v2 
WHERE visualizado = false 
GROUP BY bar_id;
```

---

## ✅ Checklist de Implementação

- ✅ GET `/api/agente/insights-v2` (buscar insights)
- ✅ GET `/api/agente/insights-v2/events` (buscar eventos)
- ✅ POST `/api/agente/insights-v2/trigger` (disparar pipeline)
- ✅ PUT `/api/agente/insights-v2` (atualizar status)
- ✅ Tipos TypeScript completos
- ✅ Hooks React customizados
- ✅ Helpers e utilitários
- ✅ Documentação completa
- ✅ Exemplos de uso
- ✅ Testes manuais

---

## 🎯 Próximos Passos

### Prompt 6: Criar Frontend (Dashboard)
1. Criar página `/agente-v2`
2. Implementar componentes visuais
3. Integrar com APIs criadas
4. Adicionar filtros interativos
5. Sistema de notificações in-app

### Melhorias Futuras
- [ ] Cache de insights (React Query)
- [ ] Paginação infinita
- [ ] Exportar insights (PDF/CSV)
- [ ] Gráficos de tendências
- [ ] Comparação V1 vs V2 no dashboard
