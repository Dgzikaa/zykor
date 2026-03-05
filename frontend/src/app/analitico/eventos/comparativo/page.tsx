'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  RefreshCw,
  ArrowLeftRight,
  Filter,
  CheckCircle2,
  UserPlus,
  RotateCcw
} from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { toast } from 'sonner';

interface EventoComparativo {
  data_evento: string;
  nome: string;
  real_r: number;
  cl_real: number;
  te_real: number;
  tb_real: number;
  m1_r: number;
  percent_art_fat: number;
  couvert_com_entrada: boolean;
}

interface DadosComparativos {
  periodo1: {
    eventos: EventoComparativo[];
    totais: {
      faturamento: number;
      clientes: number;
      ticket_medio: number;
      novos_clientes: number;
      clientes_retornantes: number;
    };
  };
  periodo2: {
    eventos: EventoComparativo[];
    totais: {
      faturamento: number;
      clientes: number;
      ticket_medio: number;
      novos_clientes: number;
      clientes_retornantes: number;
    };
  };
  comparacao: {
    faturamento_variacao: number;
    clientes_variacao: number;
    ticket_medio_variacao: number;
    novos_clientes_variacao: number;
    clientes_retornantes_variacao: number;
  };
}

export default function EventosComparativoPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();

  const [tipoComparacao, setTipoComparacao] = useState<'dia' | 'semana' | 'mes' | 'custom'>('semana');
  const [dataReferencia1, setDataReferencia1] = useState(new Date().toISOString().split('T')[0]);
  const [dataReferencia2, setDataReferencia2] = useState(() => {
    const data = new Date();
    data.setDate(data.getDate() - 7); // 1 semana atrás
    return data.toISOString().split('T')[0];
  });
  const [filtroCouvert, setFiltroCouvert] = useState<'todos' | 'com_entrada' | 'sem_entrada'>('todos');
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<DadosComparativos | null>(null);

  useEffect(() => {
    setPageTitle('📊 Comparativo de Eventos');
  }, [setPageTitle]);

  const buscarComparativo = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        bar_id: selectedBar?.id?.toString() || '',
        tipo: tipoComparacao,
        data1: dataReferencia1,
        data2: dataReferencia2,
        filtro_couvert: filtroCouvert
      });

      const response = await fetch(`/api/analitico/eventos/comparativo?${params}`);
      const result = await response.json();

      if (result.success) {
        setDados(result.data);
        toast.success('Comparativo carregado com sucesso!');
      } else {
        toast.error(result.error || 'Erro ao buscar comparativo');
      }
    } catch (error) {
      console.error('Erro ao buscar comparativo:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T12:00:00Z');
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  const getVariacaoColor = (variacao: number) => {
    if (variacao > 0) return 'text-green-600 dark:text-green-400';
    if (variacao < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getVariacaoIcon = (variacao: number) => {
    if (variacao > 0) return <TrendingUp className="w-4 h-4" />;
    if (variacao < 0) return <TrendingDown className="w-4 h-4" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-2 py-4 max-w-[98vw]">
        {/* Filtros */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros de Comparação
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Selecione os períodos e filtros para comparar eventos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Tipo de Comparação */}
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Tipo de Comparação</Label>
                <Select value={tipoComparacao} onValueChange={(v) => setTipoComparacao(v as any)}>
                  <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800">
                    <SelectItem value="dia">Dia x Dia</SelectItem>
                    <SelectItem value="semana">Semana x Semana</SelectItem>
                    <SelectItem value="mes">Mês x Mês</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Data Referência 1 */}
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Período 1</Label>
                <Input
                  type="date"
                  value={dataReferencia1}
                  onChange={(e) => setDataReferencia1(e.target.value)}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>

              {/* Data Referência 2 */}
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Período 2</Label>
                <Input
                  type="date"
                  value={dataReferencia2}
                  onChange={(e) => setDataReferencia2(e.target.value)}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>

              {/* Filtro Couvert */}
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Filtro Couvert</Label>
                <Select value={filtroCouvert} onValueChange={(v) => setFiltroCouvert(v as any)}>
                  <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800">
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="com_entrada">Com Entrada</SelectItem>
                    <SelectItem value="sem_entrada">Sem Entrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={buscarComparativo}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="w-4 h-4 mr-2" />
                    Comparar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resultados */}
        {dados && (
          <>
            {/* Cards de Variação */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {/* Faturamento */}
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Faturamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {formatCurrency(dados.periodo1.totais.faturamento)}
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${getVariacaoColor(dados.comparacao.faturamento_variacao)}`}>
                    {getVariacaoIcon(dados.comparacao.faturamento_variacao)}
                    {dados.comparacao.faturamento_variacao > 0 ? '+' : ''}
                    {dados.comparacao.faturamento_variacao.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    vs {formatCurrency(dados.periodo2.totais.faturamento)}
                  </div>
                </CardContent>
              </Card>

              {/* Clientes */}
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Clientes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {dados.periodo1.totais.clientes}
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${getVariacaoColor(dados.comparacao.clientes_variacao)}`}>
                    {getVariacaoIcon(dados.comparacao.clientes_variacao)}
                    {dados.comparacao.clientes_variacao > 0 ? '+' : ''}
                    {dados.comparacao.clientes_variacao.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    vs {dados.periodo2.totais.clientes}
                  </div>
                </CardContent>
              </Card>

              {/* Ticket Médio */}
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    🎯 Ticket Médio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {formatCurrency(dados.periodo1.totais.ticket_medio)}
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${getVariacaoColor(dados.comparacao.ticket_medio_variacao)}`}>
                    {getVariacaoIcon(dados.comparacao.ticket_medio_variacao)}
                    {dados.comparacao.ticket_medio_variacao > 0 ? '+' : ''}
                    {dados.comparacao.ticket_medio_variacao.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    vs {formatCurrency(dados.periodo2.totais.ticket_medio)}
                  </div>
                </CardContent>
              </Card>

              {/* Novos Clientes */}
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Novos Clientes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {dados.periodo1.totais.novos_clientes}
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${getVariacaoColor(dados.comparacao.novos_clientes_variacao)}`}>
                    {getVariacaoIcon(dados.comparacao.novos_clientes_variacao)}
                    {dados.comparacao.novos_clientes_variacao > 0 ? '+' : ''}
                    {dados.comparacao.novos_clientes_variacao.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    vs {dados.periodo2.totais.novos_clientes}
                  </div>
                </CardContent>
              </Card>

              {/* Clientes Retornantes */}
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Clientes Retornantes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {dados.periodo1.totais.clientes_retornantes}
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${getVariacaoColor(dados.comparacao.clientes_retornantes_variacao)}`}>
                    {getVariacaoIcon(dados.comparacao.clientes_retornantes_variacao)}
                    {dados.comparacao.clientes_retornantes_variacao > 0 ? '+' : ''}
                    {dados.comparacao.clientes_retornantes_variacao.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    vs {dados.periodo2.totais.clientes_retornantes}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabelas de Eventos */}
            <Tabs defaultValue="periodo1" className="w-full">
              <TabsList className="bg-gray-100 dark:bg-gray-700 w-full sm:w-auto">
                <TabsTrigger value="periodo1" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white dark:text-gray-300">
                  <Calendar className="w-4 h-4 mr-2" />
                  Período 1
                </TabsTrigger>
                <TabsTrigger value="periodo2" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white dark:text-gray-300">
                  <Calendar className="w-4 h-4 mr-2" />
                  Período 2
                </TabsTrigger>
              </TabsList>

              <TabsContent value="periodo1">
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white">
                      Eventos - Período 1
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dados.periodo1.eventos.length > 0 ? (
                      <div className="space-y-2">
                        {dados.periodo1.eventos.map((evento, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                          >
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {evento.nome}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {formatDate(evento.data_evento)}
                                {filtroCouvert !== 'todos' && (
                                  <Badge className="ml-2" variant={evento.couvert_com_entrada ? 'default' : 'secondary'}>
                                    {evento.couvert_com_entrada ? 'Com Entrada' : 'Sem Entrada'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(evento.real_r)}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {evento.cl_real} clientes
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        Nenhum evento encontrado para este período
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="periodo2">
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white">
                      Eventos - Período 2
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dados.periodo2.eventos.length > 0 ? (
                      <div className="space-y-2">
                        {dados.periodo2.eventos.map((evento, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                          >
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {evento.nome}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {formatDate(evento.data_evento)}
                                {filtroCouvert !== 'todos' && (
                                  <Badge className="ml-2" variant={evento.couvert_com_entrada ? 'default' : 'secondary'}>
                                    {evento.couvert_com_entrada ? 'Com Entrada' : 'Sem Entrada'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(evento.real_r)}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {evento.cl_real} clientes
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        Nenhum evento encontrado para este período
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {!dados && !loading && (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="text-center py-16">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Selecione os períodos para comparar
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Configure os filtros acima e clique em &quot;Comparar&quot;
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

