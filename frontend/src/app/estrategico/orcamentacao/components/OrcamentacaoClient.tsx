'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
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
  Receipt,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CategoriasTab } from './CategoriasTab';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MesOrcamento, CategoriaOrcamento, TotaisMes } from '../services/orcamentacao-service';
import { OrigemTooltip } from './OrigemTooltip';
import { HistoricoOrcamentoTab } from './HistoricoOrcamentoTab';

interface OrcamentacaoClientProps {
  initialData: MesOrcamento[];
  barId: number;
}

// Subcategorias com Realizado MANUAL (bolinha azul, editavel na tela).
// Demais sao automaticas (vem do gold).
//   CONTRATOS: cashback Ambev calculado pelo socio fora do CA.
//   Receitas Financeiras: socio preenche manual.
//   Outras Receitas: socio faz ajustes nao registrados no CA.
// Subcategorias com Realizado MANUAL (digitado na tela) — não vêm do Conta Azul.
// Linhas de marketing/produção que não são lançadas no CA + Não Operacionais.
// Linhas com Realizado MANUAL editável inline na orçamentação (não vão pra DRE).
// São as que não existem no Conta Azul. Contratos NÃO entra aqui (vem da DRE Manual).
const SUBCATEGORIAS_MANUAIS = new Set<string>([
  // Produção Mensal Fixo saiu daqui: o realizado vem da DRE (gold, bloco
  // 'Despesas Comerciais') — bolinha verde, read-only. Bar 4 sem lançamento = 0.
  'MKT Disparos', 'MKT Programa de Pontos', 'MKT Beneficios',
]);

// Formatadores
const formatarMoeda = (valor: number | null | undefined): string => {
  if (valor === null || valor === undefined) return 'R$ 0';
  const absVal = Math.abs(valor);
  if (absVal >= 1000000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2,
      notation: 'compact', compactDisplay: 'short'
    }).format(valor);
  }
  if (absVal >= 1000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL', minimumFractionDigits: 1, maximumFractionDigits: 1,
      notation: 'compact', compactDisplay: 'short'
    }).format(valor);
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(valor);
};

// Aplica sinal DRE: despesas viram negativas pra exibicao (dados sao Math.abs).
const sinalDre = (valor: number, tipo: string): number => tipo === 'despesa' ? -valor : valor;

const formatarPorcentagem = (valor: number | null | undefined): string => {
  if (valor === null || valor === undefined) return '0.0%';
  return `${valor.toFixed(1)}%`;
};

// Cor do Realizado vs Planejado. melhorMenor=true p/ despesa/breakeven (gastar menos = bom);
// false p/ receita/margem (mais = bom). Sem base => neutro (preto).
const corReal = (real: number, plan: number, melhorMenor: boolean): string => {
  if (!(plan > 0 || real > 0)) return 'text-gray-900 dark:text-white';
  const bom = melhorMenor ? real <= plan : real >= plan;
  return bom ? 'text-emerald-600' : 'text-red-600';
};

// Cor por sinal: lucro positivo = verde, negativo = vermelho, zero = neutro.
const corSinal = (valor: number | null | undefined): string => {
  if (!valor) return 'text-gray-900 dark:text-white';
  return valor < 0 ? 'text-red-600' : 'text-emerald-600';
};

export default function OrcamentacaoClient({ initialData, barId }: OrcamentacaoClientProps) {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [meses, setMeses] = useState<MesOrcamento[]>(initialData);
  const [mesAtualIdx, setMesAtualIdx] = useState<number>(() => {
    const mesAtual = new Date().getMonth() + 1;
    const anoAtual = new Date().getFullYear();
    return initialData.findIndex(m => m.mes === mesAtual && m.ano === anoAtual);
  });
  
  // Categorias colapsadas por default. Header mostra a soma das subs.
  const [secoesAbertas, setSecoesAbertas] = useState<Record<string, boolean>>(() => {
    const secoes: Record<string, boolean> = {};
    if (initialData.length > 0) {
      initialData[0].categorias.forEach(cat => { secoes[cat.nome] = false; });
    }
    return secoes;
  });

  const [editando, setEditando] = useState<{ mes: number; ano: number; subcategoria: string; campo: 'planejado' | 'projetado' | 'realizado' } | null>(null);
  const [valorEdit, setValorEdit] = useState('');

  // Drill-down do realizado: popup com os lançamentos do Conta Azul que compõem o valor.
  type LancamentoDrill = {
    data_competencia: string; data_pagamento: string | null; descricao: string | null;
    pessoa_nome: string | null; valor_bruto: number | string; status: string | null;
    tipo_ca: string | null; categoria_ca: string | null; categoria_zykor: string | null;
  };
  const [drill, setDrill] = useState<{
    open: boolean; loading: boolean; titulo: string; periodo: string;
    lancamentos: LancamentoDrill[]; total: number; erro: string | null;
  }>({ open: false, loading: false, titulo: '', periodo: '', lancamentos: [], total: 0, erro: null });

  const abrirLancamentos = useCallback(async (
    mesItem: { mes: number; ano: number; label: string },
    titulo: string,
    params: { categorias?: string[]; bloco?: string }
  ) => {
    if (!selectedBar) return;
    setDrill({ open: true, loading: true, titulo, periodo: mesItem.label, lancamentos: [], total: 0, erro: null });
    try {
      const qs = new URLSearchParams({
        bar_id: String(selectedBar.id), ano: String(mesItem.ano), mes: String(mesItem.mes),
      });
      if (params.categorias?.length) qs.set('categorias', params.categorias.join(','));
      if (params.bloco) qs.set('bloco', params.bloco);
      const res = await fetch(`/api/estrategico/orcamentacao/lancamentos?${qs.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Falha ao carregar lançamentos');
      setDrill(d => ({
        ...d, loading: false,
        lancamentos: json.lancamentos || [],
        total: (json.total_despesa || 0) + (json.total_receita || 0),
      }));
    } catch (e: any) {
      setDrill(d => ({ ...d, loading: false, erro: e?.message || 'Erro ao carregar lançamentos' }));
    }
  }, [selectedBar]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mesAtualRef = useRef<HTMLDivElement>(null);
  const scrollInicialRef = useRef(false);

  // Carregar dados (refresh)
  const carregarDados = useCallback(async () => {
    if (!selectedBar) return;
    setLoading(true);
    try {
      // Visao anual completa do ano corrente (Jan-Dez, 12 meses).
      const hoje = new Date();
      const anoInicio = hoje.getFullYear();
      const mesInicio = 1;
      const quantidade = 12;

      const response = await fetch(
        `/api/estrategico/orcamentacao/todos-meses?bar_id=${selectedBar.id}&ano=${anoInicio}&mes_inicio=${mesInicio}&quantidade=${quantidade}`,
        { cache: 'no-store' }
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

  // Re-busca os dados ao TROCAR DE BAR. O initialData é só do bar inicial do SSR;
  // a troca de bar é client-side (contexto) e não re-renderiza o servidor — sem isto
  // a tela ficava mostrando o bar anterior. Guard evita re-fetch à toa no mount.
  const barCarregadoRef = useRef<number | undefined>(barId);
  useEffect(() => {
    if (!selectedBar) return;
    if (barCarregadoRef.current === selectedBar.id) return;
    barCarregadoRef.current = selectedBar.id;
    carregarDados();
  }, [selectedBar, carregarDados]);

  // Botão "Atualizar": sincroniza o Conta Azul (delta) E recalcula o gold da
  // orçamentação (realizado), depois relê. Diferente da DRE (bronze ao vivo), a
  // orçamentação lê o gold, então precisa forçar o refresh aqui.
  const atualizarOrcamentacao = useCallback(async () => {
    if (!selectedBar) { carregarDados(); return; }
    setLoading(true);
    try {
      // Reprocessa o ANO exibido (não só os últimos 6 meses do cron).
      const anoExibido = meses[mesAtualIdx]?.ano ?? meses[0]?.ano ?? new Date().getFullYear();
      const r = await fetch('/api/estrategico/orcamentacao/atualizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: selectedBar.id, ano: anoExibido }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.success) {
        toast({ title: 'Falha ao atualizar', description: j?.error || 'Erro', variant: 'destructive' });
      } else {
        toast({ title: 'Atualizado', description: 'Conta Azul sincronizado e realizado recalculado.' });
      }
    } catch (e) {
      toast({ title: 'Erro de rede', description: e instanceof Error ? e.message : 'Erro', variant: 'destructive' });
    } finally {
      await carregarDados();
    }
  }, [selectedBar, carregarDados, toast]);

  // No 1º carregamento, centraliza o MÊS ATUAL na tela (sem mexer no scroll da
  // página). Depois respeita onde o usuário estiver (ex: após salvar).
  useEffect(() => {
    if (loading || scrollInicialRef.current) return;
    requestAnimationFrame(() => {
      const cont = scrollContainerRef.current;
      const mesEl = mesAtualRef.current;
      // Se o container/coluna do mês ainda não pintaram, NÃO latcha — tenta de
      // novo quando os dados/índice mudarem (evita o race que zerava o scroll).
      if (!cont || !mesEl) return;
      const c = cont.getBoundingClientRect();
      const m = mesEl.getBoundingClientRect();
      cont.scrollLeft += (m.left + m.width / 2) - (c.left + c.width / 2);
      scrollInicialRef.current = true; // só marca como feito quando de fato centralizou
    });
  }, [loading, meses, mesAtualIdx]);

  useEffect(() => {
    setPageTitle('💰 Orçamentação');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const toggleSecao = useCallback((nome: string) => {
    setSecoesAbertas(prev => ({ ...prev, [nome]: !prev[nome] }));
  }, []);

  // Expandir/recolher TODAS as seções de uma vez (igual a DRE).
  const categoriasColapsaveis = meses[0]?.categorias.filter(c => !c.modoPercentual) ?? [];
  const todasAbertas = categoriasColapsaveis.length > 0 && categoriasColapsaveis.every(c => secoesAbertas[c.nome]);
  const toggleTodasSecoes = useCallback(() => {
    setSecoesAbertas(() => {
      const next: Record<string, boolean> = {};
      (meses[0]?.categorias ?? []).forEach(c => { next[c.nome] = !todasAbertas; });
      return next;
    });
  }, [meses, todasAbertas]);

  // Subcategoria destacada ao clicar no rótulo (coluna fixa da esquerda) —
  // facilita acompanhar a linha pelos 12 meses. Clicar de novo desmarca.
  const [subSelecionada, setSubSelecionada] = useState<string | null>(null);
  // Linhas-pai expandidas (ex.: CMO Fixo) -> mostra os filhos.
  const [subsAbertas, setSubsAbertas] = useState<Record<string, boolean>>({});
  const toggleSubAberta = (nome: string) => setSubsAbertas(p => ({ ...p, [nome]: !p[nome] }));

  const salvarValor = async () => {
    if (!editando || !selectedBar) return;
    const numValue = parseFloat(valorEdit.replace(',', '.').replace(/[^\d.-]/g, ''));
    if (isNaN(numValue)) { setEditando(null); return; }

    try {
      const body: Record<string, any> = {
        bar_id: selectedBar.id,
        ano: editando.ano,
        mes: editando.mes,
        categoria_nome: editando.subcategoria,
      };
      
      if (editando.campo === 'planejado') {
        body.valor_planejado = numValue;
      } else if (editando.campo === 'projetado') {
        body.valor_projetado = numValue;
      } else if (editando.campo === 'realizado') {
        body.valor_realizado_manual = numValue;
      }

      const response = await fetch('/api/estrategico/orcamentacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Erro ao salvar');
      toast({ title: 'Salvo!', description: `Valor ${editando.campo} atualizado` });
      setEditando(null);
      // Preserva a posição do scroll (o reload trocava todo o conteúdo e voltava
      // pro topo/início — ruim quando o usuário estava em dez, p.ex.).
      const el = scrollContainerRef.current;
      const x = el?.scrollLeft ?? 0;
      const y = el?.scrollTop ?? 0;
      await carregarDados();
      requestAnimationFrame(() => {
        const c = scrollContainerRef.current;
        if (c) { c.scrollLeft = x; c.scrollTop = y; }
      });
    } catch (error) {
      toast({ title: 'Erro', description: 'Falha ao salvar valor', variant: 'destructive' });
    }
  };

  // Tooltip de histórico: mostra os 3 meses anteriores ao mês de uma celula.
  // Usado em mouseover nos campos editáveis (planejado/projetado) e no realizado.
  const getHistorico = useCallback((subNome: string, campo: 'planejado' | 'projecao' | 'realizado', idxAtual: number): Array<{ label: string; valor: number; isPercentage?: boolean }> => {
    const indices = [idxAtual - 3, idxAtual - 2, idxAtual - 1].filter(i => i >= 0 && i < meses.length);
    const out: Array<{ label: string; valor: number; isPercentage?: boolean }> = [];
    for (const i of indices) {
      const mesAnt = meses[i];
      if (!mesAnt) continue;
      const subAnt = mesAnt.categorias.flatMap(c => c.subcategorias).find(s => s.nome === subNome);
      if (!subAnt) continue;
      out.push({ label: mesAnt.label, valor: subAnt[campo], isPercentage: subAnt.isPercentage });
    }
    return out;
  }, [meses]);

  const totaisPeriodo = useMemo(() => {
    const base = { receita_planejado: 0, receita_realizado: 0, lucro_planejado: 0, lucro_projecao: 0, lucro_realizado: 0 };
    if (meses.length === 0) return base;
    // Realizado (Receita e Lucro) conta SÓ até o mês corrente. Meses futuros não
    // têm realizado, mas entravam com custos/breakeven -> jogavam o Lucro Real pra
    // muito negativo (ex: -246k somando o ano todo). Plan/Proj seguem o ano inteiro.
    const limiteReal = mesAtualIdx >= 0 ? mesAtualIdx : meses.length - 1;
    return meses.reduce((acc, mes, idx) => ({
      receita_planejado: acc.receita_planejado + mes.totais.receita_planejado,
      receita_realizado: acc.receita_realizado + (idx <= limiteReal ? mes.totais.receita_realizado : 0),
      lucro_planejado: acc.lucro_planejado + mes.totais.lucro_planejado,
      lucro_projecao: acc.lucro_projecao + mes.totais.lucro_projecao,
      lucro_realizado: acc.lucro_realizado + (idx <= limiteReal ? mes.totais.lucro_realizado : 0),
    }), base);
  }, [meses, mesAtualIdx]);

  // Pré-calcula totais por categoria/mês uma única vez quando `meses` muda,
  // evitando rodar `reduce` 12 x N categorias dentro do render. Indexado por
  // `${idxMes}::${categoriaNome}` para lookup O(1).
  const totaisPorCategoriaPorMes = useMemo(() => {
    const map = new Map<string, { totPlan: number; totProj: number; totReal: number }>();
    meses.forEach((mes, idxMes) => {
      mes.categorias.forEach(cat => {
        let totPlan = 0, totProj = 0, totReal = 0;
        for (const sub of cat.subcategorias) {
          totPlan += sub.planejado;
          totProj += sub.projecao;
          totReal += sub.realizado;
        }
        map.set(`${idxMes}::${cat.nome}`, { totPlan, totProj, totReal });
      });
    });
    return map;
  }, [meses]);

  if (!selectedBar) return null; // Or show selector logic if needed, but BarSyncCheck should handle this

  // Linha de VALORES (Plan/Proj/Real) de uma subcategoria — reutilizada pro pai e
  // pros filhos (CMO Fixo -> CUSTO-EMPRESA, etc.). isChild só muda um leve fundo.
  const linhaSubValores = (sub: any, mes: any, idx: number, isMesAtual: boolean, tipo: string, isChild = false, readonly = false) => {
    const isEditPlan = editando?.mes === mes.mes && editando?.ano === mes.ano && editando?.subcategoria === sub.nome && editando?.campo === 'planejado';
    const isEditProj = editando?.mes === mes.mes && editando?.ano === mes.ano && editando?.subcategoria === sub.nome && editando?.campo === 'projetado';
    // Linha % do faturamento (ex.: Escritório Central): célula mostra/edita o %,
    // mas o R$ (=%×fat) é o que entra nos totais/Real Fixo. Editável (digita o %).
    const ehPctFat = sub.pctFatPlan !== undefined && sub.pctFatPlan !== null;
    return (
      <div key={sub.nome} onClick={() => setSubSelecionada(sub.nome)} className={cn("relative flex items-center justify-between px-1 border-b border-gray-100 dark:border-gray-700 group cursor-pointer", isMesAtual ? "bg-emerald-50/50" : "bg-white dark:bg-gray-800", isChild && "bg-gray-50/60 dark:bg-gray-800/40", subSelecionada === sub.nome && "!bg-amber-100 dark:!bg-amber-900/30")} style={{ height: '38px' }}>
        {/* PLANEJADO */}
        <div className="flex-1 flex items-center justify-center relative group/plan">
          {isEditPlan && !readonly ? (
            <div className="flex items-center gap-1">
              <Input value={valorEdit} onChange={e => setValorEdit(e.target.value)} className="w-16 h-6 text-[11px] p-1 text-center" onKeyDown={e => { if(e.key === 'Enter') salvarValor(); if(e.key === 'Escape') setEditando(null); }} />
              <Button size="icon" variant="ghost" className="h-4 w-4 p-0" onClick={salvarValor}><Check className="h-2.5 w-2.5 text-emerald-600" /></Button>
              <Button size="icon" variant="ghost" className="h-4 w-4 p-0" onClick={() => setEditando(null)}><X className="h-2.5 w-2.5 text-red-600" /></Button>
            </div>
          ) : (
            <>
              <HistoricoTooltip historico={getHistorico(sub.nome, 'planejado', idx)} cor="blue" />
              {/* Planejado é read-only: vem 100% do BP (Financeiro › BP). */}
              <div className="flex items-center gap-1 rounded px-1" title="Planejado vem do BP (Financeiro › BP)">
                <span className={cn("text-xs whitespace-nowrap text-blue-600", readonly ? "font-semibold" : "font-medium")}>{ehPctFat ? formatarPorcentagem(sub.pctFatPlan) : sub.isPercentage ? formatarPorcentagem(sub.planejado) : formatarMoeda(sinalDre(sub.planejado, tipo))}</span>
              </div>
            </>
          )}
        </div>
        <div className="w-px h-3 bg-gray-200" />
        {/* PROJETADO */}
        <div className="flex-1 flex items-center justify-center relative group/proj">
          {isEditProj && !readonly ? (
            <div className="flex items-center gap-1">
              <Input value={valorEdit} onChange={e => setValorEdit(e.target.value)} className="w-16 h-6 text-[11px] p-1 text-center" onKeyDown={e => { if(e.key === 'Enter') salvarValor(); if(e.key === 'Escape') setEditando(null); }} />
              <Button size="icon" variant="ghost" className="h-4 w-4 p-0" onClick={salvarValor}><Check className="h-2.5 w-2.5 text-emerald-600" /></Button>
              <Button size="icon" variant="ghost" className="h-4 w-4 p-0" onClick={() => setEditando(null)}><X className="h-2.5 w-2.5 text-red-600" /></Button>
            </div>
          ) : (
            <>
              <HistoricoTooltip historico={getHistorico(sub.nome, 'projecao', idx)} cor="green" />
              <div className={cn("flex items-center gap-1 rounded px-1", !readonly && "cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/30")} onClick={readonly ? undefined : () => { setEditando({ mes: mes.mes, ano: mes.ano, subcategoria: sub.nome, campo: 'projetado' }); setValorEdit((ehPctFat ? sub.pctFatProj : sub.projecao).toString()); }}>
                <span className={cn("text-xs whitespace-nowrap", readonly ? "font-semibold" : "font-medium", sub.projecao > 0 ? "text-gray-900 dark:text-white" : "text-gray-400")}>{ehPctFat ? formatarPorcentagem(sub.pctFatProj) : sub.isPercentage ? formatarPorcentagem(sub.projecao) : formatarMoeda(sinalDre(sub.projecao, tipo))}</span>
                {/* item 6: % do faturamento ao lado da Projeção (igual à DRE) */}
                {!ehPctFat && !sub.isPercentage && tipo === 'despesa' && (mes.totais?.faturamento_meta_proj || 0) > 0 && sub.projecao !== 0 && (
                  <span className="text-[9px] text-gray-400 dark:text-gray-500 whitespace-nowrap">{((Math.abs(sub.projecao) / mes.totais.faturamento_meta_proj) * 100).toFixed(1)}%</span>
                )}
                {!readonly && <Pencil className="h-2 w-2 text-green-400 opacity-0 group-hover:opacity-100" />}
              </div>
            </>
          )}
        </div>
        <div className="w-px h-3 bg-gray-200" />
        {/* REALIZADO */}
        {(() => {
          const isReceita = tipo === 'receita';
          const isManualReal = SUBCATEGORIAS_MANUAIS.has(sub.nome);
          const isEditReal = editando?.mes === mes.mes && editando?.ano === mes.ano && editando?.subcategoria === sub.nome && editando?.campo === 'realizado';
          const tem = sub.planejado > 0 || sub.realizado !== 0;
          let corClasse = 'text-gray-400';
          if (tem) {
            corClasse = isReceita
              ? (sub.realizado >= sub.planejado ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold')
              : (sub.realizado <= sub.planejado ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold');
          }
          if (isEditReal) {
            return (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-1">
                  <Input value={valorEdit} onChange={e => setValorEdit(e.target.value)} className="w-16 h-6 text-[11px] p-1 text-center" onKeyDown={e => { if(e.key === 'Enter') salvarValor(); if(e.key === 'Escape') setEditando(null); }} />
                  <Button size="icon" variant="ghost" className="h-4 w-4 p-0" onClick={salvarValor}><Check className="h-2.5 w-2.5 text-emerald-600" /></Button>
                  <Button size="icon" variant="ghost" className="h-4 w-4 p-0" onClick={() => setEditando(null)}><X className="h-2.5 w-2.5 text-red-600" /></Button>
                </div>
              </div>
            );
          }
          return (
            <div className="flex-1 flex items-center justify-center relative group/real">
              <HistoricoTooltip historico={getHistorico(sub.nome, 'realizado', idx)} cor="gray" />
              {isManualReal ? (
                <div className="flex items-center gap-1 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded px-1" onClick={() => { setEditando({ mes: mes.mes, ano: mes.ano, subcategoria: sub.nome, campo: 'realizado' }); setValorEdit(sub.realizado.toString()); }}>
                  <span className={cn("text-xs whitespace-nowrap", corClasse)}>{formatarMoeda(sinalDre(sub.realizado, tipo))}</span>
                  <Pencil className="h-2 w-2 text-blue-400 opacity-0 group-hover:opacity-100" />
                </div>
              ) : (() => {
                const podeDrill = sub.realizadoFonte === 'ca' && !!sub.goldCategorias?.length && sub.realizado !== 0;
                const conteudo = ehPctFat ? formatarPorcentagem(sub.pctFatReal) : sub.isPercentage ? formatarPorcentagem(sub.realizado) : formatarMoeda(sinalDre(sub.realizado, tipo));
                if (!podeDrill) {
                  return <span className={cn("text-xs whitespace-nowrap", corClasse)} title="Automático: Conta Azul + ajustes da DRE Manual">{conteudo}</span>;
                }
                return (
                  <button type="button" onClick={() => abrirLancamentos(mes, sub.nome, { categorias: sub.goldCategorias })} className={cn("flex items-center gap-1 text-xs whitespace-nowrap rounded px-1 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer", corClasse)} title="Ver lançamentos do Conta Azul que compõem este valor">
                    <span>{conteudo}</span>
                    <Receipt className="h-2.5 w-2.5 text-blue-400 opacity-0 group-hover:opacity-100" />
                  </button>
                );
              })()}
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
    <Tabs defaultValue="orcamento" className="h-[calc(100dvh-80px)] flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 pt-2">
        <TabsList className="bg-transparent">
          <TabsTrigger value="orcamento">Orçamentação</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          {/* Business Plan e DRE viraram páginas em Financeiro (/financeiro/bp,
              /financeiro/dre). DRE Manual escondida (histórico preservado no banco). */}
        </TabsList>
      </div>

      {/* BUGFIX 2026-05-29: data-[state=active]:flex evita display:flex vazar
          pra estado inativo (Tailwind 'flex flex-col' overridava o atributo
          hidden do Radix e a aba Orcamentacao continuava ocupando ~50% da
          altura mesmo quando o usuario clicava em DRE Manual / BP / Historico) */}
      <TabsContent value="orcamento" className="flex-1 overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col">
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-full mx-auto px-4 py-3">
          <div className="flex items-center justify-end flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="px-4 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                  {meses.length > 0
                    ? `${meses[0]?.label?.split('/')[0]} - ${meses[meses.length - 1]?.label?.split('/')[0]} / ${meses[0]?.ano}`
                    : 'Carregando...'}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={toggleTodasSecoes} className="gap-2">
                {todasAbertas ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span className="hidden sm:inline">{todasAbertas ? 'Recolher tudo' : 'Expandir tudo'}</span>
              </Button>
              <Button variant="outline" size="sm" onClick={atualizarOrcamentacao} disabled={loading} className="gap-2">
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-2 border border-blue-200 dark:border-blue-700">
              <div className="text-blue-700 dark:text-blue-300 text-xs font-medium mb-0.5">Receita Plan.</div>
              <AnimatedCurrency value={totaisPeriodo.receita_planejado} className="text-sm font-bold text-blue-600 dark:text-blue-400" />
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-lg p-2 border border-emerald-200 dark:border-emerald-700">
              <div className="text-emerald-700 dark:text-emerald-300 text-xs font-medium mb-0.5">Receita Real.</div>
              <AnimatedCurrency value={totaisPeriodo.receita_realizado} className="text-sm font-bold text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className={cn("rounded-lg p-2 border", totaisPeriodo.lucro_planejado >= 0 ? "bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200" : "bg-gradient-to-br from-red-50 to-red-100 border-red-200")}>
              <div className={cn("text-xs font-medium mb-0.5", totaisPeriodo.lucro_planejado >= 0 ? "text-purple-700" : "text-red-700")}>Lucro Plan.</div>
              <AnimatedCurrency value={totaisPeriodo.lucro_planejado} className={cn("text-sm font-bold", totaisPeriodo.lucro_planejado >= 0 ? "text-purple-600" : "text-red-600")} />
            </div>
            <div className={cn("rounded-lg p-2 border", totaisPeriodo.lucro_projecao >= 0 ? "bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200" : "bg-gradient-to-br from-red-50 to-red-100 border-red-200")}>
              <div className={cn("text-xs font-medium mb-0.5", totaisPeriodo.lucro_projecao >= 0 ? "text-indigo-700" : "text-red-700")}>Lucro Proj.</div>
              <AnimatedCurrency value={totaisPeriodo.lucro_projecao} className={cn("text-sm font-bold", totaisPeriodo.lucro_projecao >= 0 ? "text-indigo-600" : "text-red-600")} />
            </div>
            <div className={cn("rounded-lg p-2 border", totaisPeriodo.lucro_realizado >= 0 ? "bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200" : "bg-gradient-to-br from-red-50 to-red-100 border-red-200")}>
              <div className={cn("text-xs font-medium mb-0.5", totaisPeriodo.lucro_realizado >= 0 ? "text-teal-700" : "text-red-700")}>Lucro Real.</div>
              <AnimatedCurrency value={totaisPeriodo.lucro_realizado} className={cn("text-sm font-bold", totaisPeriodo.lucro_realizado >= 0 ? "text-teal-600" : "text-red-600")} />
            </div>
          </div>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-auto scrollbar-visible" style={{ scrollBehavior: 'smooth' }}>
        <div className="flex" style={{ minWidth: 'max-content' }}>
          <div className="sticky left-0 z-20 flex-shrink-0 w-[130px] sm:w-[220px] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-md">
            <div className="h-[58px] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center justify-center sticky top-0 z-30">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">CATEGORIA</span>
            </div>
            {/* Indicadores agregados (header — antes da tabela) */}
            <div className="flex items-center gap-2 px-2 bg-slate-100 dark:bg-slate-800 border-b border-gray-200" style={{ height: '38px' }}>
              <OrigemTooltip nome="Faturamento Meta" className="text-xs font-bold text-slate-700 dark:text-slate-300">Faturamento Meta</OrigemTooltip>
            </div>
            <div className="flex items-center gap-2 px-2 border-b border-gray-200 bg-slate-50 dark:bg-slate-900/40" style={{ height: '38px' }}>
              <OrigemTooltip nome="Real Fixo" className="text-xs font-bold text-slate-700 dark:text-slate-300">Real Fixo</OrigemTooltip>
            </div>
            <div className="flex items-center gap-2 px-2 border-b border-gray-200 bg-slate-50 dark:bg-slate-900/40" style={{ height: '38px' }}>
              <OrigemTooltip nome="BreakEven" className="text-xs font-bold text-slate-700 dark:text-slate-300">BreakEven</OrigemTooltip>
            </div>
            <div className="flex items-center gap-2 px-2 border-b-2 border-gray-400 bg-slate-50 dark:bg-slate-900/40" style={{ height: '38px' }}>
              <OrigemTooltip nome="% CONTRIB" className="text-xs font-bold text-slate-700 dark:text-slate-300">% CONTRIB</OrigemTooltip>
            </div>
            {meses.length > 0 && meses[0].categorias.map(categoria => (
              <div key={categoria.nome}>
                {categoria.modoPercentual ? (
                  // Blocos % (Variáveis / CMV): 1 linha só, sem expandir.
                  <div className={cn("flex items-center gap-2 px-2 border-b border-gray-200", categoria.cor)} style={{ height: '44px' }}>
                    <OrigemTooltip nome={categoria.nome} className="text-xs font-semibold truncate">{categoria.nome} (%)</OrigemTooltip>
                  </div>
                ) : (
                  <>
                    <div className={cn("flex items-center gap-2 px-2 cursor-pointer", categoria.cor)} style={{ height: '44px' }} onClick={() => toggleSecao(categoria.nome)}>
                      {secoesAbertas[categoria.nome] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <OrigemTooltip nome={categoria.nome} className="text-xs font-semibold truncate">{categoria.nome}</OrigemTooltip>
                    </div>
                    {secoesAbertas[categoria.nome] && categoria.subcategorias.map(sub => {
                      const isManual = SUBCATEGORIAS_MANUAIS.has(sub.nome);
                      const filhos = (sub as any).filhos as any[] | undefined;
                      const temFilhos = !!filhos?.length;
                      return (
                        <React.Fragment key={sub.nome}>
                          <div
                            onClick={() => temFilhos ? toggleSubAberta(sub.nome) : setSubSelecionada(prev => (prev === sub.nome ? null : sub.nome))}
                            className={cn(
                              "flex items-center gap-1.5 px-2 pl-5 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 hover:dark:bg-gray-700/50",
                              subSelecionada === sub.nome && "!bg-amber-100 dark:!bg-amber-900/30"
                            )}
                            style={{ height: '38px' }}
                          >
                            {temFilhos ? (
                              subsAbertas[sub.nome]
                                ? <ChevronDown className="w-3 h-3 flex-shrink-0 text-gray-500" />
                                : <ChevronRight className="w-3 h-3 flex-shrink-0 text-gray-500" />
                            ) : (
                              <div className={cn('w-2 h-2 rounded-full flex-shrink-0', isManual ? 'bg-blue-500' : 'bg-green-500')} />
                            )}
                            <OrigemTooltip nome={sub.nome} className={cn("text-xs truncate", temFilhos ? "font-semibold text-gray-800 dark:text-gray-200" : "text-gray-700 dark:text-gray-300")}>{sub.nome}</OrigemTooltip>
                          </div>
                          {temFilhos && subsAbertas[sub.nome] && filhos!.map((f: any) => (
                            <div
                              key={f.nome}
                              onClick={() => setSubSelecionada(prev => (prev === f.nome ? null : f.nome))}
                              className={cn(
                                "flex items-center gap-1.5 px-2 pl-9 border-b border-gray-100 dark:border-gray-700 cursor-pointer bg-gray-50/60 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-700/50",
                                subSelecionada === f.nome && "!bg-amber-100 dark:!bg-amber-900/30"
                              )}
                              style={{ height: '38px' }}
                            >
                              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-green-400" />
                              <OrigemTooltip nome={f.nome} className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{f.nome}</OrigemTooltip>
                            </div>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </>
                )}
              </div>
            ))}
            {/* Lucro Líquido + Margem (rodapé) */}
            <div className="flex items-center gap-2 px-2 border-t-2 border-emerald-300 bg-emerald-100 dark:bg-emerald-900/30" style={{ height: '50px' }}>
              <DollarSign className="w-3 h-3 text-emerald-700" />
              <OrigemTooltip nome="Lucro Líquido" className="text-xs font-bold text-emerald-800">Lucro Líquido</OrigemTooltip>
            </div>
            <div className="flex items-center gap-2 px-2 border-b border-gray-200 bg-emerald-50 dark:bg-emerald-900/20" style={{ height: '38px' }}>
              <OrigemTooltip nome="Margem" className="text-xs font-bold text-emerald-700">Margem</OrigemTooltip>
            </div>
          </div>

          <div className="flex-1">
            <div className="inline-flex" style={{ minWidth: 'max-content' }}>
              {meses.map((mes, idx) => {
                const isMesAtual = idx === mesAtualIdx;
                return (
                  <div key={`${mes.ano}-${mes.mes}`} ref={isMesAtual ? mesAtualRef : undefined} className={cn("flex-shrink-0 w-[260px] sm:w-[330px] border-r border-gray-200 dark:border-gray-700", isMesAtual && "bg-emerald-50 dark:bg-emerald-900/20")}>
                    <div className={cn("h-[58px] border-b border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center px-1 sticky top-0 z-10", isMesAtual ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-gray-50 dark:bg-gray-700")}>
                      <span className={cn("text-xs font-bold", isMesAtual ? "text-emerald-700" : "text-gray-700 dark:text-gray-300")}>{mes.label}</span>
                      <div className="flex gap-1 text-[8px] text-gray-500">
                        <span className="text-blue-600">Plan.</span><span>|</span><span className="text-gray-900 dark:text-white">Proj.</span><span>|</span><span className="text-gray-600 dark:text-gray-300">Real.</span>
                      </div>
                    </div>
                    {/* Indicadores agregados (antes da tabela) — ordem: Faturamento Meta, Real Fixo, BreakEven, % CONTRIB */}
                    <div className={cn("flex items-center justify-between px-1 border-b border-gray-200", isMesAtual ? "bg-slate-200" : "bg-slate-100 dark:bg-slate-800")} style={{ height: '38px' }}>
                      {/* Planejado = Meta M1 (Σ M1 do planejamento comercial), automático (não editável). */}
                      <span
                        className="flex-1 text-xs font-bold text-center whitespace-nowrap text-blue-600"
                        title="Planejado = Faturamento Meta do BP (Financeiro › BP); fallback no Σ M1 do planejamento"
                      >{formatarMoeda(mes.totais.faturamento_meta_plan)}</span>
                      <div className="w-px h-3 bg-slate-300" />
                      {/* Projetado = Empilhamento M1, automático (não editável). */}
                      <span
                        className="flex-1 text-xs font-bold text-center whitespace-nowrap text-gray-900 dark:text-white"
                        title="Projetado automático = Empilhamento M1 (realizado dos dias passados + M1 dos dias futuros)"
                      >{formatarMoeda(mes.totais.faturamento_meta_proj)}</span>
                      <div className="w-px h-3 bg-slate-300" />
                      <span className={cn("flex-1 text-xs font-bold text-center whitespace-nowrap", corReal(mes.totais.faturamento_meta_real, mes.totais.faturamento_meta_plan, false))}>{formatarMoeda(mes.totais.faturamento_meta_real)}</span>
                    </div>
                    <div className={cn("flex items-center justify-between px-1 border-b border-gray-200", isMesAtual ? "bg-slate-100" : "bg-slate-50 dark:bg-slate-900/40")} style={{ height: '38px' }}>
                      <span className="flex-1 text-xs font-bold text-center whitespace-nowrap text-blue-600">{formatarMoeda(mes.totais.real_fixo_plan)}</span>
                      <div className="w-px h-3 bg-slate-300" />
                      <span className="flex-1 text-xs font-bold text-center whitespace-nowrap text-gray-900 dark:text-white">{formatarMoeda(mes.totais.real_fixo_proj)}</span>
                      <div className="w-px h-3 bg-slate-300" />
                      <span className={cn("flex-1 text-xs font-bold text-center whitespace-nowrap", corReal(mes.totais.real_fixo_real, mes.totais.real_fixo_plan, true))}>{formatarMoeda(mes.totais.real_fixo_real)}</span>
                    </div>
                    <div className={cn("flex items-center justify-between px-1 border-b border-gray-200", isMesAtual ? "bg-slate-100" : "bg-slate-50 dark:bg-slate-900/40")} style={{ height: '38px' }}>
                      <span className="flex-1 text-xs font-bold text-center whitespace-nowrap text-blue-600">{formatarMoeda(mes.totais.breakeven_plan)}</span>
                      <div className="w-px h-3 bg-slate-300" />
                      <span className="flex-1 text-xs font-bold text-center whitespace-nowrap text-gray-900 dark:text-white">{formatarMoeda(mes.totais.breakeven_proj)}</span>
                      <div className="w-px h-3 bg-slate-300" />
                      <span className={cn("flex-1 text-xs font-bold text-center whitespace-nowrap", corReal(mes.totais.breakeven_real, mes.totais.breakeven_plan, true))}>{formatarMoeda(mes.totais.breakeven_real)}</span>
                    </div>
                    <div className={cn("flex items-center justify-between px-1 border-b-2 border-gray-400", isMesAtual ? "bg-slate-100" : "bg-slate-50 dark:bg-slate-900/40")} style={{ height: '38px' }}>
                      <span className="flex-1 text-xs font-bold text-center whitespace-nowrap text-blue-600">{formatarPorcentagem(mes.totais.perc_contrib_plan)}</span>
                      <div className="w-px h-3 bg-slate-300" />
                      <span className="flex-1 text-xs font-bold text-center whitespace-nowrap text-gray-900 dark:text-white">{formatarPorcentagem(mes.totais.perc_contrib_proj)}</span>
                      <div className="w-px h-3 bg-slate-300" />
                      <span className={cn("flex-1 text-xs font-bold text-center whitespace-nowrap", corReal(mes.totais.perc_contrib_real, mes.totais.perc_contrib_plan, false))}>{formatarPorcentagem(mes.totais.perc_contrib_real)}</span>
                    </div>
                    {mes.categorias.map(categoria => {
                      // Quando categoria esta collapsed, mostra a soma das subs (Plan/Proj/Real)
                      const aberta = secoesAbertas[categoria.nome];
                      const totais = totaisPorCategoriaPorMes.get(`${idx}::${categoria.nome}`) ?? { totPlan: 0, totProj: 0, totReal: 0 };
                      const { totPlan, totProj, totReal } = totais;
                      const isReceita = categoria.tipo === 'receita';
                      let corClasseReal = 'text-gray-700 dark:text-gray-300';
                      if (totPlan > 0 || totReal > 0) {
                        if (isReceita) corClasseReal = totReal >= totPlan ? 'text-emerald-600' : 'text-red-600';
                        else corClasseReal = totReal <= totPlan ? 'text-emerald-600' : 'text-red-600';
                      }

                      // ---- Bloco % (Custos Variáveis / CMV): 1 linha; Plan% e Proj% editáveis; Real% da DRE ----
                      if (categoria.modoPercentual) {
                        const pct = categoria.percentual ?? { plan: 0, proj: 0, real: 0 };
                        const isEditProjPct = editando?.mes === mes.mes && editando?.ano === mes.ano && editando?.subcategoria === categoria.nome && editando?.campo === 'projetado';
                        return (
                          <div key={categoria.nome} className={cn("flex items-center justify-between px-1 border-b border-gray-200", categoria.cor, "bg-opacity-60 dark:bg-opacity-30")} style={{ height: '44px' }}>
                            {/* PLAN % — read-only: vem 100% do BP (Financeiro › BP). */}
                            <div className="flex-1 flex items-center justify-center">
                              <div className="flex items-center gap-1 rounded px-1" title="Planejado vem do BP (Financeiro › BP)">
                                <span className="text-xs font-bold whitespace-nowrap text-blue-700 dark:text-blue-300">{formatarPorcentagem(pct.plan)}</span>
                              </div>
                            </div>
                            <div className="w-px h-3 bg-white/40" />
                            {/* PROJ % */}
                            <div className="flex-1 flex items-center justify-center">
                              {isEditProjPct ? (
                                <div className="flex items-center gap-1">
                                  <Input value={valorEdit} onChange={e => setValorEdit(e.target.value)} className="w-16 h-6 text-[11px] p-1 text-center" onKeyDown={e => { if(e.key === 'Enter') salvarValor(); if(e.key === 'Escape') setEditando(null); }} />
                                  <Button size="icon" variant="ghost" className="h-4 w-4 p-0" onClick={salvarValor}><Check className="h-2.5 w-2.5 text-emerald-600" /></Button>
                                  <Button size="icon" variant="ghost" className="h-4 w-4 p-0" onClick={() => setEditando(null)}><X className="h-2.5 w-2.5 text-red-600" /></Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/30 rounded px-1" onClick={() => { setEditando({ mes: mes.mes, ano: mes.ano, subcategoria: categoria.nome, campo: 'projetado' }); setValorEdit(String(pct.proj)); }}>
                                  <span className="text-xs font-bold whitespace-nowrap text-gray-900 dark:text-white">{formatarPorcentagem(pct.proj)}</span>
                                  <Pencil className="h-2 w-2 text-green-500" />
                                </div>
                              )}
                            </div>
                            <div className="w-px h-3 bg-white/40" />
                            {/* REAL % (vem da DRE) */}
                            {categoria.blocoGold ? (
                              <button
                                type="button"
                                onClick={() => abrirLancamentos(mes, categoria.nome, { bloco: categoria.blocoGold })}
                                className={cn("flex-1 flex items-center justify-center gap-1 text-xs font-bold text-center whitespace-nowrap rounded px-1 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer", corReal(pct.real, pct.plan, true))}
                                title="Ver lançamentos do Conta Azul deste bloco"
                              >
                                <span>{formatarPorcentagem(pct.real)}</span>
                                <Receipt className="h-2.5 w-2.5 text-blue-400" />
                              </button>
                            ) : (
                              <span className={cn("flex-1 text-xs font-bold text-center whitespace-nowrap", corReal(pct.real, pct.plan, true))} title="Realizado vem da DRE (Conta Azul ÷ faturamento realizado)">{formatarPorcentagem(pct.real)}</span>
                            )}
                          </div>
                        );
                      }

                      // ---- Blocos fixos (R$): header colapsado mostra a soma; expandido mostra subcategorias ----
                      return (
                      <div key={categoria.nome}>
                        {!aberta ? (
                          <div className={cn("flex items-center justify-between px-1 border-b border-gray-200", categoria.cor, "bg-opacity-60 dark:bg-opacity-30")} style={{ height: '44px' }}>
                            <span className="flex-1 text-xs font-bold text-center whitespace-nowrap text-blue-700 dark:text-blue-300">{formatarMoeda(sinalDre(totPlan, categoria.tipo))}</span>
                            <div className="w-px h-3 bg-white/40" />
                            <span className="flex-1 text-xs font-bold text-center whitespace-nowrap text-gray-900 dark:text-white">{formatarMoeda(sinalDre(totProj, categoria.tipo))}{/* item 6: % do faturamento tbm no grupo macro */}{categoria.tipo === 'despesa' && (mes.totais?.faturamento_meta_proj || 0) > 0 && totProj !== 0 && <span className="ml-1 text-[9px] font-medium text-gray-500 dark:text-gray-400">{((Math.abs(totProj) / mes.totais.faturamento_meta_proj) * 100).toFixed(1)}%</span>}</span>
                            <div className="w-px h-3 bg-white/40" />
                            <span className={cn("flex-1 text-xs font-bold text-center whitespace-nowrap", corClasseReal)}>{formatarMoeda(sinalDre(totReal, categoria.tipo))}</span>
                          </div>
                        ) : (
                          <div className={cn(categoria.cor, "opacity-20")} style={{ height: '44px' }} />
                        )}
                        {aberta && categoria.subcategorias.map(sub => (
                          <React.Fragment key={sub.nome}>
                            {linhaSubValores(sub, mes, idx, isMesAtual, categoria.tipo, false, !!(sub as any).filhos?.length)}
                            {(sub as any).filhos && subsAbertas[sub.nome] && (sub as any).filhos.map((f: any) => linhaSubValores(f, mes, idx, isMesAtual, categoria.tipo, true))}
                          </React.Fragment>
                        ))}
                      </div>
                      );
                    })}
                    {/* Lucro Líquido (verde se positivo, vermelho se negativo) */}
                    <div className={cn("flex items-center justify-between px-1 border-t-2 border-emerald-300", isMesAtual ? "bg-emerald-100" : "bg-emerald-50 dark:bg-emerald-900/20")} style={{ height: '50px' }}>
                      <span className={cn("flex-1 text-xs font-bold text-center whitespace-nowrap", corSinal(mes.totais.ebitda_plan))}>{formatarMoeda(mes.totais.ebitda_plan)}</span>
                      <div className="w-px h-4 bg-emerald-300" />
                      <span className={cn("flex-1 text-xs font-bold text-center whitespace-nowrap", corSinal(mes.totais.ebitda_proj))}>{formatarMoeda(mes.totais.ebitda_proj)}</span>
                      <div className="w-px h-4 bg-emerald-300" />
                      <span className={cn("flex-1 text-xs font-bold text-center whitespace-nowrap", corSinal(mes.totais.ebitda_real))}>{formatarMoeda(mes.totais.ebitda_real)}</span>
                    </div>
                    {/* Margem EBITDA */}
                    <div className={cn("flex items-center justify-between px-1 border-b border-gray-200", isMesAtual ? "bg-emerald-50" : "bg-emerald-50 dark:bg-emerald-900/20")} style={{ height: '38px' }}>
                      <span className="flex-1 text-xs font-bold text-center whitespace-nowrap text-blue-600">{formatarPorcentagem(mes.totais.margem_ebitda_plan)}</span>
                      <div className="w-px h-3 bg-emerald-200" />
                      <span className="flex-1 text-xs font-bold text-center whitespace-nowrap text-gray-900 dark:text-white">{formatarPorcentagem(mes.totais.margem_ebitda_proj)}</span>
                      <div className="w-px h-3 bg-emerald-200" />
                      <span className={cn("flex-1 text-xs font-bold text-center whitespace-nowrap", corReal(mes.totais.margem_ebitda_real, mes.totais.margem_ebitda_plan, false))}>{formatarPorcentagem(mes.totais.margem_ebitda_real)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      </TabsContent>

      <TabsContent value="categorias" className="flex-1 overflow-auto mt-0">
        <CategoriasTab barId={selectedBar.id} />
      </TabsContent>

      <TabsContent value="historico" className="flex-1 overflow-auto mt-0">
        <HistoricoOrcamentoTab barId={selectedBar.id} />
      </TabsContent>
    </Tabs>

    {/* Drill-down: lançamentos do Conta Azul que compõem o realizado */}
    <Dialog open={drill.open} onOpenChange={(o) => setDrill(d => ({ ...d, open: o }))}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-blue-500" />
            {drill.titulo}
            <span className="text-xs font-normal text-gray-500">· {drill.periodo}</span>
          </DialogTitle>
        </DialogHeader>

        {drill.loading ? (
          <div className="space-y-2 py-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : drill.erro ? (
          <div className="py-8 text-center text-sm text-red-600">{drill.erro}</div>
        ) : drill.lancamentos.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            Nenhum lançamento do Conta Azul encontrado para este período.
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                <tr className="text-left text-gray-500">
                  <th className="py-1.5 px-2 font-medium">Data</th>
                  <th className="py-1.5 px-2 font-medium">Descrição</th>
                  <th className="py-1.5 px-2 font-medium">Categoria (CA)</th>
                  <th className="py-1.5 px-2 font-medium text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {drill.lancamentos.map((l, i) => {
                  const v = parseFloat(String(l.valor_bruto)) || 0;
                  const isReceita = String(l.tipo_ca).toUpperCase() === 'RECEITA';
                  const [, mm, dd] = String(l.data_competencia).split('-');
                  return (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-1.5 px-2 whitespace-nowrap text-gray-600 dark:text-gray-400">{dd}/{mm}</td>
                      <td className="py-1.5 px-2">
                        <div className="text-gray-800 dark:text-gray-200 truncate max-w-[260px]">{l.descricao || l.pessoa_nome || '—'}</div>
                        {l.pessoa_nome && l.descricao && (
                          <div className="text-[10px] text-gray-400 truncate max-w-[260px]">{l.pessoa_nome}</div>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-gray-500 dark:text-gray-400 truncate max-w-[140px]">{l.categoria_ca || '—'}</td>
                      <td className={cn("py-1.5 px-2 text-right whitespace-nowrap font-medium", isReceita ? "text-emerald-600" : "text-gray-800 dark:text-gray-200")}>
                        {formatarMoeda(isReceita ? v : -v)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!drill.loading && !drill.erro && drill.lancamentos.length > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-2 text-xs">
            <span className="text-gray-500">{drill.lancamentos.length} lançamento(s)</span>
            <span className="font-bold text-gray-900 dark:text-white">Total: {formatarMoeda(drill.total)}</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  );
}

// Tooltip que mostra histórico dos meses anteriores ao passar mouse.
// Posicionado acima da célula, escondido por padrão, aparece on group hover.
// Usa group/plan, group/proj ou group/real conforme o pai.
function HistoricoTooltip({
  historico,
  cor,
}: {
  historico: { label: string; valor: number; isPercentage?: boolean }[];
  cor: 'blue' | 'green' | 'gray';
}) {
  if (historico.length === 0) return null;

  const fmt = (v: number, pct?: boolean) => {
    if (pct) return `${v.toFixed(1)}%`;
    if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
    return `R$ ${v.toFixed(0)}`;
  };

  const corLabel = cor === 'blue' ? 'Plan.' : cor === 'green' ? 'Proj.' : 'Real.';
  const groupClass =
    cor === 'blue'
      ? 'group-hover/plan:opacity-100 group-hover/plan:pointer-events-auto'
      : cor === 'green'
        ? 'group-hover/proj:opacity-100 group-hover/proj:pointer-events-auto'
        : 'group-hover/real:opacity-100 group-hover/real:pointer-events-auto';

  return (
    <div
      className={cn(
        'absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 pointer-events-none opacity-0 transition-opacity duration-150',
        groupClass,
        'bg-gray-900 dark:bg-gray-800 text-white rounded shadow-lg px-2 py-1.5 whitespace-nowrap'
      )}
    >
      <div className="text-[8px] uppercase opacity-60 mb-0.5">Histórico {corLabel}</div>
      {historico.map((h, i) => (
        <div key={i} className="text-xs font-mono leading-tight">
          <span className="opacity-70 mr-1">{h.label}:</span>
          <span className="font-semibold">{fmt(h.valor, h.isPercentage)}</span>
        </div>
      ))}
      {/* setinha */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-800" />
    </div>
  );
}
