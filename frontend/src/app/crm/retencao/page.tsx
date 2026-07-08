'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  TrendingUp,
  Users,
  AlertTriangle,
  UserPlus,
  Heart,
  UserMinus,
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  DollarSign,
  Info,
  Phone,
  Target,
  RefreshCcw
} from 'lucide-react';

interface Cohort {
  cohort: string;
  total_clientes: number;
  retencao_mes_0: number;
  retencao_mes_1: number;
  retencao_mes_2: number;
  retencao_mes_3: number;
  retencao_mes_6: number;
  retencao_mes_12: number;
}

interface JornadaCliente {
  telefone: string;
  nome: string;
  etapa_atual: 'novo' | 'engajado' | 'fiel' | 'em_risco' | 'perdido';
  dias_no_funil: number;
  visitas_totais: number;
  dias_sem_visitar: number;
  ultima_visita: string;
  primeira_visita: string;
  ticket_medio: number;
  total_gasto: number;
  proxima_acao_sugerida: string;
}

interface JornadaStats {
  total: number;
  novo: number;
  engajado: number;
  fiel: number;
  em_risco: number;
  perdido: number;
}

// Tooltips explicativos para cada etapa
const ETAPA_TOOLTIPS = {
  novo: {
    titulo: 'Clientes Novos',
    descricao: '1-2 visitas realizadas. Ainda conhecendo o estabelecimento.',
    criterio: 'Menos de 3 visitas e menos de 30 dias sem comparecer',
    acao: 'Foco em criar primeira boa impressão e incentivo para retorno'
  },
  engajado: {
    titulo: 'Clientes Engajados',
    descricao: 'Visitando regularmente e desenvolvendo preferência.',
    criterio: '3+ visitas e menos de 30 dias sem comparecer',
    acao: 'Manter frequência com convites para eventos e promoções'
  },
  fiel: {
    titulo: 'Clientes Fiéis',
    descricao: 'Alta frequência e longo relacionamento. Defensores da marca.',
    criterio: '10+ visitas, cliente há 6+ meses, menos de 30 dias sem comparecer',
    acao: 'Programa VIP, benefícios exclusivos e reconhecimento'
  },
  em_risco: {
    titulo: 'Clientes em Risco',
    descricao: 'Período prolongado sem visitar. Risco de churn.',
    criterio: '30-90 dias sem comparecer',
    acao: 'Reengajamento URGENTE com cupons e comunicação personalizada'
  },
  perdido: {
    titulo: 'Clientes Perdidos',
    descricao: 'Longo tempo sem visitar. Provavelmente churned.',
    criterio: '90+ dias sem comparecer',
    acao: 'Campanha de reativação agressiva com ofertas especiais'
  }
};

const ITEMS_PER_PAGE = 20;

export default function RetencaoPage() {
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle('📊 Retenção');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [clientes, setClientes] = useState<JornadaCliente[]>([]);
  const [jornadaStats, setJornadaStats] = useState<JornadaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroEtapa, setFiltroEtapa] = useState<string | null>(null);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [clienteSelecionado, setClienteSelecionado] = useState<JornadaCliente | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cohortRes, jornadaRes] = await Promise.all([
        fetch('/api/crm/retencao?tipo=cohort'),
        fetch('/api/crm/retencao?tipo=jornada')
      ]);

      const cohortData = await cohortRes.json();
      const jornadaData = await jornadaRes.json();

      if (cohortData.success) {
        setCohorts(cohortData.data);
      }

      if (jornadaData.success) {
        setClientes(jornadaData.data || []);
        if (jornadaData.stats) {
          setJornadaStats(jornadaData.stats);
        }
      }
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtrar e paginar clientes
  const clientesFiltrados = useMemo(() => {
    let resultado = clientes;

    // Filtrar por busca
    if (busca) {
      const buscaLower = busca.toLowerCase();
      resultado = resultado.filter(c =>
        c.nome.toLowerCase().includes(buscaLower) ||
        c.telefone.includes(busca)
      );
    }

    // Filtrar por etapa
    if (filtroEtapa) {
      resultado = resultado.filter(c => c.etapa_atual === filtroEtapa);
    }

    return resultado;
  }, [clientes, busca, filtroEtapa]);

  // Paginação
  const totalPaginas = Math.ceil(clientesFiltrados.length / ITEMS_PER_PAGE);
  const clientesPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITEMS_PER_PAGE;
    return clientesFiltrados.slice(inicio, inicio + ITEMS_PER_PAGE);
  }, [clientesFiltrados, paginaAtual]);

  // Reset página ao filtrar
  useEffect(() => {
    setPaginaAtual(1);
  }, [busca, filtroEtapa]);

  const getRetencaoColor = (value: number) => {
    if (value >= 70) return 'bg-green-600 dark:bg-green-500';
    if (value >= 50) return 'bg-blue-600 dark:bg-blue-500';
    if (value >= 30) return 'bg-yellow-600 dark:bg-yellow-500';
    if (value >= 10) return 'bg-orange-600 dark:bg-orange-500';
    return 'bg-red-600 dark:bg-red-500';
  };

  const getEtapaBadge = (etapa: string) => {
    switch (etapa) {
      case 'novo':
        return <Badge className="bg-cyan-600 hover:bg-cyan-700">🆕 Novo</Badge>;
      case 'engajado':
        return <Badge className="bg-blue-600 hover:bg-blue-700">⚡ Engajado</Badge>;
      case 'fiel':
        return <Badge className="bg-green-600 hover:bg-green-700">💎 Fiel</Badge>;
      case 'em_risco':
        return <Badge className="bg-orange-600 hover:bg-orange-700">⚠️ Em Risco</Badge>;
      case 'perdido':
        return <Badge className="bg-red-600 hover:bg-red-700">❌ Perdido</Badge>;
      default:
        return <Badge>-</Badge>;
    }
  };

  const formatarData = (dataISO: string) => {
    return new Date(dataISO).toLocaleDateString('pt-BR');
  };

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleCardClick = (etapa: string) => {
    if (filtroEtapa === etapa) {
      setFiltroEtapa(null);
    } else {
      setFiltroEtapa(etapa);
    }
  };

  // Calcular porcentagem de forma segura
  const calcularPorcentagem = (parte: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((parte / total) * 100);
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400">
                Cohort Analysis e Funil de Jornada do Cliente
              </p>
            </div>
            <Button
              onClick={fetchData}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          <Tabs defaultValue="funil" className="space-y-6">
            <TabsList className="bg-white dark:bg-gray-800">
              <TabsTrigger value="funil">Funil de Jornada</TabsTrigger>
              <TabsTrigger value="clientes">Lista de Clientes ({clientes.length})</TabsTrigger>
              <TabsTrigger value="cohorts">Cohort Analysis</TabsTrigger>
            </TabsList>

            {/* FUNIL DE JORNADA */}
            <TabsContent value="funil" className="space-y-6">
              {loading ? (
                <Skeleton className="h-96" />
              ) : jornadaStats ? (
                <>
                  {/* Stats Cards com Tooltips */}
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      <CardContent className="p-6 text-center">
                        <Users className="w-8 h-8 text-gray-600 dark:text-gray-400 mx-auto mb-2" />
                        <div className="text-3xl font-bold text-gray-900 dark:text-white">{jornadaStats.total}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
                      </CardContent>
                    </Card>

                    {/* Card Novos */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card 
                          className={`bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800 cursor-pointer transition-all hover:shadow-lg ${filtroEtapa === 'novo' ? 'ring-2 ring-cyan-500' : ''}`}
                          onClick={() => handleCardClick('novo')}
                        >
                          <CardContent className="p-6 text-center relative">
                            <Info className="w-4 h-4 text-cyan-600 dark:text-cyan-400 absolute top-2 right-2" />
                            <UserPlus className="w-8 h-8 text-cyan-600 dark:text-cyan-400 mx-auto mb-2" />
                            <div className="text-3xl font-bold text-cyan-700 dark:text-cyan-300">{jornadaStats.novo}</div>
                            <div className="text-sm text-cyan-600 dark:text-cyan-400">Novos</div>
                            <div className="text-xs text-cyan-500 dark:text-cyan-500 mt-1">
                              {calcularPorcentagem(jornadaStats.novo, jornadaStats.total)}%
                            </div>
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs bg-gray-900 dark:bg-gray-700 p-4">
                        <div className="space-y-2">
                          <p className="font-bold text-cyan-400">{ETAPA_TOOLTIPS.novo.titulo}</p>
                          <p className="text-sm text-gray-300">{ETAPA_TOOLTIPS.novo.descricao}</p>
                          <p className="text-xs text-gray-400"><strong>Critério:</strong> {ETAPA_TOOLTIPS.novo.criterio}</p>
                          <p className="text-xs text-cyan-300"><strong>Ação:</strong> {ETAPA_TOOLTIPS.novo.acao}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>

                    {/* Card Engajados */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card 
                          className={`bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 cursor-pointer transition-all hover:shadow-lg ${filtroEtapa === 'engajado' ? 'ring-2 ring-blue-500' : ''}`}
                          onClick={() => handleCardClick('engajado')}
                        >
                          <CardContent className="p-6 text-center relative">
                            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 absolute top-2 right-2" />
                            <Activity className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{jornadaStats.engajado}</div>
                            <div className="text-sm text-blue-600 dark:text-blue-400">Engajados</div>
                            <div className="text-xs text-blue-500 dark:text-blue-500 mt-1">
                              {calcularPorcentagem(jornadaStats.engajado, jornadaStats.total)}%
                            </div>
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs bg-gray-900 dark:bg-gray-700 p-4">
                        <div className="space-y-2">
                          <p className="font-bold text-blue-400">{ETAPA_TOOLTIPS.engajado.titulo}</p>
                          <p className="text-sm text-gray-300">{ETAPA_TOOLTIPS.engajado.descricao}</p>
                          <p className="text-xs text-gray-400"><strong>Critério:</strong> {ETAPA_TOOLTIPS.engajado.criterio}</p>
                          <p className="text-xs text-blue-300"><strong>Ação:</strong> {ETAPA_TOOLTIPS.engajado.acao}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>

                    {/* Card Fiéis */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card 
                          className={`bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 cursor-pointer transition-all hover:shadow-lg ${filtroEtapa === 'fiel' ? 'ring-2 ring-green-500' : ''}`}
                          onClick={() => handleCardClick('fiel')}
                        >
                          <CardContent className="p-6 text-center relative">
                            <Info className="w-4 h-4 text-green-600 dark:text-green-400 absolute top-2 right-2" />
                            <Heart className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                            <div className="text-3xl font-bold text-green-700 dark:text-green-300">{jornadaStats.fiel}</div>
                            <div className="text-sm text-green-600 dark:text-green-400">Fiéis</div>
                            <div className="text-xs text-green-500 dark:text-green-500 mt-1">
                              {calcularPorcentagem(jornadaStats.fiel, jornadaStats.total)}%
                            </div>
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs bg-gray-900 dark:bg-gray-700 p-4">
                        <div className="space-y-2">
                          <p className="font-bold text-green-400">{ETAPA_TOOLTIPS.fiel.titulo}</p>
                          <p className="text-sm text-gray-300">{ETAPA_TOOLTIPS.fiel.descricao}</p>
                          <p className="text-xs text-gray-400"><strong>Critério:</strong> {ETAPA_TOOLTIPS.fiel.criterio}</p>
                          <p className="text-xs text-green-300"><strong>Ação:</strong> {ETAPA_TOOLTIPS.fiel.acao}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>

                    {/* Card Em Risco */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card 
                          className={`bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 cursor-pointer transition-all hover:shadow-lg ${filtroEtapa === 'em_risco' ? 'ring-2 ring-orange-500' : ''}`}
                          onClick={() => handleCardClick('em_risco')}
                        >
                          <CardContent className="p-6 text-center relative">
                            <Info className="w-4 h-4 text-orange-600 dark:text-orange-400 absolute top-2 right-2" />
                            <AlertTriangle className="w-8 h-8 text-orange-600 dark:text-orange-400 mx-auto mb-2" />
                            <div className="text-3xl font-bold text-orange-700 dark:text-orange-300">{jornadaStats.em_risco}</div>
                            <div className="text-sm text-orange-600 dark:text-orange-400">Em Risco</div>
                            <div className="text-xs text-orange-500 dark:text-orange-500 mt-1">
                              {calcularPorcentagem(jornadaStats.em_risco, jornadaStats.total)}%
                            </div>
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs bg-gray-900 dark:bg-gray-700 p-4">
                        <div className="space-y-2">
                          <p className="font-bold text-orange-400">{ETAPA_TOOLTIPS.em_risco.titulo}</p>
                          <p className="text-sm text-gray-300">{ETAPA_TOOLTIPS.em_risco.descricao}</p>
                          <p className="text-xs text-gray-400"><strong>Critério:</strong> {ETAPA_TOOLTIPS.em_risco.criterio}</p>
                          <p className="text-xs text-orange-300"><strong>Ação:</strong> {ETAPA_TOOLTIPS.em_risco.acao}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>

                    {/* Card Perdidos */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card 
                          className={`bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 cursor-pointer transition-all hover:shadow-lg ${filtroEtapa === 'perdido' ? 'ring-2 ring-red-500' : ''}`}
                          onClick={() => handleCardClick('perdido')}
                        >
                          <CardContent className="p-6 text-center relative">
                            <Info className="w-4 h-4 text-red-600 dark:text-red-400 absolute top-2 right-2" />
                            <UserMinus className="w-8 h-8 text-red-600 dark:text-red-400 mx-auto mb-2" />
                            <div className="text-3xl font-bold text-red-700 dark:text-red-300">{jornadaStats.perdido}</div>
                            <div className="text-sm text-red-600 dark:text-red-400">Perdidos</div>
                            <div className="text-xs text-red-500 dark:text-red-500 mt-1">
                              {calcularPorcentagem(jornadaStats.perdido, jornadaStats.total)}%
                            </div>
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs bg-gray-900 dark:bg-gray-700 p-4">
                        <div className="space-y-2">
                          <p className="font-bold text-red-400">{ETAPA_TOOLTIPS.perdido.titulo}</p>
                          <p className="text-sm text-gray-300">{ETAPA_TOOLTIPS.perdido.descricao}</p>
                          <p className="text-xs text-gray-400"><strong>Critério:</strong> {ETAPA_TOOLTIPS.perdido.criterio}</p>
                          <p className="text-xs text-red-300"><strong>Ação:</strong> {ETAPA_TOOLTIPS.perdido.acao}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Funil Visual */}
                  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-gray-900 dark:text-white">Funil de Jornada do Cliente</CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-400">
                        Distribuição de clientes por etapa - Clique nos cards acima para filtrar
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Novo */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <UserPlus className="w-5 h-5 text-cyan-600" />
                              <span className="font-semibold text-gray-900 dark:text-white">Novos</span>
                            </div>
                            <span className="text-gray-700 dark:text-gray-300">
                              {jornadaStats.novo} ({calcularPorcentagem(jornadaStats.novo, jornadaStats.total)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-8">
                            <div
                              className="bg-cyan-600 h-8 rounded-full flex items-center justify-end pr-3 text-white font-bold transition-all duration-500"
                              style={{ width: `${Math.max(calcularPorcentagem(jornadaStats.novo, jornadaStats.total), 5)}%` }}
                            >
                              {jornadaStats.novo}
                            </div>
                          </div>
                        </div>

                        {/* Engajado */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Activity className="w-5 h-5 text-blue-600" />
                              <span className="font-semibold text-gray-900 dark:text-white">Engajados</span>
                            </div>
                            <span className="text-gray-700 dark:text-gray-300">
                              {jornadaStats.engajado} ({calcularPorcentagem(jornadaStats.engajado, jornadaStats.total)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-8">
                            <div
                              className="bg-blue-600 h-8 rounded-full flex items-center justify-end pr-3 text-white font-bold transition-all duration-500"
                              style={{ width: `${Math.max(calcularPorcentagem(jornadaStats.engajado, jornadaStats.total), 5)}%` }}
                            >
                              {jornadaStats.engajado}
                            </div>
                          </div>
                        </div>

                        {/* Fiel */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Heart className="w-5 h-5 text-green-600" />
                              <span className="font-semibold text-gray-900 dark:text-white">Fiéis</span>
                            </div>
                            <span className="text-gray-700 dark:text-gray-300">
                              {jornadaStats.fiel} ({calcularPorcentagem(jornadaStats.fiel, jornadaStats.total)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-8">
                            <div
                              className="bg-green-600 h-8 rounded-full flex items-center justify-end pr-3 text-white font-bold transition-all duration-500"
                              style={{ width: `${Math.max(calcularPorcentagem(jornadaStats.fiel, jornadaStats.total), 5)}%` }}
                            >
                              {jornadaStats.fiel}
                            </div>
                          </div>
                        </div>

                        {/* Em Risco */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5 text-orange-600" />
                              <span className="font-semibold text-gray-900 dark:text-white">Em Risco</span>
                            </div>
                            <span className="text-gray-700 dark:text-gray-300">
                              {jornadaStats.em_risco} ({calcularPorcentagem(jornadaStats.em_risco, jornadaStats.total)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-8">
                            <div
                              className="bg-orange-600 h-8 rounded-full flex items-center justify-end pr-3 text-white font-bold transition-all duration-500"
                              style={{ width: `${Math.max(calcularPorcentagem(jornadaStats.em_risco, jornadaStats.total), 5)}%` }}
                            >
                              {jornadaStats.em_risco}
                            </div>
                          </div>
                        </div>

                        {/* Perdido */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <UserMinus className="w-5 h-5 text-red-600" />
                              <span className="font-semibold text-gray-900 dark:text-white">Perdidos</span>
                            </div>
                            <span className="text-gray-700 dark:text-gray-300">
                              {jornadaStats.perdido} ({calcularPorcentagem(jornadaStats.perdido, jornadaStats.total)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-8">
                            <div
                              className="bg-red-600 h-8 rounded-full flex items-center justify-end pr-3 text-white font-bold transition-all duration-500"
                              style={{ width: `${Math.max(calcularPorcentagem(jornadaStats.perdido, jornadaStats.total), 5)}%` }}
                            >
                              {jornadaStats.perdido}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : null}
            </TabsContent>

            {/* LISTA DE CLIENTES */}
            <TabsContent value="clientes" className="space-y-6">
              {/* Busca e Filtros */}
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <Input
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar por nome ou telefone..."
                        className="pl-10 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant={filtroEtapa === null ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFiltroEtapa(null)}
                      >
                        Todos
                      </Button>
                      <Button
                        variant={filtroEtapa === 'novo' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFiltroEtapa('novo')}
                        className={filtroEtapa === 'novo' ? 'bg-cyan-600 hover:bg-cyan-700' : ''}
                      >
                        🆕 Novos
                      </Button>
                      <Button
                        variant={filtroEtapa === 'engajado' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFiltroEtapa('engajado')}
                        className={filtroEtapa === 'engajado' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                      >
                        ⚡ Engajados
                      </Button>
                      <Button
                        variant={filtroEtapa === 'fiel' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFiltroEtapa('fiel')}
                        className={filtroEtapa === 'fiel' ? 'bg-green-600 hover:bg-green-700' : ''}
                      >
                        💎 Fiéis
                      </Button>
                      <Button
                        variant={filtroEtapa === 'em_risco' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFiltroEtapa('em_risco')}
                        className={filtroEtapa === 'em_risco' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                      >
                        ⚠️ Em Risco
                      </Button>
                      <Button
                        variant={filtroEtapa === 'perdido' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFiltroEtapa('perdido')}
                        className={filtroEtapa === 'perdido' ? 'bg-red-600 hover:bg-red-700' : ''}
                      >
                        ❌ Perdidos
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Lista */}
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">
                    Clientes ({clientesFiltrados.length})
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400">
                    Clique em um cliente para ver detalhes da jornada
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                      ))}
                    </div>
                  ) : clientesFiltrados.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                      Nenhum cliente encontrado
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {clientesPaginados.map((cliente) => (
                          <div
                            key={cliente.telefone}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-gray-800"
                            onClick={() => {
                              setClienteSelecionado(cliente);
                              setModalAberto(true);
                            }}
                          >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="font-bold text-gray-900 dark:text-white">{cliente.nome}</h3>
                                  {getEtapaBadge(cliente.etapa_atual)}
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-4 h-4" />
                                    {cliente.telefone}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {cliente.visitas_totais} visitas
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    {cliente.dias_sem_visitar}d sem visitar
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className="text-sm text-gray-600 dark:text-gray-400">Ticket Médio</div>
                                  <div className="font-bold text-gray-900 dark:text-white">
                                    {formatarMoeda(cliente.ticket_medio)}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Gasto</div>
                                  <div className="font-bold text-green-600 dark:text-green-400">
                                    {formatarMoeda(cliente.total_gasto)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Paginação */}
                      {totalPaginas > 1 && (
                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Mostrando {(paginaAtual - 1) * ITEMS_PER_PAGE + 1} - {Math.min(paginaAtual * ITEMS_PER_PAGE, clientesFiltrados.length)} de {clientesFiltrados.length}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                              disabled={paginaAtual === 1}
                            >
                              <ChevronLeft className="w-4 h-4 mr-1" />
                              Anterior
                            </Button>
                            <div className="flex items-center gap-1">
                              {[...Array(Math.min(5, totalPaginas))].map((_, i) => {
                                let pageNum: number;
                                if (totalPaginas <= 5) {
                                  pageNum = i + 1;
                                } else if (paginaAtual <= 3) {
                                  pageNum = i + 1;
                                } else if (paginaAtual >= totalPaginas - 2) {
                                  pageNum = totalPaginas - 4 + i;
                                } else {
                                  pageNum = paginaAtual - 2 + i;
                                }
                                return (
                                  <Button
                                    key={pageNum}
                                    variant={paginaAtual === pageNum ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setPaginaAtual(pageNum)}
                                    className="w-10"
                                  >
                                    {pageNum}
                                  </Button>
                                );
                              })}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                              disabled={paginaAtual === totalPaginas}
                            >
                              Próximo
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* COHORT ANALYSIS */}
            <TabsContent value="cohorts">
              {loading ? (
                <Skeleton className="h-96" />
              ) : (
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white">Cohort Analysis</CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-400">
                      Taxa de retenção por mês de aquisição do cliente
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">
                              Cohort
                            </th>
                            <th className="text-center py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">
                              Clientes
                            </th>
                            <th className="text-center py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">
                              Mês 0
                            </th>
                            <th className="text-center py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">
                              Mês 1
                            </th>
                            <th className="text-center py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">
                              Mês 2
                            </th>
                            <th className="text-center py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">
                              Mês 3
                            </th>
                            <th className="text-center py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">
                              Mês 6
                            </th>
                            <th className="text-center py-3 px-4 text-gray-700 dark:text-gray-300 font-semibold">
                              Mês 12
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {cohorts.map((cohort) => (
                            <tr key={cohort.cohort} className="border-b border-gray-200 dark:border-gray-700">
                              <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                                {cohort.cohort}
                              </td>
                              <td className="py-3 px-4 text-center text-gray-700 dark:text-gray-300">
                                {cohort.total_clientes}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Badge className={getRetencaoColor(cohort.retencao_mes_0)}>
                                  {cohort.retencao_mes_0}%
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Badge className={getRetencaoColor(cohort.retencao_mes_1)}>
                                  {cohort.retencao_mes_1}%
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Badge className={getRetencaoColor(cohort.retencao_mes_2)}>
                                  {cohort.retencao_mes_2}%
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Badge className={getRetencaoColor(cohort.retencao_mes_3)}>
                                  {cohort.retencao_mes_3}%
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Badge className={getRetencaoColor(cohort.retencao_mes_6)}>
                                  {cohort.retencao_mes_6}%
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Badge className={getRetencaoColor(cohort.retencao_mes_12)}>
                                  {cohort.retencao_mes_12}%
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-6 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-green-600"></div>
                        <span>≥70% Excelente</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-blue-600"></div>
                        <span>50-69% Bom</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-yellow-600"></div>
                        <span>30-49% Regular</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-orange-600"></div>
                        <span>10-29% Baixo</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-red-600"></div>
                        <span>&lt;10% Crítico</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* Modal de Detalhes do Cliente */}
          <Dialog open={modalAberto} onOpenChange={setModalAberto}>
            <DialogContent className="max-w-2xl bg-white dark:bg-gray-800">
              {clienteSelecionado && (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-white text-2xl flex items-center gap-3">
                      {clienteSelecionado.nome}
                      {getEtapaBadge(clienteSelecionado.etapa_atual)}
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 dark:text-gray-400">
                      Detalhes da Jornada do Cliente
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6 mt-4">
                    {/* Info Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="bg-gray-50 dark:bg-gray-700/50">
                        <CardContent className="p-4 text-center">
                          <Calendar className="w-6 h-6 mx-auto mb-2 text-gray-600 dark:text-gray-400" />
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {clienteSelecionado.visitas_totais}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Visitas</div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gray-50 dark:bg-gray-700/50">
                        <CardContent className="p-4 text-center">
                          <Clock className="w-6 h-6 mx-auto mb-2 text-gray-600 dark:text-gray-400" />
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {clienteSelecionado.dias_sem_visitar}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Dias sem Visitar</div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gray-50 dark:bg-gray-700/50">
                        <CardContent className="p-4 text-center">
                          <DollarSign className="w-6 h-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
                          <div className="text-xl font-bold text-gray-900 dark:text-white">
                            {formatarMoeda(clienteSelecionado.ticket_medio)}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Ticket Médio</div>
                        </CardContent>
                      </Card>

                      <Card className="bg-green-50 dark:bg-green-900/20">
                        <CardContent className="p-4 text-center">
                          <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
                          <div className="text-xl font-bold text-green-700 dark:text-green-300">
                            {formatarMoeda(clienteSelecionado.total_gasto)}
                          </div>
                          <div className="text-sm text-green-600 dark:text-green-400">Total Gasto</div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Detalhes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Telefone</div>
                        <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {clienteSelecionado.telefone}
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Dias como Cliente</div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {clienteSelecionado.dias_no_funil} dias
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Primeira Visita</div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {formatarData(clienteSelecionado.primeira_visita)}
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Última Visita</div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {formatarData(clienteSelecionado.ultima_visita)}
                        </div>
                      </div>
                    </div>

                    {/* Ação Sugerida */}
                    <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2 text-lg">
                          <Target className="w-5 h-5" />
                          Próxima Ação Recomendada
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-gray-700 dark:text-gray-300">
                          {clienteSelecionado.proxima_acao_sugerida}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </TooltipProvider>
  );
}
