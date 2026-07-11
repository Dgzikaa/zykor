'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useGraficoTheme } from '@/components/graficos/GraficoBase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  RefreshCw,
  BarChart3,
  LineChart,
  Users,
  Clock,
  Package
} from 'lucide-react';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/hooks/use-toast';

// ECharts inline — gráficos combinados (barra + N linhas, 2º eixo, cores condicionais, tooltips custom)
// não cabem nos componentes do catálogo. Padrão de referência: ferramentas/analises/previsao.
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface HorarioSemanalData {
  hora: number;
  hora_formatada: string;
  faturamento_atual: number;
  faturamento_semana1: number;
  faturamento_semana2: number;
  faturamento_semana3: number;
  media_4_semanas: number;
  // Adicionar as datas para mostrar no tooltip
  data_atual?: string;
  data_semana1?: string;
  data_semana2?: string;
  data_semana3?: string;
  // Novos campos para suportar múltiplas datas
  todas_datas?: { [data: string]: number };
  datas_ordenadas?: string[];
}

interface EstatisticasSemana {
  total_faturamento_atual: number;
  total_faturamento_semana1: number;
  total_faturamento_semana2: number;
  total_faturamento_semana3: number;
  media_total_4_semanas: number;
  horario_pico_atual: number;
  horario_pico_media: number;
  crescimento_vs_semana_anterior: number;
  crescimento_vs_media: number;
  data_atual: string;
  data_semana1: string;
  data_semana2: string;
  data_semana3: string;
}

interface StockoutSemanal {
  media_stockout: string;
  total_dias: number;
  dados_por_data: Array<{
    data_referencia: string;
    percentual_stockout: number;
  }>;
}

interface ResumoPorData {
  data: string;
  data_formatada: string;
  dia_semana: string;
  total_faturamento: number;
  horario_pico: number;
  horario_pico_valor: number;
  produto_mais_vendido: string;
  produto_mais_vendido_qtd: number;
  produto_mais_vendido_valor: number;
  total_produtos_vendidos: number;
  produtos_unicos: number;
}

interface DadosValorTotal {
  mes: string;
  mes_completo: string;
  dia_semana: string;
  data_completa: string;
  data_formatada: string;
  valor_total: number;
  cor_index: number;
  cor: string;
  sextas_detalhes?: { data: string, valor: number }[];
  // Propriedades dos dias da semana para modo multidimensional
  dom?: number;
  seg?: number;
  ter?: number;
  qua?: number;
  qui?: number;
  sex?: number;
  sab?: number;
  [key: string]: any; // Para permitir propriedades dinâmicas
}

interface LinhaVisibilidade {
  atual: boolean;
  semana1: boolean;
  semana2: boolean;
  semana3: boolean;
  media: boolean;
}

const DIAS_SEMANA = [
  { value: 'todos', label: 'Todos os Dias' },
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Segunda-feira' },
  { value: '2', label: 'Terça-feira' },
  { value: '3', label: 'Quarta-feira' },
  { value: '4', label: 'Quinta-feira' },
  { value: '5', label: 'Sexta-feira' },
  { value: '6', label: 'Sábado' }
];

const MESES_OPCOES = [
  { value: '2025-10', label: 'Outubro 2025' },
  { value: '2025-09', label: 'Setembro 2025' },
  { value: '2025-08', label: 'Agosto 2025' },
  { value: '2025-07', label: 'Julho 2025' },
  { value: '2025-06', label: 'Junho 2025' },
  { value: '2025-05', label: 'Maio 2025' },
  { value: '2025-04', label: 'Abril 2025' },
  { value: '2025-03', label: 'Março 2025' },
  { value: '2025-02', label: 'Fevereiro 2025' },
  { value: '2025-01', label: 'Janeiro 2025' }
];

export function ComparativoSemanal() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const th = useGraficoTheme();
  
  const [dados, setDados] = useState<HorarioSemanalData[]>([]);
  const [estatisticas, setEstatisticas] = useState<EstatisticasSemana | null>(null);
  const [stockoutSemanal, setStockoutSemanal] = useState<StockoutSemanal | null>(null);
  const [resumoPorData, setResumoPorData] = useState<ResumoPorData[]>([]);
  const [dadosValorTotal, setDadosValorTotal] = useState<DadosValorTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [diaSelecionado, setDiaSelecionado] = useState<string>('todos'); // Todos os dias por padrão
  const [mesesSelecionados, setMesesSelecionados] = useState<string[]>(['2025-10', '2025-09', '2025-08']); // 3 meses mais recentes por padrão
  const [modoComparacao, setModoComparacao] = useState<'individual' | 'mes_x_mes'>('individual'); // Modo Individual por padrão
  const [linhasVisiveis, setLinhasVisiveis] = useState<LinhaVisibilidade>({
    atual: true,
    semana1: true,
    semana2: true,
    semana3: true,
    media: true
  });

  // Estado dinâmico para controlar visibilidade de cada data individual
  const [linhasVisiveisDinamicas, setLinhasVisiveisDinamicas] = useState<{ [data: string]: boolean }>({});

  const toggleMes = (mes: string) => {
    setMesesSelecionados(prev => {
      if (prev.includes(mes)) {
        // Se já está selecionado, remove (mas mantém pelo menos 1)
        return prev.length > 1 ? prev.filter(m => m !== mes) : prev;
      } else {
        // Se não está selecionado, adiciona (máximo 4 meses para usar todas as linhas do gráfico)
        return prev.length < 4 ? [...prev, mes] : prev;
      }
    });
  };

  const carregarDados = async () => {
    if (!selectedBar?.id) {
      console.log('⏳ Aguardando seleção do bar...');
      return;
    }
    
    setLoading(true);
    
    try {
      // 🎯 Usar os meses realmente selecionados pelo usuário
      const mesesParam = mesesSelecionados.join(',');
      console.log('🎯 Carregando dados para os meses selecionados:', mesesSelecionados);
      console.log('🎯 Parâmetros:', { 
        barId: selectedBar.id, 
        diaSemana: diaSelecionado, 
        meses: mesesParam, 
        modo: modoComparacao 
      });
      
      const response = await fetch(
        `/api/analitico/semanal-horario?barId=${selectedBar.id}&diaSemana=${diaSelecionado}&meses=${mesesParam}&modo=${modoComparacao}`
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro HTTP:', response.status, errorText);
        throw new Error(`Erro ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('📊 Resposta completa da API:', result);
      console.log('🎯 Modo atual:', modoComparacao);
      console.log('🎯 Dia selecionado:', diaSelecionado);
      console.log('🎯 Meses selecionados:', mesesSelecionados);
      
      if (result.success) {
        console.log('✅ Dados recebidos com sucesso:', {
          horarios: result.data.horarios?.length || 0,
          estatisticas: !!result.data.estatisticas,
          resumoPorData: result.data.resumo_por_data?.length || 0,
          valorTotal: result.data.valor_total_por_mes?.length || 0
        });
        
        console.log('📊 Dados valor total recebidos:', result.data.valor_total_por_mes);
        
        if (modoComparacao === 'mes_x_mes' && diaSelecionado === 'todos') {
          console.log('🔍 MODO MÊS X MÊS + TODOS OS DIAS - Analisando dados...');
          console.log('🔍 Valor total por mês:', result.data.valor_total_por_mes);
        }
        
        // Verificar se os dados são válidos
        if (!result.data.horarios || !Array.isArray(result.data.horarios)) {
          throw new Error('Dados de horários inválidos');
        }
        
        setDados(result.data.horarios);
        setEstatisticas(result.data.estatisticas);
        setResumoPorData(result.data.resumo_por_data || []);
        setDadosValorTotal(result.data.valor_total_por_mes || []);

        // Inicializar estado dinâmico para modo individual
        if (modoComparacao === 'individual' && result.data.horarios.length > 0 && result.data.horarios[0].datas_ordenadas) {
          inicializarLinhasDinamicas(result.data.horarios[0].datas_ordenadas);
        }

        // Buscar dados de stockout semanal
        try {
          const hoje = new Date();
          const umaSemanaAtras = new Date(hoje);
          umaSemanaAtras.setDate(hoje.getDate() - 7);
          
          const dataFim = hoje.toISOString().split('T')[0];
          const dataInicio = umaSemanaAtras.toISOString().split('T')[0];

          const stockoutResponse = await fetch('/api/analitico/stockout-resumo', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              data_inicio: dataInicio,
              data_fim: dataFim,
              bar_id: selectedBar.id
            }),
          });

          if (stockoutResponse.ok) {
            const stockoutResult = await stockoutResponse.json();
            if (stockoutResult.success) {
              setStockoutSemanal(stockoutResult.data);
            }
          }
        } catch (stockoutErr) {
          console.warn('Erro ao buscar dados de stockout semanal:', stockoutErr);
          // Não falha o componente se stockout não funcionar
        }

      } else {
        console.error('❌ API retornou erro:', result.error);
        throw new Error(result.error || 'Erro desconhecido da API');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados semanais:', error);
      
      // Limpar dados em caso de erro
      setDados([]);
      setEstatisticas(null);
      setResumoPorData([]);
      setDadosValorTotal([]);
      
      // Verificar se é timeout
      const isTimeout = error instanceof Error && 
        (error.message.includes('timeout') || error.message.includes('408'));
      
      toast({
        title: isTimeout ? "⏱️ Consulta muito lenta" : "Erro ao carregar dados",
        description: isTimeout 
          ? "A consulta demorou muito. Tente selecionar menos meses ou um dia específico da semana."
          : error instanceof Error ? error.message : "Erro desconhecido. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Só carregar dados quando o bar estiver selecionado
    if (selectedBar?.id) {
      carregarDados();
    }
  }, [selectedBar?.id, diaSelecionado, mesesSelecionados, modoComparacao]);

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

  // Função para alternar visibilidade de linhas dinâmicas (por data específica)
  const toggleLinhaDinamica = (data: string) => {
    setLinhasVisiveisDinamicas(prev => ({
      ...prev,
      [data]: !prev[data]
    }));
  };

  // Inicializar estado dinâmico quando dados chegarem
  const inicializarLinhasDinamicas = (datasOrdenadas: string[]) => {
    const novoEstado: { [data: string]: boolean } = {};
    datasOrdenadas.forEach(data => {
      novoEstado[data] = true; // Todas visíveis por padrão
    });
    setLinhasVisiveisDinamicas(novoEstado);
  };

  // Cores personalizadas para cada linha
  const cores = {
    atual: '#3B82F6', // Azul
    semana1: '#10B981', // Verde
    semana2: '#8B5CF6', // Roxo
    semana3: '#F59E0B', // Amarelo/Laranja
    media: '#EF4444', // Vermelho
  };

  // Paleta de cores para múltiplas datas (24 cores distintas)
  const paletaCores = [
    '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4',
    '#84CC16', '#F97316', '#EC4899', '#6366F1', '#14B8A6', '#A855F7',
    '#EAB308', '#DC2626', '#0EA5E9', '#65A30D', '#EA580C', '#BE185D',
    '#4F46E5', '#059669', '#7C3AED', '#CA8A04', '#B91C1C', '#0284C7'
  ];

  // Gerar cores dinâmicas baseadas nas datas encontradas
  const gerarCoresDinamicas = () => {
    if (modoComparacao === 'individual' && dados.length > 0 && dados[0].datas_ordenadas) {
      const datasEncontradas = dados[0].datas_ordenadas;
      const coresDinamicas: { [data: string]: string } = {};
      
      datasEncontradas.forEach((data, index) => {
        coresDinamicas[data] = paletaCores[index % paletaCores.length];
      });
      
      return coresDinamicas;
    }
    return {};
  };

  const coresDinamicas = gerarCoresDinamicas();

  // Formatador de valores do eixo/label dos gráficos (mesma regra dos rótulos recharts anteriores)
  const kfmt = (value: number) => `R$ ${(value / 1000).toFixed(0)}k`;

  // ── Gráfico de Valor Total (barra) — ambos os modos ──
  // Reconstrói os 2 layouts recharts (múltiplas barras por dia da semana / barra única por mês)
  // preservando cores condicionais, rótulos e o conteúdo exato dos tooltips custom.
  const buildValorTotalOption = () => {
    const xData = dadosValorTotal.map(d => d.data_formatada);
    const yAxis = {
      type: 'value' as const,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: th.grid } },
      axisLabel: { color: th.muted, fontSize: 11, formatter: (v: number) => kfmt(v) },
    };
    const xAxis = {
      type: 'category' as const,
      data: xData,
      axisLine: { lineStyle: { color: th.eixo } },
      axisTick: { show: false },
      axisLabel: { color: th.muted, fontSize: 11, hideOverlap: true },
    };

    if (modoComparacao === 'mes_x_mes' && diaSelecionado === 'todos') {
      // 🚀 LAYOUT ESTRATÉGICO: Múltiplas barras por dia da semana
      const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const coresDias = ['#EF4444', '#F59E0B', '#84CC16', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6'];
      return {
        grid: { top: 48, right: 24, bottom: 8, left: 8, containLabel: true },
        xAxis,
        yAxis,
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: th.surface,
          borderColor: th.eixo,
          borderWidth: 1,
          textStyle: { color: th.texto, fontSize: 12 },
          formatter: (params: any) => {
            const comValor = params.filter((p: any) => p.value > 0);
            const totalMes = comValor.reduce((sum: number, p: any) => sum + p.value, 0);
            const label = params[0]?.axisValue ?? '';
            let html = `<div style="min-width:200px">`;
            html += `<div style="font-weight:600;color:${th.texto};margin-bottom:6px">${label} - Todos os Dias</div>`;
            html += `<div style="font-size:13px;color:#3B82F6;font-weight:500;margin-bottom:6px">Total do Mês: ${formatarMoeda(totalMes)}</div>`;
            html += `<div style="border-top:1px solid ${th.eixo};padding-top:6px">`;
            html += `<div style="font-size:11px;color:${th.texto2};margin-bottom:4px">Por dia da semana:</div>`;
            comValor.slice().sort((a: any, b: any) => b.value - a.value).forEach((p: any) => {
              html += `<div style="font-size:11px;color:${th.texto};display:flex;justify-content:space-between;gap:12px;align-items:center"><span><span style="color:${p.color}">●</span> ${p.seriesName}</span><span style="font-weight:500">${formatarMoeda(p.value)}</span></div>`;
            });
            html += `</div></div>`;
            return html;
          },
        },
        series: diasSemana.map((dia, index) => ({
          name: dia,
          type: 'bar',
          data: dadosValorTotal.map(d => d[dia.toLowerCase()] || 0),
          itemStyle: { color: coresDias[index], opacity: 0.8 },
          label: {
            show: true,
            position: 'top',
            color: th.texto2,
            fontSize: 10,
            formatter: (p: any) => (p.value && p.value > 0) ? kfmt(p.value) : '',
          },
        })),
      };
    }

    // LAYOUT ORIGINAL: Uma barra por mês/data (cor condicional por entry)
    const nomeBarra = modoComparacao === 'mes_x_mes'
      ? `Média ${DIAS_SEMANA.find(d => d.value === diaSelecionado)?.label}s por Mês`
      : `${DIAS_SEMANA.find(d => d.value === diaSelecionado)?.label}s por Data`;
    return {
      grid: { top: 32, right: 24, bottom: 8, left: 8, containLabel: true },
      xAxis,
      yAxis,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: th.surface,
        borderColor: th.eixo,
        borderWidth: 1,
        textStyle: { color: th.texto, fontSize: 12 },
        formatter: (params: any) => {
          const data = dadosValorTotal[params[0]?.dataIndex];
          if (!data) return '';
          const titulo = modoComparacao === 'mes_x_mes'
            ? `${data.mes} (Total do Mês)`
            : `${data.data_formatada} (${data.mes})`;
          let html = `<div>`;
          html += `<div style="font-weight:600;color:${th.texto};margin-bottom:6px">${titulo}</div>`;
          html += `<div style="font-size:13px;color:#3B82F6;margin-bottom:6px"><strong>${modoComparacao === 'mes_x_mes' ? `Média: ${formatarMoeda(data.valor_total)}` : `Total: ${formatarMoeda(data.valor_total)}`}</strong></div>`;
          if (modoComparacao === 'mes_x_mes' && data.sextas_detalhes && data.sextas_detalhes.length > 0) {
            html += `<div style="border-top:1px solid ${th.eixo};padding-top:6px">`;
            html += `<div style="font-size:11px;color:${th.texto2};margin-bottom:4px">Valores individuais (${data.sextas_detalhes.length}x):</div>`;
            data.sextas_detalhes.slice().sort((a: any, b: any) => b.valor - a.valor).forEach((sexta: any) => {
              html += `<div style="font-size:11px;color:${th.texto}">${sexta.data} - ${formatarMoeda(sexta.valor)}</div>`;
            });
            html += `</div>`;
          }
          html += `</div>`;
          return html;
        },
      },
      series: [{
        name: nomeBarra,
        type: 'bar',
        data: dadosValorTotal.map(d => ({ value: d.valor_total, itemStyle: { color: d.cor, opacity: 0.8 } })),
        label: {
          show: true,
          position: 'top',
          color: th.texto2,
          fontSize: 10,
          formatter: (p: any) => kfmt(p.value),
        },
      }],
    };
  };

  // ── Gráfico por Hora (barra + N linhas) — reconstrói o CustomTooltip recharts ──
  const buildHoraOption = () => {
    const coresPorDiaSemana: Record<string, string> = {
      'Dom': '#EF4444', 'Seg': '#F59E0B', 'Ter': '#84CC16',
      'Qua': '#10B981', 'Qui': '#06B6D4', 'Sex': '#3B82F6', 'Sáb': '#8B5CF6'
    };
    const xData = dados.map(d => d.hora_formatada);
    const series: any[] = [];
    // metadados p/ reconstruir os rótulos do tooltip no modo Mês x Mês (recharts usava entry.dataKey)
    const dataKeyByName: Record<string, string> = {};
    const legendData: string[] = [];

    const pushLinha = (name: string, dataKey: string, color: string, opts: { width?: number; dash?: boolean; symbolSize?: number } = {}) => {
      dataKeyByName[name] = dataKey;
      legendData.push(name);
      series.push({
        name,
        type: 'line',
        smooth: true,
        symbolSize: opts.symbolSize ?? 8,
        data: dados.map((h: any) => (h[dataKey] ?? null)),
        itemStyle: { color },
        lineStyle: { color, width: opts.width ?? 2, type: opts.dash ? 'dashed' : 'solid' },
      });
    };
    const pushBarra = (name: string, dataKey: string, color: string, opacity: number) => {
      dataKeyByName[name] = dataKey;
      legendData.push(name);
      series.push({
        name,
        type: 'bar',
        data: dados.map((h: any) => (h[dataKey] ?? null)),
        itemStyle: { color, opacity },
      });
    };

    if (modoComparacao === 'individual' && dados.length > 0) {
      // 🎯 Modo Individual — uma linha por dia da semana (só os que têm dados)
      const diasComDados = new Set<string>();
      dados.forEach((horario: any) => {
        Object.keys(horario).forEach(key => {
          if (key.startsWith('dia_') && horario[key] > 0) {
            const diaAbrev = key.replace('dia_', '');
            diasComDados.add(diaAbrev.charAt(0).toUpperCase() + diaAbrev.slice(1));
          }
        });
      });

      if (diasComDados.size === 0 && dados[0].datas_ordenadas) {
        // Fallback: datas individuais agrupadas por dia da semana
        const datasPorDiaSemana = new Map<string, string[]>();
        dados[0].datas_ordenadas
          .filter(data => linhasVisiveisDinamicas[data] !== false)
          .forEach(data => {
            const dataObj = new Date(data + 'T12:00:00');
            const diaSemana = dataObj.toLocaleDateString('pt-BR', { weekday: 'long' });
            const diaAbrev = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1, 3);
            if (!datasPorDiaSemana.has(diaAbrev)) datasPorDiaSemana.set(diaAbrev, []);
            datasPorDiaSemana.get(diaAbrev)!.push(data);
          });
        Array.from(datasPorDiaSemana.entries()).forEach(([diaAbrev, datasDodia]) => {
          const dataKey = `data_${datasDodia[0].replace(/-/g, '_')}`;
          pushLinha(diaAbrev, dataKey, coresPorDiaSemana[diaAbrev] || '#6B7280');
        });
      } else {
        Array.from(diasComDados).forEach(diaAbrev => {
          pushLinha(diaAbrev, `dia_${diaAbrev.toLowerCase()}`, coresPorDiaSemana[diaAbrev] || '#6B7280');
        });
      }
    } else {
      // Modo Mês x Mês: barra atual + linhas semana1/2/3
      if (linhasVisiveis.atual) {
        pushBarra(
          modoComparacao === 'mes_x_mes' ? `Média ${MESES_OPCOES.find(m => m.value === mesesSelecionados[0])?.label.split(' ')[0]}` : 'Data 1',
          'faturamento_atual', cores.atual, 0.7
        );
      }
      if (linhasVisiveis.semana1) {
        pushLinha(
          modoComparacao === 'mes_x_mes' ? `Média ${MESES_OPCOES.find(m => m.value === mesesSelecionados[1])?.label.split(' ')[0]}` : 'Data 2',
          'faturamento_semana1', cores.semana1
        );
      }
      if (linhasVisiveis.semana2 && (modoComparacao !== 'mes_x_mes' || mesesSelecionados.length > 2)) {
        pushLinha(
          modoComparacao === 'mes_x_mes' ? `Média ${MESES_OPCOES.find(m => m.value === mesesSelecionados[2])?.label.split(' ')[0] || 'Mês 3'}` : 'Data 3',
          'faturamento_semana2', cores.semana2
        );
      }
      if (linhasVisiveis.semana3 && (modoComparacao !== 'mes_x_mes' || mesesSelecionados.length > 3)) {
        pushLinha(
          modoComparacao === 'mes_x_mes' ? `Média ${MESES_OPCOES.find(m => m.value === mesesSelecionados[3])?.label.split(' ')[0] || 'Mês 4'}` : 'Data 4',
          'faturamento_semana3', cores.semana3
        );
      }
    }

    if (linhasVisiveis.media) {
      pushLinha(
        modoComparacao === 'mes_x_mes' ? 'Média Geral' : 'Média 4 Semanas',
        'media_4_semanas', cores.media, { width: 3, dash: true, symbolSize: 10 }
      );
    }

    return {
      grid: { top: 40, right: 24, bottom: 8, left: 8, containLabel: true },
      legend: { top: 4, icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { color: th.texto2, fontSize: 12 }, data: legendData },
      xAxis: {
        type: 'category' as const,
        data: xData,
        axisLine: { lineStyle: { color: th.eixo } },
        axisTick: { show: false },
        axisLabel: { color: th.muted, fontSize: 11, hideOverlap: true },
      },
      yAxis: {
        type: 'value' as const,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: th.grid } },
        axisLabel: { color: th.muted, fontSize: 11, formatter: (v: number) => kfmt(v) },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: th.surface,
        borderColor: th.eixo,
        borderWidth: 1,
        textStyle: { color: th.texto, fontSize: 12 },
        formatter: (params: any) => {
          const label = Array.isArray(params) ? (params[0]?.axisValue ?? '') : params.axisValue;
          const dadosHora: any = dados.find(d => d.hora_formatada === label);
          let html = `<div><div style="font-weight:600;color:${th.texto};margin-bottom:6px">${label}</div>`;

          if (modoComparacao === 'individual' && dadosHora) {
            // Modo Individual — agrega por dia da semana a partir de dadosHora (igual ao CustomTooltip)
            const dadosPorDiaSemana = new Map<string, { valores: number[]; cor: string }>();
            Object.keys(dadosHora).forEach(key => {
              if (key.startsWith('dia_') && dadosHora[key] > 0) {
                const diaAbrev = key.replace('dia_', '');
                const diaCapitalizado = diaAbrev.charAt(0).toUpperCase() + diaAbrev.slice(1);
                dadosPorDiaSemana.set(diaCapitalizado, {
                  valores: [dadosHora[key]],
                  cor: coresPorDiaSemana[diaCapitalizado] || '#6B7280',
                });
              }
            });
            if (dadosPorDiaSemana.size === 0 && dadosHora.todas_datas && dadosHora.datas_ordenadas) {
              Object.entries(dadosHora.todas_datas)
                .filter(([, valor]) => (valor as number) > 0)
                .forEach(([data, valor]) => {
                  const dataObj = new Date(data + 'T12:00:00');
                  const diaSemana = dataObj.toLocaleDateString('pt-BR', { weekday: 'long' });
                  const diaAbrev = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1, 3);
                  if (!dadosPorDiaSemana.has(diaAbrev)) {
                    dadosPorDiaSemana.set(diaAbrev, { valores: [], cor: coresPorDiaSemana[diaAbrev] || '#6B7280' });
                  }
                  dadosPorDiaSemana.get(diaAbrev)!.valores.push(valor as number);
                });
            }
            if (dadosPorDiaSemana.size === 0) {
              const valorAtual = dadosHora.faturamento_atual || 0;
              if (valorAtual > 0) {
                html += `<div style="font-size:13px;display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:12px;height:12px;border-radius:9999px;background:#3B82F6"></span><span style="color:${th.texto2}">Atual: ${formatarMoeda(valorAtual)}</span></div>`;
              }
            } else {
              const ordemDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
              Array.from(dadosPorDiaSemana.entries())
                .map(([diaAbrev, d]) => {
                  const media = d.valores.reduce((sum, val) => sum + val, 0) / d.valores.length;
                  return { diaAbrev, cor: d.cor, media, count: d.valores.length };
                })
                .sort((a, b) => ordemDias.indexOf(a.diaAbrev) - ordemDias.indexOf(b.diaAbrev))
                .forEach(e => {
                  const txt = e.count > 1
                    ? `${e.diaAbrev} (${e.count}x): ${formatarMoeda(e.media)}`
                    : `${e.diaAbrev}: ${formatarMoeda(e.media)}`;
                  html += `<div style="font-size:13px;display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:12px;height:12px;border-radius:9999px;background:${e.cor}"></span><span style="color:${th.texto2}">${txt}</span></div>`;
                });
            }
            if (dadosHora.media_4_semanas > 0) {
              html += `<div style="font-size:13px;color:#EF4444;margin-top:4px;padding-top:4px;border-top:1px solid ${th.eixo}">Média Geral: ${formatarMoeda(dadosHora.media_4_semanas)}</div>`;
            }
          } else {
            // Modo Mês x Mês: reaproveita as séries, reetiquetando por dataKey
            const arr = Array.isArray(params) ? params.slice() : [params];
            arr.sort((a: any, b: any) => b.value - a.value).forEach((entry: any) => {
              let dataLabel = entry.seriesName;
              if (modoComparacao === 'mes_x_mes') {
                const dataKey = dataKeyByName[entry.seriesName];
                if (dataKey === 'faturamento_atual') {
                  dataLabel = MESES_OPCOES.find(m => m.value === mesesSelecionados[0])?.label.split(' ')[0] || 'Mês 1';
                } else if (dataKey === 'faturamento_semana1') {
                  dataLabel = MESES_OPCOES.find(m => m.value === mesesSelecionados[1])?.label.split(' ')[0] || 'Mês 2';
                } else if (dataKey === 'faturamento_semana2') {
                  dataLabel = MESES_OPCOES.find(m => m.value === mesesSelecionados[2])?.label.split(' ')[0] || 'Mês 3';
                } else if (dataKey === 'faturamento_semana3') {
                  dataLabel = MESES_OPCOES.find(m => m.value === mesesSelecionados[3])?.label.split(' ')[0] || 'Mês 4';
                } else if (dataKey === 'media_4_semanas') {
                  dataLabel = 'Média Geral';
                }
              }
              html += `<div style="font-size:13px;color:${entry.color}">${dataLabel}: ${formatarMoeda(entry.value)}</div>`;
            });
          }
          html += `</div>`;
          return html;
        },
      },
      series,
    };
  };

  const formatarData = (data: string) => {
    // Adicionar horário para evitar problemas de timezone
    const date = new Date(data + 'T12:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4">
          <div className="text-center">
            {/* Loading Circle */}
            <div className="relative mx-auto mb-6">
              <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-600 rounded-full"></div>
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            
            {/* Title */}
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Carregando dados semanais...
            </h3>
            
            {/* Subtitle */}
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Processando {mesesSelecionados.length} {mesesSelecionados.length === 1 ? 'mês' : 'meses'}...
            </p>
            
            {/* Timeout Warning */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                ⏱️ Consultas grandes podem demorar até 25 segundos
              </p>
            </div>
            
            {/* Progress dots */}
            <div className="flex justify-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 🛡️ Verificações de segurança
  if (!dados || dados.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Nenhum dado encontrado
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Não há dados disponíveis para o {DIAS_SEMANA.find(d => d.value === diaSelecionado)?.label.toLowerCase()} nos meses selecionados.
            </p>
            <button 
              onClick={carregarDados}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Verificar se os dados têm a estrutura esperada
  if (!Array.isArray(dados) || dados.some(item => !item.hora_formatada)) {
    console.error('❌ Estrutura de dados inválida:', dados);
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 text-red-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Erro nos dados
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Os dados recebidos estão em formato inválido. Tente recarregar a página.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors mr-2"
            >
              Recarregar Página
            </button>
            <button 
              onClick={carregarDados}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Carregando dados</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Processando {mesesSelecionados.length} {mesesSelecionados.length === 1 ? 'mês' : 'meses'}...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header com seletor */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Comparativo Semanal - {DIAS_SEMANA.find(d => d.value === diaSelecionado)?.label}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Comparativo entre {mesesSelecionados.map(m => MESES_OPCOES.find(opt => opt.value === m)?.label.split(' ')[0]).join(' vs ')} (17h às 3h)
          </p>
          {/* Debug Info */}
          <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
            🔍 Debug: Modo={modoComparacao} | Dia={diaSelecionado} | Meses={mesesSelecionados.length} | Dados={dadosValorTotal.length}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Seletor de Modo */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Modo:</label>
            <select 
              value={modoComparacao} 
              onChange={(e) => {
                const value = e.target.value as 'individual' | 'mes_x_mes';
                setModoComparacao(value);
                // 🎯 Quando muda para Individual, resetar para apenas Setembro
                if (value === 'individual') {
                  setMesesSelecionados(['2025-09']);
                  console.log('🎯 Modo Individual: Resetado para apenas Setembro');
                }
                // 🎯 Quando muda para Mês x Mês, usar apenas 3 meses mais recentes
                else if (value === 'mes_x_mes') {
                  setMesesSelecionados(['2025-10', '2025-09', '2025-08']);
                  console.log('🎯 Modo Mês x Mês: Resetado para 3 meses mais recentes');
                }
              }}
              className="bg-transparent text-sm text-gray-900 dark:text-white border-none outline-none"
            >
              <option value="individual" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Individual</option>
              <option value="mes_x_mes" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Mês x Mês</option>
            </select>
          </div>

          <Select value={diaSelecionado} onValueChange={setDiaSelecionado}>
            <SelectTrigger className="w-48 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
              <SelectValue placeholder="Escolha o dia da semana" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              {DIAS_SEMANA.map(dia => (
                <SelectItem 
                  key={dia.value} 
                  value={dia.value}
                  className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700"
                >
                  {dia.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Seleção de Meses */}
          <div className="flex flex-wrap gap-2">
            {MESES_OPCOES.slice(0, modoComparacao === 'mes_x_mes' ? 6 : 3).map(mes => (
              <label 
                key={mes.value}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                  mesesSelecionados.includes(mes.value)
                    ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-900 dark:text-blue-300'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={mesesSelecionados.includes(mes.value)}
                  onChange={() => toggleMes(mes.value)}
                  className="sr-only"
                />
                <span className="text-sm font-medium">{mes.label.split(' ')[0]}</span>
              </label>
            ))}
          </div>
          
          <Button onClick={carregarDados} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Carregando...' : 'Atualizar'}
          </Button>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      {estatisticas && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Mais Recente</p>
                  <p className="font-bold text-lg text-gray-900 dark:text-white">
                    {formatarMoeda(estatisticas.total_faturamento_atual)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatarData(estatisticas.data_atual)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Média 4 Semanas</p>
                  <p className="font-bold text-lg text-gray-900 dark:text-white">
                    {formatarMoeda(estatisticas.media_total_4_semanas)}
                  </p>
                  <p className={`text-xs ${estatisticas.crescimento_vs_media >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {estatisticas.crescimento_vs_media >= 0 ? '+' : ''}{estatisticas.crescimento_vs_media.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" />
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Horário Pico Atual</p>
                  <p className="font-bold text-lg text-gray-900 dark:text-white">
                    {formatarHora(estatisticas.horario_pico_atual)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Média: {formatarHora(estatisticas.horario_pico_media)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-orange-600" />
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">vs Último Similar</p>
                  <p className={`font-bold text-lg ${estatisticas.crescimento_vs_semana_anterior >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {estatisticas.crescimento_vs_semana_anterior >= 0 ? '+' : ''}{estatisticas.crescimento_vs_semana_anterior.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatarData(estatisticas.data_atual)} vs {formatarData(estatisticas.data_semana1)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-red-600" />
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">% Stockout Semanal</p>
                  <p className={`font-bold text-lg ${
                    stockoutSemanal ? (
                      parseFloat(stockoutSemanal.media_stockout.replace('%', '')) <= 10 
                        ? 'text-green-600' 
                        : parseFloat(stockoutSemanal.media_stockout.replace('%', '')) <= 25
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    ) : 'text-gray-500'
                  }`}>
                    {stockoutSemanal?.media_stockout || '--'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {stockoutSemanal ? `${stockoutSemanal.total_dias} dias` : 'Sem dados'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}


      {/* Gráfico de Valor Total (ambos os modos) */}
      {dadosValorTotal.length > 0 && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <TrendingUp className="w-5 h-5" />
              {modoComparacao === 'mes_x_mes' && diaSelecionado === 'todos'
                ? 'Evolução por Dia da Semana'
                : modoComparacao === 'mes_x_mes' 
                  ? `Média Mensal - ${DIAS_SEMANA.find(d => d.value === diaSelecionado)?.label}s`
                  : `Evolução Individual - ${DIAS_SEMANA.find(d => d.value === diaSelecionado)?.label}s`
              }
          </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              {modoComparacao === 'mes_x_mes' && diaSelecionado === 'todos'
                ? 'Comparativo de todos os dias da semana por mês'
                : modoComparacao === 'mes_x_mes'
                  ? `Média de todas as ${DIAS_SEMANA.find(d => d.value === diaSelecionado)?.label.toLowerCase()}s por mês`
                  : `Valor individual de cada ${DIAS_SEMANA.find(d => d.value === diaSelecionado)?.label.toLowerCase()} por data`
              }
            </CardDescription>
        </CardHeader>
        <CardContent>
            {/* 🎨 Legenda Estratégica Melhorada */}
            {dadosValorTotal.length > 0 && (
              <div className="mb-6">
                {/* Header da Legenda */}
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {modoComparacao === 'mes_x_mes' && diaSelecionado === 'todos' 
                      ? '📊 Evolução por Dia da Semana' 
                      : '📅 Evolução por Mês'
                    }
                  </h4>
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    {dadosValorTotal.length} {dadosValorTotal.length === 1 ? 'período' : 'períodos'}
                  </span>
                </div>
                
                {/* Legenda Organizada */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {modoComparacao === 'mes_x_mes' && diaSelecionado === 'todos' ? (
                      // Legenda para dias da semana - Layout em grid
                      ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, index) => {
                        const cores = ['#EF4444', '#F59E0B', '#84CC16', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6'];
                        const diasCompletos = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                        return (
                          <div key={dia} className="flex items-center gap-2 p-2 rounded-md bg-white dark:bg-gray-700/50">
                            <div 
                              className="w-4 h-4 rounded-full shadow-sm"
                              style={{ backgroundColor: cores[index] }}
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {dia}
                              </span>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {diasCompletos[index]}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : modoComparacao === 'individual' && diaSelecionado === 'todos' ? (
                      // 🎯 FILTROS DE DIAS DA SEMANA para modo Individual
                      ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, index) => {
                        const cores = ['#EF4444', '#F59E0B', '#84CC16', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6'];
                        const diasCompletos = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                        const diaValue = index.toString(); // 0=Domingo, 1=Segunda, etc.
                        
                        return (
                          <label 
                            key={dia}
                            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all ${
                              diaSelecionado === diaValue || diaSelecionado === 'todos'
                                ? 'bg-white dark:bg-gray-700 border-2 border-blue-300 dark:border-blue-600'
                                : 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700'
                            }`}
                          >
                            <input
                              type="radio"
                              name="diaSemana"
                              value={diaValue}
                              checked={diaSelecionado === diaValue}
                              onChange={() => setDiaSelecionado(diaValue)}
                              className="sr-only"
                            />
                            <div 
                              className="w-4 h-4 rounded-full shadow-sm"
                              style={{ backgroundColor: cores[index] }}
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {dia}
                              </span>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {diasCompletos[index]}
                              </p>
                            </div>
                          </label>
                        );
                      })
                    ) : (
                      // Legenda por mês - Layout melhorado
                      Array.from(new Set(dadosValorTotal.map(d => d.mes_completo)))
                        .sort()
                        .map(mesCompleto => {
                          const item = dadosValorTotal.find(d => d.mes_completo === mesCompleto);
                          const total = dadosValorTotal
                            .filter(d => d.mes_completo === mesCompleto)
                            .reduce((sum, d) => sum + d.valor_total, 0);
                          
                          return (
                            <div key={mesCompleto} className="flex items-center gap-3 p-3 rounded-md bg-white dark:bg-gray-700/50">
                              <div 
                                className="w-4 h-4 rounded-full shadow-sm"
                                style={{ backgroundColor: item?.cor || '#3B82F6' }}
                              />
                              <div>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {item?.mes || new Date(mesCompleto + '-01').toLocaleDateString('pt-BR', { 
                                    month: 'short', 
                                    year: 'numeric' 
                                  }).replace('.', '')}
                                </span>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {formatarMoeda(total)}
                                </p>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                  
                  {/* Botão "Todos os Dias" para modo Individual */}
                  {modoComparacao === 'individual' && diaSelecionado !== 'todos' && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDiaSelecionado('todos')}
                        className="text-xs"
                      >
                        📊 Ver Todos os Dias
                      </Button>
                    </div>
                  )}
                </div>
                  </div>
                )}

            {/* 🎯 Layout Estratégico do Gráfico */}
            <div className="space-y-4">
              {/* 📊 Insights Estratégicos */}
              {dadosValorTotal.length > 0 && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {modoComparacao === 'mes_x_mes' && diaSelecionado === 'todos' ? (
                      // Insights para análise multidimensional
                      <>
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {(() => {
                              // Encontrar dia da semana com maior faturamento médio
                              const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
                              const nomesDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                              let melhorDia = '';
                              let maiorMedia = 0;
                              
                              diasSemana.forEach((dia, index) => {
                                const valores = dadosValorTotal.map(d => d[dia] || 0).filter(v => v > 0);
                                const media = valores.length > 0 ? valores.reduce((sum, v) => sum + v, 0) / valores.length : 0;
                                if (media > maiorMedia) {
                                  maiorMedia = media;
                                  melhorDia = nomesDias[index];
                                }
                              });
                              
                              return melhorDia || 'Sex';
                            })()}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Melhor Dia da Semana</p>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600 dark:text-green-400">
                            {(() => {
                              const totals = dadosValorTotal.map(d => 
                                (d.dom || 0) + (d.seg || 0) + (d.ter || 0) + (d.qua || 0) + 
                                (d.qui || 0) + (d.sex || 0) + (d.sab || 0)
                              );
                              const crescimento = totals.length > 1 ? 
                                ((totals[totals.length - 1] - totals[0]) / totals[0] * 100) : 0;
                              return crescimento > 0 ? `+${crescimento.toFixed(1)}%` : `${crescimento.toFixed(1)}%`;
                            })()}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Evolução Total</p>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                            {dadosValorTotal.length}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Meses Analisados</p>
                </div>
              </>
            ) : (
                      // Insights para análise tradicional
                      <>
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {formatarMoeda(Math.max(...dadosValorTotal.map(d => d.valor_total)))}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Maior Faturamento</p>
                </div>

                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600 dark:text-green-400">
                            {formatarMoeda(dadosValorTotal.reduce((sum, d) => sum + d.valor_total, 0) / dadosValorTotal.length)}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Média do Período</p>
                </div>

                        <div className="text-center">
                          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                            {(() => {
                              const valores = dadosValorTotal.map(d => d.valor_total);
                              const crescimento = valores.length > 1 ? 
                                ((valores[valores.length - 1] - valores[0]) / valores[0] * 100) : 0;
                              return crescimento > 0 ? `+${crescimento.toFixed(1)}%` : `${crescimento.toFixed(1)}%`;
                            })()}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Tendência</p>
                        </div>
                      </>
                    )}
                  </div>
                  </div>
                )}

              {/* Controles de Visualização Estratégica */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {modoComparacao === 'mes_x_mes' && diaSelecionado === 'todos' 
                        ? 'Análise Multidimensional' 
                        : 'Análise Temporal'
                      }
                    </span>
                  </div>
                  {modoComparacao === 'mes_x_mes' && diaSelecionado === 'todos' && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      7 dimensões ativas
                  </div>
                )}
                </div>
                
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {dadosValorTotal.length} pontos de dados
                </div>
              </div>
              
              <div className="h-80 relative">
                <ReactECharts
                  option={buildValorTotalOption()}
                  style={{ height: '100%', width: '100%' }}
                  opts={{ renderer: 'canvas' }}
                  notMerge
                  lazyUpdate
                />
              </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Gráfico por Hora */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <BarChart3 className="w-5 h-5" />
            {modoComparacao === 'individual' 
              ? `Evolução por Horário - Média por Dia da Semana`
              : `Evolução por Horário - ${DIAS_SEMANA.find(d => d.value === diaSelecionado)?.label}s`
            }
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            {modoComparacao === 'individual'
              ? `Faturamento médio por hora agrupado por dia da semana (17h às 3h)`
              : `Faturamento detalhado por hora (17h às 3h)`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            {/* 🛡️ Verificação de segurança antes de renderizar o gráfico */}
            {dados && dados.length > 0 ? (
              <ReactECharts
                option={buildHoraOption()}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'canvas' }}
                notMerge
                lazyUpdate
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">
                    Nenhum dado para exibir no gráfico
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resumo por Data - Apenas no modo Individual */}
      {modoComparacao === 'individual' && resumoPorData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <Calendar className="w-5 h-5" />
              Resumo por Data
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Detalhes de cada {DIAS_SEMANA.find(d => d.value === diaSelecionado)?.label.toLowerCase()} selecionada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {resumoPorData.map((resumo, index) => (
                <div 
                  key={resumo.data} 
                  className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                >
                  {/* Header da Data */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: coresDinamicas[resumo.data] || paletaCores[index % paletaCores.length] }}
                      ></div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {resumo.data_formatada}
                      </h3>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {resumo.dia_semana}
                    </Badge>
                  </div>

                  {/* Métricas */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Faturamento:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatarMoeda(resumo.total_faturamento)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Horário Pico:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {resumo.horario_pico.toString().padStart(2, '0')}:00
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Produtos:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {resumo.total_produtos_vendidos.toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Top Produto:</p>
                      <p className="font-medium text-gray-900 dark:text-white text-xs leading-tight">
                        {resumo.produto_mais_vendido.length > 25 
                          ? `${resumo.produto_mais_vendido.substring(0, 25)}...` 
                          : resumo.produto_mais_vendido
                        }
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {resumo.produto_mais_vendido_qtd}x • {formatarMoeda(resumo.produto_mais_vendido_valor)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}