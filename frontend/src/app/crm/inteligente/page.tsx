'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Users, 
  TrendingUp, 
  AlertTriangle,
  Sparkles,
  Target,
  RefreshCw,
  Download,
  MessageCircle,
  Crown,
  Star,
  Zap,
  UserX,
  Award,
  TrendingDown,
  DollarSign,
  Calendar,
  Activity
} from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { toast } from 'sonner';

interface ClienteCRM {
  identificador: string;
  nome: string;
  email?: string;
  telefone?: string;
  total_visitas: number;
  total_gasto: number;
  ultima_visita: string;
  primeira_visita: string;
  dias_desde_ultima_visita: number;
  ticket_medio: number;
  frequencia_dias: number;
  r_score: number;
  f_score: number;
  m_score: number;
  rfm_total: number;
  segmento: string;
  cor: string;
  acoes_sugeridas: string[];
  prioridade: number;
}

interface Estatisticas {
  total_clientes: number;
  vips: number;
  em_risco: number;
  fieis: number;
  novos: number;
  inativos: number;
  regulares: number;
  potencial: number;
}

interface Paginacao {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

// Explicações dos segmentos RFM para tooltips (ajustado para realidade de bares)
const SEGMENT_TOOLTIPS = {
  vips: {
    title: '💎 VIP Champions',
    description: 'Seus MELHORES clientes! Vêm 3+ vezes, gastam muito (top 20%) e são recentes. Foco total em reter e recompensar!'
  },
  fieis: {
    title: '⭐ Clientes Fiéis',
    description: 'Frequentadores assíduos (3+ visitas) que voltam regularmente. Mantêm engajamento constante. Próximos de se tornarem VIPs!'
  },
  potencial: {
    title: '💰 Grande Potencial',
    description: 'Vieram 1-2 vezes mas GASTAM MUITO (top 20%)! Grande oportunidade de fidelizar e transformar em clientes regulares.'
  },
  em_risco: {
    title: '⚠️ Em Risco (Churn)',
    description: 'URGENTE! Eram clientes recorrentes (2+ visitas) mas SUMIRAM. Ação imediata de reconquista necessária!'
  },
  novos: {
    title: '🌱 Novos Promissores',
    description: 'Primeira visita RECENTE (últimos 30 dias). Crucial agir AGORA para garantir segunda visita e fidelizar!'
  },
  inativos: {
    title: '😴 Inativos',
    description: 'Vieram 1 vez há MUITO tempo (90+ dias) e não voltaram. Considerar campanhas de baixo custo ou reativação.'
  },
  regulares: {
    title: '📊 Regulares',
    description: 'Clientes com 1-2 visitas nos últimos 30-90 dias. Comportamento médio. Oportunidade de engajar e aumentar frequência.'
  }
};

export default function CRMInteligentePage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();

  const [clientes, setClientes] = useState<ClienteCRM[]>([]);
  const [stats, setStats] = useState<Estatisticas | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filtroSegmento, setFiltroSegmento] = useState<string>('todos');
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteCRM | null>(null);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [paginacao, setPaginacao] = useState<Paginacao>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasMore: false
  });

  useEffect(() => {
    setPageTitle('🎯 CRM Inteligente');
  }, [setPageTitle]);

  useEffect(() => {
    carregarDados(true);
  }, [selectedBar, filtroSegmento]);

  const carregarDados = async (reset: boolean = false) => {
    if (reset) {
      setLoading(true);
      setClientes([]);
      setPaginacao(prev => ({ ...prev, page: 1 }));
    } else {
      setLoadingMore(true);
    }

    try {
      const page = reset ? 1 : paginacao.page + 1;
      const response = await fetch(
        `/api/crm/segmentacao?bar_id=${selectedBar?.id}&page=${page}&limit=50&segmento=${filtroSegmento}`
      );
      const result = await response.json();

      if (result.success) {
        if (reset) {
          setClientes(result.clientes);
          toast.success('Dados do CRM carregados!');
        } else {
          setClientes(prev => [...prev, ...result.clientes]);
        }
        
        setStats(result.estatisticas);
        setPaginacao(result.paginacao);
      } else {
        toast.error('Erro ao carregar dados');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar CRM');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const carregarMais = () => {
    if (!loadingMore && paginacao.hasMore) {
      carregarDados(false);
    }
  };

  const getCorBadge = (cor: string) => {
    const cores: { [key: string]: string } = {
      purple: 'bg-muted text-foreground',
      blue: 'bg-muted text-foreground',
      green: 'bg-muted text-foreground',
      orange: 'bg-muted text-foreground',
      teal: 'bg-muted text-foreground',
      gray: 'bg-muted text-foreground',
      indigo: 'bg-muted text-foreground',
    };
    return cores[cor] || cores.gray;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T12:00:00Z');
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  const exportarCSV = () => {
    const headers = ['Nome', 'Email', 'Telefone', 'Segmento', 'Visitas', 'Gasto Total', 'Ticket Médio', 'Última Visita', 'Dias Ausente', 'RFM Total'];
    const rows = clientes.map(c => [
      c.nome,
      c.email || '',
      c.telefone || '',
      c.segmento,
      c.total_visitas,
      c.total_gasto.toFixed(2),
      c.ticket_medio.toFixed(2),
      c.ultima_visita,
      c.dias_desde_ultima_visita,
      c.rfm_total
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `crm_${filtroSegmento}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast.success(`CSV exportado com ${clientes.length} clientes!`);
  };

  const abrirDetalhes = (cliente: ClienteCRM) => {
    setClienteSelecionado(cliente);
    setModalDetalhes(true);
  };

  const segmentos = [
    { value: 'todos', label: 'Todos os Segmentos', icon: Users },
    { value: '💎 VIP Champions', label: 'VIP Champions', icon: Crown },
    { value: '⭐ Clientes Fiéis', label: 'Clientes Fiéis', icon: Star },
    { value: '💰 Grande Potencial', label: 'Grande Potencial', icon: Zap },
    { value: '⚠️ Em Risco (Churn)', label: 'Em Risco', icon: AlertTriangle },
    { value: '🌱 Novos Promissores', label: 'Novos Promissores', icon: Target },
    { value: '📊 Regulares', label: 'Regulares', icon: Activity },
    { value: '😴 Inativos', label: 'Inativos', icon: UserX },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-2 py-4 max-w-[98vw]">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3 mb-2">
            <div className="p-2 bg-muted rounded-lg">
              <Sparkles className="h-6 w-6 text-foreground" />
            </div>
            CRM Inteligente
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm ml-11">
            Análise RFM, segmentação automática e ações estratégicas
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Carregando informações do CRM...
          </div>
        )}

        {/* Estatísticas */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="border-gray-200 dark:border-gray-700">
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-6 w-6 mx-auto rounded-full" />
                  <Skeleton className="h-8 w-12 mx-auto" />
                  <Skeleton className="h-3 w-16 mx-auto" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : stats ? (
          <TooltipProvider>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
              {/* VIP Champions */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-card border-border cursor-help">
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center">
                        <Crown className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-2xl font-bold text-foreground">{stats.vips}</p>
                        <p className="text-xs text-muted-foreground text-center">VIPs</p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold mb-1">{SEGMENT_TOOLTIPS.vips.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{SEGMENT_TOOLTIPS.vips.description}</p>
                </TooltipContent>
              </Tooltip>

              {/* Fiéis */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-card border-border cursor-help">
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center">
                        <Star className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-2xl font-bold text-foreground">{stats.fieis}</p>
                        <p className="text-xs text-muted-foreground text-center">Fiéis</p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold mb-1">{SEGMENT_TOOLTIPS.fieis.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{SEGMENT_TOOLTIPS.fieis.description}</p>
                </TooltipContent>
              </Tooltip>

              {/* Potencial */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-card border-border cursor-help">
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center">
                        <Zap className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-2xl font-bold text-foreground">{stats.potencial}</p>
                        <p className="text-xs text-muted-foreground text-center">Potencial</p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold mb-1">{SEGMENT_TOOLTIPS.potencial.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{SEGMENT_TOOLTIPS.potencial.description}</p>
                </TooltipContent>
              </Tooltip>

              {/* Em Risco */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-card border-border cursor-help">
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center">
                        <AlertTriangle className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-2xl font-bold text-foreground">{stats.em_risco}</p>
                        <p className="text-xs text-muted-foreground text-center">Em Risco</p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold mb-1">{SEGMENT_TOOLTIPS.em_risco.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{SEGMENT_TOOLTIPS.em_risco.description}</p>
                </TooltipContent>
              </Tooltip>

              {/* Novos */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-card border-border cursor-help">
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center">
                        <Target className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-2xl font-bold text-foreground">{stats.novos}</p>
                        <p className="text-xs text-muted-foreground text-center">Novos</p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold mb-1">{SEGMENT_TOOLTIPS.novos.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{SEGMENT_TOOLTIPS.novos.description}</p>
                </TooltipContent>
              </Tooltip>

              {/* Regulares */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-card border-border cursor-help">
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center">
                        <Activity className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-2xl font-bold text-foreground">{stats.regulares}</p>
                        <p className="text-xs text-muted-foreground text-center">Regulares</p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold mb-1">{SEGMENT_TOOLTIPS.regulares.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{SEGMENT_TOOLTIPS.regulares.description}</p>
                </TooltipContent>
              </Tooltip>

              {/* Inativos */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-card border-border cursor-help">
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center">
                        <UserX className="w-8 h-8 text-gray-600 dark:text-gray-400 mb-2" />
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.inativos}</p>
                        <p className="text-xs text-gray-700 dark:text-gray-300 text-center">Inativos</p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold mb-1">{SEGMENT_TOOLTIPS.inativos.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{SEGMENT_TOOLTIPS.inativos.description}</p>
                </TooltipContent>
              </Tooltip>

              {/* Total (sem tooltip) */}
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex flex-col items-center">
                    <Users className="w-8 h-8 text-slate-600 dark:text-slate-400 mb-2" />
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.total_clientes}</p>
                    <p className="text-xs text-slate-700 dark:text-slate-300 text-center">Total</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TooltipProvider>
        ) : null}

        {/* Filtros e Ações */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Tabs value={filtroSegmento} onValueChange={setFiltroSegmento} className="w-full">
                  <TabsList className="bg-muted/70 border border-border flex-wrap h-auto">
                    {segmentos.map(seg => (
                      <TabsTrigger
                        key={seg.value}
                        value={seg.value}
                        className="text-xs data-[state=active]:bg-muted data-[state=active]:border data-[state=active]:border-border/70"
                      >
                        <seg.icon className="w-3 h-3 mr-1" />
                        {seg.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => carregarDados(true)}
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
                <Button
                  onClick={exportarCSV}
                  variant="outline"
                  size="sm"
                  disabled={clientes.length === 0}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar ({clientes.length})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Clientes */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <Target className="w-5 h-5" />
              Clientes Segmentados ({paginacao.total > 0 ? `${clientes.length} de ${paginacao.total}` : clientes.length})
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Análise RFM com ações estratégicas personalizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-4 w-[200px]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {clientes.map((cliente) => (
                  <div
                    key={cliente.identificador}
                    className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                    onClick={() => abrirDetalhes(cliente)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-foreground font-bold text-lg">
                            {cliente.nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              {cliente.nome}
                            </h4>
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                              {cliente.email && <span>{cliente.email}</span>}
                              {cliente.telefone && (
                                <>
                                  <span>•</span>
                                  <span>{cliente.telefone}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-15">
                          <Badge className={getCorBadge(cliente.cor)}>
                            {cliente.segmento}
                          </Badge>
                          <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                            RFM: {cliente.rfm_total}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-6 text-center">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Visitas</p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{cliente.total_visitas}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Gasto Total</p>
                          <p className="text-lg font-bold text-foreground">
                            {formatCurrency(cliente.total_gasto)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Ticket Médio</p>
                          <p className="text-lg font-bold text-foreground">
                            {formatCurrency(cliente.ticket_medio)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Última Visita</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {cliente.dias_desde_ultima_visita}d
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {clientes.length === 0 && !loading && (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Nenhum cliente encontrado neste segmento
                    </p>
                  </div>
                )}

                {/* Botão Carregar Mais */}
                {paginacao.hasMore && !loading && (
                  <div className="flex justify-center pt-6">
                    <Button
                      onClick={carregarMais}
                      disabled={loadingMore}
                      variant="outline"
                      className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    >
                      {loadingMore ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Carregando...
                        </>
                      ) : (
                        <>
                          <TrendingDown className="w-4 h-4 mr-2" />
                          Carregar mais ({paginacao.total - clientes.length} restantes)
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de Detalhes */}
        <Dialog open={modalDetalhes} onOpenChange={setModalDetalhes}>
          <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <Target className="w-5 h-5" />
                Detalhes do Cliente
              </DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                {clienteSelecionado?.nome}
              </DialogDescription>
            </DialogHeader>

            {clienteSelecionado && (
              <div className="space-y-6">
                {/* Scores RFM */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-card border-border">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Recência</p>
                      <p className="text-3xl font-bold text-foreground">
                        {clienteSelecionado.r_score}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {clienteSelecionado.dias_desde_ultima_visita} dias
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Frequência</p>
                      <p className="text-3xl font-bold text-foreground">
                        {clienteSelecionado.f_score}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {clienteSelecionado.total_visitas} visitas
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Monetário</p>
                      <p className="text-3xl font-bold text-foreground">
                        {clienteSelecionado.m_score}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatCurrency(clienteSelecionado.total_gasto)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Informações Gerais */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-gray-600 dark:text-gray-400 mb-1">Email</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {clienteSelecionado.email || 'Não informado'}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-gray-600 dark:text-gray-400 mb-1">Telefone</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {clienteSelecionado.telefone || 'Não informado'}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-gray-600 dark:text-gray-400 mb-1">Primeira Visita</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatDate(clienteSelecionado.primeira_visita)}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-gray-600 dark:text-gray-400 mb-1">Última Visita</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatDate(clienteSelecionado.ultima_visita)}
                    </p>
                  </div>
                </div>

                {/* Ações Sugeridas */}
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-muted-foreground" />
                    Ações Estratégicas Sugeridas
                  </h4>
                  <div className="space-y-2">
                    {clienteSelecionado.acoes_sugeridas.map((acao, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 bg-muted/40 border border-border rounded-lg"
                      >
                        <Target className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-foreground">
                          {acao}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contato Rápido */}
                {clienteSelecionado.telefone && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => window.open(`https://wa.me/55${clienteSelecionado.telefone?.replace(/\D/g, '')}`, '_blank')}
                      variant="outline"
                      className="flex-1"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Enviar WhatsApp
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

