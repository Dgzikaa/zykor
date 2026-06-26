'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Calculator, RefreshCw, Search, Loader2, TrendingUp, TrendingDown, CalendarDays, ListChecks, Download } from 'lucide-react';

const fmtBRL = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: any) => v == null ? '—' : `${Number(v).toFixed(1)}%`;
const fmtNum = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const corCmv = (v: any) => v == null ? 'text-gray-400' : v > 45 ? 'text-red-600 dark:text-red-400' : v > 33 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';

const isoDate = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
function calcRange(gran: 'dia' | 'semana' | 'mes', ref: string): { ini: string; fim: string } {
  const dt = new Date(ref + 'T00:00:00');
  if (gran === 'dia') return { ini: ref, fim: ref };
  if (gran === 'semana') {
    const dow = (dt.getDay() + 6) % 7; // 0 = segunda
    const ini = new Date(dt); ini.setDate(dt.getDate() - dow);
    const fim = new Date(ini); fim.setDate(ini.getDate() + 6);
    return { ini: isoDate(ini), fim: isoDate(fim) };
  }
  const ini = new Date(dt.getFullYear(), dt.getMonth(), 1);
  const fim = new Date(dt.getFullYear(), dt.getMonth() + 1, 0);
  return { ini: isoDate(ini), fim: isoDate(fim) };
}
const fmtDataBR = (s: string) => s.split('-').reverse().join('/');

export default function CmvTeoricoPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const barId = selectedBar?.id;
  const [modo, setModo] = useState<'cardapio' | 'periodo' | 'vs_real'>('cardapio');

  // ---------- CARDÁPIO (catálogo) ----------
  const [produtos, setProdutos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [recalc, setRecalc] = useState(false);
  const [busca, setBusca] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [flag, setFlag] = useState<'sem_ficha' | 'sem_preco' | null>(null);
  const [dataAnterior, setDataAnterior] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!barId) return; setLoading(true);
    try {
      const r = await api.get(`/api/operacional/cmv-teorico?bar_id=${barId}`);
      if (r.success) { setProdutos(r.produtos || []); setDataAnterior(r.data_anterior || null); }
    } finally { setLoading(false); }
  }, [barId]);
  useEffect(() => { carregar(); }, [carregar]);

  // ---------- POR PERÍODO ----------
  const yest = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 1); return isoDate(d); }, []);
  const [gran, setGran] = useState<'dia' | 'semana' | 'mes'>('dia');
  const [dataRef, setDataRef] = useState(yest);
  const [periodo, setPeriodo] = useState<any>(null);
  const [loadingPer, setLoadingPer] = useState(false);
  const [buscaPer, setBuscaPer] = useState('');
  const [catPer, setCatPer] = useState<string | null>(null);
  const [soSemFicha, setSoSemFicha] = useState(false);
  const [mostrarForaDp, setMostrarForaDp] = useState(false);
  const range = useMemo(() => calcRange(gran, dataRef), [gran, dataRef]);
  const carregarPeriodo = useCallback(async () => {
    if (!barId) return; setLoadingPer(true);
    try {
      const r = await api.get(`/api/operacional/cmv-teorico?bar_id=${barId}&ini=${range.ini}&fim=${range.fim}`);
      if (r.success) setPeriodo(r);
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
    finally { setLoadingPer(false); }
  }, [barId, range, toast]);
  useEffect(() => { if (modo === 'periodo') carregarPeriodo(); }, [modo, carregarPeriodo]);

  // ---------- TEÓRICO × REAL ----------
  const anoAtual = useMemo(() => new Date().getFullYear(), []);
  const [ano, setAno] = useState(anoAtual);
  const [vsReal, setVsReal] = useState<any[]>([]);
  const [loadingVs, setLoadingVs] = useState(false);
  const carregarVsReal = useCallback(async () => {
    if (!barId) return; setLoadingVs(true);
    try {
      const r = await api.get(`/api/operacional/cmv-teorico?bar_id=${barId}&vs_real=${ano}`);
      if (r.success) setVsReal(r.meses || []);
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
    finally { setLoadingVs(false); }
  }, [barId, ano, toast]);
  useEffect(() => { if (modo === 'vs_real') carregarVsReal(); }, [modo, carregarVsReal]);
  const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const recalcular = async () => {
    if (!barId) return; setRecalc(true);
    try {
      const r = await api.post('/api/operacional/cmv-teorico', { bar_id: barId, action: 'recalcular' });
      if (!r.success) throw new Error(r.error);
      toast({ title: 'CMV recalculado' });
      await carregar(); if (modo === 'periodo') await carregarPeriodo();
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
    finally { setRecalc(false); }
  };

  const cats = useMemo(() => Array.from(new Set(produtos.map(p => p.categoria).filter(Boolean))).sort(), [produtos]);
  const escopo = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return produtos.filter(p => (!cat || p.categoria === cat) && (!s || (p.nome || '').toLowerCase().includes(s) || (p.codigo || '').toLowerCase().includes(s)));
  }, [produtos, busca, cat]);
  const semFichaFn = (p: any) => !p.custo || p.custo === 0;
  const semPrecoFn = (p: any) => !p.preco_venda;
  const view = useMemo(() => {
    if (flag === 'sem_ficha') return escopo.filter(semFichaFn);
    if (flag === 'sem_preco') return escopo.filter(semPrecoFn);
    return escopo;
  }, [escopo, flag]);
  const comCmv = escopo.filter(p => p.cmv_pct != null);
  const cmvMedio = comCmv.length ? comCmv.reduce((s, p) => s + Number(p.cmv_pct), 0) / comCmv.length : null;
  const semFicha = escopo.filter(semFichaFn).length;
  const semPreco = escopo.filter(semPrecoFn).length;

  // produtos do período filtrados
  const perProdView = useMemo(() => {
    const lista: any[] = periodo?.produtos || [];
    const s = buscaPer.trim().toLowerCase();
    return lista.filter(p => (!catPer || p.categoria === catPer)
      && (!soSemFicha || !p.custo_unit || Number(p.custo_unit) === 0)
      && (!s || (p.nome || '').toLowerCase().includes(s) || (p.codigo || '').toLowerCase().includes(s)));
  }, [periodo, buscaPer, catPer, soSemFicha]);

  const exportarCSV = () => {
    if (!perProdView.length) return;
    const head = ['Codigo', 'Produto', 'Categoria', 'Qtd', 'Preco venda', 'Custo unit', 'Faturamento', 'Custo total', 'Margem', 'CMV %'];
    const linhas = perProdView.map((p: any) => [p.codigo, p.nome, p.categoria || '', p.qtd, p.preco_venda ?? '', p.custo_unit ?? '', p.faturamento ?? '', p.custo_total ?? '', p.margem ?? '', p.cmv_pct ?? '']
      .map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'));
    const csv = '﻿' + [head.join(';'), ...linhas].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `cmv-teorico_${range.ini}_${range.fim}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const btnGran = (g: 'dia' | 'semana' | 'mes', label: string) => (
    <button onClick={() => setGran(g)} className={`text-xs rounded px-3 py-1.5 border ${gran === g ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{label}</button>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-xl"><Calculator className="w-6 h-6 text-amber-600 dark:text-amber-400" /></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CMV Teórico</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{modo === 'cardapio' ? 'Custo da ficha (último preço) ÷ preço de venda (ContaHub)' : 'CMV teórico ponderado pelas vendas do período'} · {selectedBar?.nome || `Bar ${barId ?? ''}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button onClick={() => setModo('cardapio')} className={`text-xs px-3 py-2 flex items-center gap-1.5 ${modo === 'cardapio' ? 'bg-amber-500 text-white' : 'text-gray-600 dark:text-gray-300'}`}><ListChecks className="w-4 h-4" />Cardápio</button>
              <button onClick={() => setModo('periodo')} className={`text-xs px-3 py-2 flex items-center gap-1.5 ${modo === 'periodo' ? 'bg-amber-500 text-white' : 'text-gray-600 dark:text-gray-300'}`}><CalendarDays className="w-4 h-4" />Por período</button>
              <button onClick={() => setModo('vs_real')} className={`text-xs px-3 py-2 flex items-center gap-1.5 ${modo === 'vs_real' ? 'bg-amber-500 text-white' : 'text-gray-600 dark:text-gray-300'}`}><TrendingUp className="w-4 h-4" />Teórico × Real</button>
            </div>
            <Button onClick={recalcular} disabled={recalc} variant="outline"><RefreshCw className={`w-4 h-4 mr-2 ${recalc ? 'animate-spin' : ''}`} />{recalc ? 'Recalculando…' : 'Recalcular'}</Button>
          </div>
        </div>

        {modo === 'cardapio' ? (<>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">CMV médio</div><div className={`text-2xl font-bold ${corCmv(cmvMedio)}`}>{fmtPct(cmvMedio)}</div></CardContent></Card>
            <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Produtos c/ CMV</div><div className="text-2xl font-bold">{comCmv.length}</div></CardContent></Card>
            <button type="button" onClick={() => setFlag(f => f === 'sem_ficha' ? null : 'sem_ficha')} className="text-left w-full">
              <Card className={`card-dark transition ${flag === 'sem_ficha' ? 'ring-2 ring-amber-400' : 'hover:ring-1 hover:ring-gray-300 dark:hover:ring-gray-600'}`}><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Sem ficha {flag === 'sem_ficha' && '· filtrando'}</div><div className="text-2xl font-bold text-gray-400">{semFicha}</div></CardContent></Card>
            </button>
            <button type="button" onClick={() => setFlag(f => f === 'sem_preco' ? null : 'sem_preco')} className="text-left w-full">
              <Card className={`card-dark transition ${flag === 'sem_preco' ? 'ring-2 ring-amber-400' : 'hover:ring-1 hover:ring-gray-300 dark:hover:ring-gray-600'}`}><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Sem preço CH {flag === 'sem_preco' && '· filtrando'}</div><div className="text-2xl font-bold text-gray-400">{semPreco}</div></CardContent></Card>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto…" className="pl-9" />
            </div>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setCat(null)} className={`text-xs rounded px-2.5 py-1 border ${!cat ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>Todas</button>
              {cats.map(c => <button key={c} onClick={() => setCat(c)} className={`text-xs rounded px-2.5 py-1 border ${cat === c ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{c}</button>)}
            </div>
          </div>

          <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                <th className="text-left font-medium px-3 py-2">Cód.</th>
                <th className="text-left font-medium px-3 py-2">Produto</th>
                <th className="text-left font-medium px-3 py-2">Categoria</th>
                <th className="text-right font-medium px-3 py-2">Custo (ficha)</th>
                <th className="text-right font-medium px-3 py-2">Preço (CH)</th>
                <th className="text-right font-medium px-3 py-2">Margem</th>
                <th className="text-right font-medium px-3 py-2">CMV %</th>
                {dataAnterior && <th className="text-right font-medium px-3 py-2" title={`vs ${dataAnterior}`}>Δ</th>}
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? <tr><td colSpan={dataAnterior ? 8 : 7} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                : view.length === 0 ? <tr><td colSpan={dataAnterior ? 8 : 7} className="px-3 py-10 text-center text-gray-400">Sem produtos. Monte as fichas e clique em Recalcular.</td></tr>
                : view.map((p: any) => (
                  <tr key={p.produto_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.codigo}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{p.nome}</td>
                    <td className="px-3 py-2"><Badge variant="outline">{p.categoria || '—'}</Badge></td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.custo ? fmtBRL(p.custo) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">{fmtBRL(p.preco_venda)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.margem != null ? fmtBRL(p.margem) : '—'}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-bold ${corCmv(p.cmv_pct)}`}>{fmtPct(p.cmv_pct)}</td>
                    {dataAnterior && <td className="px-3 py-2 text-right tabular-nums text-xs">
                      {p.delta_cmv == null ? '—' : <span className={p.delta_cmv > 0 ? 'text-red-500' : p.delta_cmv < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}>{p.delta_cmv > 0 ? <TrendingUp className="w-3 h-3 inline" /> : p.delta_cmv < 0 ? <TrendingDown className="w-3 h-3 inline" /> : null} {p.delta_cmv > 0 ? '+' : ''}{p.delta_cmv}pp</span>}
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div></CardContent></Card>
        </>) : modo === 'periodo' ? (<>
          {/* ===== POR PERÍODO ===== */}
          <div className="flex flex-wrap items-center gap-2">
            {btnGran('dia', 'Dia')}{btnGran('semana', 'Semana')}{btnGran('mes', 'Mês')}
            <Input type="date" value={dataRef} onChange={e => setDataRef(e.target.value)} className="w-auto" />
            <span className="text-sm text-gray-500 dark:text-gray-400">{range.ini === range.fim ? fmtDataBR(range.ini) : `${fmtDataBR(range.ini)} → ${fmtDataBR(range.fim)}`}</span>
          </div>

          {loadingPer ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          : !periodo || (periodo.produtos || []).length === 0 ? <Card className="card-dark"><CardContent className="py-16 text-center text-gray-400">Sem vendas no período (ou fichas/de-para pendentes).</CardContent></Card>
          : (<>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">CMV teórico</div><div className={`text-2xl font-bold ${corCmv(periodo.headline?.cmv_pct)}`}>{fmtPct(periodo.headline?.cmv_pct)}</div></CardContent></Card>
              <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Faturamento</div><div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{fmtBRL(periodo.headline?.faturamento)}</div></CardContent></Card>
              <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Custo teórico</div><div className="text-2xl font-bold">{fmtBRL(periodo.headline?.custo_total)}</div></CardContent></Card>
              <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Margem</div><div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmtBRL(periodo.headline?.margem)}</div></CardContent></Card>
            </div>
            {periodo.headline?.qtd_cortesia > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Cortesia/consumação no período: <b>{fmtNum(periodo.headline.qtd_cortesia)}</b> itens · custo <b>{fmtBRL(periodo.headline.custo_cortesia)}</b> <span className="text-gray-400">(fora do CMV — dado de graça)</span></p>
            )}
            {periodo.headline?.sem_ficha_n > 0 && (
              <button onClick={() => setSoSemFicha(v => !v)} className={`text-left text-xs rounded-md px-3 py-2 border w-full sm:w-auto ${soSemFicha ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300' : 'border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50/60 dark:hover:bg-red-900/10'}`}>
                ⚠ <b>{periodo.headline.sem_ficha_n}</b> produtos venderam <b>sem ficha</b> ({fmtBRL(periodo.headline.sem_ficha_fat)} em vendas, fora do custo) · cobertura do CMV: <b>{fmtPct(periodo.headline.cobertura_pct)}</b> {soSemFicha ? '· mostrando só estes (clique p/ ver todos)' : '· clique p/ ver quais'}
              </button>
            )}
            {periodo.headline?.fora_depara_n > 0 && (
              <button onClick={() => setMostrarForaDp(v => !v)} className={`text-left text-xs rounded-md px-3 py-2 border w-full sm:w-auto block ${mostrarForaDp ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300' : 'border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 hover:bg-orange-50/60 dark:hover:bg-orange-900/10'}`}>
                🔗 <b>{periodo.headline.fora_depara_n}</b> produtos vendidos no ContaHub <b>fora do de-para</b> ({fmtBRL(periodo.headline.fora_depara_fat)}) — sem código interno/ficha, invisíveis no CMV · clique pra ver
              </button>
            )}
            {mostrarForaDp && (periodo.fora_depara || []).length > 0 && (
              <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-orange-50/60 dark:bg-orange-900/10 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                    <th className="text-left font-medium px-3 py-2">Cód. CH</th>
                    <th className="text-left font-medium px-3 py-2">Produto (ContaHub)</th>
                    <th className="text-right font-medium px-3 py-2">Qtd</th>
                    <th className="text-right font-medium px-3 py-2">Faturamento</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(periodo.fora_depara || []).map((p: any) => (
                      <tr key={p.prd} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.prd}</td>
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{p.prd_desc}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(p.qtd)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">{fmtBRL(p.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div></CardContent></Card>
            )}

            {/* por categoria */}
            <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                  <th className="text-left font-medium px-3 py-2">Categoria</th>
                  <th className="text-right font-medium px-3 py-2">Itens</th>
                  <th className="text-right font-medium px-3 py-2">Qtd vendida</th>
                  <th className="text-right font-medium px-3 py-2">Faturamento</th>
                  <th className="text-right font-medium px-3 py-2">Custo teórico</th>
                  <th className="text-right font-medium px-3 py-2">Margem</th>
                  <th className="text-right font-medium px-3 py-2">CMV %</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(periodo.categorias || []).map((c: any) => (
                    <tr key={c.categoria} onClick={() => setCatPer(x => x === c.categoria ? null : c.categoria)} className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 ${catPer === c.categoria ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}`}>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{c.categoria}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{c.itens}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.qtd)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">{fmtBRL(c.faturamento)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(c.custo_total)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(c.margem)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-bold ${corCmv(c.cmv_pct)}`}>{fmtPct(c.cmv_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></CardContent></Card>

            {/* por produto */}
            <div className="flex flex-col sm:flex-row gap-2 items-center">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input value={buscaPer} onChange={e => setBuscaPer(e.target.value)} placeholder="Buscar produto…" className="pl-9" />
              </div>
              {catPer && <button onClick={() => setCatPer(null)} className="text-xs text-amber-600 underline">limpar categoria: {catPer}</button>}
              <Button variant="outline" size="sm" onClick={exportarCSV}><Download className="w-4 h-4 mr-1.5" />Exportar CSV</Button>
            </div>
            <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                  <th className="text-left font-medium px-3 py-2">Cód.</th>
                  <th className="text-left font-medium px-3 py-2">Produto</th>
                  <th className="text-left font-medium px-3 py-2">Categoria</th>
                  <th className="text-right font-medium px-3 py-2">Qtd</th>
                  <th className="text-right font-medium px-3 py-2">Preço venda</th>
                  <th className="text-right font-medium px-3 py-2">Custo unit.</th>
                  <th className="text-right font-medium px-3 py-2">Faturamento</th>
                  <th className="text-right font-medium px-3 py-2">Custo total</th>
                  <th className="text-right font-medium px-3 py-2">Margem</th>
                  <th className="text-right font-medium px-3 py-2">CMV %</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {perProdView.map((p: any) => (
                    <tr key={p.codigo} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.codigo}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{p.nome}</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.categoria || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(p.qtd)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">{fmtBRL(p.preco_venda)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.custo_unit ? fmtBRL(p.custo_unit) : <span className="text-amber-500" title="Sem ficha/custo">—</span>}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(p.faturamento)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(p.custo_total)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(p.margem)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-bold ${corCmv(p.cmv_pct)}`}>{fmtPct(p.cmv_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></CardContent></Card>
          </>)}
        </>) : (<>
          {/* ===== TEÓRICO × REAL ===== */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Ano:</span>
            {[anoAtual - 1, anoAtual].map(a => (
              <button key={a} onClick={() => setAno(a)} className={`text-xs rounded px-3 py-1.5 border ${ano === a ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{a}</button>
            ))}
            <span className="text-xs text-gray-400">CMV teórico (fichas × vendas) × CMV real (financeiro). Gap = perda/quebra/consumo não-mapeado.</span>
          </div>
          {loadingVs ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          : (
            <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                  <th className="text-left font-medium px-3 py-2">Mês</th>
                  <th className="text-right font-medium px-3 py-2">Faturamento</th>
                  <th className="text-right font-medium px-3 py-2" title="Nosso, das fichas × vendas">CMV teórico</th>
                  <th className="text-right font-medium px-3 py-2" title="Do financeiro (compras/estoque)">CMV real</th>
                  <th className="text-right font-medium px-3 py-2" title="Real − Teórico = perda/quebra/consumo">Gap</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {vsReal.filter((m: any) => m.cmv_teorico_pct != null || (m.cmv_real_pct != null && Number(m.cmv_real_pct) > 0)).map((m: any) => (
                    <tr key={m.mes} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{MESES[m.mes]}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">{fmtBRL(m.fat_cmvivel ?? m.fat_teorico)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${corCmv(m.cmv_teorico_pct)}`}>{fmtPct(m.cmv_teorico_pct)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${corCmv(m.cmv_real_pct)}`}>{fmtPct(m.cmv_real_pct)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold">{m.gap_pp == null ? '—' : <span className={Number(m.gap_pp) > 1 ? 'text-red-600 dark:text-red-400' : Number(m.gap_pp) < -1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}>{Number(m.gap_pp) > 0 ? '+' : ''}{Number(m.gap_pp).toFixed(2)}pp</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></CardContent></Card>
          )}
        </>)}
      </div>
    </div>
  );
}
