'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Package, TrendingDown, TrendingUp, RefreshCw, AlertTriangle, CheckCircle, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';

interface StockoutData {
  data_referencia?: string;
  data_analisada?: string;
  bar_id?: number;
  timestamp_consulta: string;
  filtros_aplicados?: string[];
  estatisticas: {
    total_produtos: number;
    produtos_ativos: number;
    produtos_inativos: number;
    percentual_stockout: string;
    percentual_disponibilidade: string;
  };
  produtos: {
    ativos: Array<{
      produto_id?: string;
      produto_descricao?: string;
      prd_desc?: string;
      grupo_descricao?: string;
      loc_desc?: string;
      local_producao?: string;
      preco?: number;
      prd_precovenda?: number;
      estoque?: number;
      prd_estoque?: number;
      timestamp_coleta?: string;
    }>;
    inativos: Array<{
      produto_id?: string;
      produto_descricao?: string;
      prd_desc?: string;
      grupo_descricao?: string;
      loc_desc?: string;
      local_producao?: string;
      preco?: number;
      prd_precovenda?: number;
      estoque?: number;
      prd_estoque?: number;
      controla_estoque?: string;
      prd_controlaestoque?: string;
      valida_estoque_venda?: string;
      prd_validaestoquevenda?: string;
      timestamp_coleta?: string;
    }>;
  };
  grupos: {
    ativos: Array<{
      grupo: string;
      quantidade: number;
      produtos: string[];
    }>;
    inativos: Array<{
      grupo: string;
      quantidade: number;
      produtos: string[];
    }>;
  };
  analise_por_local?: Array<{
    local_producao?: string;
    local?: string;
    total_produtos: number;
    disponiveis?: number;
    indisponiveis?: number;
    produtos_disponiveis?: number;
    produtos_indisponiveis?: number;
    perc_stockout?: number;
    percentual_stockout?: string;
    percentual_disponibilidade?: string;
    produtos_detalhados?: {
      disponiveis: Array<{ prd_desc: string; loc_desc: string }>;
      indisponiveis: Array<{ prd_desc: string; loc_desc: string }>;
    };
    produtos_por_dia?: Array<{
      data: string;
      disponiveis: Array<{ prd_desc: string; loc_desc: string }>;
      indisponiveis: Array<{ prd_desc: string; loc_desc: string }>;
    }>;
  }>;
}

interface HistoricoData {
  periodo: {
    data_inicio: string;
    data_fim: string;
  };
  bar_id: number;
  resumo: {
    total_dias: number;
    media_stockout: string;
    media_disponibilidade: string;
  };
  analise_por_dia_semana: Array<{
    dia_semana: string;
    dia_numero: number;
    total_ocorrencias: number;
    media_stockout: string;
    media_disponibilidade: string;
    melhor_dia: boolean;
    pior_dia: boolean;
  }>;
  analise_semanal: Array<{
    semana_inicio: string;
    semana_fim: string;
    numero_semana: number;
    dias_com_dados: number;
    media_stockout: string;
    media_disponibilidade: string;
  }>;
  analise_por_local?: Array<{
    local: string;
    total_produtos: number;
    produtos_disponiveis: number;
    produtos_indisponiveis: number;
    percentual_stockout: string;
    percentual_disponibilidade: string;
    produtos_detalhados?: {
      disponiveis: Array<{ prd_desc: string; loc_desc: string }>;
      indisponiveis: Array<{ prd_desc: string; loc_desc: string }>;
    };
    produtos_por_dia?: Array<{
      data: string;
      disponiveis: Array<{ prd_desc: string; loc_desc: string }>;
      indisponiveis: Array<{ prd_desc: string; loc_desc: string }>;
    }>;
  }>;
  historico_diario: Array<{
    data_referencia: string;
    dia_semana: string;
    total_produtos_ativos: number;
    produtos_disponiveis: number;
    produtos_stockout: number;
    percentual_stockout: string;
    percentual_disponibilidade: string;
  }>;
}

// Locais são carregados dinamicamente da API - cada bar tem seus próprios locais
// Exemplo Deboche: Bar, Cozinha, Cozinha 2, Salao
// Exemplo Ordinário: Preshh, Mexido, Batidos, Montados, Chopp, Cozinha 1, Cozinha 2

export default function StockoutPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar, isLoading: barLoading } = useBar();

  const [selectedDate, setSelectedDate] = useState(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  });
  
  const [stockoutData, setStockoutData] = useState<StockoutData | null>(null);
  const [historicoData, setHistoricoData] = useState<HistoricoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('diario');
  
  // Estados para filtros
  const [filtrosAtivos, setFiltrosAtivos] = useState<string[]>([]);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  
  // Estado para local selecionado
  const [localSelecionado, setLocalSelecionado] = useState<string>('');
  
  // Estado para dia selecionado dentro de uma categoria (modo período)
  const [diaSelecionado, setDiaSelecionado] = useState<string>('');
  
  // Modo de análise diária: 'unica' ou 'periodo'
  const [modoAnalise, setModoAnalise] = useState<'unica' | 'periodo'>('unica');
  
  // Datas para histórico e período
  const [dataInicio, setDataInicio] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // 7 dias atrás
    return date.toISOString().split('T')[0];
  });
  
  const [dataFim, setDataFim] = useState(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  });
  
  // Datas para análise diária em período
  const [dataInicioDiaria, setDataInicioDiaria] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 3); // 3 dias atrás
    return date.toISOString().split('T')[0];
  });
  
  const [dataFimDiaria, setDataFimDiaria] = useState(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  });

  const buscarDadosStockout = async (data: string, filtros: string[] = []) => {
    // Não buscar se o bar ainda não foi carregado
    if (!selectedBar?.id) {
      console.log('⏳ Aguardando bar ser selecionado...');
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('🔍 Buscando stockout para data:', data, 'bar_id:', selectedBar.id, 'filtros:', filtros);
      
      const response = await fetch('/api/analitico/stockout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data_selecionada: data,
          bar_id: selectedBar.id,
          filtros: filtros
        }),
      });
      
      console.log('📡 Response status:', response.status);
      const result = await response.json();
      console.log('📊 Result:', result);
      
      if (result.success) {
        setStockoutData(result.data);
        const filtroTexto = filtros.length > 0 ? ` (${filtros.length} filtros aplicados)` : '';
        toast.success(`Dados de stockout carregados para ${data}${filtroTexto}`);
      } else {
        console.error('❌ Erro na resposta:', result.error);
        toast.error(result.error || 'Erro ao buscar dados de stockout');
        setStockoutData(null);
      }
    } catch (error) {
      console.error('❌ Erro ao buscar dados de stockout:', error);
      toast.error('Erro ao buscar dados de stockout');
      setStockoutData(null);
    } finally {
      setLoading(false);
    }
  };

  const buscarDadosPeriodo = async () => {
    // Não buscar se o bar ainda não foi carregado
    if (!selectedBar?.id) {
      console.log('⏳ Aguardando bar ser selecionado...');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/analitico/stockout-historico', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data_inicio: dataInicioDiaria,
          data_fim: dataFimDiaria,
          bar_id: selectedBar.id,
          filtros: filtrosAtivos
        }),
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        // Converter dados de histórico para formato de stockout
        const mediaStockout = parseFloat(result.data.resumo.media_stockout.replace('%', ''));
        const mediaDisponibilidade = parseFloat(result.data.resumo.media_disponibilidade.replace('%', ''));
        
        // Calcular totais médios
        const totalDias = result.data.historico_diario.length;
        const somaAtivos = result.data.historico_diario.reduce((acc: number, dia: any) => acc + dia.total_produtos_ativos, 0);
        const somaDisponiveis = result.data.historico_diario.reduce((acc: number, dia: any) => acc + dia.produtos_disponiveis, 0);
        const somaStockout = result.data.historico_diario.reduce((acc: number, dia: any) => acc + dia.produtos_stockout, 0);
        
        const mediaAtivos = Math.round(somaAtivos / totalDias);
        const mediaDisponiveis = Math.round(somaDisponiveis / totalDias);
        const mediaStockoutQtd = Math.round(somaStockout / totalDias);
        
        // Criar objeto compatível com StockoutData
        const dadosPeriodo: StockoutData = {
          data_referencia: `${dataInicioDiaria} a ${dataFimDiaria}`,
          data_analisada: `${dataInicioDiaria} a ${dataFimDiaria}`,
          timestamp_consulta: new Date().toISOString(),
          filtros_aplicados: filtrosAtivos,
          estatisticas: {
            total_produtos: mediaAtivos,
            produtos_ativos: mediaDisponiveis,
            produtos_inativos: mediaStockoutQtd,
            percentual_stockout: `${mediaStockout.toFixed(1)}%`,
            percentual_disponibilidade: `${mediaDisponibilidade.toFixed(1)}%`
          },
          produtos: {
            ativos: [],
            inativos: []
          },
          grupos: {
            ativos: [],
            inativos: []
          },
          // Incluir análise por local que vem da API
          analise_por_local: result.data.analise_por_local || []
        };
        
        setStockoutData(dadosPeriodo);
        toast.success(`Média de ${totalDias} dias analisados (${dataInicioDiaria} a ${dataFimDiaria})`);
      } else {
        toast.error(result.error || 'Erro ao buscar dados do período');
        setStockoutData(null);
      }
    } catch (error) {
      console.error('Erro ao buscar dados do período:', error);
      toast.error('Erro ao buscar dados do período');
      setStockoutData(null);
    } finally {
      setLoading(false);
    }
  };

  const buscarHistoricoStockout = async () => {
    // Não buscar se o bar ainda não foi carregado
    if (!selectedBar?.id) {
      console.log('⏳ Aguardando bar ser selecionado...');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/analitico/stockout-historico', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data_inicio: dataInicio,
          data_fim: dataFim,
          bar_id: selectedBar.id,
          filtros: filtrosAtivos
        }),
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setHistoricoData(result.data);
        toast.success(`Histórico carregado: ${result.data.resumo.total_dias} dias analisados`);
      } else {
        toast.error(result.error || 'Erro ao buscar histórico de stockout');
        setHistoricoData(null);
      }
    } catch (error) {
      console.error('Erro ao buscar histórico de stockout:', error);
      toast.error('Erro ao buscar histórico de stockout');
      setHistoricoData(null);
    } finally {
      setLoading(false);
    }
  };

  const executarSyncManual = async () => {
    setSyncLoading(true);
    try {
      const response = await fetch('/api/contahub/stockout-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data_date: selectedDate
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('Sincronização de stockout executada com sucesso!');
        // Recarregar dados após sync
        await buscarDadosStockout(selectedDate);
      } else {
        toast.error(result.error || 'Erro na sincronização de stockout');
      }
    } catch (error) {
      console.error('Erro na sincronização de stockout:', error);
      toast.error('Erro na sincronização de stockout');
    } finally {
      setSyncLoading(false);
    }
  };

  // Funções para gerenciar filtros
  const toggleFiltro = (filtro: string) => {
    setFiltrosAtivos(prev => {
      const novos = prev.includes(filtro) 
        ? prev.filter(f => f !== filtro)
        : [...prev, filtro];
      
      // Recarregar dados com novos filtros
      if (selectedDate && activeTab === 'diario') {
        buscarDadosStockout(selectedDate, novos);
      }
      
      return novos;
    });
  };

  const limparFiltros = () => {
    setFiltrosAtivos([]);
    if (selectedDate && activeTab === 'diario') {
      buscarDadosStockout(selectedDate, []);
    }
  };

  // Configurar título da página
  useEffect(() => {
    setPageTitle('📦 Controle de Stockout');
  }, [setPageTitle]);

  // Carregar dados automaticamente quando o bar for selecionado ou mudar
  useEffect(() => {
    // Não fazer nada se o bar ainda está carregando ou não foi selecionado
    if (barLoading || !selectedBar?.id) {
      console.log('⏳ Aguardando bar ser carregado...', { barLoading, selectedBar });
      return;
    }
    
    console.log('🏪 Bar selecionado:', selectedBar.nome, '(ID:', selectedBar.id, ')');
    
    if (activeTab === 'diario') {
      if (modoAnalise === 'unica' && selectedDate) {
        console.log('🚀 Carregando dados iniciais para:', selectedDate);
        buscarDadosStockout(selectedDate, filtrosAtivos);
      } else if (modoAnalise === 'periodo') {
        console.log('🚀 Carregando dados de período:', dataInicioDiaria, 'a', dataFimDiaria);
        buscarDadosPeriodo();
      }
    } else if (activeTab === 'historico') {
      buscarHistoricoStockout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, modoAnalise, selectedBar?.id, barLoading]);

  const formatarData = (data: string) => {
    if (!data || data.includes('a')) return data; // Se já está formatado ou é um range
    try {
      return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
    } catch {
      return data;
    }
  };

  const getStockoutColor = (percentual: string) => {
    const valor = parseFloat(percentual.replace('%', ''));
    if (valor <= 10) return 'text-green-600 dark:text-green-400';
    if (valor <= 25) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getStockoutBadgeVariant = (percentual: string) => {
    const valor = parseFloat(percentual.replace('%', ''));
    if (valor <= 10) return 'badge-success';
    if (valor <= 25) return 'badge-warning';
    return 'badge-error';
  };

  // Função para listar locais da análise (dinâmico por bar)
  const agruparLocaisPorCategoria = () => {
    if (!stockoutData?.analise_por_local) return [];

    // Se estiver no modo período, usar dados já agrupados
    if (modoAnalise === 'periodo') {
      return stockoutData.analise_por_local
        .filter((item: any) => item.local && item.local !== 'Sem local definido')
        .map((item: any) => ({
          key: item.local.toLowerCase().replace(/\s+/g, '_'),
          nome: item.local,
          locais: [item],
          total_produtos: item.total_produtos || 0,
          disponiveis: item.produtos_disponiveis || 0,
          indisponiveis: item.produtos_indisponiveis || 0,
          perc_stockout: parseFloat((item.percentual_stockout || '0%').replace('%', ''))
        }))
        .sort((a: any, b: any) => b.perc_stockout - a.perc_stockout);
    }

    // Modo data única - usar locais diretamente da API
    return stockoutData.analise_por_local
      .filter((local: any) => {
        const localProducao = local.local_producao || local.loc_desc || '';
        return localProducao && localProducao !== 'Sem local definido';
      })
      .map((local: any) => {
        const localProducao = local.local_producao || local.loc_desc || '';
        return {
          key: localProducao.toLowerCase().replace(/\s+/g, '_'),
          nome: localProducao,
          locais: [local],
          total_produtos: local.total_produtos || 0,
          disponiveis: local.disponiveis || 0,
          indisponiveis: local.indisponiveis || 0,
          perc_stockout: local.perc_stockout || 0
        };
      })
      .sort((a: any, b: any) => b.perc_stockout - a.perc_stockout);
  };

  // Função para filtrar produtos por local selecionado (dinâmico)
  const getProdutosPorLocal = () => {
    if (!localSelecionado || !stockoutData) {
      return { disponiveis: [], indisponiveis: [] };
    }

    // Encontrar o nome do local selecionado
    const gruposAtuais = agruparLocaisPorCategoria();
    const grupoSelecionadoData = gruposAtuais.find((g: any) => g.key === localSelecionado);
    if (!grupoSelecionadoData) return { disponiveis: [], indisponiveis: [] };

    const nomeLocal = grupoSelecionadoData.nome;

    // Se estiver no modo período e tiver dados de analise_por_local com produtos_por_dia
    if (modoAnalise === 'periodo' && stockoutData.analise_por_local) {
      const localData = stockoutData.analise_por_local.find(
        (item: any) => item.local === nomeLocal
      );
      
      if (localData) {
        // Se tem um dia selecionado, mostrar produtos daquele dia
        if (diaSelecionado && localData.produtos_por_dia) {
          const produtosDoDia = localData.produtos_por_dia.find(
            (dia: any) => dia.data === diaSelecionado
          );
          if (produtosDoDia) {
            return {
              disponiveis: produtosDoDia.disponiveis || [],
              indisponiveis: produtosDoDia.indisponiveis || []
            };
          }
        }
        
        // Se não tem dia selecionado, mostrar produtos gerais do período
        if (localData.produtos_detalhados) {
          return {
            disponiveis: localData.produtos_detalhados.disponiveis || [],
            indisponiveis: localData.produtos_detalhados.indisponiveis || []
          };
        }
      }
    }

    // Mapeamento de categorias para locais originais (Ordinário bar_id=3)
    // Alinhado com Desempenho: Bar = Bar+Baldes+Shot e Dose+Chopp
    const categoriasParaLocais: Record<string, string[]> = {
      'Bebidas': ['Bar', 'Baldes', 'Shot e Dose', 'Chopp'],
      'Drinks': ['Montados', 'Batidos', 'Mexido', 'Preshh'],
      'Cozinha': ['Cozinha 1', 'Cozinha 2', 'Cozinha'],
    };
    
    // Se o nomeLocal é uma categoria conhecida, usar os locais mapeados
    const locaisParaFiltrar = categoriasParaLocais[nomeLocal] 
      ? categoriasParaLocais[nomeLocal].map(l => l.toLowerCase().trim())
      : [nomeLocal.toLowerCase().trim()];
    
    // Modo data única - filtrar por locais da categoria
    const disponiveis = (stockoutData.produtos?.ativos || []).filter(produto => {
      const localProduto = (produto.loc_desc || produto.local_producao || '').toLowerCase().trim();
      return locaisParaFiltrar.includes(localProduto);
    });

    const indisponiveis = (stockoutData.produtos?.inativos || []).filter(produto => {
      const localProduto = (produto.loc_desc || produto.local_producao || '').toLowerCase().trim();
      return locaisParaFiltrar.includes(localProduto);
    });

    return { disponiveis, indisponiveis };
  };
  
  // Função para pegar os dias disponíveis de uma categoria (dinâmico)
  const getDiasDaCategoria = () => {
    if (!localSelecionado || !stockoutData?.analise_por_local || modoAnalise !== 'periodo') {
      return [];
    }
    
    // Encontrar o nome do local selecionado
    const gruposAtuais = agruparLocaisPorCategoria();
    const grupoSelecionadoData = gruposAtuais.find((g: any) => g.key === localSelecionado);
    if (!grupoSelecionadoData) return [];
    
    const nomeLocal = grupoSelecionadoData.nome;
    
    const localData = stockoutData.analise_por_local.find(
      (item: any) => item.local === nomeLocal
    );
    
    return localData?.produtos_por_dia || [];
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        <Card className="card-dark mb-6">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="tabs-list-dark mb-6">
                <TabsTrigger value="diario" className="tabs-trigger-dark inline-flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>Análise Diária</span>
                </TabsTrigger>
                <TabsTrigger value="historico" className="tabs-trigger-dark inline-flex items-center">
                  <TrendingDown className="h-4 w-4 mr-2" />
                  <span>Histórico</span>
                </TabsTrigger>
              </TabsList>

            <TabsContent value="diario" className="space-y-6">
              {/* Controles de Busca */}
              <Card className="card-dark">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col gap-3 sm:gap-4">
                    {/* Seletor de Modo */}
                    <div className="flex flex-col xs:flex-row xs:items-center gap-2 xs:gap-3">
                      <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        Modo de análise:
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={modoAnalise === 'unica' ? 'default' : 'outline'}
                          onClick={() => setModoAnalise('unica')}
                          className={modoAnalise === 'unica' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'btn-outline-dark'}
                          leftIcon={<Calendar className="w-4 h-4" />}
                        >
                          Data Única
                        </Button>
                        <Button
                          size="sm"
                          variant={modoAnalise === 'periodo' ? 'default' : 'outline'}
                          onClick={() => setModoAnalise('periodo')}
                          className={modoAnalise === 'periodo' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'btn-outline-dark'}
                          leftIcon={<TrendingDown className="w-4 h-4" />}
                        >
                          Período
                        </Button>
                      </div>
                    </div>

                    {/* Controles de Data */}
                    <div className="flex flex-col xs:flex-row flex-wrap items-stretch xs:items-center gap-2 sm:gap-3">
                      {modoAnalise === 'unica' ? (
                        <>
                          <div className="flex items-center gap-2">
                            <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              Data:
                            </label>
                            <Input
                              type="date"
                              value={selectedDate}
                              onChange={(e) => setSelectedDate(e.target.value)}
                              className="input-dark flex-1 xs:w-[160px] sm:w-[180px]"
                            />
                          </div>
                          <Button
                            onClick={() => buscarDadosStockout(selectedDate, filtrosAtivos)}
                            disabled={loading}
                            loading={loading}
                            className="btn-primary-dark"
                            leftIcon={!loading ? <Calendar className="w-4 h-4" /> : undefined}
                          >
                            {loading ? 'Carregando...' : 'Buscar'}
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              De:
                            </label>
                            <Input
                              type="date"
                              value={dataInicioDiaria}
                              onChange={(e) => setDataInicioDiaria(e.target.value)}
                              className="input-dark flex-1 xs:w-[140px] sm:w-[180px]"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              Até:
                            </label>
                            <Input
                              type="date"
                              value={dataFimDiaria}
                              onChange={(e) => setDataFimDiaria(e.target.value)}
                              className="input-dark flex-1 xs:w-[140px] sm:w-[180px]"
                            />
                          </div>
                          <Button
                            onClick={buscarDadosPeriodo}
                            disabled={loading}
                            loading={loading}
                            className="btn-primary-dark"
                            leftIcon={!loading ? <TrendingDown className="w-4 h-4" /> : undefined}
                          >
                            {loading ? 'Carregando...' : 'Buscar Período'}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {stockoutData && (
                <>
                  {/* Cards de Estatísticas */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <Card className="card-dark">
                      <CardHeader className="pb-2 p-3 sm:p-4">
                        <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                          {modoAnalise === 'periodo' ? 'Média de Produtos' : 'Total'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4 pt-0">
                        <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                          {stockoutData?.estatisticas?.total_produtos || 0}
                        </div>
                        {modoAnalise === 'periodo' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            por dia
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="card-dark">
                      <CardHeader className="pb-2 p-3 sm:p-4">
                        <CardTitle className="text-xs sm:text-sm font-medium text-green-600 dark:text-green-400">
                          {modoAnalise === 'periodo' ? 'Média Ativos' : 'Ativos'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4 pt-0">
                        <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400 flex items-center gap-1 sm:gap-2">
                          <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                          {stockoutData?.estatisticas?.produtos_ativos || 0}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {stockoutData?.estatisticas?.percentual_disponibilidade || '0%'}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="card-dark">
                      <CardHeader className="pb-2 p-3 sm:p-4">
                        <CardTitle className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-400">
                          {modoAnalise === 'periodo' ? 'Média Inativos' : 'Inativos'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4 pt-0">
                        <div className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400 flex items-center gap-1 sm:gap-2">
                          <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
                          {stockoutData?.estatisticas?.produtos_inativos || 0}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Em stockout
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="card-dark col-span-2 lg:col-span-1">
                      <CardHeader className="pb-2 p-3 sm:p-4">
                        <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                          % Stockout
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4 pt-0">
                        <div className={`text-xl sm:text-2xl font-bold ${getStockoutColor(stockoutData?.estatisticas?.percentual_stockout || '0%')}`}>
                          {stockoutData?.estatisticas?.percentual_stockout || '0%'}
                        </div>
                        <Badge className={`${getStockoutBadgeVariant(stockoutData?.estatisticas?.percentual_stockout || '0%')} text-xs`}>
                          {parseFloat((stockoutData?.estatisticas?.percentual_stockout || '0%').replace('%', '')) <= 10 ? 'Excelente' :
                           parseFloat((stockoutData?.estatisticas?.percentual_stockout || '0%').replace('%', '')) <= 25 ? 'Atenção' : 'Crítico'}
                        </Badge>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Análise Agrupada por Local */}
                  {stockoutData?.analise_por_local && stockoutData.analise_por_local.length > 0 && (
                    <>
                      <Card className="card-dark">
                        <CardHeader className="p-4 sm:p-6">
                          <CardTitle className="card-title-dark text-base sm:text-lg flex items-center gap-2">
                            <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                            Análise por Local
                          </CardTitle>
                          <CardDescription className="card-description-dark text-xs sm:text-sm">
                            Clique em um local para ver detalhes
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 pt-0">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                            {agruparLocaisPorCategoria().map((grupo) => (
                              <div 
                                key={grupo.key}
                                onClick={() => {
                                  setLocalSelecionado(grupo.key);
                                  setDiaSelecionado(''); // Limpar dia selecionado ao trocar de categoria
                                }}
                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                  localSelecionado === grupo.key
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
                                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700'
                                }`}
                              >
                                <div className="text-center">
                                  <h4 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">
                                    {grupo.nome}
                                  </h4>
                                  <div className={`text-3xl font-bold mb-2 ${
                                    grupo.perc_stockout <= 10 ? 'text-green-600 dark:text-green-400' :
                                    grupo.perc_stockout <= 25 ? 'text-yellow-600 dark:text-yellow-400' :
                                    grupo.perc_stockout <= 50 ? 'text-orange-600 dark:text-orange-400' :
                                    'text-red-600 dark:text-red-400'
                                  }`}>
                                    {grupo.perc_stockout}%
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                    {grupo.total_produtos} produtos
                                  </p>
                                  <div className="flex justify-center gap-4 text-xs">
                                    <span className="text-green-600 dark:text-green-400">
                                      ✓ {grupo.disponiveis}
                                    </span>
                                    <span className="text-red-600 dark:text-red-400">
                                      ✗ {grupo.indisponiveis}
                                    </span>
                                  </div>
                                  {localSelecionado === grupo.key && (
                                    <div className="mt-2">
                                      <Badge className="badge-primary">Selecionado</Badge>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Detalhes do Local Selecionado */}
                      {localSelecionado && (
                        <Card className="card-dark">
                          <CardHeader className="p-4 sm:p-6">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                              <div className="flex-1">
                                <CardTitle className="card-title-dark text-base sm:text-lg flex items-center gap-2">
                                  <Package className="h-4 w-4 sm:h-5 sm:w-5" />
                                  <span className="line-clamp-1">
                                    {agruparLocaisPorCategoria().find((g: any) => g.key === localSelecionado)?.nome || localSelecionado}
                                  </span>
                                </CardTitle>
                                <CardDescription className="card-description-dark text-xs sm:text-sm mt-1">
                                  {formatarData(stockoutData?.data_analisada || '')}
                                </CardDescription>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setLocalSelecionado('');
                                  setDiaSelecionado('');
                                }}
                                className="btn-outline-dark w-full sm:w-auto"
                              >
                                Limpar
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="p-4 sm:p-6">
                            <div className="space-y-4">
                              {/* Timeline de Dias (apenas no modo período) */}
                              {modoAnalise === 'periodo' && getDiasDaCategoria().length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                                    Selecione um dia:
                                  </h4>
                                  <div className="overflow-x-auto -mx-4 sm:-mx-6">
                                    <div className="inline-flex gap-2 px-4 sm:px-6 pb-2">
                                      {getDiasDaCategoria().map((dia: any, index: number) => {
                                        const data = new Date(dia.data + 'T00:00:00');
                                        const diaNumero = data.getDate();
                                        const totalStockout = dia.indisponiveis?.length || 0;
                                        const selecionado = diaSelecionado === dia.data;
                                        
                                        return (
                                          <div 
                                            key={index} 
                                            onClick={() => setDiaSelecionado(dia.data)}
                                            className={`flex-shrink-0 w-20 p-3 rounded-lg border-2 text-center cursor-pointer transition-all ${
                                              selecionado 
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg' 
                                                : totalStockout > 0
                                                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20 hover:shadow-md'
                                                  : 'border-green-500 bg-green-50 dark:bg-green-900/20 hover:shadow-md'
                                            }`}
                                          >
                                            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                                              {diaNumero}
                                            </div>
                                            <div className={`text-xs font-semibold ${
                                              totalStockout > 0 
                                                ? 'text-red-600 dark:text-red-400' 
                                                : 'text-green-600 dark:text-green-400'
                                            }`}>
                                              ✗ {totalStockout}
                                            </div>
                                            {selecionado && (
                                              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                                Ativo
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  {!diaSelecionado && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                                      Clique em um dia para ver os produtos em stockout
                                    </p>
                                  )}
                                </div>
                              )}
                              
                              {/* Layout em Duas Colunas: Stockout (Esquerda) | Disponíveis (Direita) */}
                              {(getProdutosPorLocal().indisponiveis.length > 0 || getProdutosPorLocal().disponiveis.length > 0) ? (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                  {/* Coluna da Esquerda: Produtos em Stockout */}
                                  <div>
                                    <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2 sticky top-0 bg-gray-50 dark:bg-gray-900 py-2 z-10">
                                      <AlertTriangle className="h-4 w-4" />
                                      Produtos em Stockout ({getProdutosPorLocal().indisponiveis.length})
                                    </h4>
                                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                                      {getProdutosPorLocal().indisponiveis.length > 0 ? (
                                        getProdutosPorLocal().indisponiveis.map((produto, index) => (
                                          <div key={index} className="border-l-4 border-red-500 pl-4 py-2 bg-red-50 dark:bg-red-900/20 rounded">
                                            <h5 className="font-medium text-gray-900 dark:text-white text-sm">
                                              {produto.prd_desc || produto.produto_descricao || 'Produto sem nome'}
                                            </h5>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                              Local: {produto.loc_desc || produto.local_producao || 'Não informado'}
                                            </p>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-center py-8 text-green-600 dark:text-green-400">
                                          <CheckCircle className="h-12 w-12 mx-auto mb-2" />
                                          <p className="font-medium">Nenhum produto em stockout! 🎉</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Coluna da Direita: Produtos Disponíveis */}
                                  <div>
                                    <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-3 flex items-center gap-2 sticky top-0 bg-gray-50 dark:bg-gray-900 py-2 z-10">
                                      <CheckCircle className="h-4 w-4" />
                                      Produtos Disponíveis ({getProdutosPorLocal().disponiveis.length})
                                    </h4>
                                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                                      {getProdutosPorLocal().disponiveis.length > 0 ? (
                                        getProdutosPorLocal().disponiveis.map((produto, index) => (
                                          <div key={index} className="border-l-4 border-green-500 pl-4 py-2 bg-green-50 dark:bg-green-900/20 rounded">
                                            <h5 className="font-medium text-gray-900 dark:text-white text-sm">
                                              {produto.prd_desc || produto.produto_descricao || 'Produto sem nome'}
                                            </h5>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                              Local: {produto.loc_desc || produto.local_producao || 'Não informado'}
                                            </p>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                          <AlertTriangle className="h-12 w-12 mx-auto mb-2" />
                                          <p>Nenhum produto disponível</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                  <Package className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                                  <p>Nenhum produto encontrado para este local</p>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </>
              )}

              {loading && (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-600 dark:text-gray-400">Carregando dados de stockout...</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="historico" className="space-y-4 sm:space-y-6">
              <Card className="card-dark">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col xs:flex-row flex-wrap items-stretch xs:items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        De:
                      </label>
                      <Input
                        type="date"
                        value={dataInicio}
                        onChange={(e) => setDataInicio(e.target.value)}
                        className="input-dark flex-1 xs:w-[140px] sm:w-[180px]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        Até:
                      </label>
                      <Input
                        type="date"
                        value={dataFim}
                        onChange={(e) => setDataFim(e.target.value)}
                        className="input-dark flex-1 xs:w-[140px] sm:w-[180px]"
                      />
                    </div>
                    <Button
                      onClick={buscarHistoricoStockout}
                      disabled={loading}
                      loading={loading}
                      className="btn-primary-dark w-full xs:w-auto"
                      leftIcon={!loading ? <TrendingDown className="w-4 h-4" /> : undefined}
                    >
                      {loading ? 'Carregando...' : 'Buscar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {historicoData && (
                <>
                  {/* Resumo do Período */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <Card className="card-dark">
                      <CardHeader className="pb-2 p-3 sm:p-4">
                        <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                          Total de Dias
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4 pt-0">
                        <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                          {historicoData.resumo.total_dias}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="card-dark">
                      <CardHeader className="pb-2 p-3 sm:p-4">
                        <CardTitle className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-400">
                          Média Stockout
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4 pt-0">
                        <div className={`text-xl sm:text-2xl font-bold ${getStockoutColor(historicoData.resumo.media_stockout)}`}>
                          {historicoData.resumo.media_stockout}
                        </div>
                        <Badge className={`${getStockoutBadgeVariant(historicoData.resumo.media_stockout)} text-xs mt-1`}>
                          Período
                        </Badge>
                      </CardContent>
                    </Card>

                    <Card className="card-dark">
                      <CardHeader className="pb-2 p-3 sm:p-4">
                        <CardTitle className="text-xs sm:text-sm font-medium text-green-600 dark:text-green-400">
                          Média Disponível
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4 pt-0">
                        <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                          {historicoData.resumo.media_disponibilidade}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Análise por Dia da Semana */}
                  <Card className="card-dark">
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="card-title-dark text-base sm:text-lg flex items-center gap-2">
                        <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                        Análise por Dia da Semana
                      </CardTitle>
                      <CardDescription className="card-description-dark text-xs sm:text-sm">
                        Média de stockout por dia da semana
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4">
                        {historicoData.analise_por_dia_semana.map((dia, index) => (
                          <div key={index} className={`p-4 rounded-lg border-2 ${
                            dia.melhor_dia ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
                            dia.pior_dia ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                            'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                          }`}>
                            <div className="text-center">
                              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                                {dia.dia_semana}
                              </h4>
                              <div className={`text-lg font-bold ${getStockoutColor(dia.media_stockout)}`}>
                                {dia.media_stockout}
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {dia.total_ocorrencias} dia{dia.total_ocorrencias !== 1 ? 's' : ''}
                              </p>
                              {dia.melhor_dia && (
                                <Badge className="badge-success mt-2">
                                  Melhor
                                </Badge>
                              )}
                              {dia.pior_dia && (
                                <Badge className="badge-error mt-2">
                                  Pior
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Histórico Diário */}
                  {historicoData?.historico_diario && historicoData.historico_diario.length > 0 && (
                    <Card className="card-dark">
                      <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="card-title-dark text-base sm:text-lg flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />
                          Histórico Diário
                        </CardTitle>
                        <CardDescription className="card-description-dark text-xs sm:text-sm">
                          Evolução diária do stockout
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-6 pt-0">
                        <div className="overflow-x-auto -mx-4 sm:-mx-6">
                          <div className="inline-flex gap-2 px-4 sm:px-6 pb-2">
                            {historicoData.historico_diario.map((dia, index) => {
                              const data = new Date(dia.data_referencia + 'T00:00:00');
                              const diaNumero = data.getDate();
                              const stockoutPerc = parseFloat((dia.percentual_stockout || '0%').replace('%', ''));
                              
                              return (
                                <div 
                                  key={index} 
                                  className={`flex-shrink-0 w-20 p-3 rounded-lg border-2 text-center ${
                                    stockoutPerc <= 10 ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
                                    stockoutPerc <= 25 ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
                                    'border-red-500 bg-red-50 dark:bg-red-900/20'
                                  }`}
                                >
                                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                                    {diaNumero}
                                  </div>
                                  <div className={`text-sm font-semibold ${getStockoutColor(dia.percentual_stockout || '0%')}`}>
                                    {stockoutPerc.toFixed(1)}%
                                  </div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    {dia.dia_semana?.substring(0, 3) || ''}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Análise Semanal */}
                  {historicoData?.analise_semanal && historicoData.analise_semanal.length > 1 && (
                    <Card className="card-dark">
                      <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="card-title-dark text-base sm:text-lg flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />
                          Análise Semanal
                        </CardTitle>
                        <CardDescription className="card-description-dark text-xs sm:text-sm">
                          Média de stockout por semana
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-6 pt-0">
                        <div className="space-y-2 sm:space-y-3">
                          {historicoData.analise_semanal.map((semana, index) => (
                            <div key={index} className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 xs:gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <div className="flex-1">
                                <h4 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">
                                  Semana {semana.numero_semana}
                                </h4>
                                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                  {formatarData(semana.semana_inicio)} - {formatarData(semana.semana_fim)} • {semana.dias_com_dados} dias
                                </p>
                              </div>
                              <div className="flex xs:flex-col items-center xs:items-end gap-2 xs:gap-1">
                                <div className={`text-base sm:text-lg font-bold ${getStockoutColor(semana.media_stockout)}`}>
                                  {semana.media_stockout}
                                </div>
                                <div className="flex-1 xs:w-16 sm:w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full ${
                                      parseFloat(semana.media_stockout.replace('%', '')) <= 10 ? 'bg-green-500' :
                                      parseFloat(semana.media_stockout.replace('%', '')) <= 25 ? 'bg-yellow-500' :
                                      parseFloat(semana.media_stockout.replace('%', '')) <= 50 ? 'bg-orange-500' :
                                      'bg-red-500'
                                    }`}
                                    style={{ width: `${Math.min(parseFloat(semana.media_stockout.replace('%', '')), 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Tabela de Histórico */}
                  <Card className="card-dark">
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="card-title-dark text-base sm:text-lg">
                        Histórico Detalhado
                      </CardTitle>
                      <CardDescription className="card-description-dark text-xs sm:text-sm">
                        Dados diários de stockout do período selecionado
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-6 sm:pt-0">
                      <div className="overflow-x-auto">
                        <table className="table-dark">
                          <thead className="table-header-dark">
                            <tr className="table-row-dark">
                              <th className="table-cell-dark text-left">Data</th>
                              <th className="table-cell-dark text-center">Dia da Semana</th>
                              <th className="table-cell-dark text-center">Produtos Ativos</th>
                              <th className="table-cell-dark text-center">Disponíveis</th>
                              <th className="table-cell-dark text-center">Stockout</th>
                              <th className="table-cell-dark text-center">% Stockout</th>
                              <th className="table-cell-dark text-center">% Disponibilidade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historicoData.historico_diario.map((dia, index) => (
                              <tr key={index} className="table-row-dark">
                                <td className="table-cell-dark font-medium">
                                  {formatarData(dia.data_referencia)}
                                </td>
                                <td className="table-cell-dark text-center text-gray-600 dark:text-gray-400">
                                  {dia.dia_semana}
                                </td>
                                <td className="table-cell-dark text-center">
                                  {dia.total_produtos_ativos}
                                </td>
                                <td className="table-cell-dark text-center text-green-600 dark:text-green-400">
                                  {dia.produtos_disponiveis}
                                </td>
                                <td className="table-cell-dark text-center text-red-600 dark:text-red-400">
                                  {dia.produtos_stockout}
                                </td>
                                <td className="table-cell-dark text-center">
                                  <Badge className={getStockoutBadgeVariant(dia.percentual_stockout)}>
                                    {dia.percentual_stockout}
                                  </Badge>
                                </td>
                                <td className="table-cell-dark text-center text-green-600 dark:text-green-400">
                                  {dia.percentual_disponibilidade}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {loading && (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-600 dark:text-gray-400">Carregando histórico de stockout...</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
