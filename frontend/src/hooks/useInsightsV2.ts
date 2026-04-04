/**
 * 🪝 Hook - useInsightsV2
 * 
 * Hook customizado para consumir insights do Agent V2
 */

import { useState, useEffect, useCallback } from 'react';
import type { 
  AgentInsightV2, 
  InsightEvent,
  InsightsV2Response,
  GetInsightsParams,
  UpdateInsightParams 
} from '@/types/agent-v2';

interface UseInsightsV2Options {
  barId: number;
  autoFetch?: boolean;
  filters?: Omit<GetInsightsParams, 'bar_id'>;
}

export function useInsightsV2(options: UseInsightsV2Options) {
  const { barId, autoFetch = true, filters = {} } = options;

  const [insights, setInsights] = useState<AgentInsightV2[]>([]);
  const [stats, setStats] = useState<InsightsV2Response['stats'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        bar_id: barId.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== undefined)
        ),
      });

      const response = await fetch(`/api/agente/insights-v2?${params}`);
      const data = await response.json();

      if (data.success) {
        setInsights(data.insights);
        setStats(data.stats);
      } else {
        setError(data.error || 'Erro ao buscar insights');
      }
    } catch (err) {
      setError('Erro ao buscar insights');
      console.error('Erro ao buscar insights:', err);
    } finally {
      setLoading(false);
    }
  }, [barId, filters]);

  const marcarComoLido = useCallback(async (insightId: string) => {
    try {
      const response = await fetch('/api/agente/insights-v2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: insightId, visualizado: true }),
      });

      const data = await response.json();

      if (data.success) {
        setInsights(prev =>
          prev.map(i => (i.id === insightId ? { ...i, visualizado: true } : i))
        );
        return true;
      }
      return false;
    } catch (err) {
      console.error('Erro ao marcar como lido:', err);
      return false;
    }
  }, []);

  const arquivar = useCallback(async (insightId: string) => {
    try {
      const response = await fetch('/api/agente/insights-v2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: insightId, arquivado: true }),
      });

      const data = await response.json();

      if (data.success) {
        setInsights(prev => prev.filter(i => i.id !== insightId));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Erro ao arquivar:', err);
      return false;
    }
  }, []);

  const atualizar = useCallback(async (params: UpdateInsightParams) => {
    try {
      const response = await fetch('/api/agente/insights-v2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (data.success) {
        setInsights(prev =>
          prev.map(i => (i.id === params.id ? { ...i, ...params } : i))
        );
        return true;
      }
      return false;
    } catch (err) {
      console.error('Erro ao atualizar insight:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchInsights();
    }
  }, [autoFetch, fetchInsights]);

  return {
    insights,
    stats,
    loading,
    error,
    refetch: fetchInsights,
    marcarComoLido,
    arquivar,
    atualizar,
  };
}

// ============================================================
// HOOK PARA DISPARAR PIPELINE
// ============================================================

export function useTriggerPipeline() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trigger = useCallback(async (barId: number, data?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/agente/insights-v2/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: barId, data }),
      });

      const result = await response.json();

      if (result.success) {
        return result;
      } else {
        setError(result.error || 'Erro ao disparar pipeline');
        return null;
      }
    } catch (err) {
      setError('Erro ao disparar pipeline');
      console.error('Erro ao disparar pipeline:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { trigger, loading, error };
}

// ============================================================
// HOOK PARA BUSCAR EVENTOS
// ============================================================

export function useInsightEvents(barId: number, data?: string) {
  const [eventos, setEventos] = useState<InsightEvent[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEventos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ bar_id: barId.toString() });
      if (data) params.append('data', data);

      const response = await fetch(`/api/agente/insights-v2/events?${params}`);
      const result = await response.json();

      if (result.success) {
        setEventos(result.eventos);
        setStats(result.stats);
      } else {
        setError(result.error || 'Erro ao buscar eventos');
      }
    } catch (err) {
      setError('Erro ao buscar eventos');
      console.error('Erro ao buscar eventos:', err);
    } finally {
      setLoading(false);
    }
  }, [barId, data]);

  useEffect(() => {
    fetchEventos();
  }, [fetchEventos]);

  return { eventos, stats, loading, error, refetch: fetchEventos };
}
