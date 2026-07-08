'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Target,
  Users,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Brain,
  Sparkles,
  ArrowRight,
  BarChart3
} from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';

interface Previsao {
  data: string;
  dia_semana: string;
  evento_agendado: string | null;
  previsao: {
    faturamento: number;
    publico: number;
    faturamento_minimo: number;
    faturamento_maximo: number;
    confianca: number;
  };
  historico: {
    media_faturamento: number;
    media_publico: number;
    tendencia_percentual: number;
    amostras: number;
    ultimos_eventos: Array<{
      data: string;
      faturamento: number;
      publico: number;
      evento: string;
    }>;
  };
  analise_ia: {
    previsao_faturamento: number;
    previsao_publico: number;
    confianca: number;
    fatores_positivos: string[];
    fatores_negativos: string[];
    recomendacao: string;
  } | null;
  padroes_aplicados: string[];
}

export default function PrevisaoDemandaPage() {
  const [previsoes, setPrevisoes] = useState<Previsao[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataCustom, setDataCustom] = useState('');
  const [previsaoCustom, setPrevisaoCustom] = useState<Previsao | null>(null);
  const [loadingCustom, setLoadingCustom] = useState(false);
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle('🔮 Previsão');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    fetchPrevisoesSemana();
  }, []);

  const fetchPrevisoesSemana = async () => {
    setLoading(true);
    try {
      // Buscar previsões para os próximos 7 dias
      const hoje = new Date();
      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < 7; i++) {
        const data = new Date(hoje);
        data.setDate(data.getDate() + i);
        const dataStr = data.toISOString().split('T')[0];
        
        promises.push(
          fetch('/api/agente/previsao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: dataStr, bar_id: 3 })
          }).then(r => r.json())
        );
      }
      
      const results = await Promise.all(promises);
      const previsoesValidas = results
        .filter((r: any) => r.success)
        .map((r: any) => r.data);
      
      setPrevisoes(previsoesValidas);
    } catch (error) {
      console.error('Erro ao buscar previsões:', error);
    } finally {
      setLoading(false);
    }
  };

  const buscarPrevisaoCustom = async () => {
    if (!dataCustom) return;
    
    setLoadingCustom(true);
    try {
      const response = await fetch('/api/agente/previsao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dataCustom, bar_id: 3 })
      });
      
      const result = await response.json();
      if (result.success) {
        setPrevisaoCustom(result.data);
      }
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoadingCustom(false);
    }
  };

  const getConfiancaBadge = (confianca: number) => {
    if (confianca >= 80) return <Badge className="bg-green-600">{confianca}% confiança</Badge>;
    if (confianca >= 60) return <Badge className="bg-yellow-600">{confianca}% confiança</Badge>;
    return <Badge className="bg-orange-600">{confianca}% confiança</Badge>;
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getDiaSemanaColor = (dia: string) => {
    const cores: Record<string, string> = {
      'Sexta': 'from-green-500 to-emerald-500',
      'Sábado': 'from-blue-500 to-cyan-500',
      'Domingo': 'from-purple-500 to-pink-500',
      'Quarta': 'from-orange-500 to-yellow-500',
      'Quinta': 'from-red-500 to-orange-500',
      'Terça': 'from-gray-500 to-gray-600',
      'Segunda': 'from-gray-400 to-gray-500'
    };
    return cores[dia] || 'from-gray-500 to-gray-600';
  };

  // Calcular totais da semana
  const totaisSemana = previsoes.reduce((acc, p) => ({
    faturamento: acc.faturamento + p.previsao.faturamento,
    publico: acc.publico + p.previsao.publico
  }), { faturamento: 0, publico: 0 });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Previsão de Demanda
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Previsões inteligentes baseadas em histórico e padrões
              </p>
            </div>
          </div>

          {/* Busca customizada */}
          <div className="flex gap-2">
            <Input
              type="date"
              value={dataCustom}
              onChange={(e) => setDataCustom(e.target.value)}
              className="w-44 bg-white dark:bg-gray-800"
            />
            <Button 
              onClick={buscarPrevisaoCustom}
              disabled={loadingCustom || !dataCustom}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {loadingCustom ? 'Calculando...' : 'Prever'}
            </Button>
          </div>
        </div>

        {/* Resumo da Semana */}
        {!loading && previsoes.length > 0 && (
          <Card className="mb-6 bg-gradient-to-r from-green-50 via-emerald-50 to-cyan-50 dark:from-green-900/20 dark:via-emerald-900/20 dark:to-cyan-900/20 border-green-200 dark:border-green-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Previsão Semanal
                  </h2>
                  <div className="flex gap-6">
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Faturamento Previsto</div>
                      <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                        {formatCurrency(totaisSemana.faturamento)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Público Previsto</div>
                      <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                        {totaisSemana.publico.toLocaleString()} PAX
                      </div>
                    </div>
                  </div>
                </div>
                <Sparkles className="w-16 h-16 text-green-500 opacity-30" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Previsão Customizada */}
        {previsaoCustom && (
          <Card className="mb-6 bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-800 border-2">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Previsão para {new Date(previsaoCustom.data + 'T12:00:00').toLocaleDateString('pt-BR')} ({previsaoCustom.dia_semana})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Previsão Principal */}
                <div className="col-span-1">
                  <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Faturamento Previsto</div>
                    <div className="text-4xl font-bold text-green-700 dark:text-green-300 mb-2">
                      {formatCurrency(previsaoCustom.previsao.faturamento)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatCurrency(previsaoCustom.previsao.faturamento_minimo)} - {formatCurrency(previsaoCustom.previsao.faturamento_maximo)}
                    </div>
                    <div className="mt-2">
                      {getConfiancaBadge(previsaoCustom.previsao.confianca)}
                    </div>
                  </div>
                  
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Público Previsto</div>
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      {previsaoCustom.previsao.publico} PAX
                    </div>
                  </div>
                </div>

                {/* Análise IA */}
                {previsaoCustom.analise_ia && (
                  <div className="col-span-2">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      Análise Inteligente
                    </h4>
                    
                    {previsaoCustom.analise_ia.fatores_positivos?.length > 0 && (
                      <div className="mb-3">
                        <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">Fatores Positivos:</div>
                        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                          {previsaoCustom.analise_ia.fatores_positivos.map((f, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <CheckCircle className="w-3 h-3 text-green-500" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {previsaoCustom.analise_ia.fatores_negativos?.length > 0 && (
                      <div className="mb-3">
                        <div className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-1">Pontos de Atenção:</div>
                        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                          {previsaoCustom.analise_ia.fatores_negativos.map((f, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <AlertTriangle className="w-3 h-3 text-orange-500" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {previsaoCustom.analise_ia.recomendacao && (
                      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <div className="text-sm font-medium text-purple-700 dark:text-purple-400 mb-1">Recomendação:</div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {previsaoCustom.analise_ia.recomendacao}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grid de Previsões */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Próximos 7 Dias
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Previsões baseadas em histórico e tendências
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-48" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {previsoes.map((previsao) => {
                  const tendencia = previsao.historico.tendencia_percentual;
                  
                  return (
                    <Card 
                      key={previsao.data}
                      className="border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
                    >
                      <CardContent className="p-4">
                        {/* Header do dia */}
                        <div className={`p-3 rounded-lg bg-gradient-to-r ${getDiaSemanaColor(previsao.dia_semana)} text-white mb-4`}>
                          <div className="font-bold">{previsao.dia_semana}</div>
                          <div className="text-sm opacity-90">
                            {new Date(previsao.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </div>
                        </div>

                        {/* Evento */}
                        {previsao.evento_agendado && (
                          <div className="mb-3 text-xs text-gray-600 dark:text-gray-400 truncate">
                            🎤 {previsao.evento_agendado}
                          </div>
                        )}

                        {/* Previsão */}
                        <div className="text-center mb-4">
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {formatCurrency(previsao.previsao.faturamento)}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {previsao.previsao.publico} PAX
                          </div>
                          <div className="mt-1">
                            {getConfiancaBadge(previsao.previsao.confianca)}
                          </div>
                        </div>

                        {/* Comparação */}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">vs Média:</span>
                          <span className={`flex items-center gap-1 ${tendencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {tendencia >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {tendencia >= 0 ? '+' : ''}{tendencia.toFixed(1)}%
                          </span>
                        </div>

                        {/* Histórico resumido */}
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <div className="text-xs text-gray-500">
                            Base: {previsao.historico.amostras} {previsao.dia_semana}s anteriores
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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
