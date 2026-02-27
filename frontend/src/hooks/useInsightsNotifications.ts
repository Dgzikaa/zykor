'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useBar } from '@/contexts/BarContext';

// =====================================================
// TIPOS
// =====================================================

export interface InsightAlerta {
  id: string;
  tipo: 'critico' | 'erro' | 'aviso' | 'info' | 'sucesso';
  categoria: string;
  titulo: string;
  mensagem: string;
  dados?: Record<string, unknown>;
  acoes_sugeridas?: string[];
  created_at: string;
  lido: boolean;
  url?: string; // URL para redirecionar quando clicar
}

export interface InsightsData {
  alertas: InsightAlerta[];
  insights: string[];
  resumo?: {
    criticos: number;
    erros: number;
    avisos: number;
    total: number;
  };
}

interface UseInsightsNotificationsResult {
  alertas: InsightAlerta[];
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  estatisticas: {
    total: number;
    naoLidos: number;
    criticos: number;
    erros: number;
    avisos: number;
  };
  fetchAlertas: () => Promise<void>;
  marcarComoLido: (id: string) => void;
  marcarTodosComoLidos: () => void;
}

// Gerar ID estável para o alerta (mesmo alerta = mesmo ID entre fetches/sessões)
function gerarIdEstavel(barId: number, alerta: { categoria?: string; titulo?: string; mensagem?: string }, index: number): string {
  const base = `${alerta.categoria || ''}|${alerta.titulo || ''}|${(alerta.mensagem || '').slice(0, 80)}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) - hash) + base.charCodeAt(i);
    hash = hash & hash;
  }
  return `insight-${barId}-${Math.abs(hash).toString(36)}-${index}`;
}

// =====================================================
// HOOK PRINCIPAL
// =====================================================

export function useInsightsNotifications(): UseInsightsNotificationsResult {
  const { selectedBar } = useBar();
  const [alertas, setAlertas] = useState<InsightAlerta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const hasInitializedRef = useRef(false);
  const alertasLidosRef = useRef<Set<string>>(new Set());

  // Carregar alertas lidos do localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLidos = localStorage.getItem('insights_lidos');
      if (savedLidos) {
        try {
          alertasLidosRef.current = new Set(JSON.parse(savedLidos));
        } catch {
          // Ignore parse errors
        }
      }
    }
  }, []);

  // Função para determinar URL de redirecionamento baseado na categoria
  const getUrlPorCategoria = (categoria: string): string => {
    const urlMap: Record<string, string> = {
      // Financeiro
      'faturamento': '/estrategico/visao-geral',
      'meta': '/estrategico/visao-geral',
      'metas': '/estrategico/visao-geral',
      'cmv': '/operacional/dre',
      'ticket': '/analitico',
      'pagamentos': '/fp',
      
      // Operacional
      'checklist': '/configuracoes/checklists',
      'checklists': '/configuracoes/checklists',
      'estoque': '/configuracoes/fichas-tecnicas',
      
      // Pessoas
      'desempenho': '/estrategico/desempenho',
      'aniversariantes': '/configuracoes/usuarios',
      
      // Reservas
      'reservas': '/ferramentas/calendario',
      
      // Avaliações
      'avaliacoes': '/ferramentas/nps',
      
      // Clientes
      'cliente': '/analitico/clientes',
      'clientes': '/analitico/clientes',
      
      // Eventos
      'evento': '/analitico/eventos',
      'eventos': '/analitico/eventos',
      
      // Outros
      'marketing': '/analitico',
      'financeiro': '/operacional/dre',
      'produto': '/analitico/produtos',
      'produtos': '/analitico/produtos',
    };
    
    const key = categoria.toLowerCase();
    return urlMap[key] || '/alertas';
  };

  // Buscar alertas da API
  const fetchAlertas = useCallback(async () => {
    if (!selectedBar?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/alertas-inteligentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analisar',
          barId: selectedBar.id,
          enviarDiscord: false
        })
      });

      if (!response.ok) {
        setLoading(false);
        return;
      }

      const result = await response.json();
      
      if (result.success && result.resultado?.alertas) {
        const alertasComId: InsightAlerta[] = result.resultado.alertas.map((alerta: any, index: number) => {
          const id = gerarIdEstavel(selectedBar.id, alerta, index);
          return {
            id,
            tipo: alerta.tipo || 'info',
            categoria: alerta.categoria || 'geral',
            titulo: alerta.titulo || 'Alerta',
            mensagem: alerta.mensagem || '',
            dados: alerta.dados,
            acoes_sugeridas: alerta.acoes_sugeridas || [],
            created_at: new Date().toISOString(),
            lido: alertasLidosRef.current.has(id),
            url: getUrlPorCategoria(alerta.categoria || 'geral'),
          };
        });
        
        setAlertas(alertasComId);
        setLastUpdate(new Date());
      }
    } catch (err) {
      // Erro silencioso
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id]);

  // Carregar alertas quando o bar mudar
  // DESABILITADO: Problema com modelo do Gemini na API
  // Para reativar: verificar modelo correto do Gemini e atualizar gemini-client.ts
  useEffect(() => {
    // if (selectedBar?.id && !hasInitializedRef.current) {
    //   fetchAlertas();
    //   hasInitializedRef.current = true;
    // }
  }, [selectedBar?.id, fetchAlertas]);

  // Reset quando trocar de bar
  useEffect(() => {
    hasInitializedRef.current = false;
  }, [selectedBar?.id]);

  // Marcar alerta como lido
  const marcarComoLido = useCallback((id: string) => {
    setAlertas(prev => prev.map(alerta => 
      alerta.id === id ? { ...alerta, lido: true } : alerta
    ));
    
    // Salvar no localStorage
    alertasLidosRef.current.add(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('insights_lidos', JSON.stringify([...alertasLidosRef.current]));
    }
  }, []);

  // Marcar todos como lidos
  const marcarTodosComoLidos = useCallback(() => {
    setAlertas(prev => prev.map(alerta => ({ ...alerta, lido: true })));
    
    // Salvar no localStorage
    alertas.forEach(a => alertasLidosRef.current.add(a.id));
    if (typeof window !== 'undefined') {
      localStorage.setItem('insights_lidos', JSON.stringify([...alertasLidosRef.current]));
    }
  }, [alertas]);

  // Calcular estatísticas
  const estatisticas = {
    total: alertas.length,
    naoLidos: alertas.filter(a => !a.lido).length,
    criticos: alertas.filter(a => a.tipo === 'critico').length,
    erros: alertas.filter(a => a.tipo === 'erro').length,
    avisos: alertas.filter(a => a.tipo === 'aviso').length,
  };

  return {
    alertas,
    loading,
    error,
    lastUpdate,
    estatisticas,
    fetchAlertas,
    marcarComoLido,
    marcarTodosComoLidos,
  };
}

// =====================================================
// FUNÇÕES UTILITÁRIAS
// =====================================================

export function getAlertIcon(tipo: string): { icon: string; color: string } {
  const icons: Record<string, { icon: string; color: string }> = {
    critico: { icon: '🚨', color: 'text-red-600 dark:text-red-400' },
    erro: { icon: '⚠️', color: 'text-orange-600 dark:text-orange-400' },
    aviso: { icon: '⚡', color: 'text-yellow-600 dark:text-yellow-400' },
    info: { icon: 'ℹ️', color: 'text-blue-600 dark:text-blue-400' },
    sucesso: { icon: '✅', color: 'text-green-600 dark:text-green-400' },
  };
  return icons[tipo] || icons.info;
}

export function getAlertBadgeClass(tipo: string): string {
  const classes: Record<string, string> = {
    critico: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
    erro: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    aviso: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    sucesso: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
  };
  return classes[tipo] || classes.info;
}

export function formatarTempoRelativo(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'agora';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}min atrás`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h atrás`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d atrás`;
  }
}
