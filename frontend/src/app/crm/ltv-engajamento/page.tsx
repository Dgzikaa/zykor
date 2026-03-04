'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Download,
  Activity,
  Target,
  Star,
  RefreshCcw,
  Zap,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { useBar } from '@/contexts/BarContext';

interface ClienteLTV {
  telefone: string;
  nome: string;
  ltv_atual: number;
  ltv_projetado_12m: number;
  ltv_projetado_24m: number;
  score_engajamento: number;
  nivel_engajamento: 'baixo' | 'medio' | 'alto' | 'muito_alto';
  total_visitas: number;
  frequencia_visitas: number;
  ticket_medio: number;
  ticket_medio_usado: number;
  valor_medio_mensal: number;
  tendencia_valor: 'crescente' | 'estavel' | 'decrescente';
  tendencia_frequencia: 'crescente' | 'estavel' | 'decrescente';
  potencial_crescimento: 'baixo' | 'medio' | 'alto';
  roi_marketing: number;
  confianca: 'alta' | 'media' | 'baixa';
  dados_preliminares: boolean;
}

interface Stats {
  total_clientes: number;
  clientes_confiaveis: number;
  clientes_preliminares: number;
  ltv_total_atual: number;
  ltv_total_projetado_12m: number;
  ltv_medio_atual: number;
  ltv_medio_confiaveis: number;
  ticket_medio_bar: number;
  engajamento_muito_alto: number;
  engajamento_alto: number;
  engajamento_medio: number;
  engajamento_baixo: number;
}

export default function LTVEngajamentoPage() {
  const { selectedBar } = useBar();
  const [clientes, setClientes] = useState<ClienteLTV[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [fromCache, setFromCache] = useState(false);
  const [ticketMedioBar, setTicketMedioBar] = useState(0);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [filtroConfianca, setFiltroConfianca] = useState<'todos' | 'confiaveis' | 'preliminares'>('todos');
  const itensPorPagina = 20;

  const fetchLTV = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/crm/ltv-engajamento?limite=5000&bar_id=${selectedBar?.id}`);
      const result = await response.json();

      if (result.success) {
        setClientes(result.data || []);
        setStats(result.stats);
        setFromCache(result.fromCache || false);
        setTicketMedioBar(result.ticket_medio_bar || 0);
      } else {
        console.error('Erro na API:', result.error);
      }
    } catch (error) {
      console.error('Erro ao carregar LTV:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedBar?.id) return;
    fetchLTV();
  }, [selectedBar?.id]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [busca, filtroConfianca]);

  // Filtrar por busca e confiança
  const clientesFiltrados = clientes.filter(c => {
    const matchBusca = c.nome.toLowerCase().includes(busca.toLowerCase()) || c.telefone.includes(busca);
    
    if (filtroConfianca === 'confiaveis') {
      return matchBusca && !c.dados_preliminares;
    } else if (filtroConfianca === 'preliminares') {
      return matchBusca && c.dados_preliminares;
    }
    return matchBusca;
  });

  const totalPaginas = Math.ceil(clientesFiltrados.length / itensPorPagina);
  const clientesPaginados = clientesFiltrados.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  );

  const getEngajamentoBadge = (nivel: string, score: number) => {
    switch (nivel) {
      case 'muito_alto':
        return <Badge variant="outline" className="bg-muted text-foreground border-border">⭐ {score} - Muito Alto</Badge>;
      case 'alto':
        return <Badge variant="outline" className="bg-muted text-foreground border-border">🔥 {score} - Alto</Badge>;
      case 'medio':
        return <Badge variant="outline" className="bg-muted text-foreground border-border">⚡ {score} - Médio</Badge>;
      case 'baixo':
        return <Badge variant="outline" className="bg-muted text-foreground border-border">💤 {score} - Baixo</Badge>;
      default:
        return <Badge>-</Badge>;
    }
  };

  const getConfiancaBadge = (confianca: string, dadosPreliminares: boolean) => {
    if (dadosPreliminares) {
      return (
        <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-700">
          <Clock className="w-3 h-3 mr-1" />
          Preliminar
        </Badge>
      );
    }
    
    switch (confianca) {
      case 'alta':
        return (
          <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Confiável
          </Badge>
        );
      case 'media':
        return (
          <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Confiável
          </Badge>
        );
      default:
        return null;
    }
  };

  const getTendenciaIcon = (tendencia: string) => {
    switch (tendencia) {
      case 'crescente':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'decrescente':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatarMoeda = (valor: number) => {
    if (valor >= 1000000) {
      return `R$ ${(valor / 1000000).toFixed(1)}M`;
    }
    if (valor >= 1000) {
      return `R$ ${(valor / 1000).toFixed(1)}k`;
    }
    return `R$ ${valor.toLocaleString('pt-BR')}`;
  };

  const exportarCSV = () => {
    const headers = ['Nome', 'Telefone', 'LTV Atual', 'LTV 12m', 'Visitas', 'Ticket Médio', 'Confiança', 'Score', 'ROI Marketing'];
    const rows = clientesFiltrados.map(c => [
      c.nome,
      c.telefone,
      c.ltv_atual,
      c.ltv_projetado_12m,
      c.total_visitas,
      c.ticket_medio,
      c.dados_preliminares ? 'Preliminar' : 'Confiável',
      c.score_engajamento,
      c.roi_marketing
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ltv-engajamento-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-2 py-4 max-w-[98vw]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              💰 LTV e Score de Engajamento
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Lifetime Value e métricas de engajamento dos clientes (dados reais ContaHub)
            </p>
          </div>

          <div className="flex items-center gap-3">
            {fromCache && (
              <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700">
                <Zap className="w-3 h-3 mr-1" />
                Cache
              </Badge>
            )}
            <Button 
              onClick={fetchLTV} 
              variant="outline" 
              disabled={loading}
              className="border-gray-300 dark:border-gray-600"
            >
              <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button onClick={exportarCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Stats com Tooltips */}
        <TooltipProvider>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
              {/* LTV Atual Total */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-help">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">LTV Atual Total</div>
                        <HelpCircle className="w-3 h-3 text-gray-400" />
                      </div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white">
                        {formatarMoeda(stats.ltv_total_atual)}
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-3">
                  <p className="font-semibold mb-1">💰 LTV Atual Total</p>
                  <p className="text-sm">Soma de todos os valores gastos pelos clientes.</p>
                  <p className="text-xs text-gray-500 mt-1">Fonte: ContaHub (couvert + pagamentos)</p>
                </TooltipContent>
              </Tooltip>

              {/* LTV Projetado 12m */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-card border-border cursor-help">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground mb-1">LTV Projetado 12m</div>
                        <HelpCircle className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <div className="text-xl font-bold text-foreground">
                        {formatarMoeda(stats.ltv_total_projetado_12m)}
                      </div>
                      <div className="text-xs text-muted-foreground">só confiáveis</div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-3">
                  <p className="font-semibold mb-1">📈 LTV Projetado 12 Meses</p>
                  <p className="text-sm">Projeção calculada APENAS para clientes confiáveis (3+ visitas).</p>
                  <p className="text-xs text-gray-500 mt-2">Clientes com 1-2 visitas não são projetados - não há dados suficientes.</p>
                </TooltipContent>
              </Tooltip>

              {/* Ticket Médio Bar */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-card border-border cursor-help">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground mb-1">Ticket Médio Bar</div>
                        <HelpCircle className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <div className="text-xl font-bold text-foreground">
                        {formatarMoeda(stats.ticket_medio_bar)}
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-3">
                  <p className="font-semibold mb-1">🎫 Ticket Médio do Bar</p>
                  <p className="text-sm">Média de gasto por visita calculada apenas com clientes confiáveis (3+ visitas).</p>
                  <p className="text-xs text-gray-500 mt-1">Usado como referência para projeções de clientes novos.</p>
                </TooltipContent>
              </Tooltip>

              {/* Clientes Confiáveis */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 cursor-help">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Dados Confiáveis</div>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      </div>
                      <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                        {stats.clientes_confiaveis.toLocaleString('pt-BR')}
                      </div>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400">3+ visitas</div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-3">
                  <p className="font-semibold mb-1">✅ Clientes com Dados Confiáveis</p>
                  <p className="text-sm">Clientes com 3 ou mais visitas - dados estatisticamente relevantes.</p>
                  <p className="text-xs text-gray-500 mt-1">Projeções são baseadas no histórico real do cliente.</p>
                </TooltipContent>
              </Tooltip>

              {/* Clientes Preliminares */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-card border-border cursor-help">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground mb-1">Dados Preliminares</div>
                        <AlertCircle className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <div className="text-xl font-bold text-foreground">
                        {stats.clientes_preliminares.toLocaleString('pt-BR')}
                      </div>
                      <div className="text-xs text-muted-foreground">1-2 visitas</div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-3">
                  <p className="font-semibold mb-1">📊 Clientes com Dados Preliminares</p>
                  <p className="text-sm">Clientes com 1-2 visitas - dados ainda não são representativos.</p>
                  <p className="text-xs text-gray-500 mt-1">Projeções usam ticket médio do bar com fator conservador de 50%.</p>
                </TooltipContent>
              </Tooltip>

              {/* Total Clientes */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-card border-border cursor-help">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground mb-1">Total Clientes</div>
                        <HelpCircle className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <div className="text-xl font-bold text-foreground">
                        {stats.total_clientes.toLocaleString('pt-BR')}
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-3">
                  <p className="font-semibold mb-1">👥 Total de Clientes</p>
                  <p className="text-sm">Clientes únicos identificados pelo telefone.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          ) : null}

          {/* Filtros */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por nome ou telefone..."
                    className="pl-10 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={filtroConfianca === 'todos' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroConfianca('todos')}
                    className={filtroConfianca === 'todos' ? 'bg-gray-900 dark:bg-gray-100' : ''}
                  >
                    Todos
                  </Button>
                  <Button
                    variant={filtroConfianca === 'confiaveis' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroConfianca('confiaveis')}
                    className={filtroConfianca === 'confiaveis' ? 'bg-muted text-foreground border border-border hover:bg-muted' : ''}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Confiáveis
                  </Button>
                  <Button
                    variant={filtroConfianca === 'preliminares' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroConfianca('preliminares')}
                    className={filtroConfianca === 'preliminares' ? 'bg-muted text-foreground border border-border hover:bg-muted' : ''}
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    Preliminares
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">
                Clientes por LTV Atual ({clientesFiltrados.length.toLocaleString('pt-BR')})
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Ordenados por valor real já gasto
                {totalPaginas > 1 && ` • Página ${paginaAtual} de ${totalPaginas}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-48" />
                  ))}
                </div>
              ) : clientesPaginados.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  {busca ? 'Nenhum cliente encontrado com essa busca' : 'Nenhum dado de cliente disponível'}
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {clientesPaginados.map((cliente, index) => {
                      const posicaoGeral = (paginaAtual - 1) * itensPorPagina + index;
                      return (
                        <Card 
                          key={cliente.telefone} 
                          className={`border ${cliente.dados_preliminares 
                            ? 'border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-900/10' 
                            : 'border-gray-200 dark:border-gray-700'}`}
                        >
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  {posicaoGeral < 3 && !cliente.dados_preliminares && (
                                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                  )}
                                  <span className="text-sm text-gray-500 dark:text-gray-400">#{posicaoGeral + 1}</span>
                                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                    {cliente.nome}
                                  </h3>
                                  {getConfiancaBadge(cliente.confianca, cliente.dados_preliminares)}
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {cliente.telefone} • {cliente.total_visitas} visita{cliente.total_visitas !== 1 ? 's' : ''}
                                </p>
                              </div>
                              {getEngajamentoBadge(cliente.nivel_engajamento, cliente.score_engajamento)}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                              {/* LTV Atual */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg cursor-help">
                                    <div className="flex items-center justify-between">
                                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">LTV Atual</div>
                                      <HelpCircle className="w-3 h-3 text-gray-400" />
                                    </div>
                                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                                      {formatarMoeda(cliente.ltv_atual)}
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs p-3">
                                  <p className="font-semibold mb-1">💰 LTV Atual</p>
                                  <p className="text-sm">Valor real já gasto pelo cliente.</p>
                                </TooltipContent>
                              </Tooltip>

                              {/* Projeção 12m */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={`p-3 rounded-lg cursor-help ${cliente.dados_preliminares 
                                    ? 'bg-gray-100 dark:bg-gray-700/50' 
                                    : 'bg-green-50 dark:bg-green-900/20'}`}>
                                    <div className="flex items-center justify-between">
                                      <div className={`text-xs mb-1 ${cliente.dados_preliminares 
                                        ? 'text-gray-500 dark:text-gray-400' 
                                        : 'text-green-600 dark:text-green-400'}`}>
                                        Projeção 12m
                                      </div>
                                      <HelpCircle className={`w-3 h-3 ${cliente.dados_preliminares ? 'text-gray-400' : 'text-green-400'}`} />
                                    </div>
                                    {cliente.dados_preliminares ? (
                                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        Aguardando dados
                                      </div>
                                    ) : (
                                      <div className="text-xl font-bold text-green-700 dark:text-green-300">
                                        {formatarMoeda(cliente.ltv_projetado_12m)}
                                      </div>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs p-3">
                                  <p className="font-semibold mb-1">📈 Projeção 12 Meses</p>
                                  {cliente.dados_preliminares ? (
                                    <>
                                      <p className="text-sm text-gray-600">Não é possível projetar com apenas {cliente.total_visitas} visita(s).</p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        Necessário mínimo de 3 visitas para projeção confiável.
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-sm">Baseada no histórico real do cliente.</p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        Ticket: R$ {cliente.ticket_medio} × {cliente.frequencia_visitas} visitas/mês × tendência
                                      </p>
                                    </>
                                  )}
                                </TooltipContent>
                              </Tooltip>

                              {/* Ticket Médio */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg cursor-help">
                                    <div className="flex items-center justify-between">
                                      <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">Ticket Médio</div>
                                      <HelpCircle className="w-3 h-3 text-blue-400" />
                                    </div>
                                    <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                                      {formatarMoeda(cliente.ticket_medio)}
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs p-3">
                                  <p className="font-semibold mb-1">🎟️ Ticket Médio Real</p>
                                  <p className="text-sm">Valor real gasto por visita: R$ {cliente.ltv_atual} ÷ {cliente.total_visitas} visitas</p>
                                  {cliente.dados_preliminares && (
                                    <p className="text-xs text-orange-500 mt-1">
                                      ⚠️ Com {cliente.total_visitas} visita(s) este valor pode não ser representativo
                                    </p>
                                  )}
                                </TooltipContent>
                              </Tooltip>

                              {/* ROI Marketing */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={`p-3 rounded-lg cursor-help ${cliente.dados_preliminares 
                                    ? 'bg-gray-100 dark:bg-gray-700/50' 
                                    : 'bg-purple-50 dark:bg-purple-900/20'}`}>
                                    <div className="flex items-center justify-between">
                                      <div className={`text-xs mb-1 ${cliente.dados_preliminares 
                                        ? 'text-gray-500 dark:text-gray-400' 
                                        : 'text-purple-600 dark:text-purple-400'}`}>
                                        ROI Marketing
                                      </div>
                                      <HelpCircle className={`w-3 h-3 ${cliente.dados_preliminares ? 'text-gray-400' : 'text-purple-400'}`} />
                                    </div>
                                    {cliente.dados_preliminares ? (
                                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        Aguardando dados
                                      </div>
                                    ) : (
                                      <div className="text-xl font-bold text-purple-700 dark:text-purple-300">
                                        {cliente.roi_marketing}x
                                      </div>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs p-3">
                                  <p className="font-semibold mb-1">🎯 ROI de Marketing</p>
                                  {cliente.dados_preliminares ? (
                                    <>
                                      <p className="text-sm text-gray-600">Não é possível calcular ROI sem projeção.</p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        Necessário mínimo de 3 visitas.
                                      </p>
                                    </>
                                  ) : (
                                    <p className="text-sm">Retorno estimado para cada R$1 investido em campanhas.</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </div>

                            <div className="flex items-center gap-6 text-sm">
                              <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-gray-500" />
                                <span className="text-gray-700 dark:text-gray-300">
                                  {cliente.total_visitas} visita{cliente.total_visitas !== 1 ? 's' : ''}
                                </span>
                              </div>

                              {!cliente.dados_preliminares && (
                                <>
                                  <div className="flex items-center gap-2">
                                    {getTendenciaIcon(cliente.tendencia_valor)}
                                    <span className="text-gray-700 dark:text-gray-300">
                                      Valor {cliente.tendencia_valor}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Target className="w-4 h-4 text-gray-500" />
                                    <span className="text-gray-700 dark:text-gray-300">
                                      Potencial: {cliente.potencial_crescimento}
                                    </span>
                                  </div>
                                </>
                              )}

                              {cliente.dados_preliminares && (
                                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                                  <AlertCircle className="w-4 h-4" />
                                  <span>Aguardando mais visitas para análise completa</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Paginação */}
                  {totalPaginas > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaginaAtual(1)}
                        disabled={paginaAtual === 1}
                        className="border-gray-300 dark:border-gray-600"
                      >
                        Primeira
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                        disabled={paginaAtual === 1}
                        className="border-gray-300 dark:border-gray-600"
                      >
                        Anterior
                      </Button>
                      
                      <span className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                        Página {paginaAtual} de {totalPaginas}
                      </span>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                        disabled={paginaAtual === totalPaginas}
                        className="border-gray-300 dark:border-gray-600"
                      >
                        Próxima
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaginaAtual(totalPaginas)}
                        disabled={paginaAtual === totalPaginas}
                        className="border-gray-300 dark:border-gray-600"
                      >
                        Última
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TooltipProvider>
      </div>
    </div>
  );
}
