'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingState } from '@/components/ui/loading-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  Lightbulb, 
  TrendingUp, 
  TrendingDown,
  Target,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  Archive,
  RefreshCw,
  Sparkles,
  BarChart3,
  Users,
  Music
} from 'lucide-react';

interface Insight {
  id: string;
  tipo: string;
  categoria: string;
  titulo: string;
  descricao: string;
  impacto: string;
  prioridade: number;
  visualizado: boolean;
  arquivado: boolean;
  created_at: string;
  dados_suporte?: any;
  acao_sugerida?: string;
}

interface Padrao {
  id: number;
  tipo: string;
  descricao: string;
  dados_suporte: any;
  confianca: number;
  ocorrencias: number;
  status: string;
  created_at: string;
}

export default function InsightsAgentePage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [padroes, setPadroes] = useState<Padrao[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [detectando, setDetectando] = useState(false);

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/agente/insights?bar_id=3&padroes=true');
      const result = await response.json();
      
      if (result.success) {
        setInsights(result.data.insights);
        setPadroes(result.data.padroes);
        setStats(result.data.stats);
      }
    } catch (error) {
      console.error('Erro ao buscar insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const detectarPadroes = async () => {
    setDetectando(true);
    try {
      const response = await fetch('/api/agente/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'detectar_padroes', bar_id: 3 })
      });
      
      const result = await response.json();
      if (result.success) {
        alert(`${result.padroes_detectados} padrões detectados!`);
        fetchInsights();
      }
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setDetectando(false);
    }
  };

  const marcarVisualizado = async (id: string, visualizado: boolean) => {
    try {
      await fetch('/api/agente/insights', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, visualizado })
      });
      fetchInsights();
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const getImpactoBadge = (impacto: string) => {
    switch (impacto) {
      case 'alto':
        return <Badge className="bg-red-600">Alto Impacto</Badge>;
      case 'medio':
        return <Badge className="bg-yellow-600">Médio Impacto</Badge>;
      case 'baixo':
        return <Badge className="bg-green-600">Baixo Impacto</Badge>;
      default:
        return <Badge variant="outline">Informativo</Badge>;
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'analise_diaria':
        return <BarChart3 className="w-5 h-5" />;
      case 'tendencia_faturamento':
        return <TrendingUp className="w-5 h-5" />;
      case 'atracao_alta_performance':
        return <Music className="w-5 h-5 text-green-500" />;
      case 'atracao_baixa_performance':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'sazonalidade_mensal':
        return <Target className="w-5 h-5" />;
      default:
        return <Lightbulb className="w-5 h-5" />;
    }
  };

  const getPadraoTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'tendencia_dia_semana':
        return <Badge className="bg-blue-600">Tendência</Badge>;
      case 'atracao_alta_performance':
        return <Badge className="bg-green-600">Alta Performance</Badge>;
      case 'atracao_baixa_performance':
        return <Badge className="bg-orange-600">Baixa Performance</Badge>;
      case 'sazonalidade_mensal':
        return <Badge className="bg-purple-600">Sazonalidade</Badge>;
      case 'ticket_por_publico':
        return <Badge className="bg-cyan-600">Correlação</Badge>;
      default:
        return <Badge variant="outline">{tipo}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Insights do Agente IA
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Padrões detectados e análises inteligentes
              </p>
            </div>
          </div>

          <Button 
            onClick={detectarPadroes}
            disabled={detectando}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {detectando ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Detectando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Detectar Padrões
              </>
            )}
          </Button>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-blue-600 dark:text-blue-400">Total Insights</div>
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.total_insights}</div>
                  </div>
                  <Lightbulb className="w-8 h-8 text-blue-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-orange-600 dark:text-orange-400">Não Lidos</div>
                    <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{stats.nao_visualizados}</div>
                  </div>
                  <Eye className="w-8 h-8 text-orange-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-purple-600 dark:text-purple-400">Padrões Ativos</div>
                    <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{padroes.length}</div>
                  </div>
                  <Target className="w-8 h-8 text-purple-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-green-600 dark:text-green-400">Alto Impacto</div>
                    <div className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.por_impacto?.alto || 0}</div>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-green-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="padroes" className="w-full">
          <TabsList className="mb-4 bg-white dark:bg-gray-800">
            <TabsTrigger value="padroes">Padrões Detectados ({padroes.length})</TabsTrigger>
            <TabsTrigger value="insights">Insights Recentes ({insights.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="padroes">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Padrões Detectados pela IA
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Tendências e correlações identificadas automaticamente
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
                  </div>
                ) : padroes.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    Nenhum padrão detectado. Clique em "Detectar Padrões" para iniciar a análise.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {padroes.map((padrao) => (
                      <Card key={padrao.id} className="border border-gray-200 dark:border-gray-700">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              {getTipoIcon(padrao.tipo)}
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  {getPadraoTipoBadge(padrao.tipo)}
                                  <Badge variant="outline" className="text-xs">
                                    {(padrao.confianca * 100).toFixed(0)}% confiança
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {padrao.ocorrencias} ocorrências
                                  </Badge>
                                </div>
                                <p className="text-gray-900 dark:text-white font-medium">
                                  {padrao.descricao}
                                </p>
                                {padrao.dados_suporte && (
                                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                    {padrao.tipo === 'tendencia_dia_semana' && padrao.dados_suporte.dia_semana && (
                                      <span>
                                        {padrao.dados_suporte.dia_semana}: Média R$ {padrao.dados_suporte.media_recente?.toFixed(2)}
                                      </span>
                                    )}
                                    {padrao.tipo.includes('atracao') && padrao.dados_suporte.atracao && (
                                      <span>
                                        {padrao.dados_suporte.atracao}: {padrao.dados_suporte.shows} shows, 
                                        ROI {padrao.dados_suporte.roi?.toFixed(0)}%
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(padrao.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                  <Lightbulb className="w-5 h-5" />
                  Insights Recentes
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Análises e recomendações geradas pelo agente
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}
                  </div>
                ) : insights.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    Nenhum insight gerado ainda. Os insights são gerados automaticamente pelas análises diárias.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {insights.map((insight) => (
                      <Card 
                        key={insight.id} 
                        className={`border ${insight.visualizado ? 'border-gray-200 dark:border-gray-700' : 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10'}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getTipoIcon(insight.tipo)}
                              <h3 className="font-bold text-gray-900 dark:text-white">
                                {insight.titulo}
                              </h3>
                              {!insight.visualizado && (
                                <Badge className="bg-blue-600 text-xs">Novo</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {getImpactoBadge(insight.impacto)}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => marcarVisualizado(insight.id, !insight.visualizado)}
                              >
                                {insight.visualizado ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-4">
                            {insight.descricao?.substring(0, 500)}...
                          </p>
                          
                          {insight.acao_sugerida && (
                            <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <span className="text-sm text-green-700 dark:text-green-300">
                                <strong>Ação sugerida:</strong> {insight.acao_sugerida}
                              </span>
                            </div>
                          )}
                          
                          <div className="mt-2 text-xs text-gray-500">
                            {new Date(insight.created_at).toLocaleString('pt-BR')}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
