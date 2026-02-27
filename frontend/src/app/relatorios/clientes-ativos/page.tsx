'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { 
  Users, 
  UserPlus, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  ArrowLeft,
  ArrowRight,
  Star,
  AlertCircle,
  Info,
  CheckCircle,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart as RechartsBarChart, Bar } from 'recharts';

// Componente de Tooltip para métricas
const MetricTooltip = ({ children, content }: { children: React.ReactNode; content: string }) => (
  <TooltipProvider delayDuration={200}>
    <UITooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help">{children}</div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-center">
        <p>{content}</p>
      </TooltipContent>
    </UITooltip>
  </TooltipProvider>
);

interface ClientesAtivosData {
  periodo: string;
  label: string;
  periodoAtual: {
    inicio: string;
    fim: string;
  };
  periodoAnterior: {
    inicio: string;
    fim: string;
  };
  atual: {
    totalClientes: number;
    novosClientes: number;
    clientesRetornantes: number;
    percentualNovos: number;
    percentualRetornantes: number;
    clientesAtivos: number;
  };
  anterior: {
    totalClientes: number;
    novosClientes: number;
    clientesRetornantes: number;
    clientesAtivos: number;
  };
  variacoes: {
    total: number;
    novos: number;
    retornantes: number;
    ativos: number;
  };
  insights: Array<{
    tipo: 'positivo' | 'atencao' | 'info';
    titulo: string;
    descricao: string;
  }>;
}

interface EvolucaoMensal {
  mes: string;
  mesLabel: string;
  totalClientes: number;
  novosClientes: number;
  clientesRetornantes: number;
  percentualNovos: number;
  percentualRetornantes: number;
  baseAtiva: number;
}

export default function ClientesAtivosPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();

  const [loading, setLoading] = useState(false);
  const [loadingEvolucao, setLoadingEvolucao] = useState(false);
  const [data, setData] = useState<ClientesAtivosData | null>(null);
  const [evolucaoData, setEvolucaoData] = useState<EvolucaoMensal[]>([]);
  const [periodo, setPeriodo] = useState<'dia' | 'semana' | 'mes'>('semana');
  const [dataCustom, setDataCustom] = useState(new Date().toISOString().split('T')[0]);
  const [mesesEvolucao, setMesesEvolucao] = useState(12);

  useEffect(() => {
    setPageTitle('👥 Clientes Ativos');
  }, [setPageTitle]);

  useEffect(() => {
    // Quando muda o período, resetar dataCustom para hoje
    const hoje = new Date().toISOString().split('T')[0];
    setDataCustom(hoje);
    buscarDados(hoje);
    buscarEvolucao();
  }, [periodo, selectedBar]);

  useEffect(() => {
    buscarEvolucao();
  }, [mesesEvolucao]);

  const buscarDados = async (dataEspecifica?: string) => {
    setLoading(true);
    try {
      const barId = selectedBar?.id;
      if (!barId) return;
      const params = new URLSearchParams({
        periodo,
        bar_id: barId.toString()
      });

      if (dataEspecifica || (periodo !== 'semana')) {
        params.append('data_inicio', dataEspecifica || dataCustom);
      }

      const response = await fetch(`/api/clientes-ativos?${params}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        toast.error(result.error || 'Erro ao buscar dados de clientes');
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao buscar dados de clientes');
    } finally {
      setLoading(false);
    }
  };

  const buscarEvolucao = async () => {
    setLoadingEvolucao(true);
    try {
      const barId = selectedBar?.id;
      if (!barId) return;
      const params = new URLSearchParams({
        bar_id: barId.toString(),
        meses: mesesEvolucao.toString()
      });

      const response = await fetch(`/api/clientes-ativos/evolucao?${params}`);
      const result = await response.json();

      if (result.success) {
        setEvolucaoData(result.data);
      } else {
        toast.error(result.error || 'Erro ao buscar dados de evolução');
      }
    } catch (error) {
      console.error('Erro ao buscar evolução:', error);
      toast.error('Erro ao buscar dados de evolução');
    } finally {
      setLoadingEvolucao(false);
    }
  };

  const navegarPeriodo = (direcao: 'anterior' | 'proximo') => {
    const dataAtual = new Date(dataCustom);
    
    if (periodo === 'dia') {
      dataAtual.setDate(dataAtual.getDate() + (direcao === 'proximo' ? 1 : -1));
    } else if (periodo === 'semana') {
      dataAtual.setDate(dataAtual.getDate() + (direcao === 'proximo' ? 7 : -7));
    } else if (periodo === 'mes') {
      dataAtual.setMonth(dataAtual.getMonth() + (direcao === 'proximo' ? 1 : -1));
    }
    
    const novaData = dataAtual.toISOString().split('T')[0];
    setDataCustom(novaData);
    buscarDados(novaData);
  };

  const getInsightIcon = (tipo: string) => {
    switch (tipo) {
      case 'positivo':
        return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'atencao':
        return <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />;
      default:
        return <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getInsightBorderColor = (tipo: string) => {
    switch (tipo) {
      case 'positivo':
        return 'border-l-4 border-l-green-500';
      case 'atencao':
        return 'border-l-4 border-l-orange-500';
      default:
        return 'border-l-4 border-l-blue-500';
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="p-6">
            {/* Seletor de Período */}
            <div className="mb-6">
              <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as any)} className="w-full">
                <TabsList className="bg-gray-100 dark:bg-gray-700 w-full sm:w-auto">
                  <TabsTrigger 
                    value="dia"
                    disabled={loading}
                    className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Dia
                  </TabsTrigger>
                  <TabsTrigger 
                    value="semana"
                    disabled={loading}
                    className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Semana
                  </TabsTrigger>
                  <TabsTrigger 
                    value="mes"
                    disabled={loading}
                    className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Mês
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Navegação e Data */}
            {data && !loading && (
              <div className="mb-6 space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {data.label}
                  </h3>
                </div>

                <div className="flex items-center justify-center gap-4">
                  <Button
                    onClick={() => navegarPeriodo('anterior')}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    leftIcon={<ArrowLeft className="w-4 h-4" />}
                    className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600"
                  >
                    {periodo === 'dia' ? 'Dia' : periodo === 'semana' ? 'Semana' : 'Mês'} Anterior
                  </Button>

                  {periodo !== 'semana' && (
                    <Input
                      type="date"
                      value={dataCustom}
                      onChange={(e) => {
                        setDataCustom(e.target.value);
                        buscarDados(e.target.value);
                      }}
                      disabled={loading}
                      className="w-48 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  )}

                  <Button
                    onClick={() => navegarPeriodo('proximo')}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                    className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600"
                  >
                    Próxim{periodo === 'dia' ? 'o Dia' : periodo === 'semana' ? 'a Semana' : 'o Mês'}
                  </Button>
                </div>
              </div>
            )}

            {/* Loading ou Dados */}
            {loading ? (
              <LoadingState 
                title="Carregando análise..."
                subtitle="Processando dados de clientes ativos"
                icon={<Users className="w-4 h-4" />}
              />
            ) : data ? (
              <>
                {/* Cards de Métricas */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {/* Total de Clientes */}
                  <MetricTooltip content="Número total de clientes únicos que visitaram o bar no período selecionado. Cada cliente é contado apenas uma vez, mesmo que tenha feito múltiplas visitas.">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Total de Clientes
                        </span>
                        <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        {data.atual.totalClientes.toLocaleString('pt-BR')}
                      </div>
                      <div className="flex items-center gap-2">
                        {data.variacoes.total >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                        <span className={`text-sm font-medium ${data.variacoes.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {data.variacoes.total > 0 ? '+' : ''}{data.variacoes.total}%
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Anterior: {data.anterior.totalClientes.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </MetricTooltip>

                  {/* Novos Clientes */}
                  <MetricTooltip content="Clientes que visitaram o bar pela PRIMEIRA VEZ no período selecionado. São pessoas que nunca tinham vindo antes em todo o histórico registrado.">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-green-300 dark:hover:border-green-600 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Novos Clientes
                        </span>
                        <UserPlus className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl font-bold text-gray-900 dark:text-white">
                          {data.atual.novosClientes.toLocaleString('pt-BR')}
                        </span>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-sm font-semibold">
                          {data.atual.percentualNovos.toFixed(1)}% do total
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {data.variacoes.novos >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                        <span className={`text-sm font-medium ${data.variacoes.novos >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {data.variacoes.novos > 0 ? '+' : ''}{data.variacoes.novos.toFixed(1)}%
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Anterior: {data.anterior.novosClientes.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </MetricTooltip>

                  {/* Clientes Retornantes */}
                  <MetricTooltip content="Clientes que já tinham visitado o bar anteriormente e RETORNARAM no período selecionado. Indica a fidelização e satisfação dos clientes.">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-purple-300 dark:hover:border-purple-600 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Clientes Retornantes
                        </span>
                        <RefreshCw className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl font-bold text-gray-900 dark:text-white">
                          {data.atual.clientesRetornantes.toLocaleString('pt-BR')}
                        </span>
                        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-sm font-semibold">
                          {data.atual.percentualRetornantes.toFixed(1)}% do total
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {data.variacoes.retornantes >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                        <span className={`text-sm font-medium ${data.variacoes.retornantes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {data.variacoes.retornantes > 0 ? '+' : ''}{data.variacoes.retornantes.toFixed(1)}%
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Anterior: {data.anterior.clientesRetornantes.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </MetricTooltip>

                  {/* Clientes Ativos */}
                  <MetricTooltip content={periodo === 'dia' 
                    ? "Dos clientes que vieram NESTE DIA, quantos são 'ativos' (têm 2+ visitas nos últimos 90 dias)." 
                    : "Base total de clientes ativos: quantos clientes têm 2+ visitas nos últimos 90 dias que terminam neste período. Acompanhe a evolução semana a semana."}>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-yellow-300 dark:hover:border-yellow-600 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Clientes Ativos
                        </span>
                        <Star className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        {data.atual.clientesAtivos.toLocaleString('pt-BR')}
                      </div>
                      <div className="flex items-center gap-2">
                        {data.variacoes.ativos >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                        <span className={`text-sm font-medium ${data.variacoes.ativos >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {data.variacoes.ativos > 0 ? '+' : ''}{data.variacoes.ativos}%
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Anterior: {data.anterior.clientesAtivos.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </MetricTooltip>
                </div>

                {/* Insights Estratégicos */}
                {data.insights.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      ✨ Insights Estratégicos
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Análises automáticas para tomada de decisão
                    </p>
                    <div className="space-y-4">
                      {data.insights.map((insight, index) => (
                        <div
                          key={index}
                          className={`flex gap-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-700 ${getInsightBorderColor(insight.tipo)}`}
                        >
                          {getInsightIcon(insight.tipo)}
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                              {insight.titulo}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {insight.descricao}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gráficos de Evolução Mensal */}
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Evolução Mensal de Clientes
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={mesesEvolucao === 6 ? 'default' : 'outline'}
                        onClick={() => setMesesEvolucao(6)}
                        className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600"
                      >
                        6 meses
                      </Button>
                      <Button
                        size="sm"
                        variant={mesesEvolucao === 12 ? 'default' : 'outline'}
                        onClick={() => setMesesEvolucao(12)}
                        className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600"
                      >
                        12 meses
                      </Button>
                    </div>
                  </div>

                  {loadingEvolucao ? (
                    <LoadingState 
                      title="Carregando evolução..."
                      subtitle="Processando dados mensais"
                      icon={<BarChart3 className="w-4 h-4" />}
                    />
                  ) : evolucaoData.length > 0 ? (
                    <div className="space-y-6">
                      {/* Gráfico de Novos Clientes x Retornantes */}
                      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <CardHeader>
                          <CardTitle className="text-base text-gray-900 dark:text-white">
                            Novos Clientes vs Retornantes (Total)
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <RechartsBarChart data={evolucaoData}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                              <XAxis 
                                dataKey="mesLabel" 
                                className="text-gray-600 dark:text-gray-400"
                                tick={{ fill: 'currentColor' }}
                              />
                              <YAxis 
                                className="text-gray-600 dark:text-gray-400"
                                tick={{ fill: 'currentColor' }}
                              />
                              <Tooltip 
                                contentStyle={{
                                  backgroundColor: 'var(--background)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '8px'
                                }}
                              />
                              <Legend />
                              <Bar dataKey="novosClientes" name="Novos Clientes" fill="#10b981" />
                              <Bar dataKey="clientesRetornantes" name="Retornantes" fill="#3b82f6" />
                            </RechartsBarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Gráfico de Percentuais */}
                      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <CardHeader>
                          <CardTitle className="text-base text-gray-900 dark:text-white">
                            % Novos Clientes vs % Retornantes
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={evolucaoData}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                              <XAxis 
                                dataKey="mesLabel" 
                                className="text-gray-600 dark:text-gray-400"
                                tick={{ fill: 'currentColor' }}
                              />
                              <YAxis 
                                className="text-gray-600 dark:text-gray-400"
                                tick={{ fill: 'currentColor' }}
                                tickFormatter={(value) => `${value.toFixed(1)}%`}
                              />
                              <Tooltip 
                                contentStyle={{
                                  backgroundColor: 'var(--background)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '8px'
                                }}
                                formatter={(value: any) => `${parseFloat(value).toFixed(2)}%`}
                              />
                              <Legend />
                              <Line 
                                type="monotone" 
                                dataKey="percentualNovos" 
                                name="% Novos" 
                                stroke="#10b981" 
                                strokeWidth={2}
                                dot={{ fill: '#10b981' }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="percentualRetornantes" 
                                name="% Retornantes" 
                                stroke="#3b82f6" 
                                strokeWidth={2}
                                dot={{ fill: '#3b82f6' }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Gráfico de Base Ativa */}
                      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <CardHeader>
                          <CardTitle className="text-base text-gray-900 dark:text-white">
                            Evolução da Base Ativa (90 dias)
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={evolucaoData}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                              <XAxis 
                                dataKey="mesLabel" 
                                className="text-gray-600 dark:text-gray-400"
                                tick={{ fill: 'currentColor' }}
                              />
                              <YAxis 
                                className="text-gray-600 dark:text-gray-400"
                                tick={{ fill: 'currentColor' }}
                              />
                              <Tooltip 
                                contentStyle={{
                                  backgroundColor: 'var(--background)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '8px'
                                }}
                              />
                              <Legend />
                              <Line 
                                type="monotone" 
                                dataKey="baseAtiva" 
                                name="Base Ativa" 
                                stroke="#f59e0b" 
                                strokeWidth={3}
                                dot={{ fill: '#f59e0b', r: 4 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Gráfico de Total de Clientes */}
                      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <CardHeader>
                          <CardTitle className="text-base text-gray-900 dark:text-white">
                            Total de Clientes por Mês
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={evolucaoData}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                              <XAxis 
                                dataKey="mesLabel" 
                                className="text-gray-600 dark:text-gray-400"
                                tick={{ fill: 'currentColor' }}
                              />
                              <YAxis 
                                className="text-gray-600 dark:text-gray-400"
                                tick={{ fill: 'currentColor' }}
                              />
                              <Tooltip 
                                contentStyle={{
                                  backgroundColor: 'var(--background)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '8px'
                                }}
                              />
                              <Legend />
                              <Line 
                                type="monotone" 
                                dataKey="totalClientes" 
                                name="Total de Clientes" 
                                stroke="#8b5cf6" 
                                strokeWidth={3}
                                dot={{ fill: '#8b5cf6', r: 4 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                      Nenhum dado de evolução disponível
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                Selecione um período para visualizar os dados
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
