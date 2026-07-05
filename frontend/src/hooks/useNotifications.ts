'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api-client';
import { getSupabaseClient } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// =====================================================
// TIPOS
// =====================================================

export type Severidade = 'info' | 'sucesso' | 'alerta' | 'critico';

export interface NotificacaoUI {
  id: string;
  bar_id: number;
  usuario_id: string;
  event_key: string;
  categoria: string;
  severidade: Severidade;
  titulo: string;
  mensagem: string;
  url: string | null;
  dados?: Record<string, unknown>;
  canais?: string[];
  lida: boolean;
  lida_em: string | null;
  criada_em: string;
}

export interface EstatisticasNotificacao {
  total: number;
  naoLidas: number;
  porCategoria: Record<string, number>;
  porSeveridade: Record<string, number>;
}

interface UseNotificationsOptions {
  /** filtra por categoria (aba da Central) */
  categoria?: string;
  /** só não lidas */
  apenasNaoLidas?: boolean;
  limit?: number;
  /** liga a assinatura realtime (default true) */
  realtime?: boolean;
  /** callback quando chega uma notificação nova via realtime (ex: tocar som/toast) */
  onNova?: (n: NotificacaoUI) => void;
}

// =====================================================
// HOOK
// =====================================================

export function useNotifications(opts: UseNotificationsOptions = {}) {
  const { categoria, apenasNaoLidas, limit = 30, realtime = true, onNova } = opts;

  const [notificacoes, setNotificacoes] = useState<NotificacaoUI[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [estatisticas, setEstatisticas] = useState<EstatisticasNotificacao | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onNovaRef = useRef(onNova);
  onNovaRef.current = onNova;

  // -------- carregar --------
  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (apenasNaoLidas) params.set('apenas_nao_lidas', 'true');
      if (categoria) params.set('categoria', categoria);
      params.set('limit', String(limit));

      const res = await api.get(`/api/configuracoes/notifications?${params.toString()}`);
      if (res?.success) {
        setNotificacoes(res.data.notificacoes ?? []);
        setNaoLidas(res.data.nao_lidas ?? 0);
        setEstatisticas(res.data.estatisticas ?? null);
      } else {
        setError(res?.error ?? 'Erro ao carregar notificações');
      }
    } catch (e) {
      setError('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  }, [apenasNaoLidas, categoria, limit]);

  // -------- ações --------
  const marcarLida = useCallback(async (id: string) => {
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === id && !n.lida ? { ...n, lida: true } : n))
    );
    setNaoLidas((c) => Math.max(0, c - 1));
    try {
      await api.put(`/api/configuracoes/notifications/${id}`, { lida: true });
    } catch {
      /* realtime/refetch corrige */
    }
  }, []);

  const marcarTodasLidas = useCallback(async () => {
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
    setNaoLidas(0);
    try {
      await api.patch('/api/configuracoes/notifications?action=mark_all_read');
    } catch {
      /* noop */
    }
  }, []);

  const excluir = useCallback(async (id: string) => {
    setNotificacoes((prev) => {
      const alvo = prev.find((n) => n.id === id);
      if (alvo && !alvo.lida) setNaoLidas((c) => Math.max(0, c - 1));
      return prev.filter((n) => n.id !== id);
    });
    try {
      await api.delete(`/api/configuracoes/notifications/${id}`);
    } catch {
      /* noop */
    }
  }, []);

  // -------- carga inicial --------
  useEffect(() => {
    carregar();
  }, [carregar]);

  // -------- realtime --------
  useEffect(() => {
    if (!realtime) return;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    (async () => {
      const supabase = await getSupabaseClient();
      if (!supabase || cancelled) return;

      const { data: userData } = await supabase.auth.getUser();
      const authId = userData?.user?.id;
      if (!authId || cancelled) return;

      channel = supabase
        .channel(`notificacoes:${authId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'system',
            table: 'notificacoes',
            filter: `usuario_id=eq.${authId}`,
          },
          (payload) => {
            const nova = payload.new as NotificacaoUI;
            // respeita filtros da aba atual
            if (categoria && nova.categoria !== categoria) {
              if (!nova.lida) setNaoLidas((c) => c + 1);
              return;
            }
            if (apenasNaoLidas && nova.lida) return;
            setNotificacoes((prev) =>
              prev.some((n) => n.id === nova.id) ? prev : [nova, ...prev]
            );
            if (!nova.lida) setNaoLidas((c) => c + 1);
            onNovaRef.current?.(nova);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'system',
            table: 'notificacoes',
            filter: `usuario_id=eq.${authId}`,
          },
          (payload) => {
            const atual = payload.new as NotificacaoUI;
            setNotificacoes((prev) => prev.map((n) => (n.id === atual.id ? atual : n)));
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'system',
            table: 'notificacoes',
            filter: `usuario_id=eq.${authId}`,
          },
          (payload) => {
            const oldId = (payload.old as { id?: string })?.id;
            if (oldId) setNotificacoes((prev) => prev.filter((n) => n.id !== oldId));
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) {
        getSupabaseClient().then((s) => s?.removeChannel(channel!)).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtime, categoria, apenasNaoLidas]);

  return {
    notificacoes,
    naoLidas,
    estatisticas,
    loading,
    error,
    carregar,
    recarregar: carregar,
    marcarLida,
    marcarTodasLidas,
    excluir,
  };
}

// =====================================================
// HELPERS DE UI
// =====================================================

export function corSeveridade(sev: Severidade): string {
  const m: Record<Severidade, string> = {
    info: 'text-blue-600 dark:text-blue-400',
    sucesso: 'text-green-600 dark:text-green-400',
    alerta: 'text-amber-600 dark:text-amber-400',
    critico: 'text-red-600 dark:text-red-400',
  };
  return m[sev] ?? m.info;
}

export function bordaSeveridade(sev: Severidade): string {
  const m: Record<Severidade, string> = {
    info: 'border-l-blue-500',
    sucesso: 'border-l-green-500',
    alerta: 'border-l-amber-500',
    critico: 'border-l-red-500',
  };
  return m[sev] ?? m.info;
}

export function emojiSeveridade(sev: Severidade): string {
  const m: Record<Severidade, string> = {
    info: 'ℹ️',
    sucesso: '✅',
    alerta: '⚠️',
    critico: '🚨',
  };
  return m[sev] ?? 'ℹ️';
}

export function formatarTempo(timestamp: string): string {
  const now = Date.now();
  const t = new Date(timestamp).getTime();
  const diff = Math.floor((now - t) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}
