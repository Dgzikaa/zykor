'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  MessageCircle,
  Users,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Activity,
  Loader2,
} from 'lucide-react';

type DashboardStats = {
  totalConversas: number;
  contatosUnicos: number;
  totalMensagens: number;
  clientesSegmentados: number;
  churnCritico: number;
  ltvTotalAtual: number;
};

type DataSourcesStatus = {
  umbler: boolean;
  segmentacao: boolean;
  churn: boolean;
  ltv: boolean;
};

type DataSourcesLoading = {
  umbler: boolean;
  segmentacao: boolean;
  churn: boolean;
  ltv: boolean;
};

const INITIAL_STATS: DashboardStats = {
  totalConversas: 0,
  contatosUnicos: 0,
  totalMensagens: 0,
  clientesSegmentados: 0,
  churnCritico: 0,
  ltvTotalAtual: 0,
};

const CRM_CACHE_PREFIX = 'crm-dashboard-cache-v1';

function formatCurrencyCompact(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value || 0);
}

export default function FerramentasCRMPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [sourceStatus, setSourceStatus] = useState<DataSourcesStatus>({
    umbler: false,
    segmentacao: false,
    churn: false,
    ltv: false,
  });
  const [sourceLoading, setSourceLoading] = useState<DataSourcesLoading>({
    umbler: false,
    segmentacao: false,
    churn: false,
    ltv: false,
  });

  useEffect(() => {
    let cancelled = false;
    const barId = selectedBar?.id;
    if (!barId) {
      setLoading(false);
      setStats(INITIAL_STATS);
      setSourceStatus({
        umbler: false,
        segmentacao: false,
        churn: false,
        ltv: false,
      });
      setSourceLoading({
        umbler: false,
        segmentacao: false,
        churn: false,
        ltv: false,
      });
      return;
    }

    // Mostra dados em cache imediatamente e revalida em background
    let hasCache = false;
    let cachedStats: DashboardStats = { ...INITIAL_STATS };
    let cachedSourceStatus: DataSourcesStatus = {
      umbler: false,
      segmentacao: false,
      churn: false,
      ltv: false,
    };

    try {
      const raw = window.sessionStorage.getItem(`${CRM_CACHE_PREFIX}:${barId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { stats: DashboardStats; sourceStatus: DataSourcesStatus };
        if (parsed?.stats && parsed?.sourceStatus) {
          hasCache = true;
          cachedStats = parsed.stats;
          cachedSourceStatus = parsed.sourceStatus;
          setStats(parsed.stats);
          setSourceStatus(parsed.sourceStatus);
          setLoading(false);
        }
      }
    } catch {
      // ignora falhas de cache
    }

    const load = async () => {
      if (!hasCache) {
        setLoading(true);
      }
      setSourceLoading({
        umbler: true,
        segmentacao: true,
        churn: true,
        ltv: true,
      });

      const nextStats: DashboardStats = { ...cachedStats };
      const nextSourceStatus: DataSourcesStatus = { ...cachedSourceStatus };

      const markSourceDone = (source: keyof DataSourcesLoading) => {
        if (cancelled) return;
        setSourceLoading((prev) => ({ ...prev, [source]: false }));
      };

      try {
        const [umblerRes, segmentacaoRes, churnRes, ltvRes] = await Promise.allSettled([
          fetch(`/api/umbler/dashboard?bar_id=${barId}`, { cache: 'no-store' }),
          fetch(`/api/crm/segmentacao?bar_id=${barId}&page=1&limit=1&segmento=todos`, { cache: 'no-store' }),
          fetch(`/api/crm/churn-prediction?bar_id=${barId}&page=1&limit=1`, { cache: 'no-store' }),
          fetch(`/api/crm/ltv-engajamento?bar_id=${barId}&limite=1`, { cache: 'no-store' }),
        ]);

        if (umblerRes.status === 'fulfilled') {
          const json = await umblerRes.value.json();
          if (json?.success && json.metricas) {
            nextSourceStatus.umbler = true;
            nextStats.totalConversas = json.metricas.total_conversas || 0;
            nextStats.contatosUnicos = json.metricas.contatos_unicos || 0;
            nextStats.totalMensagens = json.metricas.total_mensagens || 0;
            if (!cancelled) {
              setSourceStatus((prev) => ({ ...prev, umbler: true }));
              setStats((prev) => ({
                ...prev,
                totalConversas: json.metricas.total_conversas || 0,
                contatosUnicos: json.metricas.contatos_unicos || 0,
                totalMensagens: json.metricas.total_mensagens || 0,
              }));
            }
          }
        }
        markSourceDone('umbler');

        if (segmentacaoRes.status === 'fulfilled') {
          const json = await segmentacaoRes.value.json();
          if (json?.success && json.estatisticas) {
            nextSourceStatus.segmentacao = true;
            nextStats.clientesSegmentados = json.estatisticas.total_clientes || 0;
            if (!cancelled) {
              setSourceStatus((prev) => ({ ...prev, segmentacao: true }));
              setStats((prev) => ({ ...prev, clientesSegmentados: json.estatisticas.total_clientes || 0 }));
            }
          }
        }
        markSourceDone('segmentacao');

        if (churnRes.status === 'fulfilled') {
          const json = await churnRes.value.json();
          if (json?.success && json.stats) {
            nextSourceStatus.churn = true;
            nextStats.churnCritico = json.stats.critico || 0;
            if (!cancelled) {
              setSourceStatus((prev) => ({ ...prev, churn: true }));
              setStats((prev) => ({ ...prev, churnCritico: json.stats.critico || 0 }));
            }
          }
        }
        markSourceDone('churn');

        if (ltvRes.status === 'fulfilled') {
          const json = await ltvRes.value.json();
          if (json?.success && json.stats) {
            nextSourceStatus.ltv = true;
            nextStats.ltvTotalAtual = json.stats.ltv_total_atual || 0;
            if (!cancelled) {
              setSourceStatus((prev) => ({ ...prev, ltv: true }));
              setStats((prev) => ({ ...prev, ltvTotalAtual: json.stats.ltv_total_atual || 0 }));
            }
          }
        }
        markSourceDone('ltv');
        try {
          window.sessionStorage.setItem(
            `${CRM_CACHE_PREFIX}:${barId}`,
            JSON.stringify({ stats: nextStats, sourceStatus: nextSourceStatus })
          );
        } catch {
          // ignora falhas de cache
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedBar?.id, reloadTick]);

  const indicadores = useMemo(
    () => [
      {
        label: 'Conversas',
        value: stats.totalConversas.toLocaleString('pt-BR'),
        icon: MessageCircle,
        tone: 'text-blue-600 dark:text-blue-400',
        loaded: sourceStatus.umbler,
        source: 'umbler' as const,
      },
      {
        label: 'Contatos Únicos',
        value: stats.contatosUnicos.toLocaleString('pt-BR'),
        icon: Users,
        tone: 'text-purple-600 dark:text-purple-400',
        loaded: sourceStatus.umbler,
        source: 'umbler' as const,
      },
      {
        label: 'Clientes Segmentados',
        value: stats.clientesSegmentados.toLocaleString('pt-BR'),
        icon: Activity,
        tone: 'text-green-600 dark:text-green-400',
        loaded: sourceStatus.segmentacao,
        source: 'segmentacao' as const,
      },
      {
        label: 'Churn Crítico',
        value: stats.churnCritico.toLocaleString('pt-BR'),
        icon: AlertTriangle,
        tone: 'text-red-600 dark:text-red-400',
        loaded: sourceStatus.churn,
        source: 'churn' as const,
      },
      {
        label: 'Mensagens',
        value: stats.totalMensagens.toLocaleString('pt-BR'),
        icon: TrendingUp,
        tone: 'text-cyan-600 dark:text-cyan-400',
        loaded: sourceStatus.umbler,
        source: 'umbler' as const,
      },
      {
        label: 'LTV Total',
        value: formatCurrencyCompact(stats.ltvTotalAtual),
        icon: DollarSign,
        tone: 'text-amber-600 dark:text-amber-400',
        loaded: sourceStatus.ltv,
        source: 'ltv' as const,
      },
    ],
    [stats, sourceStatus]
  );

  const hasAnySourceLoaded = useMemo(
    () => Object.values(sourceStatus).some(Boolean),
    [sourceStatus]
  );
  const anySourcePending = useMemo(
    () => Object.values(sourceLoading).some(Boolean),
    [sourceLoading]
  );

  useEffect(() => {
    setPageTitle('💬 CRM');
    return () => setPageTitle('');
  }, [setPageTitle]);

  return (
    <div className="min-h-[calc(100vh-8px)] bg-background">
      <div className="container mx-auto px-2 py-4 pb-6 max-w-[98vw] space-y-4">
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-gray-900 dark:text-white">Hub de CRM</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Visão inicial dos principais números e atalhos para cada módulo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedBar?.id ? (
              <div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                Selecione um bar para carregar os indicadores do CRM.
              </div>
            ) : anySourcePending && !hasAnySourceLoaded ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando indicadores do CRM...
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  {[...Array(6)].map((_, idx) => (
                    <Skeleton key={idx} className="h-20" />
                  ))}
                </div>
              </div>
            ) : !hasAnySourceLoaded ? (
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                <p className="text-sm text-foreground font-medium">
                  Ainda não encontramos dados para os módulos de CRM deste bar.
                </p>
                <p className="text-xs text-muted-foreground">
                  Verifique integrações e permissões, ou recarregue para tentar novamente.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setReloadTick((v) => v + 1)}>
                    Recarregar dados
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {indicadores.map((item) => {
                  const Icon = item.icon;
                  const isPending = sourceLoading[item.source] && !item.loaded;
                  return (
                    <div
                      key={item.label}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
                        <Icon className={`w-4 h-4 ${item.tone}`} />
                      </div>
                      {isPending ? (
                        <Skeleton className="h-6 w-16" />
                      ) : (
                        <p className={`text-lg font-bold ${item.tone}`}>{item.loaded ? item.value : '--'}</p>
                      )}
                      {!item.loaded && !isPending && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Sem dados no momento</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

