'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  TrendingDown,
  RefreshCcw,
  Calendar,
  DollarSign,
  Package,
  ShoppingCart,
  Users,
  Calculator,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Info
} from 'lucide-react';
import { useBar } from '@/contexts/BarContext';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CMVSemanal {
  id: number;
  bar_id: number;
  ano: number;
  semana: number;
  data_inicio: string;
  data_fim: string;
  cmv_real: number;
  faturamento_cmvivel: number;
  cmv_limpo_percentual: number;
  cmv_teorico_percentual: number;
  gap: number;
  estoque_inicial: number;
  compras_periodo: number;
  estoque_final: number;
  consumo_socios: number;
  consumo_beneficios: number;
  consumo_adm: number;
  consumo_rh: number;
  consumo_artista: number;
  outros_ajustes: number;
  ajuste_bonificacoes: number;
}

export default function CMVSemanalVisualizarPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const { user } = useUser();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [cmvs, setCmvs] = useState<CMVSemanal[]>([]);
  const [anoFiltro, setAnoFiltro] = useState(() => new Date().getFullYear());

  // Carregar dados
  const carregarCMVs = useCallback(async () => {
    if (!selectedBar || !user) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        bar_id: selectedBar.id.toString(),
        ano: anoFiltro.toString()
      });

      const response = await fetch(`/api/cmv-semanal?${params}`, {
        headers: {
          'x-user-data': encodeURIComponent(JSON.stringify({ ...user, bar_id: selectedBar?.id }))
        }
      });

      if (!response.ok) throw new Error('Erro ao carregar CMVs');

      const data = await response.json();
      
      // Filtrar apenas CMVs com dados (não zerados)
      const cmvsComDados = (data.data || []).filter((cmv: CMVSemanal) => 
        cmv.faturamento_cmvivel > 0 || cmv.cmv_real > 0
      );
      
      setCmvs(cmvsComDados);

    } catch (error) {
      console.error('Erro ao carregar CMVs:', error);
      toast({
        title: "Erro ao carregar CMVs",
        description: "Não foi possível carregar os dados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [selectedBar, user, anoFiltro, toast]);

  useEffect(() => {
    setPageTitle('📊 Visualização CMV Semanal');
  }, [setPageTitle]);

  useEffect(() => {
    if (selectedBar && user) {
      carregarCMVs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBar, user, anoFiltro]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCcw className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">Carregando CMVs...</p>
        </div>
      </div>
    );
  }

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor || 0);
  };

  const formatarPercentual = (valor: number) => {
    return `${(valor || 0).toFixed(2)}%`;
  };

  // Calcular estatísticas
  const cmvMedio = cmvs.length > 0 
    ? cmvs.reduce((sum, cmv) => sum + cmv.cmv_limpo_percentual, 0) / cmvs.length 
    : 0;

  const gapMedio = cmvs.length > 0 
    ? cmvs.reduce((sum, cmv) => sum + cmv.gap, 0) / cmvs.length 
    : 0;

  const faturamentoTotal = cmvs.reduce((sum, cmv) => sum + cmv.faturamento_cmvivel, 0);
  const cmvRealTotal = cmvs.reduce((sum, cmv) => sum + cmv.cmv_real, 0);

  // Preparar dados para gráficos
  const dadosGrafico = cmvs.map(cmv => ({
    semana: `S${cmv.semana}`,
    'CMV Limpo': parseFloat(cmv.cmv_limpo_percentual.toFixed(2)),
    'CMV Teórico': parseFloat(cmv.cmv_teorico_percentual.toFixed(2)),
    'Gap': parseFloat(cmv.gap.toFixed(2)),
  }));

  const dadosConsumos = cmvs.map(cmv => ({
    semana: `S${cmv.semana}`,
    'Sócios': cmv.consumo_socios,
    'Benefícios': cmv.consumo_beneficios,
    'ADM': cmv.consumo_adm,
    'Artista': cmv.consumo_artista,
  }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              📊 Visualização CMV Semanal
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Análise detalhada do CMV por semana
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={anoFiltro.toString()} onValueChange={(value) => setAnoFiltro(parseInt(value))}>
              <SelectTrigger className="w-32 select-dark">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="modal-select-content">
                {[2024, 2025, 2026].map((ano) => (
                  <SelectItem key={ano} value={ano.toString()} className="modal-select-item">
                    {ano}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={carregarCMVs}
              variant="outline"
              className="btn-outline-dark"
              leftIcon={<RefreshCcw className="h-4 w-4" />}
            >
              Atualizar
            </Button>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card className="card-dark">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                CMV Médio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatarPercentual(cmvMedio)}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Média do período
              </p>
            </CardContent>
          </Card>

          <Card className="card-dark">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Gap Médio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                gapMedio < 0 
                  ? 'text-yellow-600 dark:text-yellow-400' 
                  : gapMedio >= 0 && gapMedio <= 5
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatarPercentual(gapMedio)}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Diferença vs teórico
              </p>
            </CardContent>
          </Card>

          <Card className="card-dark">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Faturamento Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatarMoeda(faturamentoTotal)}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {cmvs.length} semanas
              </p>
            </CardContent>
          </Card>

          <Card className="card-dark">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Package className="h-4 w-4" />
                CMV Real Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatarMoeda(cmvRealTotal)}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Soma do período
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de CMV */}
        <Card className="card-dark mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <TrendingUp className="h-5 w-5" />
              Evolução do CMV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dadosGrafico}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis 
                  dataKey="semana" 
                  className="text-gray-600 dark:text-gray-400"
                />
                <YAxis className="text-gray-600 dark:text-gray-400" />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="CMV Limpo" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="CMV Teórico" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#10b981' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="Gap" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  dot={{ fill: '#ef4444' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Consumos */}
        <Card className="card-dark mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <Users className="h-5 w-5" />
              Consumos Internos por Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosConsumos}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis 
                  dataKey="semana" 
                  className="text-gray-600 dark:text-gray-400"
                />
                <YAxis className="text-gray-600 dark:text-gray-400" />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px'
                  }}
                  formatter={(value) => formatarMoeda(value as number)}
                />
                <Legend />
                <Bar dataKey="Sócios" fill="#8b5cf6" />
                <Bar dataKey="Benefícios" fill="#ec4899" />
                <Bar dataKey="ADM" fill="#f59e0b" />
                <Bar dataKey="Artista" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tabela Detalhada */}
        <Card className="card-dark">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700">
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <Calendar className="h-5 w-5" />
              Detalhamento Semanal ({cmvs.length} registros)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">Semana</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">Período</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">Faturamento</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">CMV Real</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">CMV %</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">Gap</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cmvs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <Package className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-600 dark:text-gray-400 font-medium">
                          Nenhum CMV encontrado
                        </p>
                      </td>
                    </tr>
                  ) : (
                    cmvs.map((cmv) => (
                      <tr
                        key={cmv.id}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                          {cmv.ano} - S{cmv.semana}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(cmv.data_inicio).toLocaleDateString('pt-BR')} até{' '}
                          {new Date(cmv.data_fim).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-semibold text-gray-900 dark:text-white">
                          {formatarMoeda(cmv.faturamento_cmvivel)}
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-semibold text-gray-900 dark:text-white">
                          {formatarMoeda(cmv.cmv_real)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            className={`${
                              cmv.cmv_limpo_percentual <= 33
                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300'
                                : cmv.cmv_limpo_percentual <= 40
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300'
                                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300'
                            }`}
                          >
                            {formatarPercentual(cmv.cmv_limpo_percentual)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            className={`${
                              cmv.gap < 0
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300'
                                : cmv.gap >= 0 && cmv.gap <= 5
                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300'
                                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300'
                            }`}
                          >
                            {formatarPercentual(cmv.gap)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {cmv.gap < 0 ? (
                            <Info className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mx-auto" />
                          ) : cmv.gap >= 0 && cmv.gap <= 5 ? (
                            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

