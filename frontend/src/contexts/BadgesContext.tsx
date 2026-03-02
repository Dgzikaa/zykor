'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useBar } from '@/contexts/BarContext';

interface MenuBadges {
  checklist: number;
  producao: number;
  windsor: number;
  marketing: number;
  configuracoes: number;
  notifications: number;
  home: number;
  visaoGeral: number;
  relatorios: number;
  financeiro: number;
  [key: string]: number;
}

interface BadgesContextType {
  badges: MenuBadges;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  clear: () => void;
  hasAnyBadge: boolean;
  totalBadges: number;
  criticalBadges: number;
}

const BadgesContext = createContext<BadgesContextType | undefined>(undefined);

const initialBadges: MenuBadges = {
  checklist: 0,
  producao: 0,
  windsor: 0,
  marketing: 0,
  configuracoes: 0,
  notifications: 0,
  home: 0,
  visaoGeral: 0,
  relatorios: 0,
  financeiro: 0,
};

export function BadgesProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const { selectedBar } = useBar();
  const [badges, setBadges] = useState<MenuBadges>(initialBadges);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBadges = useCallback(async () => {
    if (!user?.id || !selectedBar?.id) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/configuracoes/badges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bar_id: selectedBar.id,
          user_id: user.id,
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.badges) {
        setBadges(data.badges);
      }
    } catch (error) {
      console.error('Erro ao buscar badges:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedBar?.id]);

  useEffect(() => {
    fetchBadges();

    // Atualizar a cada 5 minutos
    const interval = setInterval(fetchBadges, 300000);

    return () => clearInterval(interval);
  }, [fetchBadges]);

  const refresh = useCallback(() => {
    fetchBadges();
  }, [fetchBadges]);

  const clear = useCallback(() => {
    setBadges(initialBadges);
  }, []);

  const value: BadgesContextType = {
    badges,
    loading,
    error,
    refresh,
    clear,
    hasAnyBadge: Object.values(badges).some(count => count > 0),
    totalBadges: Object.values(badges).reduce((sum, count) => sum + count, 0),
    criticalBadges: badges.visaoGeral + badges.notifications,
  };

  return (
    <BadgesContext.Provider value={value}>
      {children}
    </BadgesContext.Provider>
  );
}

export function useBadges() {
  const context = useContext(BadgesContext);
  if (context === undefined) {
    // Retornar valores padrão ao invés de lançar erro
    return {
      badges: initialBadges,
      loading: false,
      error: null,
      refresh: () => {},
      clear: () => {},
      hasAnyBadge: false,
      totalBadges: 0,
      criticalBadges: 0,
    };
  }
  return context;
}
