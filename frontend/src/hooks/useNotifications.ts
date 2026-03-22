import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api-client';

// =====================================================
// TIPOS
// =====================================================

interface Notificacao {
  id: string;
  modulo:
    | 'checklists'
    | 'metas'
    | 'relatorios'
    | 'dashboard'
    | 'sistema';
  tipo: 'info' | 'alerta' | 'erro' | 'sucesso';
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
  categoria?: string;
  titulo: string;
  mensagem: string;
  dados_extras?: Record<string, any>;
  acoes?: Array<{
    label: string;
    action: 'redirect' | 'callback' | 'download';
    url?: string;
    callback?: string;
  }>;
  canais: string[];
  status: 'pendente' | 'enviada' | 'lida' | 'descartada';
  usuario_id?: string;
  role_alvo?: string;
  criada_em: string;
  enviada_em?: string;
  lida_em?: string;
  agendada_para?: string;
}

interface NotificacaoTemplate {
  template_nome: string;
  template_modulo: string;
  template_categoria: string;
  variaveis: Record<string, any>;
  usuario_id?: string;
  role_alvo?: string;
  enviar_em?: string;
}

interface FiltrosNotificacao {
  status?: 'pendente' | 'enviada' | 'lida' | 'descartada';
  modulo?: string;
  tipo?: string;
  prioridade?: string;
  data_inicio?: string;
  data_fim?: string;
  usuario_id?: string;
  apenas_nao_lidas?: boolean;
  page?: number;
  limit?: number;
}

interface EstatisticasNotificacao {
  total_semana: number;
  nao_lidas: number;
  alta_prioridade: number;
  por_tipo: Record<string, number>;
  por_modulo: Record<string, number>;
}

interface PaginacaoNotificacao {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

interface UseNotificationsResult {
  // Estados
  notificacoes: Notificacao[];
  loading: boolean;
  error: string | null;

  // Dados auxiliares
  estatisticas: EstatisticasNotificacao | null;
  paginacao: PaginacaoNotificacao | null;

  // Ações CRUD
  carregarNotificacoes: (filtros?: FiltrosNotificacao) => Promise<void>;
  marcarComoLida: (id: string) => Promise<boolean>;
  marcarTodasComoLidas: () => Promise<boolean>;
  excluirNotificacao: (id: string) => Promise<boolean>;

  // Utilitários
  recarregar: () => Promise<void>;
  limparErro: () => void;
}

// =====================================================
// HOOK PRINCIPAL
// =====================================================

export function useNotifications(): UseNotificationsResult {
  // =====================================================
  // ESTADOS
  // =====================================================

  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estatisticas, setEstatisticas] =
    useState<EstatisticasNotificacao | null>(null);
  const [paginacao, setPaginacao] = useState<PaginacaoNotificacao | null>(null);

  // Ref para armazenar últimos filtros usados
  const ultimosFiltrosRef = useRef<FiltrosNotificacao>({});

  // =====================================================
  // CARREGAR NOTIFICAÇÕES
  // =====================================================

  const carregarNotificacoes = useCallback(
    async (filtros: FiltrosNotificacao = {}) => {
      try {
        setLoading(true);
        setError(null);

        // Salvar filtros para recarregar
        ultimosFiltrosRef.current = filtros;

        const params = new URLSearchParams();

        // Adicionar filtros como parâmetros
        if (filtros.status) params.append('status', filtros.status);
        if (filtros.modulo) params.append('modulo', filtros.modulo);
        if (filtros.tipo) params.append('tipo', filtros.tipo);
        if (filtros.prioridade) params.append('prioridade', filtros.prioridade);
        if (filtros.data_inicio)
          params.append('data_inicio', filtros.data_inicio);
        if (filtros.data_fim) params.append('data_fim', filtros.data_fim);
        if (filtros.usuario_id) params.append('usuario_id', filtros.usuario_id);
        if (filtros.apenas_nao_lidas !== undefined)
          params.append(
            'apenas_nao_lidas',
            filtros.apenas_nao_lidas.toString()
          );
        if (filtros.page) params.append('page', filtros.page.toString());
        if (filtros.limit) params.append('limit', filtros.limit.toString());

        const response = await api.get(
          `/api/configuracoes/notifications?${params.toString()}`
        );

        if (response.success) {
          setNotificacoes(response.data.notificacoes || []);
          setEstatisticas(response.data.estatisticas || null);
          setPaginacao(response.data.paginacao || null);
        } else {
          setError(response.error || 'Erro ao carregar notificações');
        }
      } catch (err: unknown) {
        console.error('Erro ao carregar notificações:', err);
        setError('Erro ao carregar notificações');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // =====================================================
  // MARCAR COMO LIDA
  // =====================================================

  const marcarComoLida = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await api.put(`/api/configuracoes/notifications/${id}`, {
        status: 'lida',
      });

      if (response.success) {
        // Atualizar estado local
        setNotificacoes(prev =>
          prev.map(notif =>
            notif.id === id
              ? {
                  ...notif,
                  status: 'lida' as const,
                  lida_em: new Date().toISOString(),
                }
              : notif
          )
        );

        // Atualizar estatísticas
        setEstatisticas(prev =>
          prev
            ? {
                ...prev,
                nao_lidas: Math.max(0, prev.nao_lidas - 1),
              }
            : null
        );

        return true;
      } else {
        setError(response.error || 'Erro ao marcar como lida');
        return false;
      }
    } catch (err: unknown) {
      console.error('Erro ao marcar como lida:', err);
      setError('Erro ao marcar como lida');
      return false;
    }
  }, []);

  // =====================================================
  // MARCAR TODAS COMO LIDAS
  // =====================================================

  const marcarTodasComoLidas = useCallback(async (): Promise<boolean> => {
    try {
      const response = await api.put('/api/configuracoes/notifications/read-all');

      if (response.success) {
        // Atualizar estado local
        setNotificacoes(prev =>
          prev.map(notif =>
            notif.status !== 'lida'
              ? {
                  ...notif,
                  status: 'lida' as const,
                  lida_em: new Date().toISOString(),
                }
              : notif
          )
        );

        // Atualizar estatísticas
        setEstatisticas(prev =>
          prev
            ? {
                ...prev,
                nao_lidas: 0,
              }
            : null
        );

        return true;
      } else {
        setError(response.error || 'Erro ao marcar todas como lidas');
        return false;
      }
    } catch (err: unknown) {
      console.error('Erro ao marcar todas como lidas:', err);
      setError('Erro ao marcar todas como lidas');
      return false;
    }
  }, []);

  // =====================================================
  // EXCLUIR NOTIFICAÇÃO
  // =====================================================

  const excluirNotificacao = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await api.delete(`/api/configuracoes/notifications/${id}`);

        if (response.success) {
          // Atualizar estado local
          setNotificacoes(prev => prev.filter(notif => notif.id !== id));

          // Atualizar estatísticas se era não lida
          const notificacao = notificacoes.find(n => n.id === id);
          if (
            notificacao &&
            ['pendente', 'enviada'].includes(notificacao.status)
          ) {
            setEstatisticas(prev =>
              prev
                ? {
                    ...prev,
                    nao_lidas: Math.max(0, prev.nao_lidas - 1),
                  }
                : null
            );
          }

          return true;
        } else {
          setError(response.error || 'Erro ao excluir notificação');
          return false;
        }
      } catch (err: unknown) {
        console.error('Erro ao excluir notificação:', err);
        setError('Erro ao excluir notificação');
        return false;
      }
    },
    [notificacoes]
  );

  // =====================================================
  // RECARREGAR
  // =====================================================

  const recarregar = useCallback(async () => {
    await carregarNotificacoes(ultimosFiltrosRef.current);
  }, [carregarNotificacoes]);

  // =====================================================
  // LIMPAR ERRO
  // =====================================================

  const limparErro = useCallback(() => {
    setError(null);
  }, []);

  // =====================================================
  // RETORNO
  // =====================================================

  return {
    // Estados
    notificacoes,
    loading,
    error,

    // Dados auxiliares
    estatisticas,
    paginacao,

    // Ações CRUD
    carregarNotificacoes,
    marcarComoLida,
    marcarTodasComoLidas,
    excluirNotificacao,

    // Utilitários
    recarregar,
    limparErro,
  };
}

// =====================================================
// FUNÇÕES UTILITÁRIAS
// =====================================================

export function getColorByType(tipo: string): string {
  const colors = {
    info: 'text-blue-600 dark:text-blue-400',
    alerta: 'text-yellow-600 dark:text-yellow-400',
    erro: 'text-red-600 dark:text-red-400',
    sucesso: 'text-green-600 dark:text-green-400',
  };
  return colors[tipo as keyof typeof colors] || colors.info;
}

export function getColorByPriority(prioridade: string): string {
  const colors = {
    baixa: 'text-gray-600 dark:text-gray-400',
    media: 'text-blue-600 dark:text-blue-400',
    alta: 'text-orange-600 dark:text-orange-400',
    critica: 'text-red-600 dark:text-red-400',
  };
  return colors[prioridade as keyof typeof colors] || colors.media;
}

export function formatarTempo(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'agora';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m atrás`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h atrás`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d atrás`;
  }
}
