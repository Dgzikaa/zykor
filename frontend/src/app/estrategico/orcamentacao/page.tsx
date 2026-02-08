'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Card } from '@/components/ui/card';
import PageHeader from '@/components/layouts/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useBar } from '@/contexts/BarContext';
import { AnimatedCurrency } from '@/components/ui/animated-counter';
import { cn } from '@/lib/utils';
import {
  DollarSign,
  Check,
  X,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Pencil,
  BarChart3,
} from 'lucide-react';

// Tipos
interface SubcategoriaOrcamento {
  nome: string;
  planejado: number;
  projecao: number;
  realizado: number;
  isPercentage?: boolean;
}

interface CategoriaOrcamento {
  nome: string;
  cor: string;
  tipo: string;
  subcategorias: SubcategoriaOrcamento[];
}

interface TotaisMes {
  receita_planejado: number;
  receita_projecao: number;
  receita_realizado: number;
  despesas_planejado: number;
  despesas_projecao: number;
  despesas_realizado: number;
  lucro_planejado: number;
  lucro_projecao: number;
  lucro_realizado: number;
  margem_planejado: number;
  margem_projecao: number;
  margem_realizado: number;
}

interface MesOrcamento {
  mes: number;
  ano: number;
  label: string;
  isAtual: boolean;
  categorias: CategoriaOrcamento[];
  totais: TotaisMes;
}

// Formatadores
const formatarMoeda = (valor: number | null | undefined): string => {
  if (valor === null || valor === undefined) return 'R$ 0';
  if (Math.abs(valor) >= 1000000) {
    // Para valores em milhões, usar 1 casa decimal para não arredondar 1.5mi para 2mi
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
      notation: 'compact',
      compactDisplay: 'short'
    }).format(valor);
  }
  if (Math.abs(valor) >= 1000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: 'compact',
      compactDisplay: 'short'
    }).format(valor);
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
};

const formatarMoedaCompleta = (valor: number | null | undefined): string => {
  if (valor === null || valor === undefined) return 'R$ 0';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
};

const formatarPorcentagem = (valor: number | null | undefined): string => {
  if (valor === null || valor === undefined) return '0.0%';
  return `${valor.toFixed(1)}%`;
};

export default function OrcamentacaoPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [meses, setMeses] = useState<MesOrcamento[]>([]);
  const [mesAtualIdx, setMesAtualIdx] = useState<number>(-1);
  const [secoesAbertas, setSecoesAbertas] = useState<Record<string, boolean>>({});
  const [editando, setEditando] = useState<{ mes: number; ano: number; subcategoria: string } | null>(null);
  const [valorEdit, setValorEdit] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mesAtualRef = useRef<HTMLDivElement>(null);

  // Calcular intervalo de meses: 5 meses anteriores + mês atual + 1 mês posterior = 7 meses
  const calcularIntervaloMeses = () => {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1; // 1-12
    const anoAtual = hoje.getFullYear();
    
    // Mês inicial = 5 meses atrás
    let mesInicio = mesAtual - 5;
    let anoInicio = anoAtual;
    
    if (mesInicio <= 0) {
      mesInicio += 12;
      anoInicio -= 1;
    }
    
    return { mesInicio, anoInicio, quantidade: 7 };
  };

  // Carregar dados de 7 meses (5 anteriores + atual + 1 posterior)
  const carregarDados = useCallback(async () => {
    if (!selectedBar) return;

    setLoading(true);
    try {
      const { mesInicio, anoInicio, quantidade } = calcularIntervaloMeses();
      const response = await fetch(
        `/api/estrategico/orcamentacao/todos-meses?bar_id=${selectedBar.id}&ano=${anoInicio}&mes_inicio=${mesInicio}&quantidade=${quantidade}`
      );

      if (!response.ok) throw new Error('Erro ao carregar dados');

      const result = await response.json();
      
      if (result.success && result.data) {
        console.log('📊 Dados recebidos da API:', {
          totalMeses: result.data.length,
          primeiroMes: result.data[0]?.label,
          categoriasCount: result.data[0]?.categorias?.length,
          amostraSubcat: result.data[0]?.categorias?.[0]?.subcategorias?.[0]
        });
        setMeses(result.data);
        
        // Encontrar índice do mês atual
        const mesAtual = new Date().getMonth() + 1;
        const anoAtual = new Date().getFullYear();
        const idx = result.data.findIndex((m: MesOrcamento) => 
          m.mes === mesAtual && m.ano === anoAtual
        );
        setMesAtualIdx(idx >= 0 ? idx : -1);

        // Abrir todas as seções por padrão
        if (result.data.length > 0 && result.data[0].categorias) {
          const secoesIniciais: Record<string, boolean> = {};
          result.data[0].categorias.forEach((cat: CategoriaOrcamento) => {
            secoesIniciais[cat.nome] = true;
          });
          setSecoesAbertas(secoesIniciais);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar dados de orçamentação',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id]);

  // Scroll para mês atual após carregar
  useEffect(() => {
    if (!loading && scrollContainerRef.current && mesAtualRef.current) {
      const container = scrollContainerRef.current;
      const element = mesAtualRef.current;
      const containerWidth = container.offsetWidth;
      const elementLeft = element.offsetLeft;
      const elementWidth = element.offsetWidth;

      container.scrollLeft = elementLeft - (containerWidth * 0.4) + (elementWidth / 2);
    }
  }, [loading, mesAtualIdx]);

  // Toggle seção
  const toggleSecao = (nome: string) => {
    setSecoesAbertas(prev => ({ ...prev, [nome]: !prev[nome] }));
  };

  // Salvar valor planejado
  const salvarValor = async () => {
    if (!editando || !selectedBar) return;

    const numValue = parseFloat(valorEdit.replace(',', '.').replace(/[^\d.-]/g, ''));
    if (isNaN(numValue)) {
      setEditando(null);
      return;
    }

    try {
      const response = await fetch('/api/estrategico/orcamentacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: selectedBar.id,
          ano: editando.ano,
          mes: editando.mes,
          categoria_nome: editando.subcategoria,
          valor_planejado: numValue,
        }),
      });

      if (!response.ok) throw new Error('Erro ao salvar');

      toast({ title: 'Salvo!', description: 'Valor planejado atualizado' });
      setEditando(null);
      carregarDados();
    } catch (error) {
      toast({ title: 'Erro', description: 'Falha ao salvar valor', variant: 'destructive' });
    }
  };

  // Calcular totais do período visível
  const calcularTotaisPeriodo = () => {
    if (meses.length === 0) {
      return {
        receita_planejado: 0,
        receita_projecao: 0,
        receita_realizado: 0,
        despesas_planejado: 0,
        despesas_projecao: 0,
        despesas_realizado: 0,
        lucro_planejado: 0,
        lucro_projecao: 0,
        lucro_realizado: 0,
      };
    }

    return meses.reduce((acc, mes) => ({
      receita_planejado: acc.receita_planejado + mes.totais.receita_planejado,
      receita_projecao: acc.receita_projecao + mes.totais.receita_projecao,
      receita_realizado: acc.receita_realizado + mes.totais.receita_realizado,
      despesas_planejado: acc.despesas_planejado + mes.totais.despesas_planejado,
      despesas_projecao: acc.despesas_projecao + mes.totais.despesas_projecao,
      despesas_realizado: acc.despesas_realizado + mes.totais.despesas_realizado,
      lucro_planejado: acc.lucro_planejado + mes.totais.lucro_planejado,
      lucro_projecao: acc.lucro_projecao + mes.totais.lucro_projecao,
      lucro_realizado: acc.lucro_realizado + mes.totais.lucro_realizado,
    }), {
      receita_planejado: 0,
      receita_projecao: 0,
      receita_realizado: 0,
      despesas_planejado: 0,
      despesas_projecao: 0,
      despesas_realizado: 0,
      lucro_planejado: 0,
      lucro_projecao: 0,
      lucro_realizado: 0,
    });
  };

  useEffect(() => {
    if (selectedBar) {
      carregarDados();
    }
  }, [carregarDados]);

  const totaisPeriodo = calcularTotaisPeriodo();

  if (!selectedBar) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="bg-white dark:bg-gray-800 p-8 text-center max-w-md">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Selecione um Bar
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Escolha um bar no seletor acima para visualizar a orçamentação.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Header com navegação e cards de resumo */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-full mx-auto px-4 py-3">
          {/* Linha 1: Título e navegação */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <PageHeader
                title="Orçamentação"
                description=""
              />
            </div>

            {/* Período atual */}
            <div className="flex items-center gap-2">
              <div className="px-4 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {meses.length > 0 
                    ? `${meses[0]?.label?.split('/')[0]} - ${meses[meses.length - 1]?.label?.split('/')[0]} / ${meses[0]?.ano}${meses[0]?.ano !== meses[meses.length - 1]?.ano ? ' - ' + meses[meses.length - 1]?.ano : ''}`
                    : 'Carregando...'}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={carregarDados}
                disabled={loading}
                className="gap-2 ml-4"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Atualizar
              </Button>
            </div>
          </div>

          {/* Linha 2: Cards de resumo do período */}
          <div
            className="grid grid-cols-3 md:grid-cols-6 gap-2"
          >
            {/* Receita Planejada */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-2 border border-blue-200 dark:border-blue-700">
              <div className="text-blue-700 dark:text-blue-300 text-[10px] font-medium mb-0.5">Receita Plan.</div>
              <AnimatedCurrency value={totaisPeriodo.receita_planejado} className="text-sm font-bold text-blue-600 dark:text-blue-400" />
            </div>

            {/* Receita Projeção */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-2 border border-green-200 dark:border-green-700">
              <div className="text-green-700 dark:text-green-300 text-[10px] font-medium mb-0.5">Receita Proj.</div>
              <AnimatedCurrency value={totaisPeriodo.receita_projecao} className="text-sm font-bold text-green-600 dark:text-green-400" />
            </div>

            {/* Receita Realizada */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-lg p-2 border border-emerald-200 dark:border-emerald-700">
              <div className="text-emerald-700 dark:text-emerald-300 text-[10px] font-medium mb-0.5">Receita Real.</div>
              <AnimatedCurrency value={totaisPeriodo.receita_realizado} className="text-sm font-bold text-emerald-600 dark:text-emerald-400" />
            </div>

            {/* Lucro Planejado */}
            <div className={cn(
              "rounded-lg p-2 border",
              totaisPeriodo.lucro_planejado >= 0
                ? "bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700"
                : "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700"
            )}>
              <div className={cn("text-[10px] font-medium mb-0.5", totaisPeriodo.lucro_planejado >= 0 ? "text-purple-700 dark:text-purple-300" : "text-red-700 dark:text-red-300")}>Lucro Plan.</div>
              <AnimatedCurrency value={totaisPeriodo.lucro_planejado} className={cn("text-sm font-bold", totaisPeriodo.lucro_planejado >= 0 ? "text-purple-600 dark:text-purple-400" : "text-red-600 dark:text-red-400")} />
            </div>

            {/* Lucro Projeção */}
            <div className={cn(
              "rounded-lg p-2 border",
              totaisPeriodo.lucro_projecao >= 0
                ? "bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border-indigo-200 dark:border-indigo-700"
                : "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700"
            )}>
              <div className={cn("text-[10px] font-medium mb-0.5", totaisPeriodo.lucro_projecao >= 0 ? "text-indigo-700 dark:text-indigo-300" : "text-red-700 dark:text-red-300")}>Lucro Proj.</div>
              <AnimatedCurrency value={totaisPeriodo.lucro_projecao} className={cn("text-sm font-bold", totaisPeriodo.lucro_projecao >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-red-600 dark:text-red-400")} />
            </div>

            {/* Lucro Realizado */}
            <div className={cn(
              "rounded-lg p-2 border",
              totaisPeriodo.lucro_realizado >= 0
                ? "bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20 border-teal-200 dark:border-teal-700"
                : "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700"
            )}>
              <div className={cn("text-[10px] font-medium mb-0.5", totaisPeriodo.lucro_realizado >= 0 ? "text-teal-700 dark:text-teal-300" : "text-red-700 dark:text-red-300")}>Lucro Real.</div>
              <AnimatedCurrency value={totaisPeriodo.lucro_realizado} className={cn("text-sm font-bold", totaisPeriodo.lucro_realizado >= 0 ? "text-teal-600 dark:text-teal-400" : "text-red-600 dark:text-red-400")} />
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo - Layout Excel com scroll horizontal e vertical */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto scrollbar-visible"
        style={{ 
          scrollBehavior: 'smooth',
          scrollbarWidth: 'thin', // Firefox
          WebkitOverflowScrolling: 'touch', // iOS
        }}
      >
        <div className="flex" style={{ minWidth: 'max-content' }}>
          {/* Coluna fixa - Labels das categorias */}
          <div className="sticky left-0 z-20 flex-shrink-0 w-[200px] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-md">
            {/* Header vazio para alinhar */}
            <div className="h-[48px] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center justify-center sticky top-0 z-30">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 text-center">CATEGORIA</span>
            </div>

            {/* Labels das categorias */}
            {meses.length > 0 && meses[0].categorias.map(categoria => (
              <div key={categoria.nome}>
                {/* Header da seção */}
                <div
                  className={cn("flex items-center gap-2 px-2 cursor-pointer", categoria.cor)}
                  style={{ height: '32px' }}
                  onClick={() => toggleSecao(categoria.nome)}
                >
                  {secoesAbertas[categoria.nome] ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  <span className="text-[10px] font-semibold truncate">{categoria.nome}</span>
                </div>

                {/* Subcategorias */}
                {secoesAbertas[categoria.nome] && categoria.subcategorias.map(sub => (
                  <div
                    key={sub.nome}
                    className="flex items-center gap-1 px-2 pl-5 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    style={{ height: '28px' }}
                  >
                    <span className="text-[10px] text-gray-700 dark:text-gray-300 truncate">{sub.nome}</span>
                  </div>
                ))}
              </div>
            ))}

            {/* Linha de Lucro */}
            <div
              className="flex items-center gap-2 px-2 border-t-2 border-gray-300 dark:border-gray-600 bg-emerald-100 dark:bg-emerald-900/30"
              style={{ height: '36px' }}
            >
              <DollarSign className="w-3 h-3 text-emerald-700 dark:text-emerald-300" />
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-200">LUCRO</span>
            </div>
          </div>

          {/* Área dos Meses */}
          <div className="flex-1">
            {loading ? (
              <div className="flex gap-0">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-[180px]">
                    <Skeleton className="h-[48px] rounded-none" />
                    {[...Array(20)].map((_, j) => (
                      <Skeleton key={j} className="h-7 rounded-none" />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="inline-flex" style={{ minWidth: 'max-content' }}>
                {meses.map((mes) => {
                  const isAtual = mes.isAtual;

                  return (
                    <div
                      key={`${mes.ano}-${mes.mes}`}
                      ref={isAtual ? mesAtualRef : undefined}
                      className={cn(
                        "flex-shrink-0 w-[180px] border-r border-gray-200 dark:border-gray-700",
                        isAtual && "bg-emerald-50 dark:bg-emerald-900/20"
                      )}
                    >
                      {/* Header do mês */}
                      <div
                        className={cn(
                          "h-[48px] border-b border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center px-1 sticky top-0 z-10",
                          isAtual ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-gray-50 dark:bg-gray-700"
                        )}
                      >
                        <span className={cn(
                          "text-xs font-bold text-center",
                          isAtual ? "text-emerald-700 dark:text-emerald-400" : "text-gray-700 dark:text-gray-300"
                        )}>
                          {mes.label}
                        </span>
                        <div className="flex gap-1 text-[8px] text-gray-500 dark:text-gray-400">
                          <span className="text-blue-600 dark:text-blue-400">Plan.</span>
                          <span>|</span>
                          <span className="text-green-600 dark:text-green-400">Proj.</span>
                          <span>|</span>
                          <span className="text-gray-600 dark:text-gray-300">Real.</span>
                        </div>
                      </div>

                      {/* Valores por categoria */}
                      {mes.categorias.map(categoria => (
                        <div key={categoria.nome}>
                          {/* Espaço para header da seção */}
                          <div
                            className={cn(categoria.cor, "opacity-80")}
                            style={{ height: '32px' }}
                          />

                          {/* Valores das subcategorias */}
                          {secoesAbertas[categoria.nome] && categoria.subcategorias.map(sub => {
                            const isEditando = editando?.mes === mes.mes && editando?.ano === mes.ano && editando?.subcategoria === sub.nome;

                            return (
                              <div
                                key={sub.nome}
                                className={cn(
                                  "relative flex items-center justify-between px-1 border-b border-gray-100 dark:border-gray-700 group",
                                  isAtual ? "bg-emerald-50/50 dark:bg-emerald-900/10" : "bg-white dark:bg-gray-800"
                                )}
                                style={{ height: '28px' }}
                              >
                                {/* Valor Planejado (editável) */}
                                <div className="flex-1 flex items-center justify-center">
                                  {isEditando ? (
                                    <div className="flex items-center gap-0.5">
                                      <Input
                                        type="text"
                                        value={valorEdit}
                                        onChange={(e) => setValorEdit(e.target.value)}
                                        className="w-12 h-5 text-[9px] p-0.5 text-center"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') salvarValor();
                                          if (e.key === 'Escape') setEditando(null);
                                        }}
                                      />
                                      <Button size="icon" variant="ghost" className="h-4 w-4 p-0" onClick={salvarValor}>
                                        <Check className="h-2.5 w-2.5 text-emerald-600" />
                                      </Button>
                                      <Button size="icon" variant="ghost" className="h-4 w-4 p-0" onClick={() => setEditando(null)}>
                                        <X className="h-2.5 w-2.5 text-red-600" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div 
                                      className="flex items-center gap-0.5 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded px-0.5"
                                      onClick={() => {
                                        setEditando({ mes: mes.mes, ano: mes.ano, subcategoria: sub.nome });
                                        setValorEdit(sub.planejado.toString());
                                      }}
                                    >
                                      <span className="text-[9px] font-medium text-blue-600 dark:text-blue-400">
                                        {sub.isPercentage ? formatarPorcentagem(sub.planejado) : formatarMoeda(sub.planejado)}
                                      </span>
                                      <Pencil className="h-2 w-2 text-blue-400 opacity-0 group-hover:opacity-100" />
                                    </div>
                                  )}
                                </div>

                                {/* Divisor */}
                                <div className="w-px h-3 bg-gray-200 dark:bg-gray-600" />

                                {/* Valor Projeção (automático do NIBO) */}
                                <div className="flex-1 flex items-center justify-center">
                                  <span className={cn(
                                    "text-[9px] font-medium",
                                    sub.projecao > 0 ? "text-green-600 dark:text-green-400" : "text-gray-400 dark:text-gray-500"
                                  )}>
                                    {sub.isPercentage ? formatarPorcentagem(sub.projecao) : formatarMoeda(sub.projecao)}
                                  </span>
                                </div>

                                {/* Divisor */}
                                <div className="w-px h-3 bg-gray-200 dark:bg-gray-600" />

                                {/* Valor Realizado (automático do NIBO - pagos) */}
                                <div className="flex-1 flex items-center justify-center">
                                  <span className={cn(
                                    "text-[9px] font-medium",
                                    sub.realizado > 0 ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500"
                                  )}>
                                    {sub.isPercentage ? formatarPorcentagem(sub.realizado) : formatarMoeda(sub.realizado)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}

                      {/* Linha de Lucro */}
                      <div
                        className={cn(
                          "flex items-center justify-between px-1 border-t-2 border-gray-300 dark:border-gray-600",
                          isAtual ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-emerald-50 dark:bg-emerald-900/20"
                        )}
                        style={{ height: '36px' }}
                      >
                        {/* Lucro Planejado */}
                        <span className={cn(
                          "flex-1 text-[9px] font-bold text-center",
                          mes.totais.lucro_planejado >= 0 ? "text-blue-700 dark:text-blue-300" : "text-red-600 dark:text-red-400"
                        )}>
                          {formatarMoeda(mes.totais.lucro_planejado)}
                        </span>
                        
                        <div className="w-px h-4 bg-emerald-300 dark:bg-emerald-600" />
                        
                        {/* Lucro Projeção */}
                        <span className={cn(
                          "flex-1 text-[9px] font-bold text-center",
                          mes.totais.lucro_projecao >= 0 ? "text-green-700 dark:text-green-300" : "text-red-600 dark:text-red-400"
                        )}>
                          {formatarMoeda(mes.totais.lucro_projecao)}
                        </span>
                        
                        <div className="w-px h-4 bg-emerald-300 dark:bg-emerald-600" />
                        
                        {/* Lucro Realizado */}
                        <span className={cn(
                          "flex-1 text-[9px] font-bold text-center",
                          mes.totais.lucro_realizado >= 0 ? "text-emerald-800 dark:text-emerald-200" : "text-red-600 dark:text-red-400"
                        )}>
                          {formatarMoeda(mes.totais.lucro_realizado)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
