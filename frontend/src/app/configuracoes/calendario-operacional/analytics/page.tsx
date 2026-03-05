'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CalendarIcon, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Activity,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { usePageTitle } from '@/contexts/PageTitleContext';
import Link from 'next/link';

interface AnalyticsData {
  periodo: {
    ano: number;
    mes: number | null;
    dataInicio: string;
    dataFim: string;
    totalDias: number;
  };
  resumo: {
    diasAbertos: number;
    diasFechados: number;
    percentualAberto: string;
    diasComRegistroManual: number;
    diasComMovimento: number;
    maiorSequenciaAbertos: number;
    maiorSequenciaFechados: number;
  };
  faturamento: {
    totalDiasAbertos: number;
    totalDiasFechados: number;
    mediaDiaAberto: number;
  };
  porDiaSemana: Array<{
    dia: number;
    diaLabel: string;
    total: number;
    abertos: number;
    fechados: number;
    percentualAberto: string;
  }>;
  porMes: Array<{
    mes: number;
    mesLabel: string;
    total: number;
    abertos: number;
    fechados: number;
    percentualAberto: string;
  }> | null;
  motivosMaisComuns: Array<{
    motivo: string;
    count: number;
  }>;
  detalhes: {
    diasComInconsistencia: number;
    diasSemMovimento: number;
  };
}

export default function CalendarioAnalyticsPage() {
  const { setPageTitle } = usePageTitle();
  
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [mesSelecionado, setMesSelecionado] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPageTitle('Analytics - Calendário Operacional');
    carregarAnalytics();
    return () => setPageTitle('');
  }, [anoSelecionado, mesSelecionado, setPageTitle]);

  const carregarAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ano: anoSelecionado.toString(),
        bar_id: '3'
      });
      
      if (mesSelecionado) {
        params.append('mes', mesSelecionado.toString());
      }

      const response = await fetch(`/api/ferramentas/calendario-operacional/analytics?${params}`);
      
      if (!response.ok) throw new Error('Erro ao carregar analytics');
      
      const result = await response.json();
      setAnalytics(result.data);
    } catch (error) {
      console.error('Erro ao carregar analytics:', error);
      toast.error('Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  const getNomeMes = (mes: number) => {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[mes - 1];
  };

  if (loading && !analytics) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 animate-pulse mx-auto text-blue-600 dark:text-blue-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Carregando analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link href="/extras/calendario-operacional">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Calendário
            </Button>
          </Link>

          <Card className="card-dark">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="card-title-dark flex items-center gap-2">
                    <BarChart3 className="w-6 h-6" />
                    Analytics - Calendário Operacional
                  </CardTitle>
                  <CardDescription className="card-description-dark mt-2">
                    Insights e estatísticas sobre dias abertos e fechados
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {/* Filtros */}
              <div className="flex gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ano
                  </label>
                  <select
                    value={anoSelecionado}
                    onChange={(e) => setAnoSelecionado(parseInt(e.target.value))}
                    className="input-dark"
                  >
                    {[2024, 2025, 2026].map(ano => (
                      <option key={ano} value={ano}>{ano}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mês
                  </label>
                  <select
                    value={mesSelecionado || ''}
                    onChange={(e) => setMesSelecionado(e.target.value ? parseInt(e.target.value) : null)}
                    className="input-dark"
                  >
                    <option value="">Ano completo</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => (
                      <option key={mes} value={mes}>{getNomeMes(mes)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {analytics && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Período: {new Date(analytics.periodo.dataInicio).toLocaleDateString('pt-BR')} até {' '}
                  {new Date(analytics.periodo.dataFim).toLocaleDateString('pt-BR')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {analytics && (
          <>
            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">
                    Dias Abertos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-900 dark:text-green-300">
                    {analytics.resumo.diasAbertos}
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                    {analytics.resumo.percentualAberto}% do período
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">
                    Dias Fechados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-900 dark:text-red-300">
                    {analytics.resumo.diasFechados}
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                    {(100 - parseFloat(analytics.resumo.percentualAberto)).toFixed(1)}% do período
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">
                    Registros Manuais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-900 dark:text-blue-300">
                    {analytics.resumo.diasComRegistroManual}
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                    Definidos por você
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-400">
                    Dias com Movimento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-900 dark:text-purple-300">
                    {analytics.resumo.diasComMovimento}
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-500 mt-1">
                    Com faturamento registrado
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Sequências e Faturamento */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card className="card-dark">
                <CardHeader>
                  <CardTitle className="card-title-dark flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Sequências
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div>
                      <p className="text-sm text-green-700 dark:text-green-400 font-medium">Maior Sequência Abertos</p>
                      <p className="text-xs text-green-600 dark:text-green-500 mt-1">Dias consecutivos</p>
                    </div>
                    <div className="text-3xl font-bold text-green-900 dark:text-green-300">
                      {analytics.resumo.maiorSequenciaAbertos}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div>
                      <p className="text-sm text-red-700 dark:text-red-400 font-medium">Maior Sequência Fechados</p>
                      <p className="text-xs text-red-600 dark:text-red-500 mt-1">Dias consecutivos</p>
                    </div>
                    <div className="text-3xl font-bold text-red-900 dark:text-red-300">
                      {analytics.resumo.maiorSequenciaFechados}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-dark">
                <CardHeader>
                  <CardTitle className="card-title-dark flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Faturamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-green-700 dark:text-green-400 font-medium">Total em Dias Abertos</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-300 mt-2">
                      {analytics.faturamento.totalDiasAbertos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">Média por Dia Aberto</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-300 mt-2">
                      {analytics.faturamento.mediaDiaAberto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>

                  {analytics.faturamento.totalDiasFechados > 0 && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-300 dark:border-yellow-700">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                        <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
                          Faturamento em Dias Fechados
                        </p>
                      </div>
                      <p className="text-lg font-bold text-yellow-900 dark:text-yellow-300">
                        {analytics.faturamento.totalDiasFechados.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                        Possível inconsistência
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Por Dia da Semana */}
            <Card className="card-dark mb-6">
              <CardHeader>
                <CardTitle className="card-title-dark">Por Dia da Semana</CardTitle>
                <CardDescription className="card-description-dark">
                  Análise de abertura/fechamento por dia da semana
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.porDiaSemana.map(dia => {
                    const percentual = parseFloat(dia.percentualAberto);
                    const cor = percentual >= 80 ? 'green' : percentual >= 50 ? 'yellow' : 'red';
                    
                    return (
                      <div key={dia.dia} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-gray-900 dark:text-white">{dia.diaLabel}</span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {dia.abertos}/{dia.total} dias
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                          <div 
                            className={`h-2 rounded-full ${
                              cor === 'green' ? 'bg-green-500' : 
                              cor === 'yellow' ? 'bg-yellow-500' : 
                              'bg-red-500'
                            }`}
                            style={{ width: `${percentual}%` }}
                          ></div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-400">
                            {dia.abertos} abertos, {dia.fechados} fechados
                          </span>
                          <span className={`font-semibold ${
                            cor === 'green' ? 'text-green-600 dark:text-green-400' : 
                            cor === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' : 
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {dia.percentualAberto}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Motivos Mais Comuns e Alertas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="card-dark">
                <CardHeader>
                  <CardTitle className="card-title-dark">Motivos Mais Comuns</CardTitle>
                  <CardDescription className="card-description-dark">
                    Top 5 motivos de fechamento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.motivosMaisComuns.length > 0 ? (
                    <div className="space-y-3">
                      {analytics.motivosMaisComuns.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <span className="text-sm text-gray-900 dark:text-white">{item.motivo}</span>
                          <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700">
                            {item.count} {item.count === 1 ? 'dia' : 'dias'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-8">
                      Nenhum fechamento registrado
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="card-dark">
                <CardHeader>
                  <CardTitle className="card-title-dark">Alertas e Inconsistências</CardTitle>
                  <CardDescription className="card-description-dark">
                    Possíveis problemas detectados
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analytics.detalhes.diasComInconsistencia > 0 && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        <span className="font-semibold text-yellow-900 dark:text-yellow-300">
                          Dias Fechados com Movimento
                        </span>
                      </div>
                      <p className="text-sm text-yellow-700 dark:text-yellow-400">
                        {analytics.detalhes.diasComInconsistencia} {analytics.detalhes.diasComInconsistencia === 1 ? 'dia marcado' : 'dias marcados'} como fechado mas com faturamento registrado
                      </p>
                    </div>
                  )}

                  {analytics.detalhes.diasSemMovimento > 0 && (
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        <span className="font-semibold text-orange-900 dark:text-orange-300">
                          Dias Abertos sem Movimento
                        </span>
                      </div>
                      <p className="text-sm text-orange-700 dark:text-orange-400">
                        {analytics.detalhes.diasSemMovimento} {analytics.detalhes.diasSemMovimento === 1 ? 'dia aberto' : 'dias abertos'} sem faturamento registrado
                      </p>
                    </div>
                  )}

                  {analytics.detalhes.diasComInconsistencia === 0 && analytics.detalhes.diasSemMovimento === 0 && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <span className="font-semibold text-green-900 dark:text-green-300">
                          Nenhuma inconsistência detectada
                        </span>
                      </div>
                      <p className="text-sm text-green-700 dark:text-green-400 mt-2">
                        Calendário está consistente com o movimento real
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

