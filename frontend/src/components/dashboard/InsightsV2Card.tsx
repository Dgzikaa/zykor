'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { toast } from 'sonner';
import type { AgentInsightV2 } from '@/types/agent-v2';

interface InsightsV2CardProps {
  barId: number;
  compact?: boolean;
  showActions?: boolean;
  maxInsights?: number;
  className?: string;
}

interface InsightsV2Response {
  success: boolean;
  insights: AgentInsightV2[];
  stats: {
    total: number;
    nao_visualizados: number;
    problemas: number;
    oportunidades: number;
    por_severidade: {
      alta: number;
      media: number;
      baixa: number;
    };
  };
}

export default function InsightsV2Card({ 
  barId,
  compact = false, 
  showActions = true,
  maxInsights = 10,
  className = ''
}: InsightsV2CardProps) {
  const [insights, setInsights] = useState<AgentInsightV2[]>([]);
  const [stats, setStats] = useState<InsightsV2Response['stats'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [filtroSeveridade, setFiltroSeveridade] = useState<string>('');

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        bar_id: barId.toString(),
        limit: maxInsights.toString(),
      });

      if (filtroTipo) params.append('tipo', filtroTipo);
      if (filtroSeveridade) params.append('severidade', filtroSeveridade);

      const response = await fetch(`/api/agente/insights-v2?${params}`);
      const result: InsightsV2Response = await response.json();
      
      if (result.success) {
        setInsights(result.insights);
        setStats(result.stats);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Erro ao buscar insights v2:', error);
    } finally {
      setLoading(false);
    }
  };

  const executarAnalise = async () => {
    setAnalisando(true);
    try {
      const response = await fetch('/api/agente/insights-v2/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: barId })
      });

      const result = await response.json();
      
      if (result.success) {
        const insightsGerados = result.pipeline?.narrator?.insights_gerados || 0;
        const eventosDetectados = result.pipeline?.detector?.eventos_detectados || 0;
        
        toast.success(
          `Análise concluída! ${eventosDetectados} eventos detectados, ${insightsGerados} insights gerados.`
        );
        
        fetchInsights();
      } else {
        toast.error('Erro ao executar análise');
      }
    } catch (error) {
      toast.error('Erro ao executar análise');
      console.error('Erro:', error);
    } finally {
      setAnalisando(false);
    }
  };

  const marcarComoLido = async (insightId: string) => {
    try {
      await fetch('/api/agente/insights-v2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: insightId, visualizado: true })
      });
      
      setInsights(prev =>
        prev.map(i => (i.id === insightId ? { ...i, visualizado: true } : i))
      );
    } catch (error) {
      console.error('Erro ao marcar como lido:', error);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [barId, filtroTipo, filtroSeveridade]);

  const getSeveridadeBadge = (severidade: string) => {
    switch (severidade) {
      case 'alta':
        return <Badge variant="destructive" className="text-xs">Alta</Badge>;
      case 'media':
        return <Badge variant="warning" className="text-xs">Média</Badge>;
      case 'baixa':
        return <Badge variant="success" className="text-xs">Baixa</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{severidade}</Badge>;
    }
  };

  const getTipoIcon = (tipo: string) => {
    return tipo === 'problema' 
      ? <AlertTriangle className="w-4 h-4 text-orange-500" />
      : <Lightbulb className="w-4 h-4 text-yellow-500" />;
  };

  const getSeveridadeColor = (severidade: string) => {
    switch (severidade) {
      case 'alta':
        return 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10';
      case 'media':
        return 'border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-900/10';
      case 'baixa':
        return 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10';
      default:
        return 'border-gray-200 dark:border-gray-700';
    }
  };

  const insightsFiltrados = insights.slice(0, maxInsights);
  const temMaisInsights = insights.length > maxInsights;

  if (compact) {
    return (
      <Card className={`bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              <span className="font-semibold text-gray-900 dark:text-white">Insights V2</span>
              {stats && stats.nao_visualizados > 0 && (
                <Badge className="bg-blue-600 text-xs">{stats.nao_visualizados}</Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={fetchInsights}
              disabled={loading}
              className="h-7 w-7 p-0"
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <RefreshCcw className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : insightsFiltrados.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              ✨ Nenhum insight no momento.
            </p>
          ) : (
            <div className="space-y-2">
              {insightsFiltrados.slice(0, 3).map((insight) => (
                <div 
                  key={insight.id} 
                  className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-900"
                >
                  {getTipoIcon(insight.tipo)}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                      {insight.titulo}
                    </span>
                  </div>
                  {!insight.visualizado && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg text-gray-900 dark:text-white">
                Insights V2 — Análise Inteligente
              </CardTitle>
              {lastUpdate && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showActions && (
              <Button
                size="sm"
                variant="outline"
                onClick={executarAnalise}
                disabled={analisando}
                className="text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-900/20"
              >
                {analisando ? (
                  <>
                    <RefreshCcw className="w-4 h-4 mr-1 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-1" />
                    Executar Análise
                  </>
                )}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={fetchInsights}
              disabled={loading}
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Filtros */}
        {showActions && (
          <div className="flex items-center gap-2 mt-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="text-xs px-2 py-1 border rounded bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
            >
              <option value="">Todos os tipos</option>
              <option value="problema">⚠️ Problemas</option>
              <option value="oportunidade">💡 Oportunidades</option>
            </select>
            <select
              value={filtroSeveridade}
              onChange={(e) => setFiltroSeveridade(e.target.value)}
              className="text-xs px-2 py-1 border rounded bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
            >
              <option value="">Todas as severidades</option>
              <option value="alta">🔴 Alta</option>
              <option value="media">🟠 Média</option>
              <option value="baixa">🔵 Baixa</option>
            </select>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {/* Stats */}
        {stats && !loading && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="text-xs text-gray-600 dark:text-gray-400">Total</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-xs text-blue-600 dark:text-blue-400">Não Lidos</div>
              <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{stats.nao_visualizados}</div>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-xs text-red-600 dark:text-red-400">Problemas</div>
              <div className="text-xl font-bold text-red-700 dark:text-red-300">{stats.problemas}</div>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-xs text-green-600 dark:text-green-400">Oportunidades</div>
              <div className="text-xl font-bold text-green-700 dark:text-green-300">{stats.oportunidades}</div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : insightsFiltrados.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              ✨ Nenhum insight no momento.
            </p>
            {showActions && (
              <Button
                size="sm"
                variant="outline"
                onClick={executarAnalise}
                disabled={analisando}
                className="mt-3"
              >
                <Play className="w-4 h-4 mr-1" />
                Executar Análise
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {insightsFiltrados.map((insight) => (
              <div 
                key={insight.id} 
                className={`p-3 rounded-lg border ${getSeveridadeColor(insight.severidade)} ${
                  !insight.visualizado ? 'ring-2 ring-blue-300 dark:ring-blue-700' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getTipoIcon(insight.tipo)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                        {insight.titulo}
                      </h3>
                      {getSeveridadeBadge(insight.severidade)}
                      {!insight.visualizado && (
                        <Badge className="bg-blue-600 text-xs">Novo</Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      {insight.descricao}
                    </p>

                    {insight.causa_provavel && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          <strong>Causa provável:</strong> {insight.causa_provavel}
                        </p>
                      </div>
                    )}

                    {insight.acoes_recomendadas && insight.acoes_recomendadas.length > 0 && (
                      <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                        <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">
                          ✅ Ações recomendadas:
                        </p>
                        <ul className="text-xs text-green-600 dark:text-green-400 space-y-0.5">
                          {insight.acoes_recomendadas.slice(0, 2).map((acao, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <ChevronRight className="w-3 h-3 flex-shrink-0 mt-0.5" />
                              <span>{acao}</span>
                            </li>
                          ))}
                          {insight.acoes_recomendadas.length > 2 && (
                            <li className="text-gray-500">
                              +{insight.acoes_recomendadas.length - 2} ações adicionais
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500">
                        {new Date(insight.created_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {!insight.visualizado && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => marcarComoLido(insight.id)}
                          className="h-6 text-xs text-blue-600 hover:text-blue-700"
                        >
                          Marcar como lido
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {temMaisInsights && (
              <p className="text-xs text-gray-500 text-center pt-2">
                +{insights.length - maxInsights} insights adicionais
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
