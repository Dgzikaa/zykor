"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  BarChart3, 
  PieChart, 
  Calendar,
  ChevronDown,
  ChevronRight,
  Filter,
  Eye,
  EyeOff,
  Activity,
  Target,
  Zap,
  Users,
  Building2,
  ShoppingCart,
  Wrench,
  Home,
  FileText,
  Edit3,
  Trash2,
  Plus
} from "lucide-react";
import { LoadingState } from '@/components/ui/loading-state';
import DreManualModal from "@/components/dre/DreManualModal";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, Filler } from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';
import { toast } from 'sonner';
import { useBar } from '@/contexts/BarContext';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, Filler);

interface Categoria {
  nome: string;
  entradas: number;
  saidas: number;
}

interface MacroCategoria {
  nome: string;
  tipo: string;
  total_entradas: number;
  total_saidas: number;
  categorias: Categoria[];
}

interface DreApiResponse {
  macroCategorias: MacroCategoria[];
  entradasTotais: number;
  saidasTotais: number;
  saldo: number;
  ebitda: number;
  periodo: { month: number; year: number };
  estatisticas?: {
    total_categorias: number;
    categorias_com_manual: number;
    total_lancamentos_manuais: number;
  };
}

interface LancamentoManual {
  id: number;
  data_competencia: string;
  descricao: string;
  valor: number;
  categoria: string;
  categoria_macro: string;
  observacoes?: string;
  usuario_criacao: string;
  criado_em: string;
  atualizado_em?: string;
}

const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const getCurrentMonthYear = () => {
  const now = new Date();
  return `${months[now.getMonth()]} ${now.getFullYear()}`;
};

const getMacroIcon = (nome: string) => {
  const iconMap: { [key: string]: any } = {
    "Receita": TrendingUp,
    "Custos Variáveis": TrendingDown,
    "Custo insumos (CMV)": ShoppingCart,
    "Mão-de-Obra": Users,
    "Despesas Comerciais": Building2,
    "Despesas Administrativas": Wrench,
    "Despesas Operacionais": Activity,
    "Despesas de Ocupação (Contas)": Home,
    "Não Operacionais": FileText,
    "Investimentos": Zap,
    "Sócios": Users,
  };
  return iconMap[nome] || BarChart3;
};

const getMacroColor = (nome: string) => {
  const colorMap: { [key: string]: string } = {
    "Receita": "from-green-500 to-green-600",
    "Custos Variáveis": "from-red-500 to-red-600",
    "Custo insumos (CMV)": "from-orange-500 to-orange-600",
    "Mão-de-Obra": "from-blue-500 to-blue-600",
    "Despesas Comerciais": "from-purple-500 to-purple-600",
    "Despesas Administrativas": "from-indigo-500 to-indigo-600",
    "Despesas Operacionais": "from-pink-500 to-pink-600",
    "Despesas de Ocupação (Contas)": "from-gray-500 to-gray-600",
    "Não Operacionais": "from-yellow-500 to-yellow-600",
    "Investimentos": "from-cyan-500 to-cyan-600",
    "Sócios": "from-violet-500 to-violet-600",
  };
  return colorMap[nome] || "from-gray-500 to-gray-600";
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(value);
};

// Função para limpar nomes de categorias para exibição
const cleanCategoryName = (name: string) => {
  return name
    .replace(/^\[Investimento\]\s*/, '')
    .replace(/^\[.*?\]\s*/, '') // Remove qualquer prefixo entre colchetes
    .trim();
};

export default function DrePage() {
  const { selectedBar, isLoading: barLoading } = useBar();
  const [data, setData] = useState<DreApiResponse | null>(null);
  const [yearlyData, setYearlyData] = useState<DreApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingYearly, setLoadingYearly] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedMacros, setCollapsedMacros] = useState<Set<string>>(new Set(['Receita', 'Custos Variáveis', 'Custo insumos (CMV)', 'Mão-de-Obra', 'Despesas Comerciais', 'Despesas Administrativas', 'Despesas Operacionais', 'Despesas de Ocupação (Contas)', 'Não Operacionais', 'Investimentos', 'Sócios', 'Outras Despesas']));
  const [month, setMonth] = useState(() => {
    const currentMonth = new Date().getMonth() + 1;
    console.log('Mês inicial:', currentMonth);
    return currentMonth;
  });
  const [year, setYear] = useState(new Date().getFullYear());
  const [historicalData, setHistoricalData] = useState<Array<{
    month: number;
    year: number;
    monthName: string;
    receitas: number;
    custos: number;
    ebitda: number;
  }>>([]);
  const [loadingHistorical, setLoadingHistorical] = useState(true);
  const [consolidatedData, setConsolidatedData] = useState<Array<{
    month: number;
    year: number;
    monthName: string;
    macroCategorias: MacroCategoria[];
    ebitda: number;
  }>>([]);
  const [loadingConsolidated, setLoadingConsolidated] = useState(true);
  const [lancamentosManuais, setLancamentosManuais] = useState<LancamentoManual[]>([]);
  const [loadingManuais, setLoadingManuais] = useState(false);
  const [showManuais, setShowManuais] = useState(false);
  const [editingLancamento, setEditingLancamento] = useState<LancamentoManual | null>(null);


  const fetchData = useCallback(async () => {
    // Aguardar bar estar carregado
    if (barLoading || !selectedBar?.id) {
      console.log('⏳ [DRE] Aguardando bar ser selecionado...');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const barIdParam = `&bar_id=${selectedBar.id}`;
      console.log(`🔍 [DRE] Buscando dados para Bar: ${selectedBar.nome} (ID: ${selectedBar.id})`);
      
      // Buscar estrutura de categorias, dados consolidados e detalhes do Nibo em paralelo
      const [categoriasResponse, dreResponse, niboResponse] = await Promise.all([
        fetch('/api/financeiro/nibo-categorias'),
        fetch(`/api/financeiro/dre-simples?ano=${year}&mes=${month}${barIdParam}`),
        fetch(`/api/financeiro/nibo/dre-monthly-detailed?year=${year}&month=${month}${barIdParam}`)
      ]);
      
      if (!categoriasResponse.ok || !dreResponse.ok) {
        throw new Error('Erro ao buscar dados da DRE');
      }
      
      const categoriasResult = await categoriasResponse.json();
      const dreResult = await dreResponse.json();
      
      // Dados detalhados do Nibo (pode falhar, não é crítico)
      let niboResult = null;
      if (niboResponse.ok) {
        niboResult = await niboResponse.json();
      }
      
      // Criar mapa de valores por categoria
      const valoresPorCategoria = new Map();
      dreResult.categorias?.forEach(cat => {
        valoresPorCategoria.set(cat.categoria_dre, cat.valor_total);
      });
      
      // Ordem específica das macro-categorias conforme solicitado
      const ordemMacroCategorias = [
        'Receita',
        'Custos Variáveis', 
        'Custo insumos (CMV)',
        'Mão-de-Obra',
        'Despesas Comerciais',
        'Despesas Administrativas', 
        'Despesas Operacionais',
        'Despesas de Ocupação (Contas)',
        'Não Operacionais',
        'Investimentos',
        'Sócios'
      ];
      
      // Construir estrutura completa baseada em nibo_categorias na ordem específica
      const macroCategorias = ordemMacroCategorias.map(macroNome => {
        const categoriasDetalhe = categoriasResult.categorias_por_macro?.[macroNome] || [];
        const valorMacro = valoresPorCategoria.get(macroNome) || 0;
        const isEntrada = valorMacro > 0;
        
        // Buscar dados detalhados do Nibo para esta macro-categoria
        const niboMacro = (niboResult as any)?.macroCategorias?.find((m: any) => m.nome === macroNome);
        
        // Mapear subcategorias com valores reais do Nibo + dados manuais
        const subcategorias = categoriasDetalhe.map(cat => {
          const niboCategoria = niboMacro?.categorias?.find(nc => nc.nome === cat.categoria_nome);
          
          // Buscar lançamentos manuais para esta categoria específica
          const lancamentosManuais = dreResult.lancamentos_manuais?.filter(l => 
            l.categoria === cat.categoria_nome
          ) || [];
          
          const valorManualEntradas = lancamentosManuais
            .filter(l => l.valor > 0)
            .reduce((sum, l) => sum + l.valor, 0);
            
          const valorManualSaidas = Math.abs(lancamentosManuais
            .filter(l => l.valor < 0)
            .reduce((sum, l) => sum + l.valor, 0));
          
          if (niboCategoria || valorManualEntradas > 0 || valorManualSaidas > 0) {
            // Combinar valores do Nibo + manuais
            // Para saídas: Nibo já vem como positivo, manuais negativos devem ser convertidos para positivos
            const totalSaidas = (niboCategoria?.saidas || 0) + valorManualSaidas;
            const totalEntradas = (niboCategoria?.entradas || 0) + valorManualEntradas;
            
            return {
              nome: cat.categoria_nome,
              entradas: totalEntradas,
              saidas: totalSaidas
            };
          } else {
            // Fallback: distribuir proporcionalmente se não há dados específicos
            return {
              nome: cat.categoria_nome,
              entradas: isEntrada ? Math.abs(valorMacro) / categoriasDetalhe.length : 0,
              saidas: isEntrada ? 0 : Math.abs(valorMacro) / categoriasDetalhe.length
            };
          }
        });
        
        return {
          nome: macroNome,
          tipo: isEntrada ? 'entrada' : 'saida',
          total_entradas: isEntrada ? Math.abs(valorMacro) : 0,
          total_saidas: isEntrada ? 0 : Math.abs(valorMacro),
          categorias: subcategorias,
          origem: dreResult.categorias?.find(c => c.categoria_dre === macroNome)?.origem || 'automatico'
        };
      }).filter(macro => macro.total_entradas > 0 || macro.total_saidas > 0 || macro.nome === 'Receita'); // Manter sempre Receita e categorias com valores
      
      setData({
        macroCategorias,
        entradasTotais: dreResult.resumo?.total_receitas || 0,
        saidasTotais: Math.abs(dreResult.resumo?.total_custos || 0) + Math.abs(dreResult.resumo?.total_despesas || 0),
        saldo: dreResult.resumo?.lucro_operacional || 0,
        ebitda: dreResult.resumo?.lucro_operacional || 0,
        periodo: { month, year }
      });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [month, year, selectedBar?.id, barLoading]);

  const fetchYearlyData = useCallback(async () => {
    // Aguardar bar estar carregado
    if (barLoading || !selectedBar?.id) {
      return;
    }

    setLoadingYearly(true);
    setError(null);
    
    try {
      const barIdParam = `&bar_id=${selectedBar.id}`;
      // Usar a nova API consolidada que inclui lançamentos manuais
      const response = await fetch(`/api/financeiro/dre-yearly-consolidated?year=${year}${barIdParam}`);
      if (!response.ok) {
        throw new Error('Erro ao buscar dados anuais consolidados');
      }
      const result = await response.json();
      
      // Usar os dados consolidados (incluindo manuais)
      setYearlyData({
        macroCategorias: result.macroCategorias || [],
        entradasTotais: result.entradasTotais,
        saidasTotais: result.saidasTotais,
        saldo: result.saldo,
        ebitda: result.ebitda,
        periodo: { month: 0, year }, // 0 indica dados anuais
        estatisticas: result.estatisticas
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoadingYearly(false);
    }
  }, [year, selectedBar?.id, barLoading]);

  const fetchLancamentosManuais = useCallback(async () => {
    setLoadingManuais(true);
    try {
      const response = await fetch(`/api/financeiro/dre-simples?ano=${year}&mes=${month}`);
      if (response.ok) {
        const result = await response.json();
        setLancamentosManuais(result.lancamentos_manuais || []);
      }
    } catch (err) {
      console.error('Erro ao buscar lançamentos manuais:', err);
    } finally {
      setLoadingManuais(false);
    }
  }, [month, year]);

  const handleEditLancamento = (lancamento: LancamentoManual) => {
    setEditingLancamento(lancamento);
  };

  const handleDeleteLancamento = async (lancamentoId: number) => {
    if (!confirm('Tem certeza que deseja excluir este lançamento manual?')) {
      return;
    }

    try {
      const response = await fetch(`/api/financeiro/dre-manual/${lancamentoId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao excluir lançamento');
      }

      // Atualizar a lista de lançamentos
      await fetchLancamentosManuais();
      
      // Recarregar os dados do DRE para refletir as mudanças
      await fetchData();
      
      toast.success('Lançamento excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir lançamento:', error);
      toast.error('Erro ao excluir lançamento');
    }
  };

  const handleSaveLancamento = async () => {
    // Atualizar a lista de lançamentos
    await fetchLancamentosManuais();
    
    // Recarregar os dados do DRE para refletir as mudanças
    await fetchData();
    
    // Fechar o modal de edição
    setEditingLancamento(null);
  };

  const handleNewLancamento = () => {
    setEditingLancamento({ 
      id: 0, 
      data_competencia: `${year}-${month.toString().padStart(2, '0')}-01`,
      descricao: '',
      valor: 0,
      categoria: '',
      categoria_macro: '',
      observacoes: '',
      usuario_criacao: '',
      criado_em: '',
      atualizado_em: ''
    });
  };

  useEffect(() => {
    fetchData();
    fetchLancamentosManuais();
  }, [fetchData, fetchLancamentosManuais, month, year]);

  useEffect(() => {
    fetchYearlyData();
  }, [fetchYearlyData, year]);



  useEffect(() => {
    fetchHistoricalData();
  }, []);

  useEffect(() => {
    fetchConsolidatedData();
  }, []);

  async function fetchHistoricalData() {
    setLoadingHistorical(true);
    try {
      // Usar a API monthly para evolução temporal real
      const response = await fetch(`/api/financeiro/nibo/dre-monthly-2025`);
      if (response.ok) {
        const result = await response.json();
        
        // Usar os dados mensais reais para o gráfico
        const historicalDataArray = result.monthlyData || [];
        
        setHistoricalData(historicalDataArray);
        console.log('📊 Dados mensais carregados:', historicalDataArray.length, 'meses');
      }
    } catch (err) {
      console.error('Erro ao buscar dados históricos:', err);
    } finally {
      setLoadingHistorical(false);
    }
  }

  async function fetchConsolidatedData() {
    setLoadingConsolidated(true);
    try {
      // Usar a API yearly detailed
      const response = await fetch(`/api/financeiro/nibo/dre-yearly-detailed?year=2025`);
      if (response.ok) {
        const result = await response.json();
        
        // Criar um array com os dados de 2025 para a tabela consolidada
        const consolidatedDataArray = [{
          month: 1,
          year: 2025,
          monthName: 'Janeiro',
          macroCategorias: result.macroCategorias || [], // Agora temos macro-categorias detalhadas
          ebitda: Number(result.ebitda) || 0
        }];
        
        setConsolidatedData(consolidatedDataArray);
      }
    } catch (err) {
      console.error('Erro ao buscar dados consolidados:', err);
    } finally {
      setLoadingConsolidated(false);
    }
  }

  const handleExpand = (macroNome: string) => {
    // Implementar modal ou navegação para detalhes
    console.log('Expandir:', macroNome);
  };

  const toggleMacroCollapse = (macroNome: string) => {
    setCollapsedMacros(prev => {
      const newSet = new Set(prev);
      if (newSet.has(macroNome)) {
        newSet.delete(macroNome);
      } else {
        newSet.add(macroNome);
      }
      return newSet;
    });
  };

  // Função helper para buscar valor de macro-categoria nos dados consolidados
  const getConsolidatedValue = (macroNome: string, monthIndex: number) => {
    if (!consolidatedData[monthIndex] || !consolidatedData[monthIndex].macroCategorias) {
      return 0;
    }
    
    const macro = consolidatedData[monthIndex].macroCategorias.find(m => m.nome === macroNome);
    if (!macro) {
      return 0;
    }
    
    // Para Receita, retorna total_entradas, para outros retorna total_saidas
    return macro.nome === "Receita" ? macro.total_entradas : macro.total_saidas;
  };

  // Dados para o gráfico de pizza (usando dados anuais)
  const pieChartData = (yearlyData ? {
    labels: yearlyData.macroCategorias
      .filter(macro => macro.nome !== "Investimentos" && macro.nome !== "Sócios")
      .map(macro => macro.nome),
    datasets: [
      {
        data: yearlyData.macroCategorias
          .filter(macro => macro.nome !== "Investimentos" && macro.nome !== "Sócios")
          .map(macro => Math.abs(macro.total_entradas - macro.total_saidas)),
        backgroundColor: [
          '#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6',
          '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
        ],
        borderWidth: 2,
        borderColor: '#1F2937'
      }
    ]
  } : null);

  // Dados para o gráfico de linha (dados reais dos últimos 12 meses)
  const lineChartData = {
    labels: historicalData.map(item => `${item.monthName} ${item.year}`),
    datasets: [
      {
        label: 'EBITDA',
        data: historicalData.map(item => item.ebitda),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Receitas',
        data: historicalData.map(item => item.receitas),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Custos',
        data: historicalData.map(item => item.custos),
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#D1D5DB',
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const value = context.parsed;
            return `${context.label}: ${formatCurrency(value)}`;
          }
        }
      }
    }
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#D1D5DB',
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const value = context.parsed.y;
            return `${context.dataset.label}: ${formatCurrency(value)}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: '#374151'
        },
        ticks: {
          color: '#D1D5DB',
          callback: function(value: any) {
            return formatCurrency(value);
          }
        }
      },
      x: {
        grid: {
          color: '#374151'
        },
        ticks: {
          color: '#D1D5DB'
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
            DRE Operacional
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Demonstrativo de Resultado do Exercício - Visão Operacional
          </p>
        </div>

        {/* Tabs Avançados */}
          <div className="card-dark rounded-2xl shadow-xl overflow-hidden">
          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 p-1 sm:p-2 rounded-none border-b border-gray-200 dark:border-gray-700 w-full">
              <TabsTrigger 
                value="dashboard" 
                className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-lg dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition-all duration-200 flex-1 flex items-center justify-center gap-1 sm:gap-2"
              >
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger 
                value="mes" 
                className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-lg dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition-all duration-200 flex-1 flex items-center justify-center gap-1 sm:gap-2"
              >
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm">DRE Mês</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="p-4 sm:p-6 lg:p-8">
              {loadingYearly ? (
                <LoadingState
                  title="Carregando DRE..."
                  subtitle="Processando demonstrativo de resultados"
                  icon={<BarChart3 className="w-4 h-4" />}
                />
              ) : error ? (
                <div className="text-center py-12">
                  <div className="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">Erro ao carregar dados</div>
                  <div className="text-gray-600 dark:text-gray-400">{error}</div>
                </div>
              ) : yearlyData ? (
                <div className="space-y-8">
                  {/* KPIs Principais */}
                  <div className="mb-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-blue-500 text-white">
                            <BarChart3 className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                              Dashboard Anual {year}
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                              Os cards principais mostram os totais consolidados de todo o ano {year}
                            </p>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-green-100 text-xs sm:text-sm font-medium">Total Entradas ({year})</p>
                          <p className="text-lg sm:text-2xl font-bold truncate">
                            {loadingYearly ? (
                              <div className="animate-pulse bg-green-400 h-6 sm:h-8 w-24 sm:w-32 rounded"></div>
                            ) : (
                              new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(yearlyData?.entradasTotais || 0)
                            )}
                          </p>
                        </div>
                        <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-green-200 flex-shrink-0 ml-2" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-red-100 text-xs sm:text-sm font-medium">Total Saídas ({year})</p>
                          <p className="text-lg sm:text-2xl font-bold truncate">
                            {loadingYearly ? (
                              <div className="animate-pulse bg-red-400 h-6 sm:h-8 w-24 sm:w-32 rounded"></div>
                            ) : (
                              new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(yearlyData?.saidasTotais || 0)
                            )}
                          </p>
                        </div>
                        <TrendingDown className="w-6 h-6 sm:w-8 sm:h-8 text-red-200 flex-shrink-0 ml-2" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-blue-100 text-xs sm:text-sm font-medium">EBITDA ({year})</p>
                          <p className="text-lg sm:text-2xl font-bold truncate">
                            {loadingYearly ? (
                              <div className="animate-pulse bg-blue-400 h-6 sm:h-8 w-24 sm:w-32 rounded"></div>
                            ) : (
                              new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(yearlyData?.ebitda || 0)
                            )}
                          </p>
                        </div>
                        <Target className="w-6 h-6 sm:w-8 sm:h-8 text-blue-200 flex-shrink-0 ml-2" />
                      </div>
                    </div>

                    <div className={`rounded-2xl p-4 sm:p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 ${
                      (yearlyData?.saldo || 0) >= 0 
                        ? 'bg-gradient-to-br from-green-500 to-green-600' 
                        : 'bg-gradient-to-br from-red-500 to-red-600'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-medium opacity-90">Saldo Geral ({year})</p>
                          <p className="text-lg sm:text-2xl font-bold truncate">
                            {loadingYearly ? (
                              <div className="animate-pulse bg-white/20 h-6 sm:h-8 w-24 sm:w-32 rounded"></div>
                            ) : (
                              new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(yearlyData?.saldo || 0)
                            )}
                          </p>
                        </div>
                        <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 flex-shrink-0 ml-2" />
                      </div>
                    </div>
                  </div>

                  {/* Gráficos Funcionais */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center mb-4">
                        <PieChart className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 mr-2" />
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Distribuição por Categoria</h3>
                      </div>
                      <div className="h-48 sm:h-64">
                        {pieChartData ? (
                          <Pie data={pieChartData} options={pieChartOptions} />
                        ) : (
                          <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                              <PieChart className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                              <p className="text-gray-500 dark:text-gray-400">Carregando dados...</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center mb-4">
                        <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 mr-2" />
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Evolução Temporal</h3>
                      </div>
                      <div className="h-48 sm:h-64">
                        {loadingHistorical ? (
                          <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                              <p className="text-gray-500 dark:text-gray-400">Carregando dados históricos...</p>
                            </div>
                          </div>
                        ) : historicalData.length > 0 ? (
                          <Line data={lineChartData} options={lineChartOptions} />
                        ) : (
                          <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                              <p className="text-gray-500 dark:text-gray-400">Nenhum dado histórico disponível</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Macro-Categorias Avançadas com Dropdown */}
                  <div className="space-y-4">
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      Macro-Categorias
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {yearlyData.macroCategorias.map((macro) => {
                        const Icon = getMacroIcon(macro.nome);
                        const colorClass = getMacroColor(macro.nome);
                        
                        // Apenas Receita e Não Operacionais são ENTRADAS (verde positivo)
                        // Todo o resto é SAÍDA (vermelho negativo)
                        const isEntrada = macro.nome === 'Receita' || macro.nome === 'Não Operacionais';
                        
                        // Calcular valor principal
                        const valorBruto = macro.total_entradas + macro.total_saidas;
                        const valorPrincipal = isEntrada ? valorBruto : -valorBruto;
                        
                        const isExpanded = !collapsedMacros.has(macro.nome);
                        
                        // Para subcategorias: somar entradas + saídas de cada uma
                        const subcategorias = macro.categorias?.map(cat => ({
                          nome: cat.nome,
                          valor: cat.entradas + cat.saidas
                        })).filter(c => c.valor > 0).sort((a, b) => b.valor - a.valor) || [];
                        
                        return (
                          <div key={macro.nome} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all duration-300">
                            {/* Header do Card - Clicável */}
                            <button
                              onClick={() => toggleMacroCollapse(macro.nome)}
                              className="w-full p-4 sm:p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2.5 rounded-lg bg-gradient-to-br ${colorClass} text-white`}>
                                    <Icon className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white">{macro.nome}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {subcategorias.length} categorias
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className={`text-lg font-bold ${
                                    isEntrada ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                  }`}>
                                    {isEntrada ? '' : '-'}{formatCurrency(Math.abs(valorPrincipal))}
                                  </div>
                                  {isExpanded ? (
                                    <ChevronDown className="w-5 h-5 text-gray-400" />
                                  ) : (
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                  )}
                                </div>
                              </div>
                            </button>

                            {/* Dropdown com Subcategorias */}
                            {isExpanded && subcategorias.length > 0 && (
                              <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 max-h-72 overflow-y-auto">
                                <div className="p-2 space-y-0.5">
                                  {subcategorias.map((cat, idx) => (
                                    <div 
                                      key={`${cat.nome}-${idx}`}
                                      className={`flex items-center justify-between py-1.5 px-3 rounded transition-colors ${
                                        isEntrada 
                                          ? 'hover:bg-green-50 dark:hover:bg-green-900/20' 
                                          : 'hover:bg-red-50 dark:hover:bg-red-900/20'
                                      }`}
                                    >
                                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1 mr-2">
                                        {cleanCategoryName(cat.nome)}
                                      </span>
                                      <span className={`text-sm font-medium whitespace-nowrap ${
                                        isEntrada 
                                          ? 'text-green-600 dark:text-green-400' 
                                          : 'text-red-600 dark:text-red-400'
                                      }`}>
                                        {isEntrada ? '' : '-'}{formatCurrency(cat.valor)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Mensagem se não houver subcategorias */}
                            {isExpanded && subcategorias.length === 0 && (
                              <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4 text-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  Nenhuma subcategoria disponível
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="mes" className="p-4 sm:p-6 lg:p-8">
              <div className="space-y-6">
                                {/* Filtros Compactos - Mobile Responsive */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-2 lg:p-3 mb-3 lg:mb-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 lg:gap-0">
                    <div className="flex items-center gap-2 justify-center lg:justify-start">
                      <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Período:</span>
                    </div>
                    
                    <div className="flex items-center gap-3 justify-center lg:justify-end">
                      <select 
                        value={month} 
                        onChange={(e) => {
                          console.log('Mês selecionado:', e.target.value);
                          setMonth(Number(e.target.value));
                        }}
                        className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[100px]"
                      >
                        {months.map((monthName, index) => {
                          const monthValue = index + 1;
                          return (
                            <option key={monthValue} value={monthValue}>
                              {monthName}
                            </option>
                          );
                        })}
                      </select>
                      
                      <select 
                        value={year} 
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[100px]"
                      >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : error ? (
                  <div className="text-center py-12">
                    <div className="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">Erro ao carregar dados</div>
                    <div className="text-gray-600 dark:text-gray-400">{error}</div>
                  </div>
                ) : (
                  <div className="flex flex-col lg:flex-row bg-gray-50 dark:bg-gray-900">
                    {/* Sidebar Lateral com Analytics - Mobile First */}
                    <aside className="flex flex-col lg:w-80 w-full bg-gray-50 dark:bg-gray-900 p-2 lg:p-4">
                      <div className="space-y-6 w-full">
                        {/* Analytics do Mês - Mobile Responsive */}
                        <div>
                          <div className="text-xs font-medium dark:text-gray-300 text-gray-800 mb-2 block lg:mb-1">
                            Analytics do Mês
                          </div>
                          <div className="grid grid-cols-3 lg:grid-cols-1 gap-2 lg:space-y-1 lg:gap-0 overflow-hidden">
                            {(() => {
                              // Calcular métricas
                              const custoFixo = (
                                (data?.macroCategorias.find(m => m.nome === "Mão-de-Obra")?.total_saidas || 0) +
                                (data?.macroCategorias.find(m => m.nome === "Despesas Comerciais")?.total_saidas || 0) +
                                (data?.macroCategorias.find(m => m.nome === "Despesas Administrativas")?.total_saidas || 0) +
                                (data?.macroCategorias.find(m => m.nome === "Despesas Operacionais")?.total_saidas || 0) +
                                (data?.macroCategorias.find(m => m.nome === "Despesas de Ocupação (Contas)")?.total_saidas || 0)
                              );
                              
                              const totalReceitas = data?.macroCategorias.find(m => m.nome === "Receita")?.total_entradas || 1;
                              const custosVariaveis = data?.macroCategorias.find(m => m.nome === "Custos Variáveis")?.total_saidas || 0;
                              const cmv = data?.macroCategorias.find(m => m.nome === "Custo insumos (CMV)")?.total_saidas || 0;
                              
                              const mc = (1 - ((custosVariaveis + cmv) / totalReceitas)) * 100;
                              const breakeven = custoFixo / (mc / 100);
                              
                              return (
                                <>
                                  {/* Custo Fixo */}
                                  <div className="dark:bg-gray-800 bg-gray-50 lg:rounded-t-[6px] rounded-[6px] p-2 border dark:border-gray-700 border-gray-300">
                                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-1 lg:mb-2">
                                      <div className="flex items-center justify-center lg:justify-start gap-1 mb-1 lg:mb-0">
                                        <span className="text-red-400">📉</span>
                                        <span className="text-xs dark:text-gray-400 text-gray-700 font-medium">Custo Fixo</span>
                                      </div>
                                    </div>
                                    <div className="text-center lg:text-left">
                                      <div className="lg:flex lg:justify-between lg:text-xs">
                                        <span className="text-red-400 text-xs lg:inline hidden">Total:</span>
                                        <span className="font-bold dark:text-white text-black text-xs">
                                          {formatCurrency(custoFixo)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* MC % */}
                                  <div className="dark:bg-gray-800 bg-gray-50 lg:rounded-none rounded-[6px] p-2 border dark:border-gray-700 border-gray-300">
                                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-1 lg:mb-2">
                                      <div className="flex items-center justify-center lg:justify-start gap-1 mb-1 lg:mb-0">
                                        <span className="text-orange-400">📊</span>
                                        <span className="text-xs dark:text-gray-400 text-gray-700 font-medium">MC %</span>
                                      </div>
                                    </div>
                                    <div className="text-center lg:text-left">
                                      <div className="lg:flex lg:justify-between lg:text-xs">
                                        <span className="text-orange-400 text-xs lg:inline hidden">Margem:</span>
                                        <span className="font-bold dark:text-white text-black text-xs">
                                          {mc.toFixed(1)}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Breakeven */}
                                  <div className="dark:bg-gray-800 bg-gray-50 lg:rounded-b-[6px] rounded-[6px] p-2 border dark:border-gray-700 border-gray-300">
                                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-1 lg:mb-2">
                                      <div className="flex items-center justify-center lg:justify-start gap-1 mb-1 lg:mb-0">
                                        <span className="text-blue-400">🎯</span>
                                        <span className="text-xs dark:text-gray-400 text-gray-700 font-medium">Breakeven</span>
                                      </div>
                                    </div>
                                    <div className="text-center lg:text-left">
                                      <div className="lg:flex lg:justify-between lg:text-xs">
                                        <span className="text-blue-400 text-xs lg:inline hidden">Ponto Equilíbrio:</span>
                                        <span className="font-bold dark:text-white text-black text-xs">
                                          {formatCurrency(breakeven)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </aside>

                    {/* Área Principal da Tabela - Mobile Responsive */}
                    <div className="flex-1 lg:overflow-x-visible overflow-x-auto lg:overflow-y-auto overflow-y-visible hide-scrollbar lg:mt-0 mt-4">
                      <div className="bg-white dark:bg-gray-800 rounded-lg lg:rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[280px]">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800">
                          <tr>
                            <th className="text-left py-3 px-3 sm:px-4 font-semibold text-gray-900 dark:text-white text-xs sm:text-sm">
                              Macro-Categoria
                            </th>
                            <th className="text-right py-3 px-2 sm:px-4 font-semibold text-gray-900 dark:text-white text-xs sm:text-sm">
                              Valor
                            </th>
                            <th className="text-right py-3 px-2 sm:px-4 font-semibold text-gray-900 dark:text-white text-xs sm:text-sm hidden sm:table-cell">
                              %
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {/* Macro-categorias do EBITDA */}
                          {data?.macroCategorias
                            .filter(macro => macro.nome !== "Investimentos" && macro.nome !== "Sócios")
                            .map((macro) => {
                            const Icon = getMacroIcon(macro.nome);
                            const colorClass = getMacroColor(macro.nome);
                            const isCollapsed = collapsedMacros.has(macro.nome);
                            // Calcular valor unificado: Receita e Não Operacionais positivos, demais custos negativos
                            const valorUnificado = (macro.nome === "Receita" || macro.nome === "Não Operacionais") 
                              ? macro.total_entradas 
                              : -(macro.total_saidas || macro.total_entradas); // Custos sempre negativos
                            
                            // Calcular percentual baseado no total de receitas
                            const totalReceitas = data?.macroCategorias.find(m => m.nome === "Receita")?.total_entradas || 1;
                            const percentualReceita = macro.nome === "Receita"
                              ? null // Receita não mostra %
                              : (Math.abs(valorUnificado) / totalReceitas) * 100;
                            
                            return (
                              <React.Fragment key={macro.nome}>
                                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                  <td className="py-2 lg:py-2.5 px-2 lg:px-4">
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => toggleMacroCollapse(macro.nome)}
                                        className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                                      >
                                        {isCollapsed ? (
                                          <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                                        )}
                                      </button>
                                      <div className={`p-1.5 rounded-md bg-gradient-to-br ${colorClass} text-white`}>
                                        <Icon className="w-3.5 h-3.5" />
                                      </div>
                                      <span className="font-semibold text-gray-900 dark:text-white text-sm">
                                        {macro.nome}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-2 lg:py-2.5 px-2 lg:px-4 text-right">
                                    <span className={`text-sm lg:text-base font-semibold ${valorUnificado >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                      {formatCurrency(valorUnificado)}
                                    </span>
                                  </td>
                                  <td className="py-2 lg:py-2.5 px-2 lg:px-4 text-right">
                                    <span className="text-sm lg:text-base font-medium text-gray-600 dark:text-gray-400">
                                      {percentualReceita ? `${percentualReceita.toFixed(1)}%` : '-'}
                                    </span>
                                  </td>
                                </tr>
                                
                                {/* Categorias Expandidas */}
                                {!isCollapsed && macro.categorias.map((cat) => {
                                  // Valor unificado para subcategorias - Receita, Não Operacionais e Contratos são positivos, demais negativos
                                  const valorCatUnificado = (macro.nome === "Receita" || macro.nome === "Não Operacionais" || cat.nome.includes("Contratos")) 
                                    ? cat.entradas 
                                    : -(cat.saidas || cat.entradas); // Para custos, usar saidas ou entradas como negativo
                                  
                                  // Percentual da subcategoria baseado no total de receitas
                                  const percentualCatReceita = (macro.nome === "Receita" || macro.nome === "Não Operacionais" || cat.nome.includes("Contratos"))
                                    ? (valorCatUnificado / totalReceitas) * 100
                                    : (Math.abs(valorCatUnificado) / totalReceitas) * 100;
                                  return (
                                    <tr key={cat.nome} className="bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                                      <td className="py-2 lg:py-3 px-3 lg:px-6 pl-8 lg:pl-16">
                                        <span className="text-gray-700 dark:text-gray-300 text-sm lg:text-base">{cleanCategoryName(cat.nome)}</span>
                                      </td>
                                      <td className="py-2 lg:py-3 px-3 lg:px-6 text-right">
                                        <span className={`text-sm lg:text-base ${valorCatUnificado >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                          {formatCurrency(valorCatUnificado)}
                                        </span>
                                      </td>
                                      <td className="py-2 lg:py-3 px-3 lg:px-6 text-right">
                                        <span className="text-xs lg:text-sm font-medium text-gray-500 dark:text-gray-500">
                                          {percentualCatReceita.toFixed(1)}%
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}

                          {/* Linha de separação antes do EBITDA */}
                          <tr className="bg-gray-100 dark:bg-gray-700">
                            <td colSpan={3} className="py-2"></td>
                          </tr>

                          {/* EBITDA - Linha especial */}
                          <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-t-2 border-blue-200 dark:border-blue-700">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                                  <Target className="w-3.5 h-3.5" />
                                </div>
                                <span className="font-bold text-base text-blue-900 dark:text-blue-100">
                                  EBITDA
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className={`text-lg font-bold ${(data?.ebitda || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {formatCurrency(data?.ebitda || 0)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                                {data?.macroCategorias.find(m => m.nome === "Receita")?.total_entradas 
                                  ? ((data?.ebitda || 0) / data.macroCategorias.find(m => m.nome === "Receita")!.total_entradas * 100).toFixed(1) + '%'
                                  : '-'}
                              </span>
                            </td>
                          </tr>

                          {/* Linha de separação após EBITDA */}
                          <tr className="bg-gray-100 dark:bg-gray-700">
                            <td colSpan={3} className="py-2"></td>
                          </tr>

                          {/* Macro-categorias fora do EBITDA (Investimentos e Sócios) */}
                          {data?.macroCategorias
                            .filter(macro => macro.nome === "Investimentos" || macro.nome === "Sócios")
                            .map((macro) => {
                            const Icon = getMacroIcon(macro.nome);
                            const colorClass = getMacroColor(macro.nome);
                            const isCollapsed = collapsedMacros.has(macro.nome);
                            const totalReceitas = data?.macroCategorias.find(m => m.nome === "Receita")?.total_entradas || 1;
                            // Valor unificado para Investimentos e Sócios - sempre negativos (custos)
                            const valorUnificadoInvSoc = -(macro.total_saidas || macro.total_entradas);
                            
                            return (
                              <React.Fragment key={macro.nome}>
                                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                  <td className="py-4 px-6">
                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={() => toggleMacroCollapse(macro.nome)}
                                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                                      >
                                        {isCollapsed ? (
                                          <ChevronRight className="w-4 h-4 text-gray-500" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4 text-gray-500" />
                                        )}
                                      </button>
                                      <div className={`p-2 rounded-lg bg-gradient-to-br ${colorClass} text-white`}>
                                        <Icon className="w-4 h-4" />
                                      </div>
                                      <span className="font-semibold text-gray-900 dark:text-white">
                                        {macro.nome}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-4 px-6 text-right">
                                    <span className={`text-lg font-semibold ${valorUnificadoInvSoc >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                      {formatCurrency(valorUnificadoInvSoc)}
                                    </span>
                                  </td>
                                  <td className="py-4 px-6 text-right">
                                    <span className="text-lg font-semibold text-gray-500 dark:text-gray-500">
                                      -
                                    </span>
                                  </td>
                                </tr>
                                
                                {/* Categorias Expandidas */}
                                {!isCollapsed && macro.categorias.map((cat) => {
                                  // Valor unificado para subcategorias - Receita, Não Operacionais e Contratos são positivos, demais negativos
                                  const valorCatUnificado = (macro.nome === "Receita" || macro.nome === "Não Operacionais" || cat.nome.includes("Contratos")) 
                                    ? cat.entradas 
                                    : -(cat.saidas || cat.entradas); // Para custos, usar saidas ou entradas como negativo
                                  
                                  // Percentual da subcategoria baseado no total de receitas
                                  const percentualCatReceita = (macro.nome === "Receita" || macro.nome === "Não Operacionais" || cat.nome.includes("Contratos"))
                                    ? (valorCatUnificado / totalReceitas) * 100
                                    : (Math.abs(valorCatUnificado) / totalReceitas) * 100;
                                  return (
                                    <tr key={cat.nome} className="bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                                      <td className="py-2 lg:py-3 px-3 lg:px-6 pl-8 lg:pl-16">
                                        <span className="text-gray-700 dark:text-gray-300 text-sm lg:text-base">{cleanCategoryName(cat.nome)}</span>
                                      </td>
                                      <td className="py-2 lg:py-3 px-3 lg:px-6 text-right">
                                        <span className={`text-sm lg:text-base ${valorCatUnificado >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                          {formatCurrency(valorCatUnificado)}
                                        </span>
                                      </td>
                                      <td className="py-2 lg:py-3 px-3 lg:px-6 text-right">
                                        <span className="text-xs lg:text-sm font-medium text-gray-500 dark:text-gray-500">
                                          {percentualCatReceita.toFixed(1)}%
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                    </div>
                  </div>
                )}
                
                {/* Seção de Lançamentos Manuais - Mobile Optimized */}
                <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {/* Header da Seção - Mobile Responsive */}
                    <div className="p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                        <button
                          onClick={() => setShowManuais(!showManuais)}
                          className="flex items-center gap-2 sm:gap-3 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg p-2 transition-colors w-full sm:w-auto"
                        >
                          <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                            <Edit3 className="w-3 h-3 sm:w-4 sm:h-4" />
                          </div>
                          <div className="text-left flex-1">
                            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                              Lançamentos Manuais
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                              {lancamentosManuais.length} lançamento{lancamentosManuais.length !== 1 ? 's' : ''} no mês
                            </p>
                          </div>
                          <div className="ml-auto">
                            {showManuais ? (
                              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                            )}
                          </div>
                        </button>
                        
                        <div className="w-full sm:w-auto">
                          <button
                            onClick={handleNewLancamento}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-xs sm:text-sm"
                          >
                            <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span>Novo</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Conteúdo Colapsável - Mobile Optimized */}
                    {showManuais && (
                      <div className="p-3 sm:p-4">
                        {loadingManuais ? (
                          <div className="flex items-center justify-center py-6 sm:py-8">
                            <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600"></div>
                          </div>
                        ) : lancamentosManuais.length === 0 ? (
                          <div className="text-center py-6 sm:py-8">
                            <Edit3 className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-2 sm:mb-3" />
                            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 font-medium">
                              Nenhum lançamento manual encontrado
                            </p>
                            <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1">
                              Use o botão "Novo" para adicionar ajustes manuais
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2 sm:space-y-3">
                            {lancamentosManuais
                              .sort((a, b) => {
                                // Lista de prioridades em ordem alfabética
                                const prioridades = ['Ambev', 'Bonificação', 'Contrato', 'Cash-back Março'];
                                
                                const aIndex = prioridades.findIndex(p => 
                                  a.descricao.toLowerCase().includes(p.toLowerCase())
                                );
                                const bIndex = prioridades.findIndex(p => 
                                  b.descricao.toLowerCase().includes(p.toLowerCase())
                                );
                                
                                // Se ambos estão na lista de prioridades
                                if (aIndex !== -1 && bIndex !== -1) {
                                  return aIndex - bIndex;
                                }
                                
                                // Se apenas 'a' está na lista de prioridades
                                if (aIndex !== -1 && bIndex === -1) {
                                  return -1;
                                }
                                
                                // Se apenas 'b' está na lista de prioridades
                                if (aIndex === -1 && bIndex !== -1) {
                                  return 1;
                                }
                                
                                // Se nenhum está na lista de prioridades, ordenar alfabeticamente
                                return a.descricao.localeCompare(b.descricao, 'pt-BR');
                              })
                              .map((lancamento) => (
                              <div
                                key={lancamento.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors gap-3 sm:gap-0"
                              >
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                  <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${
                                    lancamento.valor >= 0 
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                      : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                  }`}>
                                    {lancamento.valor >= 0 ? (
                                      <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                                    ) : (
                                      <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate">
                                      {lancamento.descricao}
                                    </p>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                      <span className="truncate">{lancamento.categoria_macro}</span>
                                      <span className="hidden sm:inline">•</span>
                                      <span className="truncate">{lancamento.categoria}</span>
                                      <span className="hidden sm:inline">•</span>
                                      <span>{new Date(lancamento.data_competencia).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                                  <div className="text-left sm:text-right flex-1 sm:flex-initial">
                                    <p className={`text-base sm:text-lg font-bold ${
                                      lancamento.valor >= 0 
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-red-600 dark:text-red-400'
                                    }`}>
                                      {formatCurrency(lancamento.valor)}
                                    </p>
                                    {lancamento.observacoes && (
                                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
                                        {lancamento.observacoes}
                                      </p>
                                    )}
                                  </div>
                                  
                                  {/* Botões de Ação - Mobile Optimized */}
                                  <div className="flex items-center gap-2 justify-end sm:justify-start">
                                    <button
                                      onClick={() => handleEditLancamento(lancamento)}
                                      className="p-1.5 sm:p-2 rounded-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors"
                                      title="Editar lançamento"
                                    >
                                      <Edit3 className="w-3 h-3 sm:w-4 sm:h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteLancamento(lancamento.id)}
                                      className="p-1.5 sm:p-2 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors"
                                      title="Excluir lançamento"
                                    >
                                      <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

          </Tabs>
        </div>
      </div>
      
      {/* Modal de Edição de Lançamento Manual */}
      {editingLancamento && (
        <DreManualModal
          isOpen={!!editingLancamento}
          onClose={() => setEditingLancamento(null)}
          onLancamentoAdicionado={handleSaveLancamento}
          mesAno={{ mes: month, ano: year }}
          editingLancamento={editingLancamento}
        />
      )}
    </div>
  );
}
