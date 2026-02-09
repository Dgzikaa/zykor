'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  ChevronRight,
  ChevronDown,
  Pencil,
  BarChart3,
} from 'lucide-react';
import { MesOrcamento, CategoriaOrcamento, TotaisMes } from '../services/orcamentacao-service';

interface OrcamentacaoClientProps {
  initialData: MesOrcamento[];
  barId: number;
}

// Formatadores
const formatarMoeda = (valor: number | null | undefined): string => {
  if (valor === null || valor === undefined) return 'R$ 0';
  const absVal = Math.abs(valor);
  if (absVal >= 1000000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 1,
      notation: 'compact', compactDisplay: 'short'
    }).format(valor);
  }
  if (absVal >= 1000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0,
      notation: 'compact', compactDisplay: 'short'
    }).format(valor);
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(valor);
};

const formatarPorcentagem = (valor: number | null | undefined): string => {
  if (valor === null || valor === undefined) return '0.0%';
  return `${valor.toFixed(1)}%`;
};

export default function OrcamentacaoClient({ initialData, barId }: OrcamentacaoClientProps) {
  const { selectedBar } = useBar();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [meses, setMeses] = useState<MesOrcamento[]>(initialData);
  const [mesAtualIdx, setMesAtualIdx] = useState<number>(() => {
    const mesAtual = new Date().getMonth() + 1;
    const anoAtual = new Date().getFullYear();
    return initialData.findIndex(m => m.mes === mesAtual && m.ano === anoAtual);
  });
  
  const [secoesAbertas, setSecoesAbertas] = useState<Record<string, boolean>>(() => {
    const secoes: Record<string, boolean> = {};
    if (initialData.length > 0) {
      initialData[0].categorias.forEach(cat => { secoes[cat.nome] = true; });
    }
    return secoes;
  });

  const [editando, setEditando] = useState<{ mes: number; ano: number; subcategoria: string } | null>(null);
  const [valorEdit, setValorEdit] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mesAtualRef = useRef<HTMLDivElement>(null);

  // Carregar dados (refresh)
  const carregarDados = useCallback(async () => {
    if (!selectedBar) return;
    setLoading(true);
    try {
      const hoje = new Date();
      let mesInicio = hoje.getMonth() + 1 - 5;
      let anoInicio = hoje.getFullYear();
      if (mesInicio <= 0) { mesInicio += 12; anoInicio -= 1; }

      const response = await fetch(
        `/api/estrategico/orcamentacao/todos-meses?bar_id=${selectedBar.id}&ano=${anoInicio}&mes_inicio=${mesInicio}&quantidade=7`
      );
      if (!response.ok) throw new Error('Erro ao carregar dados');
      const result = await response.json();
      if (result.success && result.data) {
        setMeses(result.data);
        const mesAtual = new Date().getMonth() + 1;
        const anoAtual = new Date().getFullYear();
        const idx = result.data.findIndex((m: MesOrcamento) => m.mes === mesAtual && m.ano === anoAtual);
        setMesAtualIdx(idx >= 0 ? idx : -1);
      }
    } catch (error) {
      toast({ title: 'Erro', description: 'Falha ao atualizar dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedBar, toast]);

  // Scroll para mês atual
  useEffect(() => {
    if (!loading && scrollContainerRef.current && mesAtualRef.current) {
      const g = scrollContainerRef.current;
      const e = mesAtualRef.current;
      g.scrollLeft = e.offsetLeft - (g.offsetWidth * 0.4) + (e.offsetWidth / 2);
    }
  }, [loading, mesAtualIdx]);

  const toggleSecao = (nome: string) => {
    setSecoesAbertas(prev => ({ ...prev, [nome]: !prev[nome] }));
  };

  const salvarValor = async () => {
    if (!editando || !selectedBar) return;
    const numValue = parseFloat(valorEdit.replace(',', '.').replace(/[^\d.-]/g, ''));
    if (isNaN(numValue)) { setEditando(null); return; }

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

  const totaisPeriodo = useMemo(() => {
    if (meses.length === 0) return { receita_planejado: 0, receita_realizado: 0, lucro_planejado: 0, lucro_projecao: 0, lucro_realizado: 0 };
    return meses.reduce((acc, mes) => ({
      receita_planejado: acc.receita_planejado + mes.totais.receita_planejado,
      receita_realizado: acc.receita_realizado + mes.totais.receita_realizado,
      lucro_planejado: acc.lucro_planejado + mes.totais.lucro_planejado,
      lucro_projecao: acc.lucro_projecao + mes.totais.lucro_projecao,
      lucro_realizado: acc.lucro_realizado + mes.totais.lucro_realizado,
    }), { receita_planejado: 0, receita_realizado: 0, lucro_planejado: 0, lucro_projecao: 0, lucro_realizado: 0 });
  }, [meses]);

  if (!selectedBar) return null; // Or show selector logic if needed, but BarSyncCheck should handle this

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-full mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <PageHeader title="Orçamentação" description="" />
            <div className="flex items-center gap-2">
              <div className="px-4 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {meses.length > 0 
                    ? `${meses[0]?.label?.split('/')[0]} - ${meses[meses.length - 1]?.label?.split('/')[0]} / ${meses[0]?.ano}`
                    : 'Carregando...'}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={carregarDados} disabled={loading} className="gap-2 ml-4">
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Atualizar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-2 border border-blue-200 dark:border-blue-700">
              <div className="text-blue-700 dark:text-blue-300 text-[10px] font-medium mb-0.5">Receita Plan.</div>
              <AnimatedCurrency value={totaisPeriodo.receita_planejado} className="text-sm font-bold text-blue-600 dark:text-blue-400" />
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-lg p-2 border border-emerald-200 dark:border-emerald-700">
              <div className="text-emerald-700 dark:text-emerald-300 text-[10px] font-medium mb-0.5">Receita Real.</div>
              <AnimatedCurrency value={totaisPeriodo.receita_realizado} className="text-sm font-bold text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className={cn("rounded-lg p-2 border", totaisPeriodo.lucro_planejado >= 0 ? "bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200" : "bg-gradient-to-br from-red-50 to-red-100 border-red-200")}>
              <div className={cn("text-[10px] font-medium mb-0.5", totaisPeriodo.lucro_planejado >= 0 ? "text-purple-700" : "text-red-700")}>Lucro Plan.</div>
              <AnimatedCurrency value={totaisPeriodo.lucro_planejado} className={cn("text-sm font-bold", totaisPeriodo.lucro_planejado >= 0 ? "text-purple-600" : "text-red-600")} />
            </div>
            <div className={cn("rounded-lg p-2 border", totaisPeriodo.lucro_projecao >= 0 ? "bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200" : "bg-gradient-to-br from-red-50 to-red-100 border-red-200")}>
              <div className={cn("text-[10px] font-medium mb-0.5", totaisPeriodo.lucro_projecao >= 0 ? "text-indigo-700" : "text-red-700")}>Lucro Proj.</div>
              <AnimatedCurrency value={totaisPeriodo.lucro_projecao} className={cn("text-sm font-bold", totaisPeriodo.lucro_projecao >= 0 ? "text-indigo-600" : "text-red-600")} />
            </div>
            <div className={cn("rounded-lg p-2 border", totaisPeriodo.lucro_realizado >= 0 ? "bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200" : "bg-gradient-to-br from-red-50 to-red-100 border-red-200")}>
              <div className={cn("text-[10px] font-medium mb-0.5", totaisPeriodo.lucro_realizado >= 0 ? "text-teal-700" : "text-red-700")}>Lucro Real.</div>
              <AnimatedCurrency value={totaisPeriodo.lucro_realizado} className={cn("text-sm font-bold", totaisPeriodo.lucro_realizado >= 0 ? "text-teal-600" : "text-red-600")} />
            </div>
          </div>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-auto scrollbar-visible" style={{ scrollBehavior: 'smooth' }}>
        <div className="flex" style={{ minWidth: 'max-content' }}>
          <div className="sticky left-0 z-20 flex-shrink-0 w-[200px] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-md">
            <div className="h-[48px] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center justify-center sticky top-0 z-30">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">CATEGORIA</span>
            </div>
            {meses.length > 0 && meses[0].categorias.map(categoria => (
              <div key={categoria.nome}>
                <div className={cn("flex items-center gap-2 px-2 cursor-pointer", categoria.cor)} style={{ height: '32px' }} onClick={() => toggleSecao(categoria.nome)}>
                  {secoesAbertas[categoria.nome] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <span className="text-[10px] font-semibold truncate">{categoria.nome}</span>
                </div>
                {secoesAbertas[categoria.nome] && categoria.subcategorias.map(sub => (
                  <div key={sub.nome} className="flex items-center gap-1 px-2 pl-5 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 hover:dark:bg-gray-700/50" style={{ height: '28px' }}>
                    <span className="text-[10px] text-gray-700 dark:text-gray-300 truncate">{sub.nome}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="flex items-center gap-2 px-2 border-t-2 border-gray-300 bg-emerald-100 dark:bg-emerald-900/30" style={{ height: '36px' }}>
              <DollarSign className="w-3 h-3 text-emerald-700" />
              <span className="text-[10px] font-bold text-emerald-800">LUCRO</span>
            </div>
          </div>

          <div className="flex-1">
            <div className="inline-flex" style={{ minWidth: 'max-content' }}>
              {meses.map((mes, idx) => {
                const isMesAtual = idx === mesAtualIdx;
                return (
                  <div key={`${mes.ano}-${mes.mes}`} ref={isMesAtual ? mesAtualRef : undefined} className={cn("flex-shrink-0 w-[180px] border-r border-gray-200 dark:border-gray-700", isMesAtual && "bg-emerald-50 dark:bg-emerald-900/20")}>
                    <div className={cn("h-[48px] border-b border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center px-1 sticky top-0 z-10", isMesAtual ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-gray-50 dark:bg-gray-700")}>
                      <span className={cn("text-xs font-bold", isMesAtual ? "text-emerald-700" : "text-gray-700 dark:text-gray-300")}>{mes.label}</span>
                      <div className="flex gap-1 text-[8px] text-gray-500">
                        <span className="text-blue-600">Plan.</span><span>|</span><span className="text-green-600">Proj.</span><span>|</span><span className="text-gray-600 dark:text-gray-300">Real.</span>
                      </div>
                    </div>
                    {mes.categorias.map(categoria => (
                      <div key={categoria.nome}>
                        <div className={cn(categoria.cor, "opacity-20")} style={{ height: '32px' }} />
                        {secoesAbertas[categoria.nome] && categoria.subcategorias.map(sub => {
                          const isEdit = editando?.mes === mes.mes && editando?.ano === mes.ano && editando?.subcategoria === sub.nome;
                          return (
                            <div key={sub.nome} className={cn("relative flex items-center justify-between px-1 border-b border-gray-100 dark:border-gray-700 group", isMesAtual ? "bg-emerald-50/50" : "bg-white dark:bg-gray-800")} style={{ height: '28px' }}>
                              <div className="flex-1 flex items-center justify-center">
                                {isEdit ? (
                                  <div className="flex items-center gap-0.5">
                                    <Input value={valorEdit} onChange={e => setValorEdit(e.target.value)} className="w-12 h-5 text-[9px] p-0.5 text-center" autoFocus onKeyDown={e => { if(e.key === 'Enter') salvarValor(); if(e.key === 'Escape') setEditando(null); }} />
                                    <Button size="icon" variant="ghost" className="h-4 w-4 p-0" onClick={salvarValor}><Check className="h-2.5 w-2.5 text-emerald-600" /></Button>
                                    <Button size="icon" variant="ghost" className="h-4 w-4 p-0" onClick={() => setEditando(null)}><X className="h-2.5 w-2.5 text-red-600" /></Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-0.5 cursor-pointer hover:bg-blue-50 rounded px-0.5" onClick={() => { setEditando({ mes: mes.mes, ano: mes.ano, subcategoria: sub.nome }); setValorEdit(sub.planejado.toString()); }}>
                                    <span className="text-[9px] font-medium text-blue-600">{sub.isPercentage ? formatarPorcentagem(sub.planejado) : formatarMoeda(sub.planejado)}</span>
                                    <Pencil className="h-2 w-2 text-blue-400 opacity-0 group-hover:opacity-100" />
                                  </div>
                                )}
                              </div>
                              <div className="w-px h-3 bg-gray-200" />
                              <div className="flex-1 flex items-center justify-center">
                                <span className={cn("text-[9px] font-medium", sub.projecao > 0 ? "text-green-600" : "text-gray-400")}>{sub.isPercentage ? formatarPorcentagem(sub.projecao) : formatarMoeda(sub.projecao)}</span>
                              </div>
                              <div className="w-px h-3 bg-gray-200" />
                              <div className="flex-1 flex items-center justify-center">
                                <span className={cn("text-[9px] font-medium", sub.realizado > 0 ? "text-gray-900 dark:text-white" : "text-gray-400")}>{sub.isPercentage ? formatarPorcentagem(sub.realizado) : formatarMoeda(sub.realizado)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    <div className={cn("flex items-center justify-between px-1 border-t-2 border-gray-300", isMesAtual ? "bg-emerald-100" : "bg-emerald-50 dark:bg-emerald-900/20")} style={{ height: '36px' }}>
                      <span className={cn("flex-1 text-[9px] font-bold text-center", mes.totais.lucro_planejado >= 0 ? "text-blue-700" : "text-red-600")}>{formatarMoeda(mes.totais.lucro_planejado)}</span>
                      <div className="w-px h-4 bg-emerald-300" />
                      <span className={cn("flex-1 text-[9px] font-bold text-center", mes.totais.lucro_projecao >= 0 ? "text-green-700" : "text-red-600")}>{formatarMoeda(mes.totais.lucro_projecao)}</span>
                      <div className="w-px h-4 bg-emerald-300" />
                      <span className={cn("flex-1 text-[9px] font-bold text-center", mes.totais.lucro_realizado >= 0 ? "text-emerald-800" : "text-red-600")}>{formatarMoeda(mes.totais.lucro_realizado)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
