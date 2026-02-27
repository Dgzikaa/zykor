'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Lightbulb, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  RefreshCcw,
  ChevronRight,
  Sparkles,
  Bell,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { useBar } from '@/contexts/BarContext';
import { toast } from 'sonner';

interface Alerta {
  tipo: 'critico' | 'erro' | 'aviso' | 'info' | 'sucesso';
  categoria: string;
  titulo: string;
  mensagem: string;
  dados?: Record<string, unknown>;
  acoes_sugeridas?: string[];
}

interface InsightsData {
  alertas: Alerta[];
  insights: string[];
  metricas: Record<string, number>;
}

interface InsightsCardProps {
  compact?: boolean;
  showActions?: boolean;
  maxAlertas?: number;
  className?: string;
}

export default function InsightsCard({ 
  compact = false, 
  showActions = true,
  maxAlertas = 5,
  className = ''
}: InsightsCardProps) {
  const { selectedBar } = useBar();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InsightsData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchInsights = async () => {
    if (!selectedBar?.id) return;
    
    setLoading(true);
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

      const result = await response.json();
      
      if (result.success) {
        setData(result.resultado);
        setLastUpdate(new Date());
      }
    } catch (error) {
      // Erro silencioso
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [selectedBar?.id]);

  const getAlertIcon = (tipo: string) => {
    switch (tipo) {
      case 'critico':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'erro':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'aviso':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'sucesso':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getAlertBadgeClass = (tipo: string) => {
    switch (tipo) {
      case 'critico':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'erro':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'aviso':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'sucesso':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      default:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  const handleEnviarDiscord = async () => {
    if (!selectedBar?.id || !data) return;

    try {
      const response = await fetch('/api/alertas-inteligentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'processar_pendentes',
          barId: selectedBar.id,
          enviarDiscord: true
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Alertas enviados para o Discord!');
      } else {
        toast.error('Erro ao enviar para Discord');
      }
    } catch (error) {
      toast.error('Erro ao enviar para Discord');
    }
  };

  const alertasFiltrados = data?.alertas?.slice(0, maxAlertas) || [];
  const temMaisAlertas = (data?.alertas?.length || 0) > maxAlertas;

  if (compact) {
    return (
      <Card className={`bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <span className="font-semibold text-gray-900 dark:text-white">Insights IA</span>
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
          ) : alertasFiltrados.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              ✨ Tudo em ordem! Nenhum alerta no momento.
            </p>
          ) : (
            <div className="space-y-2">
              {alertasFiltrados.slice(0, 3).map((alerta, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-900">
                  {getAlertIcon(alerta.tipo)}
                  <span className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                    {alerta.titulo}
                  </span>
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
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-lg text-gray-900 dark:text-white">
                Insights Inteligentes
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
                onClick={handleEnviarDiscord}
                className="text-purple-600 border-purple-300 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-700 dark:hover:bg-purple-900/20"
              >
                <Bell className="w-4 h-4 mr-1" />
                Discord
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
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <RefreshCcw className="w-8 h-8 animate-spin text-purple-500 mb-2" />
            <p className="text-sm text-gray-500">Analisando dados...</p>
          </div>
        ) : !data || (alertasFiltrados.length === 0 && (!data.insights || data.insights.length === 0)) ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              ✨ Tudo em ordem! Nenhum alerta ou insight no momento.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Alertas */}
            {alertasFiltrados.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Alertas ({data.alertas.length})
                </h4>
                {alertasFiltrados.map((alerta, idx) => (
                  <div 
                    key={idx} 
                    className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start gap-3">
                      {getAlertIcon(alerta.tipo)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 dark:text-white text-sm">
                            {alerta.titulo}
                          </span>
                          <Badge className={`text-xs ${getAlertBadgeClass(alerta.tipo)}`}>
                            {alerta.categoria}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {alerta.mensagem}
                        </p>
                        {alerta.acoes_sugeridas && alerta.acoes_sugeridas.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-500 mb-1">
                              Sugestões:
                            </p>
                            <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                              {alerta.acoes_sugeridas.slice(0, 2).map((acao, i) => (
                                <li key={i} className="flex items-center gap-1">
                                  <ChevronRight className="w-3 h-3" />
                                  {acao}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {temMaisAlertas && (
                  <p className="text-xs text-gray-500 text-center">
                    +{data.alertas.length - maxAlertas} alertas adicionais
                  </p>
                )}
              </div>
            )}

            {/* Insights da IA */}
            {data.insights && data.insights.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-500" />
                  Insights da IA
                </h4>
                <div className="space-y-2">
                  {data.insights.map((insight, idx) => (
                    <div 
                      key={idx}
                      className="p-3 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800"
                    >
                      <p className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                        <span className="text-purple-500">💡</span>
                        {insight}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
