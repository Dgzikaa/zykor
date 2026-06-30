'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell } from '@/components/layout/PageShell';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { Scale, Loader2, Search, CalendarDays, AlertTriangle, TrendingUp, TrendingDown, Boxes, ChefHat, Drumstick, Pencil, Check, X } from 'lucide-react';

// célula com lápis (padrão Orçamentação): mostra valor + lápis no hover; clica → input com ✓/✕; salva e recalcula.
function PencilCell({ value, fmt, onSave, disabled }: { value: number | null; fmt: (v: any) => string; onSave: (v: number | null) => void; disabled?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState('');
  if (disabled) return <span className="tabular-nums text-gray-400">{value ? fmt(value) : '—'}</span>;
  const commit = () => { setEditing(false); const n = v.trim() === '' ? null : Number(v.replace(',', '.')); if ((n ?? 0) !== (value ?? 0)) onSave(n); };
  if (editing) return (
    <span className="inline-flex items-center gap-0.5 justify-end">
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <input autoFocus value={v} inputMode="decimal" onChange={e => setV(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className="w-16 text-right tabular-nums rounded px-1 py-0.5 text-sm border border-indigo-400 ring-1 ring-indigo-300 bg-transparent" />
      <button onClick={commit} className="text-emerald-600 hover:text-emerald-700"><Check className="w-3.5 h-3.5" /></button>
      <button onClick={() => setEditing(false)} className="text-red-500 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
    </span>
  );
  return (
    <span onClick={() => { setV(value != null ? String(value) : ''); setEditing(true); }}
      className="group/cell inline-flex items-center gap-1 justify-end cursor-pointer rounded px-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
      <span className="tabular-nums">{value ? fmt(value) : <span className="text-gray-300">—</span>}</span>
      <Pencil className="w-3 h-3 text-indigo-400 opacity-0 group-hover/cell:opacity-100" />
    </span>
  );
}

const fmtBRL = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtQtd = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const fmtData = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const ddmm = (d: string) => d ? d.split('-').reverse().slice(0, 2).join('/') : '—';
// dd/mm do dia anterior a `d` (fim da semana = contagem de fechamento − 1 = domingo)
const ddmmPrev = (d: string) => { const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() - 1); return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`; };

const TIPOS = [{ k: 'diaria', l: 'Diária' }, { k: 'semanal', l: 'Semanal' }, { k: 'mensal', l: 'Mensal' }];

// 3 cards de headline (Desvio total / Perdas / Sobras) — reusado nas 3 abas
function HeadCards({ head }: { head: any }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <Card className="card-dark"><CardContent className="py-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">Desvio total</div>
        <div className={`text-2xl font-bold ${(head?.desvio_total ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{fmtBRL(head?.desvio_total)}</div>
        <div className="text-[11px] text-gray-400">estoque real − teórico no período</div>
      </CardContent></Card>
      <Card className="card-dark"><CardContent className="py-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">Perdas (faltou estoque)</div>
        <div className="text-2xl font-bold text-red-600 dark:text-red-400">{fmtBRL(head?.perdas)}</div>
        <div className="text-[11px] text-gray-400">sobrou menos do que as vendas explicam</div>
      </CardContent></Card>
      <Card className="card-dark"><CardContent className="py-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">Sobras (sobrou estoque)</div>
        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmtBRL(head?.sobras)}</div>
        <div className="text-[11px] text-gray-400">restou mais do que as vendas explicam</div>
      </CardContent></Card>
    </div>
  );
}

// caixa de análise (perda vs período anterior + drivers) — reusado nas 3 abas
function AnaliseBlock({ analise, tipo }: { analise: any; tipo: string | null }) {
  if (!(analise?.insights?.length > 0)) return null;
  const lv = analise.level as 'alert' | 'warn' | 'info';
  const cls = lv === 'alert' ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/15'
    : lv === 'warn' ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/15'
      : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/15';
  const labelTipo = tipo === 'diaria' ? 'diária' : tipo === 'semanal' ? 'semanal' : 'mensal';
  const bullet = (l: string) => l === 'alert' ? '⚠️' : l === 'warn' ? '⚠' : '•';
  return (
    <div className={`rounded-lg border px-4 py-3 ${cls}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <AlertTriangle className={`w-4 h-4 ${lv === 'alert' ? 'text-rose-600 dark:text-rose-400' : lv === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`} />
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Análise de desvios — contagem {labelTipo}</span>
        {analise.anterior && <span className="text-xs text-gray-500">vs {fmtData(analise.anterior)}</span>}
      </div>
      <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
        {analise.insights.map((ins: any, i: number) => (
          <li key={i} className="flex gap-1.5"><span className="shrink-0">{bullet(ins.level)}</span><span>{ins.texto}</span></li>
        ))}
      </ul>
    </div>
  );
}

export default function DesviosPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  const [tipo, setTipo] = useState('diaria');
  const [datas, setDatas] = useState<string[]>([]);
  const [ini, setIni] = useState<string | null>(null);
  const [fim, setFim] = useState<string | null>(null);
  // prévia da semana em andamento (abertura da semana → última contagem diária; só Curva A)
  const [andamentoWin, setAndamentoWin] = useState<{ ini: string; fim: string } | null>(null);
  const [andamento, setAndamento] = useState(false);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any | null>(null);
  const [busca, setBusca] = useState('');
  const [aba, setAba] = useState('insumos');
  const [soCurvaA, setSoCurvaA] = useState(false);
  const [filtroDado, setFiltroDado] = useState<'sem_contagem' | 'sem_ficha' | null>(null);
  const [filtroArea, setFiltroArea] = useState<string | null>(null);
  const [filtroSecaoProd, setFiltroSecaoProd] = useState<'Comida' | 'Drinks' | null>(null);
  const [rowsProt, setRowsProt] = useState<any[]>([]);
  const [protAnalise, setProtAnalise] = useState<any>(null);
  const [loadingAba, setLoadingAba] = useState(false);

  // carrega datas do tipo selecionado e pré-seleciona as 2 mais recentes
  useEffect(() => {
    if (!barId) return;
    setAndamento(false);
    api.get(`/api/operacional/desvios?tipo=${tipo}`).then((r) => {
      if (r.success) {
        const ds: string[] = r.datas || [];
        setDatas(ds);
        setAndamentoWin(r.andamento || null);
        if (ds.length >= 2) { setFim(ds[0]); setIni(ds[1]); }
        else { setFim(ds[0] || null); setIni(null); setRes(null); }
      }
    });
  }, [barId, tipo]);

  const carregar = useCallback(async (a: string, b: string, t: string, emAndamento = false) => {
    if (!barId || !a || !b) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/operacional/desvios?ini=${a}&fim=${b}&tipo=${t}${emAndamento ? '&andamento=1' : ''}`);
      if (r.success) setRes(r);
    } finally { setLoading(false); }
  }, [barId]);
  useEffect(() => { if (ini && fim) carregar(ini, fim, tipo, andamento); }, [ini, fim, tipo, andamento, carregar]);

  // Seletor único de Semanal/Mensal: cada período é a janela [ini, fim) entre duas contagens
  // consecutivas (datas vêm DESC); fim = a contagem que fecha a semana/mês.
  const periodos = useMemo(() => {
    const out: { ini: string; fim: string }[] = [];
    for (let i = 0; i + 1 < datas.length; i++) out.push({ fim: datas[i], ini: datas[i + 1] });
    return out;
  }, [datas]);
  // Diária = 1 só dia selecionado: a janela é [dia, próxima contagem). O dia mais recente (datas[0])
  // ainda não tem contagem de fechamento, então não pode ser início — começa em datas[1].
  const diasDiaria = useMemo(() => {
    const out: { dia: string; fim: string }[] = [];
    for (let i = 1; i < datas.length; i++) out.push({ dia: datas[i], fim: datas[i - 1] });
    return out;
  }, [datas]);
  const labelPeriodo = (p: { ini: string; fim: string }) =>
    tipo === 'mensal'
      ? new Date(p.ini + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      // semana operacional: ini (segunda) → fim−1 (domingo); fim é a contagem de fechamento da semana seguinte
      : `${ddmm(p.ini)} – ${ddmmPrev(p.fim)}`;

  // abas Produções / Proteínas (leitura) — carregam sob demanda
  // Proteínas tem fn própria (balanço VMarket × utilizado produção); Produções vem do mesmo fn_desvios
  const carregarAba = useCallback(async () => {
    if (!barId || !ini || !fim || aba !== 'proteinas') return;
    setLoadingAba(true);
    try {
      const r = await api.get(`/api/operacional/desvios?ini=${ini}&fim=${fim}&aba=proteina&tipo=${tipo}${andamento ? '&andamento=1' : ''}`);
      if (r.success) { setRowsProt(r.itens || []); setProtAnalise(r.analise || null); }
    } finally { setLoadingAba(false); }
  }, [barId, ini, fim, aba, tipo, andamento]);
  useEffect(() => { carregarAba(); }, [carregarAba]);
  // após salvar (res muda), recarrega a aba Proteínas pra refletir utilizado/desperdício
  useEffect(() => { if (aba === 'proteinas' && res) carregarAba(); }, [res]); // eslint-disable-line react-hooks/exhaustive-deps

  // Produções = linhas is_producao do fn_desvios (balanço ancorado no estoque, com Produzido)
  // prodBase = antes do filtro Comida/Drinks (alimenta os contadores dos chips); prodView = já filtrado.
  const prodBase = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return (res?.itens || []).filter((i: any) => i.is_producao
      && ((tipo !== 'diaria' && !andamento) || i.curva_a === true) // diária / semana em andamento: só Curva A
      && (!soCurvaA || i.curva_a === true)         // filtro Só Curva A (semanal/mensal)
      && (!s || (i.insumo_nome || '').toLowerCase().includes(s) || (i.insumo_codigo || '').toLowerCase().includes(s)));
  }, [res, busca, tipo, soCurvaA, andamento]);
  const cntProdComida = useMemo(() => prodBase.filter((i: any) => i.secao_prod === 'Comida').length, [prodBase]);
  const cntProdDrinks = useMemo(() => prodBase.filter((i: any) => i.secao_prod === 'Drinks').length, [prodBase]);
  const prodView = useMemo(() => prodBase.filter((i: any) => !filtroSecaoProd || i.secao_prod === filtroSecaoProd), [prodBase, filtroSecaoProd]);
  const protView = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return rowsProt.filter((i: any) => !s || (i.insumo_nome || '').toLowerCase().includes(s) || (i.insumo_cod || '').toLowerCase().includes(s));
  }, [rowsProt, busca]);

  // edita em qualquer granularidade (lápis); salva no dia de início do período
  const editavel = !!ini; // edita em qualquer granularidade; salva no dia de início do período
  const salvar = useCallback(async (kind: 'produzido' | 'desperdicio' | 'utilizado', codigo: string, payload: { fornadas?: number | null; qtd?: number | null }) => {
    if (!ini || !fim) return;
    try {
      await api.post('/api/operacional/desvios', { tipo: kind, codigo, data: ini, ...payload });
      await carregar(ini, fim, tipo, andamento);
    } catch { /* silencioso; recarrega no próximo */ }
  }, [ini, fim, tipo, andamento, carregar]);

  // Insumos = só insumos (exclui produção e proteína, que têm aba própria).
  // Semanal/mensal: esconde insumo fora de ficha (nunca tem saída teórica). Filtro Só Curva A.
  const itensView = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return (res?.itens || []).filter((i: any) => !i.is_producao && !i.is_proteina
      && (tipo === 'diaria' || andamento || i.tem_ficha)
      && (!soCurvaA || i.curva_a === true)
      && (!filtroDado || i.dado_faltando === filtroDado)
      && (!filtroArea || i.area === filtroArea)
      && (!s || (i.insumo_nome || '').toLowerCase().includes(s) || (i.insumo_codigo || '').toLowerCase().includes(s)));
  }, [res, busca, tipo, soCurvaA, filtroDado, filtroArea, andamento]);

  // contadores dos chips de filtro (igual /operacional/insumos) — base = aba ativa sem o filtro Curva A
  const baseRows = useMemo(() => {
    const s = busca.trim().toLowerCase();
    const items = (res?.itens || []) as any[];
    const match = (i: any) => !s || (i.insumo_nome || '').toLowerCase().includes(s) || (i.insumo_codigo || '').toLowerCase().includes(s);
    if (aba === 'producoes') return items.filter((i) => i.is_producao && match(i));
    return items.filter((i) => !i.is_producao && !i.is_proteina && i.tem_ficha && match(i));
  }, [res, busca, aba]);
  const cntTotal = baseRows.length;
  const cntCurvaA = baseRows.filter((i: any) => i.curva_a === true).length;
  const cntSemContagem = baseRows.filter((i: any) => i.dado_faltando === 'sem_contagem').length;
  const cntSemFicha = baseRows.filter((i: any) => i.dado_faltando === 'sem_ficha').length;
  // contagem por área (chips de filtro por área) — só Insumos
  const areaList = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of baseRows) m[i.area] = (m[i.area] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [baseRows]);

  // headline acompanha o filtro: soma o desvio_rs da view atual de cada aba (exclui pendente)
  const headFrom = (rows: any[]) => rows.reduce((a: any, i: any) => {
    if (i.pendente) return a; const v = Number(i.desvio_rs || 0);
    a.desvio_total += v; if (v < 0) a.perdas += v; else a.sobras += v; return a;
  }, { desvio_total: 0, perdas: 0, sobras: 0 });
  const h = useMemo(() => headFrom(itensView), [itensView]); // eslint-disable-line react-hooks/exhaustive-deps
  const hProd = useMemo(() => headFrom(prodView), [prodView]); // eslint-disable-line react-hooks/exhaustive-deps
  const hProt = useMemo(() => headFrom(protView), [protView]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PageShell width="wide">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-100 dark:bg-rose-900/30 rounded-xl"><Scale className="w-6 h-6 text-rose-600 dark:text-rose-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Desvios de Consumo</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Estoque real × teórico (ini + compras + produzido − vendas×ficha − desperdício) · {selectedBar?.nome || ''}</p>
          </div>
        </div>

        {/* Tipo + Período */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {TIPOS.map(t => (
              <button key={t.k} onClick={() => setTipo(t.k)} className={`rounded-md px-3 py-1.5 text-sm border ${tipo === t.k ? 'bg-rose-500 text-white border-rose-500' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{t.l}</button>
            ))}
          </div>
          <span className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
          <CalendarDays className="w-4 h-4 text-gray-400" />
          {tipo === 'diaria' ? (
            <>
              <span className="text-sm text-gray-500">Dia</span>
              <select value={ini || ''} onChange={e => { const d = diasDiaria.find(x => x.dia === e.target.value); if (d) { setIni(d.dia); setFim(d.fim); } }} className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm">
                {diasDiaria.length === 0 && <option value="">—</option>}
                {diasDiaria.map(d => <option key={d.dia} value={d.dia}>{fmtData(d.dia)}</option>)}
              </select>
              {ini && fim && <span className="text-xs text-gray-400">estoque {ddmm(ini)} → {ddmm(fim)}</span>}
            </>
          ) : (
            <>
              <span className="text-sm text-gray-500">{tipo === 'semanal' ? 'Semana' : 'Mês'}</span>
              <select value={andamento && andamentoWin ? `__and__${andamentoWin.fim}` : (fim || '')} onChange={e => {
                if (tipo === 'semanal' && andamentoWin && e.target.value === `__and__${andamentoWin.fim}`) { setAndamento(true); setIni(andamentoWin.ini); setFim(andamentoWin.fim); return; }
                setAndamento(false);
                const p = periodos.find(x => x.fim === e.target.value); if (p) { setIni(p.ini); setFim(p.fim); }
              }} className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm capitalize">
                {periodos.length === 0 && !andamentoWin && <option value="">—</option>}
                {tipo === 'semanal' && andamentoWin && <option value={`__and__${andamentoWin.fim}`}>🔴 Semana atual (em andamento) · {ddmm(andamentoWin.ini)} → {ddmm(andamentoWin.fim)}</option>}
                {periodos.map(p => <option key={p.fim} value={p.fim}>{labelPeriodo(p)}</option>)}
              </select>
            </>
          )}
        </div>
        {andamento && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/15 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Prévia da <b>semana em andamento</b> ({ddmm(andamentoWin?.ini || ini || '')} → {ddmm(andamentoWin?.fim || fim || '')}): considera só itens de <b>Curva A</b> (contados todo dia). O fechamento completo entra na contagem de segunda-feira.</span>
          </div>
        )}

        <Tabs value={aba} onValueChange={setAba}>
          <TabsList>
            <TabsTrigger value="insumos"><Boxes className="w-4 h-4 mr-1.5" />Insumos</TabsTrigger>
            <TabsTrigger value="producoes"><ChefHat className="w-4 h-4 mr-1.5" />Produções</TabsTrigger>
            <TabsTrigger value="proteinas"><Drumstick className="w-4 h-4 mr-1.5" />Proteínas</TabsTrigger>
          </TabsList>

          {/* Busca */}
          <div className="relative mt-3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar…" className="pl-9" />
          </div>
          {/* Filtros (contadores clicáveis, igual /operacional/insumos): total, Curva A, área, dado faltando */}
          {(aba === 'insumos' || (aba === 'producoes' && tipo !== 'diaria')) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button onClick={() => { setSoCurvaA(false); setFiltroDado(null); setFiltroArea(null); }}><Badge variant="outline" className={`cursor-pointer ${!soCurvaA && !filtroDado && !filtroArea ? 'ring-1 ring-emerald-400' : ''}`}>{cntTotal} {aba === 'producoes' ? 'produções' : 'insumos'}</Badge></button>
              {tipo !== 'diaria' && cntCurvaA > 0 && <button onClick={() => { setSoCurvaA(true); setFiltroDado(null); setFiltroArea(null); }}><Badge variant="outline" className={`cursor-pointer text-indigo-600 border-indigo-300 ${soCurvaA ? 'ring-1 ring-indigo-400' : ''}`}>{cntCurvaA} curva A</Badge></button>}
              {aba === 'insumos' && areaList.length > 1 && areaList.map(([a, n]) => (
                <button key={a} onClick={() => setFiltroArea(f => f === a ? null : a)}><Badge variant="outline" className={`cursor-pointer ${filtroArea === a ? 'ring-1 ring-violet-400 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300' : 'text-gray-600 dark:text-gray-300'}`}>{n} {a}</Badge></button>
              ))}
              {aba === 'insumos' && cntSemContagem > 0 && <button onClick={() => setFiltroDado(f => f === 'sem_contagem' ? null : 'sem_contagem')}><Badge variant="outline" className={`cursor-pointer text-amber-700 dark:text-amber-400 border-amber-300 ${filtroDado === 'sem_contagem' ? 'ring-1 ring-amber-400 bg-amber-50 dark:bg-amber-900/20' : ''}`}>⚠ {cntSemContagem} sem contagem final</Badge></button>}
              {aba === 'insumos' && cntSemFicha > 0 && <button onClick={() => setFiltroDado(f => f === 'sem_ficha' ? null : 'sem_ficha')}><Badge variant="outline" className={`cursor-pointer text-amber-700 dark:text-amber-400 border-amber-300 ${filtroDado === 'sem_ficha' ? 'ring-1 ring-amber-400 bg-amber-50 dark:bg-amber-900/20' : ''}`}>⚠ {cntSemFicha} sem ficha</Badge></button>}
            </div>
          )}

          {/* ===== INSUMOS (VMarket → ContaHub, estoque âncora) ===== */}
          <TabsContent value="insumos" className="space-y-4 mt-3">

        <HeadCards head={h} />
        <AnaliseBlock analise={res?.analise} tipo={tipo} />

        {/* Tabela */}
        <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
              <th className="text-left font-medium px-3 py-2">Insumo</th>
              <th className="text-left font-medium px-3 py-2">Área</th>
              <th className="text-right font-medium px-3 py-2" title="Contagem no início do período">Estoque ini</th>
              <th className="text-right font-medium px-3 py-2">Compras</th>
              <th className="text-right font-medium px-3 py-2" title="Vendas × ficha técnica (consumo esperado)">Saída teórica</th>
              <th className="text-right font-medium px-3 py-2" title="Saída manual: lata que estourou, item que deu problema. Conta no fim do turno.">Desperdício</th>
              <th className="text-right font-medium px-3 py-2" title="ini + compras + produzido − saída teórica − desperdício">Estoque fim teórico</th>
              <th className="text-right font-medium px-3 py-2" title="Contagem do dia seguinte (estoque que sobrou de fato)">Estoque real</th>
              <th className="text-right font-medium px-3 py-2" title="Estoque real − estoque fim teórico (negativo = faltou)">Desvio (qtd)</th>
              <th className="text-right font-medium px-3 py-2">Desvio (R$)</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? <tr><td colSpan={10} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : itensView.length === 0 ? <tr><td colSpan={10} className="px-3 py-10 text-center text-gray-400">Sem dados nesse período.</td></tr>
              : itensView.map((it: any, i: number) => (
                <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 ${it.pendente ? 'bg-amber-50/60 dark:bg-amber-900/15' : it.suspeita ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                    {it.pendente && <span title="Produção sem o 'produzido' informado — desvio não confiável neste dia"><AlertTriangle className="w-3.5 h-3.5 inline text-amber-500 mr-1" /></span>}
                    {it.insumo_nome}{it.insumo_nome !== it.insumo_codigo && <span className="text-xs text-gray-400 font-mono ml-1">{it.insumo_codigo}</span>}
                    {it.is_producao && <Badge variant="outline" className="ml-1.5 text-[10px] text-indigo-600 border-indigo-300">produção</Badge>}
                  </td>
                  <td className="px-3 py-2"><Badge variant="outline">{it.area}</Badge></td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtQtd(it.estoque_ini)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtQtd(it.compra)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtQtd(it.saida_teorica)}</td>
                  <td className="px-3 py-2 text-right"><PencilCell value={it.desperdicio} fmt={fmtQtd} disabled={!editavel} onSave={(v) => salvar('desperdicio', it.insumo_codigo, { qtd: v })} /></td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtQtd(it.estoque_fim_teorico)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtQtd(it.estoque_fim_real)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${it.pendente ? 'text-gray-300' : it.desvio_qtd < 0 ? 'text-red-600 dark:text-red-400' : it.desvio_qtd > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{it.pendente ? '—' : `${it.desvio_qtd > 0 ? '+' : ''}${fmtQtd(it.desvio_qtd)}`}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${it.pendente ? 'text-gray-300' : it.desvio_rs < -10 ? 'text-red-600 dark:text-red-400' : it.desvio_rs > 10 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                    {it.pendente ? '—' : <>{it.desvio_rs < -10 ? <TrendingDown className="w-3 h-3 inline mr-0.5" /> : it.desvio_rs > 10 ? <TrendingUp className="w-3 h-3 inline mr-0.5" /> : null}{fmtBRL(it.desvio_rs)}</>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></CardContent></Card>
          </TabsContent>

          {/* ===== PRODUÇÕES (Controle de Produção → ContaHub) ===== */}
          <TabsContent value="producoes" className="space-y-3 mt-3">
            <HeadCards head={hProd} />
            <AnaliseBlock analise={res?.analise_producao} tipo={tipo} />
            <p className="text-xs text-gray-500 dark:text-gray-400">Balanço da produção: estoque ini + <b>Produzido</b> (fornadas na diária) − saída teórica (vendas×ficha) − desperdício. {editavel ? 'Na diária você lança as fornadas.' : 'Semanal/mensal somam as fornadas do dia.'} Diária só Curva A.</p>
            {/* Filtro Comida / Drinks (seção da produção: pc=Cozinha, pd=Bar) */}
            {(cntProdComida > 0 || cntProdDrinks > 0) && (
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setFiltroSecaoProd(null)}><Badge variant="outline" className={`cursor-pointer ${!filtroSecaoProd ? 'ring-1 ring-emerald-400' : 'text-gray-600 dark:text-gray-300'}`}>{prodBase.length} todas</Badge></button>
                {cntProdComida > 0 && <button onClick={() => setFiltroSecaoProd(f => f === 'Comida' ? null : 'Comida')}><Badge variant="outline" className={`cursor-pointer text-amber-700 dark:text-amber-400 border-amber-300 ${filtroSecaoProd === 'Comida' ? 'ring-1 ring-amber-400 bg-amber-50 dark:bg-amber-900/20' : ''}`}>🍳 {cntProdComida} Comida</Badge></button>}
                {cntProdDrinks > 0 && <button onClick={() => setFiltroSecaoProd(f => f === 'Drinks' ? null : 'Drinks')}><Badge variant="outline" className={`cursor-pointer text-sky-700 dark:text-sky-400 border-sky-300 ${filtroSecaoProd === 'Drinks' ? 'ring-1 ring-sky-400 bg-sky-50 dark:bg-sky-900/20' : ''}`}>🍸 {cntProdDrinks} Drinks</Badge></button>}
              </div>
            )}
            <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                  <th className="text-left font-medium px-3 py-2">Produção</th>
                  <th className="text-right font-medium px-3 py-2">Estoque ini</th>
                  <th className="text-right font-medium px-3 py-2" title="Produção feita no período. Na diária: nº de fornadas (× rendimento).">Produzido</th>
                  <th className="text-right font-medium px-3 py-2" title="Vendas × ficha técnica">Saída teórica</th>
                  <th className="text-right font-medium px-3 py-2">Desperdício</th>
                  <th className="text-right font-medium px-3 py-2" title="ini + produzido − saída teórica − desperdício">Estoque fim teórico</th>
                  <th className="text-right font-medium px-3 py-2">Estoque real</th>
                  <th className="text-right font-medium px-3 py-2">Desvio (qtd)</th>
                  <th className="text-right font-medium px-3 py-2">Desvio (R$)</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {loading ? <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                  : prodView.length === 0 ? <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400">Sem produção nesse período.</td></tr>
                  : prodView.map((it: any, i: number) => (
                    <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 ${it.pendente ? 'bg-amber-50/60 dark:bg-amber-900/15' : ''}`}>
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{it.pendente && <span title="Produção sem o 'produzido' informado — desvio não confiável"><AlertTriangle className="w-3.5 h-3.5 inline text-amber-500 mr-1" /></span>}{it.insumo_nome}<span className="text-xs text-gray-400 font-mono ml-1">{it.insumo_codigo}</span></td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtQtd(it.estoque_ini)}</td>
                      <td className="px-3 py-2 text-right"><PencilCell value={it.produzido} fmt={fmtQtd} disabled={!editavel} onSave={(v) => salvar('produzido', it.insumo_codigo, { qtd: v })} /></td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtQtd(it.saida_teorica)}</td>
                      <td className="px-3 py-2 text-right"><PencilCell value={it.desperdicio} fmt={fmtQtd} disabled={!editavel} onSave={(v) => salvar('desperdicio', it.insumo_codigo, { qtd: v })} /></td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtQtd(it.estoque_fim_teorico)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtQtd(it.estoque_fim_real)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${it.pendente ? 'text-gray-300' : it.desvio_qtd < 0 ? 'text-red-600 dark:text-red-400' : it.desvio_qtd > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{it.pendente ? '—' : `${it.desvio_qtd > 0 ? '+' : ''}${fmtQtd(it.desvio_qtd)}`}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-semibold ${it.pendente ? 'text-gray-300' : it.desvio_rs < -10 ? 'text-red-600 dark:text-red-400' : it.desvio_rs > 10 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{it.pendente ? '—' : fmtBRL(it.desvio_rs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></CardContent></Card>
          </TabsContent>

          {/* ===== PROTEÍNAS (VMarket → Utilizado Produção) ===== */}
          <TabsContent value="proteinas" className="space-y-3 mt-3">
            <HeadCards head={hProt} />
            <AnaliseBlock analise={protAnalise} tipo={tipo} />
            <p className="text-xs text-gray-500 dark:text-gray-400">Balanço da proteína: estoque ini + <b>Compras</b> (VMarket) − <b>Utilizado Produção</b> (fornadas × proteína na ficha — automático) − desperdício. Desvio negativo = faltou (perda/furo). Em kg.</p>
            <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                  <th className="text-left font-medium px-3 py-2">Proteína</th>
                  <th className="text-right font-medium px-3 py-2">Estoque ini</th>
                  <th className="text-right font-medium px-3 py-2" title="Compras VMarket no período">Compras</th>
                  <th className="text-right font-medium px-3 py-2" title="Entrou nas produções (fornadas × ficha)">Utilizado Produção</th>
                  <th className="text-right font-medium px-3 py-2">Desperdício</th>
                  <th className="text-right font-medium px-3 py-2" title="ini + compras − utilizado − desperdício">Estoque fim teórico</th>
                  <th className="text-right font-medium px-3 py-2">Estoque real</th>
                  <th className="text-right font-medium px-3 py-2">Desvio (qtd)</th>
                  <th className="text-right font-medium px-3 py-2">Desvio (R$)</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {loadingAba ? <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                  : protView.length === 0 ? <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400">Sem proteína (marque com o badge P em Insumos) comprada/contada nesse período.</td></tr>
                  : protView.map((it: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{it.insumo_nome}<span className="text-xs text-gray-400 font-mono ml-1">{it.insumo_cod}</span></td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtQtd(it.estoque_ini)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtQtd(it.comprou)}</td>
                      <td className="px-3 py-2 text-right"><PencilCell value={it.utilizado_producao} fmt={fmtQtd} disabled={!editavel} onSave={(v) => salvar('utilizado', it.insumo_cod, { qtd: v })} /></td>
                      <td className="px-3 py-2 text-right"><PencilCell value={it.desperdicio} fmt={fmtQtd} disabled={!editavel} onSave={(v) => salvar('desperdicio', it.insumo_cod, { qtd: v })} /></td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtQtd(it.estoque_fim_teorico)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtQtd(it.estoque_fim_real)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${it.desvio_qtd < -0.05 ? 'text-red-600 dark:text-red-400' : it.desvio_qtd > 0.05 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{it.desvio_qtd > 0 ? '+' : ''}{fmtQtd(it.desvio_qtd)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-semibold ${it.desvio_rs < -10 ? 'text-red-600 dark:text-red-400' : it.desvio_rs > 10 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{fmtBRL(it.desvio_rs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></CardContent></Card>
          </TabsContent>
        </Tabs>
    </PageShell>
  );
}
