'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

interface Bar {
  id: number;
  nome: string;
  slug?: string;
  ativo?: boolean;
}

export function useBar() {
  const [bar, setBar] = useState<Bar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchBar() {
      if (!user?.bar_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/configuracoes/bars/user-bars');
        
        if (!response.ok) {
          throw new Error('Erro ao buscar informações do bar');
        }

        const json = await response.json();

        // A rota foi refatorada (commit 93ead5a2) para o envelope padrão
        // success({ bars, userData }) -> { success: true, data: { bars, userData } }.
        // Mantemos fallback para o shape antigo (json.bars) por segurança.
        if (json.success === false) {
          setError(json.error || 'Erro ao carregar bares do usuário');
          return;
        }

        const bars: Bar[] | undefined = json?.data?.bars ?? json?.bars;

        if (bars && bars.length > 0) {
          // Encontrar o bar do usuário
          const userBar = bars.find((b: Bar) => b.id === user.bar_id) || bars[0];
          setBar(userBar);
        } else {
          setError('Nenhum bar encontrado');
        }
      } catch (err) {
        console.error('Erro ao buscar bar:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    }

    fetchBar();
  }, [user?.bar_id]);

  return {
    bar,
    selectedBar: bar, // Alias para compatibilidade
    loading,
    error,
    refetch: () => {
      if (user?.bar_id) {
        setLoading(true);
        // Re-executar o useEffect
      }
    }
  };
}
