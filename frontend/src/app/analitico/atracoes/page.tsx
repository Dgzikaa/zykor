'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useBar } from '@/contexts/BarContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Music, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Users,
  DollarSign,
  Target,
  Calendar,
  Award,
  BarChart3,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface Atracao {
  artista_id: number | null;
  nome: string;
  tipo: string;
  shows: number;
  fat_total: number;
  fat_medio: number;
  publico_total: number;
  publico_medio: number;
  custo_total: number;
  custo_medio: number;
  ticket_medio: number;
  roi: number | null;
  tendencia: 'subindo' | 'estavel' | 'caindo';
  ultimo_show: string;
  dias_sem_tocar: number;
  baseline_fat: number | null;
  baseline_publico: number | null;
  lift_fat: number | null;
  lift_fat_pct: number | null;
  lift_publico: number | null;
  eventos: Array<{
    data: string;
    dia_semana: string;
    faturamento: number;
    publico: number;
    custo: number;
    ticket: number;
    co_headline: boolean;
  }>;
}

interface Stats {
  total_atracoes: number;
  total_shows: number;
  fat_total: number;
  custo_total: number;
  roi_medio: number | null;
  top_faturamento: string | null;
  top_roi: string | null;
  top_publico: string | null;
  top_lift: string | null;
}

export default function DashboardAtracoesPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  const [atracoes, setAtracoes] = useState<Atracao[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [semDados, setSemDados] = useState(false);
  const [periodo, setPeriodo] = useState('12');
  const [ordenacao, setOrdenacao] = useState<'fat_total' | 'roi' | 'publico_medio' | 'shows' | 'lift_fat'>('fat_total');
  const [atracaoSelecionada, setAtracaoSelecionada] = useState<Atracao | null>(null);

  useEffect(() => {
    if (!barId) return;
    const fetchAtracoes = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/analitico/atracoes?periodo=${periodo}&min_shows=2`, {
          headers: { 'x-selected-bar-id': String(barId) },
        });
        const result = await response.json();
        if (result.success) {
          setAtracoes(result.data || []);
          setStats(result.stats);
          setSemDados(!!result.sem_dados);
        }
      } catch (error) {
        console.error('Erro ao buscar atrações:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAtracoes();
  }, [periodo, barId]);

  const atracoesOrdenadas = [...atracoes].sort((a, b) => {
    switch (ordenacao) {
      case 'roi':
        return (b.roi || 0) - (a.roi || 0);
      case 'publico_medio':
        return b.publico_medio - a.publico_medio;
      case 'shows':
        return b.shows - a.shows;
      case 'lift_fat':
        return (b.lift_fat || -Infinity) - (a.lift_fat || -Infinity);
      default:
        return b.fat_total - a.fat_total;
    }
  });

  const getTendenciaIcon = (tendencia: string) => {
    switch (tendencia) {
      case 'subindo':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'caindo':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoiBadge = (roi: number | null) => {
    if (roi === null) return <Badge variant="outline">N/A</Badge>;
    if (roi >= 500) return <Badge className="bg-purple-600">ROI {roi.toFixed(0)}%</Badge>;
    if (roi >= 300) return <Badge className="bg-green-600">ROI {roi.toFixed(0)}%</Badge>;
    if (roi >= 100) return <Badge className="bg-blue-600">ROI {roi.toFixed(0)}%</Badge>;
    if (roi >= 0) return <Badge className="bg-yellow-600">ROI {roi.toFixed(0)}%</Badge>;
    return <Badge className="bg-red-600">ROI {roi.toFixed(0)}%</Badge>;
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
              <Music className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Dashboard de Atrações
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Análise de performance e ROI dos artistas
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Link href="/analitico/atracoes/tagging">
              <Button variant="outline" className="bg-white dark:bg-gray-800 gap-2">
                <Music className="w-4 h-4" /> Taggear eventos
              </Button>
            </Link>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-40 bg-white dark:bg-gray-800">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Último ano</SelectItem>
                <SelectItem value="24">Últimos 2 anos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={ordenacao} onValueChange={(v: any) => setOrdenacao(v)}>
              <SelectTrigger className="w-48 bg-white dark:bg-gray-800">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fat_total">Faturamento Total</SelectItem>
                <SelectItem value="roi">Melhor ROI</SelectItem>
                <SelectItem value="lift_fat">Maior Lift (vs média do dia)</SelectItem>
                <SelectItem value="publico_medio">Maior Público</SelectItem>
                <SelectItem value="shows">Mais Shows</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-purple-600 dark:text-purple-400 mb-1">Atrações Ativas</div>
                    <div className="text-3xl font-bold text-purple-700 dark:text-purple-300">{stats.total_atracoes}</div>
                    <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">{stats.total_shows} shows no período</div>
                  </div>
                  <Award className="w-12 h-12 text-purple-600 dark:text-purple-400 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-green-600 dark:text-green-400 mb-1">Faturamento Total</div>
                    <div className="text-2xl font-bold text-green-700 dark:text-green-300">{formatCurrency(stats.fat_total)}</div>
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">Top: {stats.top_faturamento}</div>
                  </div>
                  <DollarSign className="w-12 h-12 text-green-600 dark:text-green-400 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">ROI Médio</div>
                    <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                      {stats.roi_medio ? `${stats.roi_medio.toFixed(0)}%` : 'N/A'}
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">Melhor: {stats.top_roi}</div>
                  </div>
                  <Target className="w-12 h-12 text-blue-600 dark:text-blue-400 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border-orange-200 dark:border-orange-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-orange-600 dark:text-orange-400 mb-1">Custo Total</div>
                    <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{formatCurrency(stats.custo_total)}</div>
                    <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">Mais público: {stats.top_publico}</div>
                  </div>
                  <Users className="w-12 h-12 text-orange-600 dark:text-orange-400 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lista de Atrações */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Ranking de Atrações
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Performance detalhada de cada artista no período selecionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
              </div>
            ) : semDados ? (
              <div className="text-center py-12">
                <Music className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Nenhum artista vinculado a eventos ainda</h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                  Vincule artistas aos eventos na seção <strong>Artistas</strong> do modal Editar Evento (Planejamento Comercial).
                  Assim que houver shows taggeados, a análise de performance aparece aqui.
                </p>
              </div>
            ) : atracoesOrdenadas.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                Nenhuma atração com 2+ shows no período selecionado.
              </div>
            ) : (
              <div className="space-y-4">
                {atracoesOrdenadas.map((atracao, index) => (
                  <Card 
                    key={atracao.nome}
                    className="border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => setAtracaoSelecionada(atracao)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        {/* Info Principal */}
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                            index === 0 ? 'bg-yellow-500' :
                            index === 1 ? 'bg-gray-400' :
                            index === 2 ? 'bg-amber-600' :
                            'bg-gray-600'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                              {atracao.nome}
                              {getTendenciaIcon(atracao.tendencia)}
                            </h3>
                            <div className="flex gap-2 mt-1 flex-wrap">
                              <Badge variant="outline" className="capitalize">{atracao.tipo}</Badge>
                              <Badge variant="outline">{atracao.shows} shows</Badge>
                              {getRoiBadge(atracao.roi)}
                              {atracao.lift_fat != null && (
                                <Badge className={atracao.lift_fat >= 0 ? 'bg-emerald-600' : 'bg-red-600'}>
                                  {atracao.lift_fat >= 0 ? '+' : ''}{formatCurrency(atracao.lift_fat)} vs média do {atracao.eventos[0]?.dia_semana || 'dia'}
                                </Badge>
                              )}
                              {atracao.dias_sem_tocar > 60 && (
                                <Badge variant="outline" className="text-orange-600 border-orange-300">
                                  {atracao.dias_sem_tocar} dias sem tocar
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Métricas */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 text-right">
                          <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">Fat. Total</div>
                            <div className="text-lg font-bold text-gray-900 dark:text-white">
                              {formatCurrency(atracao.fat_total)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">Fat. Médio</div>
                            <div className="text-lg font-bold text-gray-900 dark:text-white">
                              {formatCurrency(atracao.fat_medio)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">Público Médio</div>
                            <div className="text-lg font-bold text-gray-900 dark:text-white">
                              {atracao.publico_medio} PAX
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">Custo Médio</div>
                            <div className="text-lg font-bold text-gray-900 dark:text-white">
                              {formatCurrency(atracao.custo_medio)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Barra de progresso visual */}
                      <div className="mt-4 flex items-center gap-4">
                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full"
                            style={{ width: `${Math.min((atracao.fat_total / (stats?.fat_total || 1)) * 100 * 3, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {((atracao.fat_total / (stats?.fat_total || 1)) * 100).toFixed(1)}% do total
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de Detalhes */}
        <Dialog open={!!atracaoSelecionada} onOpenChange={() => setAtracaoSelecionada(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800">
            {atracaoSelecionada && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-2xl text-gray-900 dark:text-white flex items-center gap-3">
                    <Music className="w-6 h-6" />
                    {atracaoSelecionada.nome}
                    {getTendenciaIcon(atracaoSelecionada.tendencia)}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                  {/* Stats do artista */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                          {formatCurrency(atracaoSelecionada.fat_total)}
                        </div>
                        <div className="text-sm text-green-600 dark:text-green-400">Fat. Total</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                          {atracaoSelecionada.roi?.toFixed(0) || 'N/A'}%
                        </div>
                        <div className="text-sm text-blue-600 dark:text-blue-400">ROI</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                          {atracaoSelecionada.publico_medio}
                        </div>
                        <div className="text-sm text-purple-600 dark:text-purple-400">Público Médio</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                          {formatCurrency(atracaoSelecionada.ticket_medio)}
                        </div>
                        <div className="text-sm text-orange-600 dark:text-orange-400">Ticket Médio</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Evolução temporal */}
                  {atracaoSelecionada.eventos.length >= 2 && (
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        Evolução de Faturamento por Show
                      </h3>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={atracaoSelecionada.eventos} margin={{ top: 5, right: 16, left: 8, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                            <XAxis
                              dataKey="data"
                              tickFormatter={(d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                              fontSize={11}
                            />
                            <YAxis
                              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                              fontSize={11}
                            />
                            <RechartsTooltip
                              formatter={((v: number, name: string): [string, string] => [
                                name === 'faturamento' ? formatCurrency(v) : `${v} PAX`,
                                name === 'faturamento' ? 'Faturamento' : 'Público',
                              ]) as any}
                              labelFormatter={(d) => new Date(d as string).toLocaleDateString('pt-BR')}
                            />
                            {atracaoSelecionada.baseline_fat != null && (
                              <ReferenceLine
                                y={atracaoSelecionada.baseline_fat}
                                stroke="#9ca3af"
                                strokeDasharray="4 4"
                                label={{ value: 'média do dia (sem o artista)', position: 'insideTopRight', fontSize: 10, fill: '#9ca3af' }}
                              />
                            )}
                            <Line type="monotone" dataKey="faturamento" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Substituição / Lift */}
                  {atracaoSelecionada.lift_fat != null && (
                    <Card className={`border ${atracaoSelecionada.lift_fat >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                      <CardContent className="p-4">
                        <h4 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5" />
                          Valor incremental (vs a casa sem esse artista)
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-gray-500 dark:text-gray-400">Fat. médio do artista</div>
                            <div className="font-bold text-gray-900 dark:text-white">{formatCurrency(atracaoSelecionada.fat_medio)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 dark:text-gray-400">Média do dia sem ele</div>
                            <div className="font-bold text-gray-900 dark:text-white">{formatCurrency(atracaoSelecionada.baseline_fat || 0)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 dark:text-gray-400">Lift em R$</div>
                            <div className={`font-bold ${atracaoSelecionada.lift_fat >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {atracaoSelecionada.lift_fat >= 0 ? '+' : ''}{formatCurrency(atracaoSelecionada.lift_fat)}
                              {atracaoSelecionada.lift_fat_pct != null && ` (${atracaoSelecionada.lift_fat_pct >= 0 ? '+' : ''}${atracaoSelecionada.lift_fat_pct.toFixed(0)}%)`}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500 dark:text-gray-400">Lift em público</div>
                            <div className={`font-bold ${(atracaoSelecionada.lift_publico || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {(atracaoSelecionada.lift_publico || 0) >= 0 ? '+' : ''}{atracaoSelecionada.lift_publico} PAX
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Histórico de shows */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Histórico de Shows ({atracaoSelecionada.shows} shows)
                    </h3>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {atracaoSelecionada.eventos.map((evento, index) => {
                        const anterior = atracaoSelecionada.eventos[index + 1];
                        const variacao = anterior 
                          ? ((evento.faturamento - anterior.faturamento) / anterior.faturamento) * 100 
                          : null;
                        
                        return (
                          <div 
                            key={evento.data}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="text-sm">
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {new Date(evento.data).toLocaleDateString('pt-BR')}
                                </div>
                                <div className="text-gray-500 dark:text-gray-400">{evento.dia_semana}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-6 text-right">
                              <div>
                                <div className="font-bold text-gray-900 dark:text-white">
                                  {formatCurrency(evento.faturamento)}
                                </div>
                                {variacao !== null && (
                                  <div className={`text-xs flex items-center justify-end gap-1 ${variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {variacao >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                    {Math.abs(variacao).toFixed(1)}%
                                  </div>
                                )}
                              </div>
                              <div className="text-gray-600 dark:text-gray-400">
                                {evento.publico} PAX
                              </div>
                              <div className="text-gray-600 dark:text-gray-400">
                                {formatCurrency(evento.custo)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Análise */}
                  <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
                    <CardContent className="p-4">
                      <h4 className="font-bold text-gray-900 dark:text-white mb-2">Análise Rápida</h4>
                      <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                        <li>
                          {atracaoSelecionada.roi && atracaoSelecionada.roi > 300 
                            ? '✅ ROI excelente - Atração muito rentável'
                            : atracaoSelecionada.roi && atracaoSelecionada.roi > 100
                            ? '✅ ROI bom - Vale o investimento'
                            : '⚠️ Avaliar custo-benefício'}
                        </li>
                        <li>
                          {atracaoSelecionada.tendencia === 'subindo'
                            ? '📈 Tendência de crescimento nos últimos shows'
                            : atracaoSelecionada.tendencia === 'caindo'
                            ? '📉 Performance caindo - avaliar renovação'
                            : '➡️ Performance estável'}
                        </li>
                        <li>
                          {atracaoSelecionada.dias_sem_tocar > 60
                            ? `⏰ ${atracaoSelecionada.dias_sem_tocar} dias sem tocar - considerar reagendar`
                            : `📅 Último show: ${new Date(atracaoSelecionada.ultimo_show).toLocaleDateString('pt-BR')}`}
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
