'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Calculator, RefreshCw, Search, Loader2, TrendingUp, TrendingDown, CalendarDays, ListChecks, Download } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { useModuloPermissao } from '@/hooks/useModuloPermissao';
import { BadgeSomenteLeitura } from '@/components/permissions/BadgeSomenteLeitura';
import { usePageTitle } from '@/contexts/PageTitleContext';

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
const ddmm = (s: string) => s.split('-').reverse().slice(0, 2).join('/');

export default function CmvTeoricoPage() {
  const { selectedBar } = useBar();
  const { soLeitura } = useModuloPermissao('/operacional/cmv-teorico');
  const { toast } = useToast();
  const { setPageTitle } = usePageTitle();
  useEffect(() => { setPageTitle('🧮 CMV Teórico'); return () => setPageTitle(''); }, [setPageTitle]);
  const barId = selectedBar?.id;
  const [modo, setModo] = useState<'cardapio' | 'periodo' | 'comparativo'>('periodo');

  // ---------- CARDÁPIO (catálogo) ----------
  const [produtos, setProdutos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [recalc, setRecalc] = useState(false);
  const [busca, setBusca] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [flag, setFlag] = useState<'sem_ficha' | 'ficha_sem_preco' | 'sem_preco' | null>(null);
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
  const [dpBusy, setDpBusy] = useState(false);
  const [manualCod, setManualCod] = useState<Record<number, string>>({});
  const [cadOpen, setCadOpen] = useState<number | null>(null); // prd com o mini-form de cadastro aberto
  const [cadCat, setCadCat] = useState<'b' | 'c' | 'd' | 'o'>('b');
  // Resolvidos nesta sessão (cadastrado/vinculado/ignorado): somem da lista NA HORA, mesmo
  // que a matview do "fora do de-para" só atualize depois (evita o item continuar aparecendo).
  const [resolvidos, setResolvidos] = useState<Set<number>>(new Set());
  const marcarResolvidos = (prds: number[]) => setResolvidos(prev => { const n = new Set(prev); prds.forEach(p => n.add(p)); return n; });
  const range = useMemo(() => calcRange(gran, dataRef), [gran, dataRef]);
  const carregarPeriodo = useCallback(async () => {
    if (!barId) return; setLoadingPer(true);
    try {
      const r = await api.get(`/api/operacional/cmv-teorico?bar_id=${barId}&ini=${range.ini}&fim=${range.fim}&gran=${gran}`);
      if (r.success) setPeriodo(r);
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
    finally { setLoadingPer(false); }
  }, [barId, range, gran, toast]);
  useEffect(() => { if (modo === 'periodo') carregarPeriodo(); }, [modo, carregarPeriodo]);

  // ---------- COMPARATIVO TEMPORAL (semana×semana / mês×mês, por categoria) ----------
  const [granComp, setGranComp] = useState<'semana' | 'mes'>('semana');
  const semanaPassada = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 7); return isoDate(d); }, []);
  const mesPassado = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 35); return isoDate(d); }, []);
  const [refA, setRefA] = useState(yest);   // período A (selecionável)
  const [refB, setRefB] = useState(semanaPassada); // período B (comparado, selecionável)
  const rangeA = useMemo(() => calcRange(granComp, refA), [granComp, refA]);
  const rangeB = useMemo(() => calcRange(granComp, refB), [granComp, refB]);
  // opções dos seletores (12 meses / 16 semanas)
  const mesOptions = useMemo(() => { const o: { val: string; label: string }[] = []; const t = new Date(); for (let i = 0; i < 12; i++) { const d = new Date(t.getFullYear(), t.getMonth() - i, 1); o.push({ val: isoDate(d), label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) }); } return o; }, []);
  const semanaOptions = useMemo(() => { const o: { val: string; label: string }[] = []; const t = new Date(); const dw = (t.getDay() + 6) % 7; const cur = new Date(t); cur.setDate(t.getDate() - dw); for (let i = 0; i < 16; i++) { const m = new Date(cur); m.setDate(cur.getDate() - i * 7); const s = new Date(m); s.setDate(m.getDate() + 6); o.push({ val: isoDate(m), label: `${ddmm(isoDate(m))}–${ddmm(isoDate(s))}` }); } return o; }, []);
  const refSelVal = (ref: string) => granComp === 'mes' ? `${ref.slice(0, 7)}-01` : (() => { const d = new Date(ref + 'T00:00:00'); const dw = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dw); return isoDate(d); })();
  const [comp, setComp] = useState<any>(null);
  const [loadingComp, setLoadingComp] = useState(false);
  const carregarComp = useCallback(async () => {
    if (!barId) return; setLoadingComp(true);
    try {
      const r = await api.get(`/api/operacional/cmv-teorico?bar_id=${barId}&comparativo=1&ini=${rangeA.ini}&fim=${rangeA.fim}&pini=${rangeB.ini}&pfim=${rangeB.fim}&gran=${granComp}`);
      if (r.success) setComp(r);
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
    finally { setLoadingComp(false); }
  }, [barId, rangeA, rangeB, granComp, toast]);
  useEffect(() => { if (modo === 'comparativo') carregarComp(); }, [modo, carregarComp]);
  // ao trocar semana↔mês, reposiciona B pra um período anterior coerente
  useEffect(() => { setRefB(granComp === 'mes' ? mesPassado : semanaPassada); }, [granComp, mesPassado, semanaPassada]);

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

  // ---------- FORA DO DE-PARA: vincular / ignorar ----------
  const vincularDepara = async (pares: { prd: number; cod_interno: string }[]) => {
    if (!barId || !pares.length) return; setDpBusy(true);
    try {
      const r = await api.post('/api/operacional/cmv-teorico', { bar_id: barId, action: 'vincular_depara', pares });
      if (!r.success) throw new Error(r.error);
      toast({ title: pares.length > 1 ? `${r.vinculados} vinculados` : 'Vinculado', description: 'Já entra no CMV.' });
      marcarResolvidos(pares.map(x => x.prd));
      await carregarPeriodo();
    } catch (e: any) { toast({ title: 'Erro ao vincular', description: e?.message, variant: 'destructive' }); }
    finally { setDpBusy(false); }
  };
  const ignorarDepara = async (prds: { prd: number; prd_desc?: string }[]) => {
    if (!barId || !prds.length) return; setDpBusy(true);
    try {
      const r = await api.post('/api/operacional/cmv-teorico', { bar_id: barId, action: 'ignorar_depara', prds });
      if (!r.success) throw new Error(r.error);
      toast({ title: `${r.ignorados} ignorado(s)`, description: 'Não aparece mais na lista.' });
      marcarResolvidos(prds.map(x => x.prd));
      await carregarPeriodo();
    } catch (e: any) { toast({ title: 'Erro ao ignorar', description: e?.message, variant: 'destructive' }); }
    finally { setDpBusy(false); }
  };
  const cadastrarDepara = async (p: any, prefixo: 'b' | 'c' | 'd' | 'o') => {
    if (!barId) return; setDpBusy(true);
    try {
      const r = await api.post('/api/operacional/cmv-teorico', { bar_id: barId, action: 'cadastrar_depara', prd: p.prd, prd_desc: p.prd_desc, prefixo });
      if (!r.success) throw new Error(r.error);
      toast({ title: `Cadastrado (${r.codigo})`, description: 'Produto criado e vinculado. Monte a ficha em Fichas Técnicas.' });
      setCadOpen(null);
      marcarResolvidos([p.prd]);
      await carregarPeriodo();
    } catch (e: any) { toast({ title: 'Erro ao cadastrar', description: e?.message, variant: 'destructive' }); }
    finally { setDpBusy(false); }
  };
  // Lista "fora do de-para" já sem os resolvidos nesta sessão (cadastrado/vinculado/ignorado).
  const foraDepara = useMemo(() => ((periodo?.fora_depara || []) as any[]).filter(p => !resolvidos.has(p.prd)), [periodo, resolvidos]);
  // só entram no "vincular em massa" os exatos sem ambiguidade E cuja sugestão NÃO está mapeada a outro código
  const exatos = useMemo(() => foraDepara.filter(p => p.nivel === 'exato' && !p.ambiguo && p.sugestao_codigo && !p.sugestao_ja_mapeada), [foraDepara]);

  // Categoria normalizada por PREFIXO do código (b→Bebida, d→Drink, c→Comida, resto→Outros) —
  // igual o Ordinário. Evita a parede de 30+ categorias cruas do ContaHub (que o Deboche tinha),
  // deixando a busca em destaque nos dois bares.
  const catBucket = useCallback((p: any): string => {
    const c = String(p?.codigo || '').trim().toLowerCase();
    if (c.startsWith('b')) return 'Bebida';
    if (c.startsWith('d')) return 'Drink';
    if (c.startsWith('c')) return 'Comida';
    return 'Outros';
  }, []);
  const cats = useMemo(() => Array.from(new Set(produtos.map(catBucket))).sort(), [produtos, catBucket]);
  const escopo = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return produtos.filter(p => (!cat || catBucket(p) === cat) && (!s || (p.nome || '').toLowerCase().includes(s) || (p.codigo || '').toLowerCase().includes(s)));
  }, [produtos, busca, cat, catBucket]);
  // sem ficha = sem receita cadastrada (itens_ficha=0); ficha s/ preço = tem receita mas insumo sem preço (custo 0)
  const semFichaFn = (p: any) => (p.itens_ficha ?? 0) === 0;
  const fichaSemPrecoFn = (p: any) => (p.itens_ficha ?? 0) > 0 && (!p.custo || Number(p.custo) === 0);
  const semPrecoFn = (p: any) => !p.preco_venda;
  const view = useMemo(() => {
    if (flag === 'sem_ficha') return escopo.filter(semFichaFn);
    if (flag === 'ficha_sem_preco') return escopo.filter(fichaSemPrecoFn);
    if (flag === 'sem_preco') return escopo.filter(semPrecoFn);
    return escopo;
  }, [escopo, flag]);
  const comCmv = escopo.filter(p => p.cmv_pct != null);
  const cmvMedio = comCmv.length ? comCmv.reduce((s, p) => s + Number(p.cmv_pct), 0) / comCmv.length : null;
  const semFicha = escopo.filter(semFichaFn).length;
  const fichaSemPreco = escopo.filter(fichaSemPrecoFn).length;
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
    const head = ['Codigo', 'Produto', 'Categoria', 'Fonte', 'Qtd', 'Preco venda', 'Custo unit', 'Faturamento', 'Custo total', 'Margem', 'CMV %'];
    const linhas = perProdView.map((p: any) => [p.codigo, p.nome, p.categoria || '', p.fonte || 'contahub', p.qtd, p.preco_venda ?? '', p.custo_unit ?? '', p.faturamento ?? '', p.custo_total ?? '', p.margem ?? '', p.cmv_pct ?? '']
      .map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'));
    const csv = '﻿' + [head.join(';'), ...linhas].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `cmv-teorico_${range.ini}_${range.fim}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const btnGran = (g: 'dia' | 'semana' | 'mes', label: string) => (
    <button onClick={() => setGran(g)} className={`text-xs rounded px-3 py-1.5 border ${gran === g ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{label}</button>
  );

  return (
    <PageShell width="wide">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-xl"><Calculator className="w-6 h-6 text-amber-600 dark:text-amber-400" /></div>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">{soLeitura && <BadgeSomenteLeitura />}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{modo === 'cardapio' ? 'Custo da ficha (último preço) ÷ preço de venda (ContaHub)' : 'CMV teórico ponderado pelas vendas do período'} · {selectedBar?.nome || `Bar ${barId ?? ''}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button onClick={() => setModo('cardapio')} className={`text-xs px-3 py-2 flex items-center gap-1.5 ${modo === 'cardapio' ? 'bg-amber-500 text-white' : 'text-gray-600 dark:text-gray-300'}`}><ListChecks className="w-4 h-4" />Cardápio</button>
              <button onClick={() => setModo('periodo')} className={`text-xs px-3 py-2 flex items-center gap-1.5 ${modo === 'periodo' ? 'bg-amber-500 text-white' : 'text-gray-600 dark:text-gray-300'}`}><CalendarDays className="w-4 h-4" />Por período</button>
              <button onClick={() => setModo('comparativo')} className={`text-xs px-3 py-2 flex items-center gap-1.5 ${modo === 'comparativo' ? 'bg-amber-500 text-white' : 'text-gray-600 dark:text-gray-300'}`}><TrendingUp className="w-4 h-4" />Comparativo</button>
            </div>
            <Button onClick={recalcular} disabled={recalc} variant="outline"><RefreshCw className={`w-4 h-4 mr-2 ${recalc ? 'animate-spin' : ''}`} />{recalc ? 'Recalculando…' : 'Recalcular'}</Button>
          </div>
        </div>

        {modo === 'cardapio' ? (<>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <StatCard label="CMV médio" value={fmtPct(cmvMedio)} valueClassName={corCmv(cmvMedio)} />
            <StatCard label="Produtos c/ CMV" value={comCmv.length} />
            <StatCard label="Sem ficha" value={semFicha} tone="muted"
              active={flag === 'sem_ficha'} onClick={() => setFlag(f => f === 'sem_ficha' ? null : 'sem_ficha')} />
            <StatCard label="Ficha s/ preço" value={fichaSemPreco} tone="warn"
              active={flag === 'ficha_sem_preco'} onClick={() => setFlag(f => f === 'ficha_sem_preco' ? null : 'ficha_sem_preco')} />
            <StatCard label="Sem preço CH" value={semPreco} tone="muted"
              active={flag === 'sem_preco'} onClick={() => setFlag(f => f === 'sem_preco' ? null : 'sem_preco')} />
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
                <th className="text-right font-medium px-3 py-2">Margem Bruta</th>
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
                    <td className="px-3 py-2"><Badge variant="outline">{p.categoria || 'Outros'}</Badge></td>
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
            {gran === 'dia'
              ? <Input type="date" value={dataRef} onChange={e => setDataRef(e.target.value)} className="w-auto" />
              : <select
                  value={gran === 'mes' ? `${dataRef.slice(0, 7)}-01` : (() => { const d = new Date(dataRef + 'T00:00:00'); const dw = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dw); return isoDate(d); })()}
                  onChange={e => setDataRef(e.target.value)}
                  className="h-9 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-2 capitalize">
                  {(gran === 'mes' ? mesOptions : semanaOptions).map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                </select>}
            <span className="text-sm text-gray-500 dark:text-gray-400">{range.ini === range.fim ? fmtDataBR(range.ini) : `${fmtDataBR(range.ini)} → ${fmtDataBR(range.fim)}`}</span>
            {periodo?.headline?.dias_yuzer?.length > 0 && (
              <span className="text-xs rounded-full px-2 py-0.5 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" title={`Operação Yuzer — o CMV usa o preço do Yuzer nesses dias: ${periodo.headline.dias_yuzer.map((d: string) => fmtDataBR(d)).join(', ')}`}>
                🎟️ {gran === 'dia' ? 'Operação Yuzer · usa preço Yuzer' : `${periodo.headline.dias_yuzer.length} dia(s) Yuzer · usam preço Yuzer`}
              </span>
            )}
          </div>

          {loadingPer ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          : !periodo || (periodo.produtos || []).length === 0 ? <Card className="card-dark"><CardContent className="py-16 text-center text-gray-400">Sem vendas no período (ou fichas/de-para pendentes).</CardContent></Card>
          : (<>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <StatCard label="CMV teórico" value={fmtPct(periodo.headline?.cmv_pct)} valueClassName={corCmv(periodo.headline?.cmv_pct)} />
              <StatCard label="Faturamento" value={fmtBRL(periodo.headline?.faturamento)} valueClassName="text-blue-600 dark:text-blue-400" />
              <StatCard label="Custo teórico" value={fmtBRL(periodo.headline?.custo_total)} />
              <StatCard label="Margem" value={fmtBRL(periodo.headline?.margem)} tone="good" />
            </div>
            {periodo.headline?.comparativo && (() => {
              const c = periodo.headline.comparativo;
              const d = Number(c.cmv_atual) - Number(c.cmv_ant);
              const labelPer = c.gran === 'mes' ? 'o mês anterior' : c.gran === 'semana' ? 'a semana anterior' : 'o dia anterior';
              const dir = d > 0.05 ? 'subiu' : d < -0.05 ? 'caiu' : 'estável';
              const sinal = (v: any) => `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(2)}`;
              const mix = Number(c.mix_pp), compras = Number(c.compras_pp);
              const motor = Math.abs(mix) >= Math.abs(compras) ? 'Mix (o que vendeu)' : 'Compras (custo do insumo)';
              const cls = dir === 'subiu' ? 'border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 bg-red-50/60 dark:bg-red-900/10'
                : dir === 'caiu' ? 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-900/10'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300';
              return (
                <div className={`text-xs rounded-md px-3 py-2 border ${cls}`}>
                  📊 CMV {dir === 'estável' ? <>estável em <b>{fmtPct(c.cmv_atual)}</b></> : <>{dir} de {fmtPct(c.cmv_ant)} para <b>{fmtPct(c.cmv_atual)}</b> ({sinal(d)} p.p.)</>} vs {labelPer}.
                  {' '}<span className="opacity-90">Mix <b>{sinal(mix)}</b> p.p. · Compras <b>{sinal(compras)}</b> p.p.</span>
                  {dir !== 'estável' && <> — puxado por <b>{motor}</b>.</>}
                </div>
              );
            })()}
            {periodo.headline?.qtd_cortesia > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Cortesia/consumação no período: <b>{fmtNum(periodo.headline.qtd_cortesia)}</b> itens · custo <b>{fmtBRL(periodo.headline.custo_cortesia)}</b> <span className="text-gray-400">(o CMV% é só sobre o que foi vendido — a cortesia fica fora daqui, mas entra nas saídas/desvios porque consome insumo)</span></p>
            )}
            {(periodo.headline?.sem_ficha_n > 0 || periodo.headline?.ficha_sem_preco_n > 0) && (
              <div className="space-y-1.5">
                {periodo.headline?.sem_ficha_n > 0 && (
                  <button onClick={() => setSoSemFicha(v => !v)} className={`text-left text-xs rounded-md px-3 py-2 border w-full sm:w-auto block ${soSemFicha ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300' : 'border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50/60 dark:hover:bg-red-900/10'}`}>
                    ⚠ <b>{periodo.headline.sem_ficha_n}</b> produtos venderam <b>sem ficha técnica</b> ({fmtBRL(periodo.headline.sem_ficha_fat)}) — falta cadastrar a receita · <b>não estou considerando no CMV</b>
                  </button>
                )}
                {periodo.headline?.ficha_sem_preco_n > 0 && (
                  <button onClick={() => setSoSemFicha(v => !v)} className={`text-left text-xs rounded-md px-3 py-2 border w-full sm:w-auto block ${soSemFicha ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300' : 'border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50/60 dark:hover:bg-amber-900/10'}`}>
                    💲 <b>{periodo.headline.ficha_sem_preco_n}</b> produtos têm <b>ficha, mas o insumo está sem preço</b> ({fmtBRL(periodo.headline.ficha_sem_preco_fat)}, custo zerado) — precifique o insumo
                  </button>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400">Cobertura do CMV: <b>{fmtPct(periodo.headline.cobertura_pct)}</b> {soSemFicha ? '· mostrando só os fora do custo (clique no aviso p/ ver todos)' : '· clique num aviso p/ filtrar'}</p>
              </div>
            )}
            {periodo.headline?.fora_depara_n > 0 && (
              <button onClick={() => setMostrarForaDp(v => !v)} className={`text-left text-xs rounded-md px-3 py-2 border w-full sm:w-auto block ${mostrarForaDp ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300' : 'border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 hover:bg-orange-50/60 dark:hover:bg-orange-900/10'}`}>
                🔗 <b>{periodo.headline.fora_depara_n}</b> produtos vendidos no ContaHub <b>fora do de-para</b> ({fmtBRL(periodo.headline.fora_depara_fat)}) — sem código interno/ficha, invisíveis no CMV · clique pra ver
              </button>
            )}
            {mostrarForaDp && foraDepara.length > 0 && (
              <Card className="card-dark overflow-hidden"><CardContent className="p-0">
                {!soLeitura && exatos.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-emerald-50/70 dark:bg-emerald-900/15 border-b border-emerald-200 dark:border-emerald-800">
                    <span className="text-xs text-emerald-700 dark:text-emerald-300"><b>{exatos.length}</b> com nome idêntico (match exato) — seguro vincular de uma vez.</span>
                    <Button size="sm" disabled={dpBusy} onClick={() => vincularDepara(exatos.map(p => ({ prd: p.prd, cod_interno: p.sugestao_codigo })))}>
                      {dpBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `✓ Vincular ${exatos.length} exatos`}
                    </Button>
                  </div>
                )}
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-orange-50/60 dark:bg-orange-900/10 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                    <th className="text-left font-medium px-3 py-2">Cód. CH</th>
                    <th className="text-left font-medium px-3 py-2">Produto (ContaHub)</th>
                    <th className="text-right font-medium px-3 py-2">Qtd</th>
                    <th className="text-right font-medium px-3 py-2">Faturamento</th>
                    <th className="text-left font-medium px-3 py-2">Sugestão / vincular</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {foraDepara.map((p: any) => {
                      const cod = (manualCod[p.prd] ?? '').trim();
                      const vincManual = () => { if (cod) vincularDepara([{ prd: p.prd, cod_interno: cod }]); };
                      return (
                      <tr key={p.prd} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 align-top">
                        <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.prd}</td>
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{p.prd_desc}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(p.qtd)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">{fmtBRL(p.valor)}</td>
                        <td className="px-3 py-2">
                          {soLeitura ? <span className="text-xs text-gray-400">—</span> : (
                          <div className="flex flex-col gap-1.5">
                            {/* sugestão de vínculo */}
                            {p.sugestao_codigo && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className={p.nivel === 'exato' && !p.sugestao_ja_mapeada ? 'border-emerald-400 text-emerald-600 dark:text-emerald-400' : 'border-amber-400 text-amber-600 dark:text-amber-400'}>
                                  {p.nivel === 'exato' ? 'exato' : `~${Math.round((p.score || 0) * 100)}%`}
                                </Badge>
                                <span className={`text-xs ${p.sugestao_ja_mapeada ? 'text-gray-400 line-through' : 'text-gray-600 dark:text-gray-300'}`}>{p.sugestao_codigo} · {p.sugestao_nome}{p.sugestao_ativo === false ? ' (inativo)' : ''}</span>
                                {p.sugestao_ja_mapeada && <span className="text-[11px] text-orange-600 dark:text-orange-400">⚠ já vinculado a outro código — provável produto diferente, cadastre</span>}
                                <Button size="sm" variant={p.nivel === 'exato' && !p.sugestao_ja_mapeada ? 'default' : 'outline'} disabled={dpBusy}
                                  onClick={() => {
                                    const aviso = p.sugestao_ja_mapeada
                                      ? `ATENÇÃO: "${p.sugestao_nome}" já está vinculado a OUTRO código do ContaHub — provavelmente é outro produto.\n\nVincular assim mesmo?\nContaHub: ${p.prd_desc} → ${p.sugestao_codigo} ${p.sugestao_nome}`
                                      : `Vincular:\n\nContaHub: ${p.prd_desc}\n→ Cardápio: ${p.sugestao_codigo} ${p.sugestao_nome}\n\nConfere? (nome parecido não é garantia)`;
                                    if ((p.nivel !== 'exato' || p.sugestao_ja_mapeada) && !confirm(aviso)) return;
                                    vincularDepara([{ prd: p.prd, cod_interno: p.sugestao_codigo }]);
                                  }}>Vincular</Button>
                              </div>
                            )}
                            {/* ações: cadastrar novo / vincular manual / ignorar */}
                            <div className="flex flex-wrap items-center gap-2">
                              {cadOpen === p.prd ? (
                                <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-900/15 px-2 py-1">
                                  <span className="text-[11px] text-gray-500">Cadastrar como:</span>
                                  <select value={cadCat} onChange={e => setCadCat(e.target.value as 'b' | 'c' | 'd' | 'o')} className="h-6 text-xs bg-transparent border rounded px-1 dark:bg-gray-800">
                                    <option value="b">Bebida</option><option value="c">Comida</option><option value="d">Drink</option><option value="o">Outros</option>
                                  </select>
                                  <Button size="sm" disabled={dpBusy} onClick={() => cadastrarDepara(p, cadCat)}>Criar</Button>
                                  <button onClick={() => setCadOpen(null)} className="text-xs text-gray-400 hover:text-gray-600">cancelar</button>
                                </span>
                              ) : (
                                <button onClick={() => { const pfx = ((p.sugestao_codigo || '')[0] || '').toLowerCase(); setCadCat((['b', 'c', 'd', 'o'].includes(pfx) ? pfx : 'b') as 'b' | 'c' | 'd' | 'o'); setCadOpen(p.prd); }}
                                  disabled={dpBusy} className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline">+ Cadastrar novo</button>
                              )}
                              {!p.sugestao_codigo && (
                                <span className="inline-flex items-center gap-1.5">
                                  <Input value={manualCod[p.prd] ?? ''} onChange={e => setManualCod(m => ({ ...m, [p.prd]: e.target.value }))} placeholder="ou vincular código" className="h-7 w-36 text-xs" />
                                  <Button size="sm" variant="outline" disabled={dpBusy || !cod} onClick={vincManual}>Vincular</Button>
                                </span>
                              )}
                              <button onClick={() => { if (confirm(`Ignorar "${p.prd_desc}"? Some da lista (use p/ ingresso, vale, taxa, embalagem…).`)) ignorarDepara([{ prd: p.prd, prd_desc: p.prd_desc }]); }}
                                disabled={dpBusy} className="text-xs text-gray-400 hover:text-red-500">ignorar</button>
                            </div>
                          </div>
                          )}
                        </td>
                      </tr>
                    ); })}
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
                    <tr key={`${p.codigo}-${p.fonte || 'ch'}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.codigo}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{p.nome}{p.fonte === 'yuzer' && <Badge variant="outline" className="ml-1.5 text-[10px] text-violet-600 border-violet-300">🎟️ Yuzer</Badge>}</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.categoria || 'Outros'}</td>
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
          {/* ===== COMPARATIVO TEMPORAL (por categoria) ===== */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              <button onClick={() => setGranComp('semana')} className={`text-xs rounded px-3 py-1.5 border ${granComp === 'semana' ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>Semana</button>
              <button onClick={() => setGranComp('mes')} className={`text-xs rounded px-3 py-1.5 border ${granComp === 'mes' ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>Mês</button>
            </div>
            {/* período A vs período B — ambos selecionáveis */}
            {([['A', refA, setRefA, 'text-amber-700 dark:text-amber-400'], ['B', refB, setRefB, 'text-gray-600 dark:text-gray-300']] as const).map(([lbl, ref, setRef, cor], i) => (
              <span key={lbl} className="inline-flex items-center gap-1">
                {i === 1 && <span className="text-xs text-gray-400 font-medium px-0.5">vs</span>}
                <select value={refSelVal(ref)} onChange={e => setRef(e.target.value)} className={`h-8 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-2 capitalize ${cor}`}>
                  {(granComp === 'mes' ? mesOptions : semanaOptions).map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                </select>
              </span>
            ))}
            <span className="text-xs text-gray-400">Escolha os 2 períodos (ex.: junho × abril). Decompõe a variação em <b>preço × mix × intramix</b> (preço = histórico VMarket).</span>
          </div>
          {loadingComp ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          : comp && (() => {
            const a = comp.atual, b = comp.anterior;
            const dTot = (a.cmv_pct ?? 0) - (b.cmv_pct ?? 0);
            const corDelta = (d: number) => d > 0.1 ? 'text-red-600 dark:text-red-400' : d < -0.1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500';
            const pp = (d: number) => `${d > 0 ? '+' : ''}${d.toFixed(2)}pp`;
            const cats = Array.from(new Set([...a.categorias.map((c: any) => c.categoria), ...b.categorias.map((c: any) => c.categoria)]));
            const fc = (arr: any[], k: string) => arr.find((c: any) => c.categoria === k);
            const rows = cats.map((k) => ({ k, at: fc(a.categorias, k), an: fc(b.categorias, k) })).sort((x, y) => (y.at?.faturamento || 0) - (x.at?.faturamento || 0));
            return (<>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">CMV teórico — atual</div><div className={`text-2xl font-bold ${corCmv(a.cmv_pct)}`}>{fmtPct(a.cmv_pct)}</div><div className="text-[11px] text-gray-400">{fmtBRL(a.custo_total)} / {fmtBRL(a.faturamento)}</div></CardContent></Card>
                <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">CMV teórico — anterior</div><div className={`text-2xl font-bold ${corCmv(b.cmv_pct)}`}>{fmtPct(b.cmv_pct)}</div><div className="text-[11px] text-gray-400">{fmtBRL(b.custo_total)} / {fmtBRL(b.faturamento)}</div></CardContent></Card>
                <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Variação</div><div className={`text-2xl font-bold ${corDelta(dTot)}`}>{pp(dTot)}</div><div className="text-[11px] text-gray-400">{dTot > 0.1 ? 'CMV piorou (subiu)' : dTot < -0.1 ? 'CMV melhorou (caiu)' : 'estável'}</div></CardContent></Card>
              </div>
              {comp.decomposicao && (() => {
                const dec = comp.decomposicao;
                const efeito = (label: string, val: number, desc: string) => (
                  <div className="rounded-md border border-gray-100 dark:border-gray-800 px-3 py-2 bg-white/70 dark:bg-gray-900/40">
                    <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-gray-700 dark:text-gray-200">{label}</span><span className={`text-sm font-bold tabular-nums ${corDelta(val)}`}>{pp(val)}</span></div>
                    <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{desc}</div>
                  </div>
                );
                const drv = comp.drivers || {};
                const listaItens = (titulo: string, itens: any[], campo: string) => (
                  <div>
                    <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">{titulo}</div>
                    <div className="space-y-0.5">
                      {(itens || []).filter((d: any) => Math.abs(d[campo]) >= 0.01).slice(0, 6).map((d: any) => (
                        <div key={d.codigo} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-gray-700 dark:text-gray-200">{d.nome} <span className="text-gray-400">{d.categoria}</span></span>
                          <span className={`shrink-0 tabular-nums font-medium ${corDelta(d[campo])}`}>{pp(d[campo])}</span>
                        </div>
                      ))}
                      {(!itens || itens.filter((d: any) => Math.abs(d[campo]) >= 0.01).length === 0) && <div className="text-[11px] text-gray-400">— sem item relevante</div>}
                    </div>
                  </div>
                );
                return (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-900/15 px-4 py-3 space-y-2.5">
                    {comp.narrativa && <div className="text-sm text-gray-900 dark:text-gray-100"><span className="font-semibold">💡 </span>{comp.narrativa}</div>}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {efeito('Preço (compras)', dec.efeito_preco, 'paguei mais/menos caro nos insumos (preço VMarket histórico)')}
                      {efeito('Mix (entre categorias)', dec.efeito_mix, 'mudei a proporção: + drink / − cerveja, etc.')}
                      {efeito('Intramix (dentro)', dec.efeito_intramix, 'dentro de cada categoria, vendi itens de CMV melhor/pior')}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-amber-100 dark:border-amber-900/30">
                      {listaItens('Itens que mais puxaram o mix/intramix', drv.volume, 'volume')}
                      {listaItens('Itens mais afetados por preço', drv.preco, 'preco')}
                    </div>
                    <div className="text-[10px] text-gray-400">Positivo = CMV piorou (subiu) · negativo = melhorou. A soma dos 3 efeitos = a variação total.</div>
                  </div>
                );
              })()}
              <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                    <th className="text-left font-medium px-3 py-2">Categoria</th>
                    <th className="text-right font-medium px-3 py-2">Faturamento atual</th>
                    <th className="text-right font-medium px-3 py-2">CMV atual</th>
                    <th className="text-right font-medium px-3 py-2">CMV anterior</th>
                    <th className="text-right font-medium px-3 py-2">Variação</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {rows.map(({ k, at, an }) => {
                      const d = (at?.cmv_pct ?? 0) - (an?.cmv_pct ?? 0);
                      return (
                        <tr key={k} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{k}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">{fmtBRL(at?.faturamento)}</td>
                          <td className={`px-3 py-2 text-right tabular-nums font-medium ${corCmv(at?.cmv_pct)}`}>{fmtPct(at?.cmv_pct)}</td>
                          <td className={`px-3 py-2 text-right tabular-nums font-medium ${corCmv(an?.cmv_pct)}`}>{fmtPct(an?.cmv_pct)}</td>
                          <td className={`px-3 py-2 text-right tabular-nums font-bold ${corDelta(d)}`}>{at && an ? pp(d) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div></CardContent></Card>
            </>);
          })()}
        </>)}
    </PageShell>
  );
}
