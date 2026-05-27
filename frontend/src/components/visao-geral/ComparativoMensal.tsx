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

// Singleton no escopo do modulo (Intl.NumberFormat e' caro).
const FMT_CMP_MENSAL_BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface IndicadorMensal {
  mes: string;
  mesNome: string;
  mesAbrev: string;
  faturamentoTotal: number;
  clientesAtivos: number;
  clientesTotais: number;
  novosClientes: number;
  clientesRecorrentes: number;
  taxaRetencao: number;
  reputacao: number;
  percentualNovos: number;
  percentualRecorrentes: number;
  percentualAtivos: number;
  cmoTotal: number;
  percentualArtistico: number;
  ticketMedio: number;
  variacoes?: {
    faturamento: number;
    clientesAtivos: number;
    clientesTotais: number;
    novosClientes: number;
    clientesRecorrentes: number;
    percentualNovos: number;
    percentualRecorrentes: number;
    percentualAtivos: number;
    cmoTotal: number;
    percentualArtistico: number;
    ticketMedio: number;
    taxaRetencao: number;
    reputacao: number;
  } | null;
}

interface DadosComparativos {
  meses: IndicadorMensal[];
  periodo: string;
  ultimaAtualizacao: string;
}

export function ComparativoMensal() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  
  const [dados, setDados] = useState<DadosComparativos | null>(null);
  const [loading, setLoading] = useState(true);
  const [mesReferencia, setMesReferencia] = useState<string>('2025-10');

  const carregarDados = async () => {
    if (!selectedBar?.id) return;
    
    setLoading(true);
    
    try {
      const response = await fetch(
        `/api/visao-geral/indicadores-mensais?barId=${selectedBar.id}&mes=${mesReferencia}`
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

  const navegarPeriodo = (direcao: 'anterior' | 'proximo') => {
    const [ano, mes] = mesReferencia.split('-').map(Number);
    const dataAtual = new Date(ano, mes - 1, 1);
    
    if (direcao === 'anterior') {
      dataAtual.setMonth(dataAtual.getMonth() - 1);
    } else {
      dataAtual.setMonth(dataAtual.getMonth() + 1);
    }
    
    const novoMes = `${dataAtual.getFullYear()}-${(dataAtual.getMonth() + 1).toString().padStart(2, '0')}`;
    setMesReferencia(novoMes);
  };

  const formatarMoeda = (valor: number) => FMT_CMP_MENSAL_BRL.format(valor);
  
  const formatarNumero = (num: number) => num.toLocaleString('pt-BR');
  
  const formatarPercentual = (num: number) => `${num.toFixed(1)}%`;

  const getVariacaoIcon = (variacao?: number) => {
    if (!variacao) return <Minus className="w-3 h-3 text-gray-400" />;
    
    if (variacao > 0) {
      return <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />;
    } else if (variacao < 0) {
      return <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400" />;
    } else {
      return <Minus className="w-3 h-3 text-gray-400" />;
    }
  };

  const getVariacaoColor = (variacao?: number) => {
    if (!variacao) return 'text-gray-400';
    
    if (variacao > 0) {
      return 'text-green-600 dark:text-green-400';
    } else if (variacao < 0) {
      return 'text-red-600 dark:text-red-400';
    } else {
      return 'text-gray-400';
    }
  };

  const formatarVariacao = (variacao?: number) => {
    if (!variacao) return '—';
    return `${variacao > 0 ? '+' : ''}${variacao.toFixed(1)}%`;
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

        {/* Cards Skeleton com gradientes e animações */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card 
              key={i} 
              className={`relative overflow-hidden ${
                i === 3 
                  ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-700 shadow-lg' 
                  : 'bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700'
              }`}
            >
              {/* Gradiente de fundo sutil */}
              <div className={`absolute inset-0 opacity-5 ${
                i === 3 
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600' 
                  : 'bg-gradient-to-br from-gray-400 to-gray-600'
              }`} />
              
              <CardHeader className="pb-4 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className={`h-8 w-8 rounded-lg ${
                      i === 3 ? 'bg-blue-200 dark:bg-blue-800' : 'bg-gray-200 dark:bg-gray-700'
                    }`} />
                    <Skeleton className="h-6 w-16" />
                  </div>
                  {i === 3 && (
                    <Skeleton className="h-6 w-12 rounded-full bg-blue-200 dark:bg-blue-800" />
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-5 relative z-10">
                {/* Indicadores Skeleton */}
                {[...Array(6)].map((_, j) => (
                  <div key={j} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-6 w-24" />
                      <div className="flex items-center gap-1">
                        <Skeleton className="h-3 w-3 rounded" />
                        <Skeleton className="h-4 w-12" />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
              
              {/* Shimmer effect */}
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
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
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">
          Erro ao carregar dados comparativos
        </p>
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
          <p className="text-gray-600 dark:text-gray-400">
            {dados.periodo} • Evolução dos indicadores
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navegarPeriodo('anterior')}
            className="p-2"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            className="p-2"
            title="Atualizar dados"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => navegarPeriodo('proximo')}
            className="p-2"
            disabled={mesReferencia >= new Date().toISOString().slice(0, 7)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Grid de Comparação - 4 Meses */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {dados.meses.map((mes, index) => (
          <Card 
            key={mes.mes} 
            className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${
              index === dados.meses.length - 1 
                ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-700 shadow-lg' 
                : 'bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {/* Gradiente de fundo sutil */}
            <div className={`absolute inset-0 opacity-5 ${
              index === dados.meses.length - 1 
                ? 'bg-gradient-to-br from-blue-500 to-indigo-600' 
                : 'bg-gradient-to-br from-gray-400 to-gray-600'
            }`} />
            
            <CardHeader className="pb-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    index === dados.meses.length - 1
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md'
                      : 'bg-gradient-to-br from-gray-500 to-gray-600'
                  }`}>
                    <Calendar className="w-4 h-4 text-white" />
                  </div>
                  <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">
                    {mes.mesNome}
                  </CardTitle>
                </div>
                {index === dados.meses.length - 1 && (
                  <Badge className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-md text-xs font-medium">
                    ✨ Atual
                  </Badge>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-5 relative z-10">
              {/* 1. Faturamento */}
              <div 
                className="group p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 hover:shadow-md transition-all duration-200 cursor-help"
                title="Soma total dos pagamentos (vr_pagamentos) realizados no mês"
              >
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300 mb-2">
                  <div className="p-1 bg-green-100 dark:bg-green-800 rounded">
                    <DollarSign className="w-3 h-3" />
                  </div>
                  <span className="font-medium">Faturamento</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-green-900 dark:text-green-100">
                    {formatarMoeda(mes.faturamentoTotal)}
                  </span>
                  {mes.variacoes && (
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                      mes.variacoes.faturamento > 0 
                        ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300' 
                        : mes.variacoes.faturamento < 0
                        ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      {getVariacaoIcon(mes.variacoes.faturamento)}
                      <span>{formatarVariacao(mes.variacoes.faturamento)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Clientes Totais */}
              <div 
                className="group p-3 rounded-lg bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border border-indigo-200 dark:border-indigo-800 hover:shadow-md transition-all duration-200 cursor-help"
                title="Quantidade de clientes únicos (por telefone) que visitaram o bar no mês"
              >
                <div className="flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-300 mb-2">
                  <div className="p-1 bg-indigo-100 dark:bg-indigo-800 rounded">
                    <Users className="w-3 h-3" />
                  </div>
                  <span className="font-medium">Clientes Totais</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
                    {formatarNumero(mes.clientesTotais)}
                  </span>
                  {mes.variacoes && (
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                      mes.variacoes.clientesTotais > 0 
                        ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300' 
                        : mes.variacoes.clientesTotais < 0
                        ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      {getVariacaoIcon(mes.variacoes.clientesTotais)}
                      <span>{formatarVariacao(mes.variacoes.clientesTotais)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Novos Clientes */}
              <div 
                className="group p-3 rounded-lg bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border border-purple-200 dark:border-purple-800 hover:shadow-md transition-all duration-200 cursor-help"
                title="Clientes que visitaram o bar pela primeira vez neste mês (primeira visita histórica)"
              >
                <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300 mb-2">
                  <div className="p-1 bg-purple-100 dark:bg-purple-800 rounded">
                    <UserPlus className="w-3 h-3" />
                  </div>
                  <span className="font-medium">Novos Clientes</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-purple-900 dark:text-purple-100">
                    {formatarNumero(mes.novosClientes)}
                  </span>
                  {mes.variacoes && (
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                      mes.variacoes.novosClientes > 0 
                        ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300' 
                        : mes.variacoes.novosClientes < 0
                        ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      {getVariacaoIcon(mes.variacoes.novosClientes)}
                      <span>{formatarVariacao(mes.variacoes.novosClientes)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. % Novos Clientes */}
              <div 
                className="group p-3 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-200 dark:border-violet-800 hover:shadow-md transition-all duration-200 cursor-help"
                title="Percentual de novos clientes em relação ao total de clientes do mês (Novos ÷ Totais × 100)"
              >
                <div className="flex items-center gap-2 text-sm text-violet-700 dark:text-violet-300 mb-2">
                  <div className="p-1 bg-violet-100 dark:bg-violet-800 rounded">
                    <UserPlus className="w-3 h-3" />
                  </div>
                  <span className="font-medium">% Novos Clientes</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-violet-900 dark:text-violet-100">
                    {formatarPercentual(mes.percentualNovos || 0)}
                  </span>
                  {mes.variacoes && (
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                      mes.variacoes.percentualNovos > 0 
                        ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300' 
                        : mes.variacoes.percentualNovos < 0
                        ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      {getVariacaoIcon(mes.variacoes.percentualNovos)}
                      <span>{formatarVariacao(mes.variacoes.percentualNovos)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Clientes Recorrentes */}
              <div 
                className="group p-3 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800 hover:shadow-md transition-all duration-200 cursor-help"
                title="Clientes que já visitaram antes e retornaram no mês (Totais - Novos)"
              >
                <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 mb-2">
                  <div className="p-1 bg-blue-100 dark:bg-blue-800 rounded">
                    <Users className="w-3 h-3" />
                  </div>
                  <span className="font-medium">Clientes Recorrentes</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
                    {formatarNumero(mes.clientesRecorrentes)}
                  </span>
                  {mes.variacoes && (
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                      mes.variacoes.clientesRecorrentes > 0 
                        ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300' 
                        : mes.variacoes.clientesRecorrentes < 0
                        ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      {getVariacaoIcon(mes.variacoes.clientesRecorrentes)}
                      <span>{formatarVariacao(mes.variacoes.clientesRecorrentes)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 6. % Clientes Recorrentes */}
              <div 
                className="group p-3 rounded-lg bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border border-cyan-200 dark:border-cyan-800 hover:shadow-md transition-all duration-200 cursor-help"
                title="Percentual de clientes recorrentes em relação ao total de clientes do mês (Recorrentes ÷ Totais × 100)"
              >
                <div className="flex items-center gap-2 text-sm text-cyan-700 dark:text-cyan-300 mb-2">
                  <div className="p-1 bg-cyan-100 dark:bg-cyan-800 rounded">
                    <RotateCcw className="w-3 h-3" />
                  </div>
                  <span className="font-medium">% Clientes Recorrentes</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-cyan-900 dark:text-cyan-100">
                    {formatarPercentual(mes.percentualRecorrentes || 0)}
                  </span>
                  {mes.variacoes && (
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                      mes.variacoes.percentualRecorrentes > 0 
                        ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300' 
                        : mes.variacoes.percentualRecorrentes < 0
                        ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      {getVariacaoIcon(mes.variacoes.percentualRecorrentes)}
                      <span>{formatarVariacao(mes.variacoes.percentualRecorrentes)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 7. Clientes Ativos */}
              <div 
                className="group p-3 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 hover:shadow-md transition-all duration-200 cursor-help"
                title="Clientes que visitaram no mês E também visitaram nos últimos 90 dias (engajamento recente)"
              >
                <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 mb-2">
                  <div className="p-1 bg-emerald-100 dark:bg-emerald-800 rounded">
                    <Activity className="w-3 h-3" />
                  </div>
                  <span className="font-medium">Clientes Ativos</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                    {formatarNumero(mes.clientesAtivos || 0)}
                  </span>
                  {mes.variacoes && (
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                      mes.variacoes.clientesAtivos > 0 
                        ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300' 
                        : mes.variacoes.clientesAtivos < 0
                        ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      {getVariacaoIcon(mes.variacoes.clientesAtivos)}
                      <span>{formatarVariacao(mes.variacoes.clientesAtivos)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 8. % Clientes Ativos */}
              <div 
                className="group p-3 rounded-lg bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 border border-teal-200 dark:border-teal-800 hover:shadow-md transition-all duration-200 cursor-help"
                title="Percentual de clientes ativos em relação ao total de clientes do mês (Ativos ÷ Totais × 100)"
              >
                <div className="flex items-center gap-2 text-sm text-teal-700 dark:text-teal-300 mb-2">
                  <div className="p-1 bg-teal-100 dark:bg-teal-800 rounded">
                    <TrendingUp className="w-3 h-3" />
                  </div>
                  <span className="font-medium">% Clientes Ativos</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-teal-900 dark:text-teal-100">
                    {formatarPercentual(mes.percentualAtivos || 0)}
                  </span>
                  {mes.variacoes && (
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                      mes.variacoes.percentualAtivos > 0 
                        ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300' 
                        : mes.variacoes.percentualAtivos < 0
                        ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      {getVariacaoIcon(mes.variacoes.percentualAtivos)}
                      <span>{formatarVariacao(mes.variacoes.percentualAtivos)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Reputação */}
              {mes.reputacao > 0 && (
                <div className="group p-3 rounded-lg bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-800 hover:shadow-md transition-all duration-200">
                  <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300 mb-2">
                    <div className="p-1 bg-yellow-100 dark:bg-yellow-800 rounded">
                      <Star className="w-3 h-3" />
                    </div>
                    <span className="font-medium">Reputação</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="text-lg font-bold text-yellow-900 dark:text-yellow-100">
                        {mes.reputacao.toFixed(1)}
                      </span>
                      <span className="text-yellow-600 dark:text-yellow-400">⭐</span>
                    </div>
                    {mes.variacoes && (
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                        mes.variacoes.reputacao > 0 
                          ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300' 
                          : mes.variacoes.reputacao < 0
                          ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}>
                        {getVariacaoIcon(mes.variacoes.reputacao)}
                        <span>{formatarVariacao(mes.variacoes.reputacao)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rodapé com Info */}
      <div className="text-center text-xs text-gray-500 dark:text-gray-400">
        Última atualização: {new Date(dados.ultimaAtualizacao).toLocaleString('pt-BR')}
      </div>
    </div>
  );
}
