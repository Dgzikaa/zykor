'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Users,
  UserPlus,
  Star,
  RotateCcw,
  Calendar,
  Activity
} from 'lucide-react';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/hooks/use-toast';

interface IndicadorMensal {
  mes: string;
  mesNome: string;
  faturamentoTotal: number;
  clientesRecorrentes: number;
  clientesTotais: number;
  novosClientes: number;
  clientesAtivos: number;
  percentualNovos: number;
  percentualRecorrentes: number;
  percentualAtivos: number;
  cmoTotal: number;
  percentualArtistico: number;
  ticketMedio: number;
  totalPessoas: number;
  reputacao: number;
  variacoes: {
    faturamento: number;
    clientesRecorrentes: number;
    clientesTotais: number;
    novosClientes: number;
    clientesAtivos: number;
    percentualNovos: number;
    percentualRecorrentes: number;
    percentualAtivos: number;
    cmoTotal: number;
    percentualArtistico: number;
    ticketMedio: number;
    reputacao: number;
  } | null;
}

interface DadosComparativos {
  meses: IndicadorMensal[];
  periodo: string;
  ultimaAtualizacao: string;
}

interface ComparativoMensalNovoProps {
  initialData?: DadosComparativos;
  barId?: number;
}

export function ComparativoMensalNovo({ initialData, barId }: ComparativoMensalNovoProps) {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  
  const [dados, setDados] = useState<DadosComparativos | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [mesReferencia, setMesReferencia] = useState<string>(() => {
    if (initialData?.meses?.length) {
      return initialData.meses[initialData.meses.length - 1].mes;
    }
    return '2025-10'; // Fallback
  });

  const carregarDados = async () => {
    const finalBarId = barId || selectedBar?.id;
    if (!finalBarId) return;
    
    setLoading(true);
    
    try {
      const response = await fetch(
        `/api/visao-geral/indicadores-mensais?barId=${selectedBar?.id}&mes=${mesReferencia}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setDados(result.data);
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao carregar dados comparativos',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Erro ao carregar dados comparativos:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados comparativos',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [selectedBar?.id, mesReferencia]);

  // Funções auxiliares
  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const formatarNumero = (valor: number) => {
    return new Intl.NumberFormat('pt-BR').format(valor);
  };

  const formatarPercentual = (valor: number) => {
    return `${valor.toFixed(1)}%`;
  };

  const formatarVariacao = (valor: number) => {
    const sinal = valor > 0 ? '+' : '';
    return `${sinal}${valor.toFixed(1)}%`;
  };

  const getVariacaoIcon = (valor: number) => {
    if (valor > 0) return <TrendingUp className="w-3 h-3" />;
    if (valor < 0) return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  const navegarMes = (direcao: 'anterior' | 'proximo') => {
    const [ano, mes] = mesReferencia.split('-').map(Number);
    const data = new Date(ano, mes - 1);
    
    if (direcao === 'anterior') {
      data.setMonth(data.getMonth() - 1);
    } else {
      data.setMonth(data.getMonth() + 1);
    }
    
    const novoMes = `${data.getFullYear()}-${(data.getMonth() + 1).toString().padStart(2, '0')}`;
    setMesReferencia(novoMes);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>

        {/* Cards Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="relative overflow-hidden">
              <CardHeader className="pb-4">
                <Skeleton className="h-6 w-16" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-20" />
                    {[...Array(4)].map((_, j) => (
                      <Skeleton key={j} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-20" />
                    {[...Array(4)].map((_, j) => (
                      <Skeleton key={j} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Loading indicator */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            <span>Carregando dados dos últimos 4 meses...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">Nenhum dado disponível</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Navegação */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Comparativo Mensal
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {dados.periodo} • Evolução dos indicadores
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navegarMes('anterior')}
            className="p-2"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => carregarDados()}
            className="p-2"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          
          <Badge variant="outline" className="px-3">
            {new Date(mesReferencia + '-01').toLocaleDateString('pt-BR', { 
              month: 'short', 
              year: 'numeric' 
            }).toUpperCase()}
          </Badge>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => navegarMes('proximo')}
            disabled={mesReferencia >= new Date().toISOString().slice(0, 7)}
            className="p-2"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Grid de Comparação - 4 Meses */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-1">
        {dados.meses.map((mes, index) => (
          <Card 
            key={mes.mes} 
            className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${
              index === dados.meses.length - 1 
                ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-700 shadow-lg' 
                : 'bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700'
            }`}
          >
            {/* Background gradient sutil */}
            <div className={`absolute inset-0 opacity-5 ${
              index === dados.meses.length - 1 
                ? 'bg-gradient-to-br from-blue-500 to-indigo-600' 
                : 'bg-gradient-to-br from-gray-400 to-gray-600'
            }`} />

            <CardHeader className="pb-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    index === 0 
                      ? 'bg-blue-100 dark:bg-blue-800' 
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    <Calendar className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-sm font-semibold">
                    {mes.mesNome.split(' ')[0].toUpperCase()}.
                  </CardTitle>
                </div>
                {index === dados.meses.length - 1 && (
                  <div className="flex flex-col gap-1">
                    <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                      Atual
                    </Badge>
                    <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                      Parcial
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="px-8 py-6 relative z-10">
              {/* Grid de 2 colunas */}
              <div className="grid grid-cols-2 gap-8">
                
                {/* Coluna 1: Financeiro */}
                <div className="space-y-3">
                  <h4 className="text-base font-semibold text-gray-600 dark:text-gray-400 mb-3">💰 Financeiro</h4>
                  
                  {/* Faturamento */}
                  <div className="px-6 py-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300 mb-2">
                      <DollarSign className="w-3 h-3" />
                      <span>Faturamento</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-green-900 dark:text-green-100 leading-tight break-words">
                        {formatarMoeda(mes.faturamentoTotal)}
                      </span>
                      {mes.variacoes && (
                        <span className={`text-xs font-bold self-end ${
                          mes.variacoes.faturamento > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatarVariacao(mes.variacoes.faturamento)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CMO */}
                  <div className="px-6 py-3 rounded-lg bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300 mb-2">
                      <TrendingDown className="w-3 h-3" />
                      <span>CMO</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-bold text-red-900 dark:text-red-100 leading-tight break-words">
                        {formatarMoeda(mes.cmoTotal)}
                      </span>
                      {mes.variacoes && (
                        <span className={`text-xs font-bold ${
                          mes.variacoes.cmoTotal > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatarVariacao(mes.variacoes.cmoTotal)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* % Art/Fat */}
                  <div className="px-6 py-3 rounded-lg bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-300 mb-2">
                      <Star className="w-3 h-3" />
                      <span>% Art/Fat</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-yellow-900 dark:text-yellow-100">
                        {formatarPercentual(mes.percentualArtistico)}
                      </span>
                      {mes.variacoes && (
                        <span className={`text-xs font-bold ${
                          mes.variacoes.percentualArtistico > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatarVariacao(mes.variacoes.percentualArtistico)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ticket Médio */}
                  <div className="px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border border-indigo-200 dark:border-indigo-800">
                    <div className="flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300 mb-2">
                      <DollarSign className="w-3 h-3" />
                      <span>Ticket Médio</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-bold text-indigo-900 dark:text-indigo-100 leading-tight break-words">
                        {formatarMoeda(mes.ticketMedio)}
                      </span>
                      {mes.variacoes && (
                        <span className={`text-xs font-bold ${
                          mes.variacoes.ticketMedio > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatarVariacao(mes.variacoes.ticketMedio)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Coluna 2: Clientes */}
                <div className="space-y-3">
                  <h4 className="text-base font-semibold text-gray-600 dark:text-gray-400 mb-3">👥 Clientes</h4>
                  
                  {/* Clientes Totais */}
                  <div className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 mb-2">
                      <Users className="w-3 h-3" />
                      <span>Totais</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-blue-900 dark:text-blue-100">
                        {formatarNumero(mes.clientesTotais)}
                      </span>
                      {mes.variacoes && (
                        <span className={`text-xs font-bold ${
                          mes.variacoes.clientesTotais > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatarVariacao(mes.variacoes.clientesTotais)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Novos Clientes */}
                  <div className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300 mb-2">
                      <UserPlus className="w-3 h-3" />
                      <span>Novos</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-purple-900 dark:text-purple-100">
                          {formatarNumero(mes.novosClientes)}
                        </span>
                        <span className="text-xs text-purple-600 dark:text-purple-400">
                          {formatarPercentual(mes.percentualNovos || 0)}
                        </span>
                      </div>
                      {mes.variacoes && (
                        <span className={`text-xs font-bold ${
                          mes.variacoes.novosClientes > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatarVariacao(mes.variacoes.novosClientes)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Clientes Recorrentes */}
                  <div className="px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border border-cyan-200 dark:border-cyan-800">
                    <div className="flex items-center gap-2 text-xs text-cyan-700 dark:text-cyan-300 mb-2">
                      <RotateCcw className="w-3 h-3" />
                      <span>Recorrentes</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-cyan-900 dark:text-cyan-100">
                          {formatarNumero(mes.clientesRecorrentes)}
                        </span>
                        <span className="text-xs text-cyan-600 dark:text-cyan-400">
                          {formatarPercentual(mes.percentualRecorrentes || 0)}
                        </span>
                      </div>
                      {mes.variacoes && (
                        <span className={`text-xs font-bold ${
                          mes.variacoes.clientesRecorrentes > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatarVariacao(mes.variacoes.clientesRecorrentes)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Clientes Ativos */}
                  <div className="px-6 py-3 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 mb-2">
                      <Activity className="w-3 h-3" />
                      <span>Ativos</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                          {formatarNumero(mes.clientesAtivos || 0)}
                        </span>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">
                          {formatarPercentual(mes.percentualAtivos || 0)}
                        </span>
                      </div>
                      {mes.variacoes && (
                        <span className={`text-xs font-bold ${
                          mes.variacoes.clientesAtivos > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatarVariacao(mes.variacoes.clientesAtivos)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
