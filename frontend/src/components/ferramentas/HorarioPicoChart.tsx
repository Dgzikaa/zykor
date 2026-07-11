'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBar } from '@/contexts/BarContext';
import dynamic from 'next/dynamic';
import { useGraficoTheme } from '@/components/graficos/GraficoBase';
import {
  TrendingUpIcon, 
  UsersIcon, 
  DollarSignIcon, 
  RefreshCwIcon,
  AlertCircleIcon,
  EyeIcon,
  TrendingDownIcon,
  BarChart3Icon,
  LineChartIcon,
  PackageIcon
} from 'lucide-react';

// ECharts inline (combo barra + 3 linhas) — sem equivalente no catálogo.
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface HorarioPicoData {
  hora: number;
  faturamento: number;
  transacoes: number;
  faturamento_semana_passada: number;
  media_ultimas_4: number;
  recorde_faturamento: number;
}

interface Estatisticas {
  total_faturamento: number;
  total_faturamento_semana_passada: number;
  total_media_ultimas_4: number;
  total_recorde: number;
  total_recorde_real: number; // Valor real do recorde (bronze_contahub_financeiro_pagamentos)
  hora_pico_faturamento: number;
  max_faturamento: number;
  total_pessoas_dia: number;
  total_couvert: number;
  total_pagamentos: number;
  total_repique: number;
  faturamento_total_calculado: number;
  faturamento_bar: number;
  total_produtos_vendidos: number;
  produto_mais_vendido: string | null;
  produto_mais_vendido_qtd: number;
  produto_mais_faturou: string | null;
  produto_mais_faturou_valor: number;
  produtos_ranking: Array<{
    produto: string;
    quantidade: number;
    valor: number;
  }>;
  data_recorde: string;
  comparacao_semana_passada: number;
  comparacao_media_ultimas_4: number;
  comparacao_recorde: number;
}

interface StockoutResumo {
  data_referencia: string;
  total_produtos_ativos: number;
  produtos_disponiveis: number;
  produtos_stockout: number;
  percentual_stockout: string;
  percentual_disponibilidade: string;
}

interface LinhaVisibilidade {
  faturamento: boolean;
  semana_passada: boolean;
  media_ultimas_4: boolean;
  recorde: boolean;
}

interface HorarioPicoChartProps {
  dataSelecionada: string;
  onDataChange?: (data: string) => void;
}

export function HorarioPicoChart({ dataSelecionada, onDataChange }: HorarioPicoChartProps) {
  const { selectedBar } = useBar();
  const th = useGraficoTheme();
  const [dados, setDados] = useState<HorarioPicoData[]>([]);
  const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null);
  const [stockoutResumo, setStockoutResumo] = useState<StockoutResumo | null>(null);
  const [diaSemana, setDiaSemana] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [barFechado, setBarFechado] = useState<{ motivo: string } | null>(null);
  const [dataInput, setDataInput] = useState(dataSelecionada);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [linhasVisiveis, setLinhasVisiveis] = useState<LinhaVisibilidade>({
    faturamento: true,
    semana_passada: true,
    media_ultimas_4: true,
    recorde: true
  });

  // Sincronizar estado interno com prop
  useEffect(() => {
    setDataInput(dataSelecionada);
  }, [dataSelecionada]);

  // Cleanup do timer
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Função para detectar se foi navegação de mês ou seleção de data
  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const novaData = event.target.value;
    
    // Sempre atualiza o estado local (para mostrar no input)
    setDataInput(novaData);
    
    console.log('📅 onChange disparado:', novaData);
    
    // Só processa se é uma data válida e completa
    if (novaData && 
        novaData.length === 10 && 
        !isNaN(Date.parse(novaData)) && 
        novaData !== dataSelecionada) {
      
      // Verifica se foi apenas mudança de mês (mesmo dia)
      const dataAtual = new Date(dataSelecionada);
      const novaDataObj = new Date(novaData);
      
      const mesmoDia = dataAtual.getDate() === novaDataObj.getDate();
      const mesmoAno = dataAtual.getFullYear() === novaDataObj.getFullYear();
      const mesDiferente = dataAtual.getMonth() !== novaDataObj.getMonth();
      
      if (mesmoDia && mesmoAno && mesDiferente) {
        console.log('🔄 Navegação de mês detectada - ignorando');
        return;
      }
      
      console.log('✅ Seleção de data real - aplicando:', novaData);
      onDataChange?.(novaData);
    } else {
      console.log('❌ Data inválida ou incompleta, ignorando');
    }
  };

  const buscarDados = async () => {
    setLoading(true);
    setError(null);
    setBarFechado(null);
    
    try {
      // Buscar dados do horário de pico
      const response = await fetch('/api/ferramentas/horario-pico', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data_selecionada: dataSelecionada,
          bar_id: selectedBar?.id
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar dados');
      }

      const result = await response.json();

      if (result.success && result.data) {
        // Processar dados para o gráfico (horario_pico pode vir vazio quando bar_fechado)
        const horarioPico = result.data.horario_pico ?? [];
        const dadosProcessados = horarioPico.map((item: any) => ({
          ...item,
          hora_formatada: `${item.hora.toString().padStart(2, '0')}:00`
        }));

        setDados(dadosProcessados);
        setEstatisticas(result.data.estatisticas ?? null);
        setDiaSemana(result.data.dia_semana ?? '');
        setBarFechado(result.bar_fechado ? { motivo: result.motivo || 'Bar fechado' } : null);
      } else {
        setError(result.error || 'Erro desconhecido');
      }

      // Buscar dados de stockout em paralelo
      try {
        const stockoutResponse = await fetch(`/api/analitico/stockout-resumo?data=${dataSelecionada}&bar_id=${selectedBar?.id}`);
        if (stockoutResponse.ok) {
          const stockoutResult = await stockoutResponse.json();
          if (stockoutResult.success) {
            setStockoutResumo(stockoutResult.data);
          }
        }
      } catch (stockoutErr) {
        console.warn('Erro ao buscar dados de stockout:', stockoutErr);
        // Não falha o componente se stockout não funcionar
      }

    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dataSelecionada && selectedBar) {
      buscarDados();
    }
  }, [dataSelecionada, selectedBar?.id]);

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const formatarHora = (hora: number) => {
    return `${hora.toString().padStart(2, '0')}:00`;
  };

  const toggleLinha = (linha: keyof LinhaVisibilidade) => {
    setLinhasVisiveis(prev => ({
      ...prev,
      [linha]: !prev[linha]
    }));
  };

  // Cores personalizadas para cada linha
  const cores = {
    faturamento: '#3B82F6', // Azul
    presenca: '#EF4444', // Vermelho
    semana_passada: '#10B981', // Verde
    media_ultimas_4: '#8B5CF6', // Roxo
    recorde: '#F59E0B', // Amarelo/Laranja
  };

  const formatarData = (dataStr: string) => {
    if (!dataStr) return '';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  if (loading) {
    return (
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardContent className="p-6">
          <div className="text-center py-8">
            <AlertCircleIcon className="w-12 h-12 mx-auto text-red-500 mb-4" />
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <Button onClick={buscarDados} variant="outline">
              <RefreshCwIcon className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const nomeRecorde = estatisticas?.data_recorde
    ? `Recorde (${formatarData(estatisticas.data_recorde)})`
    : `Recorde (${diaSemana})`;

  const chartSeries: any[] = [];
  if (linhasVisiveis.faturamento) {
    chartSeries.push({
      name: 'Faturamento Atual',
      type: 'bar',
      data: dados.map(d => d.faturamento),
      itemStyle: { color: cores.faturamento, opacity: 0.8, borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 40,
    });
  }
  if (linhasVisiveis.semana_passada) {
    chartSeries.push({
      name: 'Semana Passada',
      type: 'line',
      smooth: true,
      data: dados.map(d => d.faturamento_semana_passada),
      lineStyle: { color: cores.semana_passada, width: 3 },
      itemStyle: { color: cores.semana_passada },
      symbol: 'circle',
      symbolSize: 8,
    });
  }
  if (linhasVisiveis.media_ultimas_4) {
    chartSeries.push({
      name: 'Média 4 Semanas',
      type: 'line',
      smooth: true,
      data: dados.map(d => d.media_ultimas_4),
      lineStyle: { color: cores.media_ultimas_4, width: 3, type: [8, 8] },
      itemStyle: { color: cores.media_ultimas_4 },
      symbol: 'circle',
      symbolSize: 8,
    });
  }
  if (linhasVisiveis.recorde) {
    chartSeries.push({
      name: nomeRecorde,
      type: 'line',
      smooth: true,
      data: dados.map(d => d.recorde_faturamento),
      lineStyle: { color: cores.recorde, width: 3, type: [4, 4] },
      itemStyle: { color: cores.recorde },
      symbol: 'circle',
      symbolSize: 8,
    });
  }

  const chartOption = {
    grid: { top: 40, right: 30, bottom: 10, left: 20, containLabel: true },
    legend: { top: 0, textStyle: { color: th.texto2, fontSize: 12 } },
    tooltip: {
      trigger: 'axis',
      backgroundColor: th.surface,
      borderColor: th.eixo,
      borderWidth: 1,
      textStyle: { color: th.texto, fontSize: 12 },
      formatter: (params: any[]) => {
        if (!params?.length) return '';
        const rows = [...params]
          .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
          .map(p => {
            const nome = p.seriesName;
            const valor = formatarMoeda(Number(p.value ?? 0));
            return `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${p.color};font-weight:500">${nome}:</span><span style="font-weight:600">${valor}</span></div>`;
          })
          .join('');
        return `<div style="font-weight:600;margin-bottom:4px">Horário: ${params[0].axisValue}</div>${rows}`;
      },
    },
    xAxis: {
      type: 'category',
      data: dados.map(d => (d as any).hora_formatada),
      axisLine: { lineStyle: { color: th.eixo } },
      axisTick: { show: false },
      axisLabel: { color: th.texto2, fontSize: 12 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: th.grid } },
      axisLabel: { color: th.muted, fontSize: 12, formatter: (v: number) => `R$ ${(v / 1000).toFixed(0)}k` },
    },
    series: chartSeries,
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart3Icon className="w-6 h-6" />
                Horário de Pico - {diaSemana}
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Análise de faturamento e presença por hora • {dataSelecionada}
                {barFechado && (
                  <span className="ml-2 inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                    ⚠️ {barFechado.motivo}
                  </span>
                )}
              </CardDescription>
            </div>
            {/* Seletor de Data integrado */}
            <div className="flex items-center gap-2">
              <Label htmlFor="data-grafico" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Data:
              </Label>
              <Input
                id="data-grafico"
                type="date"
                value={dataInput}
                onChange={handleDateChange}
                className="w-40 input-dark"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controles de Visibilidade */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <EyeIcon className="h-4 w-4" />
              Controles de Visualização
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="faturamento"
                  checked={linhasVisiveis.faturamento}
                  onCheckedChange={() => toggleLinha('faturamento')}
                />
                <Label htmlFor="faturamento" className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  ● Faturamento Atual
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="semana_passada"
                  checked={linhasVisiveis.semana_passada}
                  onCheckedChange={() => toggleLinha('semana_passada')}
                />
                <Label htmlFor="semana_passada" className="text-sm font-medium text-green-600 dark:text-green-400">
                  ● Semana Passada
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="media_ultimas_4"
                  checked={linhasVisiveis.media_ultimas_4}
                  onCheckedChange={() => toggleLinha('media_ultimas_4')}
                />
                <Label htmlFor="media_ultimas_4" className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  ● Média 4 Semanas
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="recorde"
                  checked={linhasVisiveis.recorde}
                  onCheckedChange={() => toggleLinha('recorde')}
                />
                <Label htmlFor="recorde" className="text-sm font-medium text-orange-600 dark:text-orange-400">
                  ● Recorde ({estatisticas?.data_recorde ? formatarData(estatisticas.data_recorde) : diaSemana})
                </Label>
              </div>
            </div>
          </div>

          {/* Resumo do Dia */}
          {estatisticas && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <BarChart3Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">⭐ Resumo do Dia - {dataSelecionada}</h3>
              </div>
              
              {/* Grid responsivo com métricas principais */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                {/* Produto Top */}
                <div className="text-center bg-white dark:bg-gray-800/50 p-2 sm:p-3 rounded-lg">
                  <div className="flex flex-col items-center mb-1">
                    <TrendingUpIcon className="w-4 h-4 text-green-600 dark:text-green-400 mb-1" />
                    <p className="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300">Produto Top</p>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-green-900 dark:text-green-100 truncate">
                    {estatisticas.produto_mais_vendido ? 
                      (estatisticas.produto_mais_vendido.length > 15 ? 
                        estatisticas.produto_mais_vendido.substring(0, 15) + '...' : 
                        estatisticas.produto_mais_vendido
                      ) : 'N/A'
                    }
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">
                    {estatisticas.produto_mais_vendido_qtd > 0 ? `${Math.round(estatisticas.produto_mais_vendido_qtd)} un` : 'Mais vendido'}
                  </p>
                </div>

                {/* Total do Dia - DESTAQUE */}
                <div className="col-span-2 sm:col-span-1 text-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 p-2 sm:p-3 rounded-lg border-2 border-purple-200 dark:border-purple-700">
                  <div className="flex flex-col items-center mb-1">
                    <DollarSignIcon className="w-5 h-5 text-purple-600 dark:text-purple-400 mb-1" />
                    <p className="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300">Total do Dia</p>
                  </div>
                  <p className="text-base sm:text-lg font-bold text-purple-900 dark:text-purple-100">
                    {formatarMoeda(estatisticas.faturamento_total_calculado || 0)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">Faturamento</p>
                </div>

                {/* Bar */}
                <div className="text-center bg-white dark:bg-gray-800/50 p-2 sm:p-3 rounded-lg">
                  <div className="flex flex-col items-center mb-1">
                    <DollarSignIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 mb-1" />
                    <p className="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300">Bar</p>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-blue-900 dark:text-blue-100">
                    {formatarMoeda(estatisticas.faturamento_bar || 0)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">Bebidas</p>
                </div>

                {/* Couvert */}
                <div className="text-center bg-white dark:bg-gray-800/50 p-2 sm:p-3 rounded-lg">
                  <div className="flex flex-col items-center mb-1">
                    <TrendingUpIcon className="w-4 h-4 text-green-600 dark:text-green-400 mb-1" />
                    <p className="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300">Couvert</p>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-green-900 dark:text-green-100">
                    {formatarMoeda(estatisticas.total_couvert || 0)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">Entrada</p>
                </div>

                {/* 10% Garçom */}
                <div className="text-center bg-white dark:bg-gray-800/50 p-2 sm:p-3 rounded-lg">
                  <div className="flex flex-col items-center mb-1">
                    <UsersIcon className="w-4 h-4 text-orange-600 dark:text-orange-400 mb-1" />
                    <p className="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300">10% Garçom</p>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-orange-900 dark:text-orange-100">
                    {formatarMoeda(estatisticas.total_repique || 0)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">Serviço</p>
                </div>

                {/* Pessoas */}
                <div className="text-center bg-white dark:bg-gray-800/50 p-2 sm:p-3 rounded-lg">
                  <div className="flex flex-col items-center mb-1">
                    <UsersIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mb-1" />
                    <p className="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300">Pessoas</p>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-indigo-900 dark:text-indigo-100">
                    {estatisticas.total_pessoas_dia || 0}
                  </p>
                </div>

                {/* % Stockout */}
                <div className="text-center bg-white dark:bg-gray-800/50 p-2 sm:p-3 rounded-lg">
                  <div className="flex flex-col items-center mb-1">
                    <PackageIcon className="w-4 h-4 text-red-600 dark:text-red-400 mb-1" />
                    <p className="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300">% Stockout</p>
                  </div>
                  <p className={`text-xs sm:text-sm font-bold ${
                    stockoutResumo ? (
                      parseFloat(stockoutResumo.percentual_stockout.replace('%', '')) <= 10 
                        ? 'text-green-900 dark:text-green-100'
                        : parseFloat(stockoutResumo.percentual_stockout.replace('%', '')) <= 25
                        ? 'text-yellow-900 dark:text-yellow-100'
                        : 'text-red-900 dark:text-red-100'
                    ) : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {stockoutResumo?.percentual_stockout || '--'}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">
                    {stockoutResumo ? `${stockoutResumo.produtos_stockout}/${stockoutResumo.total_produtos_ativos}` : '--'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Gráfico - altura responsiva */}
          <div className="h-[280px] sm:h-[360px] lg:h-[400px]">
            <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} notMerge lazyUpdate />
          </div>

          {/* Cards de Comparação */}
          {estatisticas && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-xl border ${
                estatisticas.comparacao_semana_passada >= 0 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center gap-3">
                  {estatisticas.comparacao_semana_passada >= 0 ? (
                    <TrendingUpIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDownIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
                  )}
                  <div>
                    <p className={`text-sm font-medium ${
                      estatisticas.comparacao_semana_passada >= 0 
                        ? 'text-green-700 dark:text-green-300' 
                        : 'text-red-700 dark:text-red-300'
                    }`}>
                      vs. Semana Passada
                    </p>
                    <p className={`text-lg font-bold ${
                      estatisticas.comparacao_semana_passada >= 0 
                        ? 'text-green-900 dark:text-green-100' 
                        : 'text-red-900 dark:text-red-100'
                    }`}>
                      {estatisticas.comparacao_semana_passada >= 0 ? '+' : ''}
                      {formatarMoeda(estatisticas.comparacao_semana_passada)}
                    </p>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-xl border ${
                estatisticas.comparacao_media_ultimas_4 >= 0 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center gap-3">
                  {estatisticas.comparacao_media_ultimas_4 >= 0 ? (
                    <TrendingUpIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDownIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
                  )}
                  <div>
                    <p className={`text-sm font-medium ${
                      estatisticas.comparacao_media_ultimas_4 >= 0 
                        ? 'text-green-700 dark:text-green-300' 
                        : 'text-red-700 dark:text-red-300'
                    }`}>
                      vs. Média 4 Semanas
                    </p>
                    <p className={`text-lg font-bold ${
                      estatisticas.comparacao_media_ultimas_4 >= 0 
                        ? 'text-green-900 dark:text-green-100' 
                        : 'text-red-900 dark:text-red-100'
                    }`}>
                      {estatisticas.comparacao_media_ultimas_4 >= 0 ? '+' : ''}
                      {formatarMoeda(estatisticas.comparacao_media_ultimas_4)}
                    </p>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-xl border ${
                estatisticas.comparacao_recorde >= 0 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center gap-3">
                  {estatisticas.comparacao_recorde >= 0 ? (
                    <TrendingUpIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDownIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
                  )}
                  <div>
                    <p className={`text-sm font-medium ${
                      estatisticas.comparacao_recorde >= 0 
                        ? 'text-green-700 dark:text-green-300' 
                        : 'text-red-700 dark:text-red-300'
                    }`}>
                      vs. Recorde ({estatisticas.data_recorde ? formatarData(estatisticas.data_recorde) : diaSemana})
                    </p>
                    <p className={`text-lg font-bold ${
                      estatisticas.comparacao_recorde >= 0 
                        ? 'text-green-900 dark:text-green-100' 
                        : 'text-red-900 dark:text-red-100'
                    }`}>
                      {estatisticas.comparacao_recorde >= 0 ? '+' : ''}
                      {formatarMoeda(estatisticas.comparacao_recorde)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}


        </CardContent>
      </Card>
    </div>
  );
}