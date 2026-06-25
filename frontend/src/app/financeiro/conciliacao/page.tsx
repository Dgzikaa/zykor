'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Scale, Loader2, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, ChevronDown, Banknote, CreditCard, Percent, CalendarClock, PieChart, ShieldAlert, ListChecks, Building2, Undo2 } from 'lucide-react';

type Row = {
  data: string; status: string; stone_cnpjs: string | null;
  contahub_cartao: number; stone_bruto: number; diferenca: number;
  stone_taxa: number; stone_liquido: number; stone_transacoes: number;
};

const BRAND: Record<number, string> = { 1: 'Visa', 2: 'Mastercard', 3: 'Amex', 4: 'Hipercard', 171: 'Elo' };
const ACCOUNT: Record<number, string> = { 1: 'Débito', 2: 'Crédito', 3: 'Voucher', 4: 'Private Label', 5: 'Outro', 99: 'Pix' };
const brandName = (id: any) => BRAND[Number(id)] || (id == null ? '—' : `Bandeira ${id}`);
const accountName = (id: any) => ACCOUNT[Number(id)] || (id == null ? '—' : `Tipo ${id}`);
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const fmtBRL = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const fmtNum = (v: any) => new Intl.NumberFormat('pt-BR').format(Number(v || 0));
const fmtData = (d: string) => { try { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y.slice(2)}`; } catch { return d; } };
const fmtHora = (iso: string) => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const pct = (taxa: number, bruto: number) => bruto > 0 ? `${(taxa / bruto * 100).toFixed(2)}%` : '—';

// Badge por DIREÇÃO (pedido do sócio). dif = ContaHub − Stone:
//   d > 0 = recebeu a MENOS (vendeu e não recebeu — possível BO) → vermelho.
//   d < 0 = recebeu a MAIS (ex.: venda fora do caixa não lançada no ContaHub) → amarelo.
const StatusBadge = ({ s, dif }: { s: string; dif?: any }) => {
  const d = Number(dif || 0);
  const b = (s === 'ok' || Math.abs(d) < 0.5)
    ? { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', txt: '● bate' }
    : d > 0
      ? { cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', txt: '▲ recebeu a menos' }
      : { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', txt: '◆ recebeu a mais' };
  return <span className={`text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap ${b.cls}`}>{b.txt}</span>;
};
const corDifStatus = (s: string) => s === 'ok' ? 'text-muted-foreground' : s === 'leve' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400 font-semibold';
// Gravidade por DIREÇÃO (pedido do sócio). diferenca = ContaHub − Stone:
//   ContaHub > Stone (dif > 0) = PROBLEMA (vermelho): venda lançada que a Stone não cobrou (dinheiro não entrou).
//   Stone > ContaHub (dif < 0) = OK-ish (amarelo): ex. estorno/ajuste lançado só no ContaHub.
const corGravidade = (dif: any, status: string): string => {
  const d = Number(dif || 0);
  if (status === 'ok' || Math.abs(d) < 0.5) return 'text-muted-foreground';
  return d > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold';
};

const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const labelMes = (ym: string) => { const [y, m] = ym.split('-'); return `${MESES_PT[Number(m) - 1]}/${y}`; };

const ABAS = [
  { id: 'conciliacao', label: 'Conciliação', icon: Scale },
  { id: 'conferencia', label: 'Conferência (NF × Stone × ContaHub)', icon: Building2 },
  { id: 'analises', label: 'Análises', icon: PieChart },
] as const;
type AbaId = typeof ABAS[number]['id'];

// Sub-abas dentro de "Análises" (Pendências, Taxas, Recebíveis, Mix, Chargebacks juntas).
const SUB_ANALISES = [
  { id: 'pendencias', label: 'Pendências', icon: ListChecks },
  { id: 'taxas', label: 'Taxas (MDR)', icon: Percent },
  { id: 'recebiveis', label: 'Recebíveis', icon: CalendarClock },
  { id: 'mix', label: 'Mix & Maquininhas', icon: PieChart },
  { id: 'chargebacks', label: 'Chargebacks', icon: ShieldAlert },
] as const;
type SubAnaliseId = typeof SUB_ANALISES[number]['id'];

// Detalhe expandível por dia: mantém só "Onde diverge" + "Transações que explicam a
// diferença". Por bandeira / Repasses / lista de Transações ficam ocultos por ora
// (msg do sócio jun/2026 — "vamos usar pra outra coisa"). Flag p/ reativar fácil.
const MOSTRAR_DETALHE_COMPLETO = false;

// barra horizontal simples (proporção do maior valor)
function Barra({ v, max, cor = 'bg-primary' }: { v: number; max: number; cor?: string }) {
  const w = max > 0 ? Math.max(2, (v / max) * 100) : 0;
  return <div className="h-2 rounded bg-muted/40"><div className={`h-2 rounded ${cor}`} style={{ width: `${w}%` }} /></div>;
}

export default function ConciliacaoPage() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();

  const [aba, setAba] = useState<AbaId>('conciliacao');
  const [analiseSub, setAnaliseSub] = useState<SubAnaliseId>('pendencias');
  const [meses, setMeses] = useState<string[]>([]);
  const [mesSel, setMesSel] = useState<string>('');
  const [cnpjs, setCnpjs] = useState<string[]>([]);

  const [status, setStatus] = useState<'' | 'ok' | 'verificar'>('');
  const [cnpj, setCnpj] = useState('');
  const [apenasDif, setApenasDif] = useState(false);
  const [usarRange, setUsarRange] = useState(false);
  const [rangeDe, setRangeDe] = useState('');
  const [rangeAte, setRangeAte] = useState('');

  const [rows, setRows] = useState<Row[]>([]);
  const [resumo, setResumo] = useState<any>(null);
  const [analise, setAnalise] = useState<any>(null);
  const [pendencias, setPendencias] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAn, setLoadingAn] = useState(false);
  const [loadingPend, setLoadingPend] = useState(false);
  const [nfStone, setNfStone] = useState<any[]>([]);
  const [contahubNf, setContahubNf] = useState<any[]>([]);
  const [loadingNfStone, setLoadingNfStone] = useState(false);
  const [loadingContahubNf, setLoadingContahubNf] = useState(false);
  const [confDia, setConfDia] = useState<string | null>(null);
  const [taxasModal, setTaxasModal] = useState<{ open: boolean; titulo: string; loading: boolean; rows: any[]; erro: string | null }>({ open: false, titulo: '', loading: false, rows: [], erro: null });

  const [aberto, setAberto] = useState<string | null>(null);
  const [diaCache, setDiaCache] = useState<Record<string, any>>({});
  const [diaLoading, setDiaLoading] = useState<string | null>(null);
  const [verTxAte, setVerTxAte] = useState<Record<string, number>>({});
  const [cardFiltro, setCardFiltro] = useState<'ok' | 'menos' | 'mais' | null>(null);
  const rowsView = useMemo(() => {
    if (!cardFiltro) return rows;
    return rows.filter((r: any) => cardFiltro === 'ok' ? r.status === 'ok'
      : cardFiltro === 'menos' ? (r.status !== 'ok' && Number(r.diferenca) > 0.5)
      : (r.status !== 'ok' && Number(r.diferenca) < -0.5));
  }, [rows, cardFiltro]);

  const periodo = useMemo(() => {
    if (usarRange && rangeDe && rangeAte) return { de: rangeDe, ate: rangeAte };
    if (mesSel) {
      const [y, m] = mesSel.split('-').map(Number);
      const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return { de: `${mesSel}-01`, ate: `${mesSel}-${String(ultimo).padStart(2, '0')}` };
    }
    return { de: '', ate: '' };
  }, [usarRange, rangeDe, rangeAte, mesSel]);

  const carregar = useCallback(async () => {
    if (!selectedBar) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (periodo.de) qs.set('de', periodo.de);
      if (periodo.ate) qs.set('ate', periodo.ate);
      if (status) qs.set('status', status);
      if (cnpj) qs.set('cnpj', cnpj);
      if (apenasDif) qs.set('apenas_dif', '1');
      const r = await api.get(`/api/financeiro/conciliacao?${qs.toString()}`);
      setRows(r.conciliacao || []);
      setResumo(r.resumo || null);
      if ((r.meses_disponiveis || []).length) setMeses(r.meses_disponiveis);
      if ((r.cnpjs_disponiveis || []).length) setCnpjs(r.cnpjs_disponiveis);
      if (!mesSel && !usarRange && (r.meses_disponiveis || []).length) setMesSel(r.meses_disponiveis[0]);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar conciliação', message: e?.message });
    } finally { setLoading(false); }
  }, [selectedBar, periodo, status, cnpj, apenasDif, mesSel, usarRange, showToast]);

  const carregarAnalise = useCallback(async () => {
    if (!selectedBar || !periodo.de) return;
    setLoadingAn(true);
    try {
      const r = await api.get(`/api/financeiro/conciliacao/analise?de=${periodo.de}&ate=${periodo.ate}`);
      setAnalise(r.analise || null);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar análises', message: e?.message });
    } finally { setLoadingAn(false); }
  }, [selectedBar, periodo, showToast]);

  const carregarPendencias = useCallback(async () => {
    if (!selectedBar || !periodo.de) return;
    setLoadingPend(true);
    try {
      const r = await api.get(`/api/financeiro/conciliacao/pendencias?de=${periodo.de}&ate=${periodo.ate}`);
      setPendencias(r.pendencias || []);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar pendências', message: e?.message });
    } finally { setLoadingPend(false); }
  }, [selectedBar, periodo, showToast]);

  const carregarNfStone = useCallback(async () => {
    if (!selectedBar || !periodo.de) return;
    setLoadingNfStone(true);
    try {
      const r = await api.get(`/api/financeiro/conciliacao/nf-stone-cnpj?de=${periodo.de}&ate=${periodo.ate}`);
      setNfStone(r.linhas || []);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar NF × Stone', message: e?.message });
    } finally { setLoadingNfStone(false); }
  }, [selectedBar, periodo, showToast]);

  const carregarContahubNf = useCallback(async () => {
    if (!selectedBar || !periodo.de) return;
    setLoadingContahubNf(true);
    try {
      const r = await api.get(`/api/financeiro/conciliacao/contahub-nf?de=${periodo.de}&ate=${periodo.ate}`);
      setContahubNf(r.linhas || []);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar ContaHub × NF', message: e?.message });
    } finally { setLoadingContahubNf(false); }
  }, [selectedBar, periodo, showToast]);

  const abrirTaxasDia = useCallback(async (brandId: any, accountType: any) => {
    if (!selectedBar || !periodo.de) return;
    setTaxasModal({ open: true, titulo: `${brandName(brandId)} · ${accountName(accountType)}`, loading: true, rows: [], erro: null });
    try {
      const qs = new URLSearchParams({ de: periodo.de, ate: periodo.ate });
      if (brandId !== null && brandId !== undefined) qs.set('brand_id', String(brandId));
      if (accountType !== null && accountType !== undefined) qs.set('account_type', String(accountType));
      const r = await api.get(`/api/financeiro/conciliacao/taxas-dia?${qs.toString()}`);
      setTaxasModal(m => ({ ...m, loading: false, rows: r.dias || [] }));
    } catch (e: any) {
      setTaxasModal(m => ({ ...m, loading: false, erro: e?.message || 'Erro ao carregar' }));
    }
  }, [selectedBar, periodo]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (aba === 'analises' && analiseSub !== 'pendencias') carregarAnalise(); }, [aba, analiseSub, carregarAnalise]);
  useEffect(() => { if (aba === 'analises' && analiseSub === 'pendencias') carregarPendencias(); }, [aba, analiseSub, carregarPendencias]);
  useEffect(() => { if (aba === 'conferencia') { carregarContahubNf(); carregarNfStone(); } }, [aba, carregarContahubNf, carregarNfStone]);

  const abrirDia = useCallback(async (data: string) => {
    if (aberto === data) { setAberto(null); return; }
    setAberto(data);
    if (diaCache[data]) return;
    setDiaLoading(data);
    try {
      const r = await api.get(`/api/financeiro/conciliacao/dia?data=${data}`);
      setDiaCache((prev) => ({ ...prev, [data]: r }));
      setVerTxAte((prev) => ({ ...prev, [data]: 50 }));
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao abrir o dia', message: e?.message });
      setAberto(null);
    } finally { setDiaLoading(null); }
  }, [aberto, diaCache, showToast]);

  const mesIdx = meses.indexOf(mesSel);
  const irMes = (delta: number) => {
    const i = mesIdx + delta;
    if (i >= 0 && i < meses.length) { setUsarRange(false); setMesSel(meses[i]); setAberto(null); }
  };

  // ---- derivados das análises ----
  const an = analise;
  const totais = an?.totais;
  const bandeiras = (an?.por_bandeira || []) as any[];
  const mixTipo = useMemo(() => {
    const m = new Map<string, number>();
    let tot = 0;
    for (const b of bandeiras) { const k = accountName(b.account_type); m.set(k, (m.get(k) || 0) + Number(b.bruto)); tot += Number(b.bruto); }
    return { itens: Array.from(m, ([nome, bruto]) => ({ nome, bruto, perc: tot > 0 ? bruto / tot * 100 : 0 })).sort((a, b) => b.bruto - a.bruto), tot };
  }, [bandeiras]);
  const mixBandeira = useMemo(() => {
    const m = new Map<string, number>();
    let tot = 0;
    for (const b of bandeiras) { const k = brandName(b.brand_id); m.set(k, (m.get(k) || 0) + Number(b.bruto)); tot += Number(b.bruto); }
    return Array.from(m, ([nome, bruto]) => ({ nome, bruto, perc: tot > 0 ? bruto / tot * 100 : 0 })).sort((a, b) => b.bruto - a.bruto);
  }, [bandeiras]);
  const ticketMedio = totais && totais.qtd > 0 ? Number(totais.bruto) / Number(totais.qtd) : 0;
  const mdrMedio = totais && Number(totais.bruto) > 0 ? Number(totais.taxa) / Number(totais.bruto) * 100 : 0;

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-3 py-5 max-w-6xl">
        <div className="flex items-center gap-2 mb-1">
          <Scale className="w-5 h-5" /><h1 className="text-xl font-bold">Conciliação & Análise Stone</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-3">Cartão (ContaHub) × Stone por dia operacional, taxas, recebíveis e mix.</p>

        {/* Período + filtros (compartilhado) */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="inline-flex items-center rounded-lg border bg-background shadow-sm">
            <button onClick={() => irMes(+1)} disabled={mesIdx < 0 || mesIdx >= meses.length - 1} title="Mês anterior"
              className="px-2.5 py-2 rounded-l-lg hover:bg-muted disabled:opacity-25 disabled:hover:bg-transparent transition-colors">
              <ChevronLeft className="w-4 h-4" /></button>
            <div className="relative border-x">
              <select value={usarRange ? '' : mesSel} onChange={(e) => { setUsarRange(false); setMesSel(e.target.value); setAberto(null); }}
                className="appearance-none text-sm font-semibold px-3 py-2 pr-7 bg-transparent cursor-pointer focus:outline-none min-w-[150px] capitalize">
                {meses.map((m) => <option key={m} value={m}>{labelMes(m)}</option>)}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
            </div>
            <button onClick={() => irMes(-1)} disabled={mesIdx <= 0} title="Mês seguinte"
              className="px-2.5 py-2 rounded-r-lg hover:bg-muted disabled:opacity-25 disabled:hover:bg-transparent transition-colors">
              <ChevronRight className="w-4 h-4" /></button>
          </div>
          <label className="flex items-center gap-1.5 text-sm border rounded px-2 py-1.5 cursor-pointer hover:bg-muted/50">
            <input type="checkbox" checked={usarRange} onChange={(e) => { setUsarRange(e.target.checked); setAberto(null); }} />Intervalo custom
          </label>
          {usarRange && (
            <div className="flex items-center gap-1">
              <input type="date" value={rangeDe} onChange={(e) => setRangeDe(e.target.value)} className="text-sm border rounded px-2 py-1.5 bg-background" />
              <span className="text-muted-foreground text-xs">até</span>
              <input type="date" value={rangeAte} onChange={(e) => setRangeAte(e.target.value)} className="text-sm border rounded px-2 py-1.5 bg-background" />
            </div>
          )}
        </div>

        {/* Abas */}
        <div className="flex gap-1 border-b mb-4 overflow-x-auto">
          {ABAS.map((t) => {
            const Icon = t.icon; const ativo = aba === t.id;
            return (
              <button key={t.id} onClick={() => setAba(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${ativo ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                <Icon className="w-4 h-4" />{t.label}
              </button>
            );
          })}
        </div>

        {/* ===================== ABA CONCILIAÇÃO ===================== */}
        {aba === 'conciliacao' && (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="text-sm border rounded px-2 py-1.5 bg-background">
                <option value="">Status: todos</option><option value="ok">● Batendo</option><option value="leve">◆ Pequena dif.</option><option value="verificar">▲ A verificar</option>
              </select>
              {cnpjs.length > 1 && (
                <select value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="text-sm border rounded px-2 py-1.5 bg-background max-w-[180px]">
                  <option value="">CNPJ: todos</option>{cnpjs.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <label className="flex items-center gap-1.5 text-sm border rounded px-2 py-1.5 cursor-pointer hover:bg-muted/50">
                <input type="checkbox" checked={apenasDif} onChange={(e) => setApenasDif(e.target.checked)} />Só diferenças ≠ 0
              </label>
            </div>

            {resumo && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Dias</div><div className="text-lg font-bold">{resumo.dias}</div></CardContent></Card>
                <Card onClick={() => setCardFiltro((f) => f === 'ok' ? null : 'ok')} className={`cursor-pointer transition hover:bg-muted/30 ${cardFiltro === 'ok' ? 'ring-2 ring-emerald-500' : ''}`}><CardContent className="py-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-600" />Batendo</div><div className="text-lg font-bold text-emerald-600">{resumo.ok}</div></CardContent></Card>
                <Card onClick={() => setCardFiltro((f) => f === 'menos' ? null : 'menos')} className={`cursor-pointer transition hover:bg-muted/30 ${cardFiltro === 'menos' ? 'ring-2 ring-red-500' : ''}`}><CardContent className="py-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-600" />Recebeu a menos</div><div className="text-lg font-bold text-red-600" title="ContaHub > Stone — vendeu e não recebeu (possível BO)">{rows.filter((x: any) => x.status !== 'ok' && Number(x.diferenca) > 0.5).length}</div></CardContent></Card>
                <Card onClick={() => setCardFiltro((f) => f === 'mais' ? null : 'mais')} className={`cursor-pointer transition hover:bg-muted/30 ${cardFiltro === 'mais' ? 'ring-2 ring-amber-500' : ''}`}><CardContent className="py-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-600" />Recebeu a mais</div><div className="text-lg font-bold text-amber-600" title="Stone > ContaHub — ex.: venda fora do caixa não lançada">{rows.filter((x: any) => x.status !== 'ok' && Number(x.diferenca) < -0.5).length}</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Stone bruto</div><div className="text-base font-bold">{fmtBRL(resumo.stone_bruto_total)}</div></CardContent></Card>
              </div>
            )}

            {loading ? <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
            : rowsView.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground"><Scale className="w-9 h-9 mx-auto mb-2 opacity-40" />{cardFiltro ? <>Nenhum dia com esse status. <button onClick={() => setCardFiltro(null)} className="text-primary hover:underline">Limpar filtro</button></> : 'Sem dados no período.'}</CardContent></Card>
            : (
              <Card className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b"><tr>
                    <th className="px-3 py-2 w-8"></th><th className="text-left px-3 py-2">Dia</th><th className="text-left px-3 py-2">Status</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">ContaHub</th><th className="text-right px-3 py-2 whitespace-nowrap">Stone bruto</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">Dif. (Stone−CH)</th>
                  </tr></thead>
                  <tbody>
                    {rowsView.map((r) => {
                      const dia = diaCache[r.data]; const lim = verTxAte[r.data] || 50;
                      return (
                        <Fragment key={r.data}>
                          <tr onClick={() => abrirDia(r.data)} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer">
                            <td className="px-3 py-1.5"><ChevronDown className={`w-4 h-4 transition-transform ${aberto === r.data ? 'rotate-180' : ''}`} /></td>
                            <td className="px-3 py-1.5 whitespace-nowrap font-medium">{fmtData(r.data)}</td>
                            <td className="px-3 py-1.5"><StatusBadge s={r.status} dif={r.diferenca} /></td>
                            <td className="px-3 py-1.5 text-right whitespace-nowrap">{fmtBRL(r.contahub_cartao)}</td>
                            <td className="px-3 py-1.5 text-right whitespace-nowrap">{fmtBRL(r.stone_bruto)}</td>
                            <td className={`px-3 py-1.5 text-right whitespace-nowrap ${corGravidade(r.diferenca, r.status)}`}>{fmtBRL(-Number(r.diferenca || 0))}</td>
                          </tr>
                          {aberto === r.data && (
                            <tr className="border-b bg-muted/20"><td colSpan={6} className="px-3 py-3">
                              {diaLoading === r.data ? <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
                              : dia ? (
                                <div className="space-y-4">
                                  {dia.conciliacao && (
                                    <div>
                                      <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><Scale className="w-3.5 h-3.5" />Onde diverge (ContaHub × Stone)</div>
                                      <div className="overflow-x-auto"><table className="text-xs w-full max-w-md">
                                        <thead className="text-muted-foreground"><tr><th className="text-left py-1 pr-3">Tipo</th><th className="text-right py-1 pr-3">ContaHub</th><th className="text-right py-1 pr-3">Stone</th><th className="text-right py-1">Dif. (Stone−CH)</th></tr></thead>
                                        <tbody>{dia.conciliacao.linhas.map((l: any, i: number) => {
                                          const ok = Math.abs(l.dif) < 0.5; const total = l.tipo === 'Total';
                                          return (<tr key={i} className={`border-t border-border/50 ${total ? 'font-semibold' : ''}`}>
                                            <td className="py-1 pr-3">{l.tipo}</td>
                                            <td className="py-1 pr-3 text-right">{fmtBRL(l.contahub)}</td>
                                            <td className="py-1 pr-3 text-right">{fmtBRL(l.stone)}</td>
                                            <td className={`py-1 text-right ${ok ? 'text-muted-foreground' : (Number(l.dif) > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold')}`}>{fmtBRL(-Number(l.dif || 0))}{!ok && ' ◀'}</td>
                                          </tr>);
                                        })}</tbody>
                                      </table></div>
                                      <p className="text-[11px] text-muted-foreground mt-1"><span className="text-red-600 dark:text-red-400 font-medium">◀ vermelho = ContaHub &gt; Stone</span> (recebeu a MENOS — vendeu e não recebeu, possível BO). <span className="text-amber-600 dark:text-amber-400 font-medium">◀ âmbar = Stone &gt; ContaHub</span> (recebeu a MAIS — ex.: venda fora do caixa não lançada). ContaHub crédito = vendas Cred; Stone crédito = bandeira créd/private label.</p>
                                    </div>
                                  )}

                                  {dia.divergencias && (dia.divergencias.so_stone.length > 0 || dia.divergencias.so_ch.length > 0) && (
                                    <div className="rounded border border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-900/10 p-2">
                                      <div className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Transações que explicam a diferença (casadas por tipo + valor)</div>
                                      <div className="grid md:grid-cols-2 gap-3">
                                        <div>
                                          <div className="text-[11px] font-medium text-muted-foreground mb-1">Só na Stone — cobrado, faltando no ContaHub ({dia.divergencias.resumo.so_stone_qtd} · {fmtBRL(dia.divergencias.resumo.so_stone_valor)})</div>
                                          {dia.divergencias.so_stone.length === 0 ? <div className="text-[11px] text-muted-foreground">—</div> : (
                                            <table className="text-[11px] w-full"><thead className="text-muted-foreground"><tr><th className="text-left py-0.5 pr-2">Hora</th><th className="text-left py-0.5 pr-2">Tipo</th><th className="text-left py-0.5 pr-2">Bandeira</th><th className="text-left py-0.5 pr-2">Cartão</th><th className="text-right py-0.5">Valor</th></tr></thead>
                                              <tbody>{dia.divergencias.so_stone.map((t: any, i: number) => { const est = Number(t.valor) < 0; return (<tr key={i} className={`border-t border-border/40 ${est ? 'bg-amber-100/70 dark:bg-amber-900/20' : ''}`}><td className="py-0.5 pr-2 text-muted-foreground">{fmtHora(t.hora)}</td><td className="py-0.5 pr-2">{est && <span className="text-amber-700 dark:text-amber-300 font-semibold mr-1">estorno</span>}{t.tipo}</td><td className="py-0.5 pr-2">{brandName(t.brand_id)}</td><td className="py-0.5 pr-2 font-mono">{t.cartao}</td><td className="py-0.5 text-right font-medium">{est ? <span className="text-amber-700 dark:text-amber-300 font-bold inline-flex items-center gap-1" title="Estorno/ajuste — investigar se era pra estornar mesmo"><Undo2 className="w-3.5 h-3.5" />{fmtBRL(t.valor)}</span> : fmtBRL(t.valor)}</td></tr>); })}</tbody>
                                            </table>
                                          )}
                                        </div>
                                        <div>
                                          <div className="text-[11px] font-medium text-muted-foreground mb-1">Só no ContaHub — lançado, faltando na Stone ({dia.divergencias.resumo.so_ch_qtd} · {fmtBRL(dia.divergencias.resumo.so_ch_valor)})</div>
                                          {dia.divergencias.so_ch.length === 0 ? <div className="text-[11px] text-muted-foreground">—</div> : (
                                            <table className="text-[11px] w-full"><thead className="text-muted-foreground"><tr><th className="text-left py-0.5 pr-2">Tipo</th><th className="text-left py-0.5 pr-2">Cliente</th><th className="text-left py-0.5 pr-2">Mesa</th><th className="text-left py-0.5 pr-2">Meio</th><th className="text-right py-0.5">Valor</th></tr></thead>
                                              <tbody>{dia.divergencias.so_ch.map((t: any, i: number) => { const est = Number(t.valor) < 0; return (<tr key={i} className={`border-t border-border/40 ${est ? 'bg-amber-100/70 dark:bg-amber-900/20' : ''}`}><td className="py-0.5 pr-2">{est && <span className="text-amber-700 dark:text-amber-300 font-semibold mr-1">estorno</span>}{t.tipo}</td><td className="py-0.5 pr-2">{t.cliente || '—'}</td><td className="py-0.5 pr-2 text-muted-foreground">{t.mesa || '—'}</td><td className="py-0.5 pr-2 text-muted-foreground">{t.meio || '—'}</td><td className="py-0.5 text-right font-medium">{est ? <span className="text-amber-700 dark:text-amber-300 font-bold inline-flex items-center gap-1" title="Estorno/ajuste — investigar se era pra estornar mesmo"><Undo2 className="w-3.5 h-3.5" />{fmtBRL(t.valor)}</span> : fmtBRL(t.valor)}</td></tr>); })}</tbody>
                                            </table>
                                          )}
                                        </div>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground mt-2">Match por tipo + valor (ContaHub não fornece NSU/autorização). <span className="text-amber-700 dark:text-amber-300 font-medium">↩ estorno (valor negativo)</span> = venda cancelada/ajustada de um lado mas não do outro — investigar se era pra estornar mesmo ou se o cliente acabou pago.</p>
                                    </div>
                                  )}

                                  {MOSTRAR_DETALHE_COMPLETO && (<>
                                  <div>
                                    <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" />Por bandeira</div>
                                    <div className="overflow-x-auto"><table className="text-xs w-full">
                                      <thead className="text-muted-foreground"><tr><th className="text-left py-1 pr-3">Bandeira</th><th className="text-left py-1 pr-3">Tipo</th><th className="text-right py-1 pr-3">Qtd</th><th className="text-right py-1 pr-3">Bruto</th><th className="text-right py-1 pr-3">Taxa</th><th className="text-right py-1">Líquido</th></tr></thead>
                                      <tbody>{dia.por_bandeira.map((b: any, i: number) => (
                                        <tr key={i} className="border-t border-border/50"><td className="py-1 pr-3 font-medium">{b.bandeira}</td><td className="py-1 pr-3 text-muted-foreground">{b.tipo}</td><td className="py-1 pr-3 text-right">{b.qtd}</td><td className="py-1 pr-3 text-right">{fmtBRL(b.bruto)}</td><td className="py-1 pr-3 text-right text-muted-foreground">{fmtBRL(b.taxa)}</td><td className="py-1 text-right">{fmtBRL(b.liquido)}</td></tr>
                                      ))}</tbody>
                                    </table></div>
                                  </div>
                                  {dia.repasses.length > 0 && (
                                    <div>
                                      <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><Banknote className="w-3.5 h-3.5" />Repasses ({dia.repasses.length}) · {fmtBRL(dia.resumo.repasses_total)}</div>
                                      <div className="overflow-x-auto"><table className="text-xs w-full">
                                        <thead className="text-muted-foreground"><tr><th className="text-left py-1 pr-3">Pagamento</th><th className="text-left py-1 pr-3">Conta destino</th><th className="text-right py-1">Valor</th></tr></thead>
                                        <tbody>{dia.repasses.map((p: any, i: number) => (<tr key={i} className="border-t border-border/50"><td className="py-1 pr-3 text-muted-foreground">{p.payment_id}</td><td className="py-1 pr-3">{p.conta}</td><td className="py-1 text-right font-medium">{fmtBRL(p.valor)}</td></tr>))}</tbody>
                                      </table></div>
                                    </div>
                                  )}
                                  <div>
                                    <div className="text-xs font-semibold text-muted-foreground mb-1">Transações ({dia.resumo.transacoes}){dia.resumo.chargebacks > 0 && <span className="ml-2 text-red-600">· {dia.resumo.chargebacks} chargeback(s)</span>}{dia.divergencias?.resumo?.so_stone_qtd > 0 && <span className="ml-2 text-red-600">· {dia.divergencias.resumo.so_stone_qtd} sem par no ContaHub (em vermelho)</span>}</div>
                                    <div className="overflow-x-auto"><table className="text-xs w-full">
                                      <thead className="text-muted-foreground"><tr><th className="text-left py-1 pr-3">Hora</th><th className="text-left py-1 pr-3">Bandeira</th><th className="text-left py-1 pr-3">Tipo</th><th className="text-left py-1 pr-3">Cartão</th><th className="text-right py-1 pr-3">Bruto</th><th className="text-right py-1 pr-3">Taxa</th><th className="text-right py-1 pr-3">Líquido</th><th className="text-left py-1 pr-3">Prev.</th><th className="text-left py-1">Maquininha</th></tr></thead>
                                      <tbody>{dia.transacoes.slice(0, lim).map((t: any, i: number) => (
                                        <tr key={i} className={`border-t border-border/50 ${t.suspeita ? 'bg-red-50 dark:bg-red-900/15 border-l-2 border-l-red-500' : t.chargeback ? 'bg-red-50/60 dark:bg-red-900/10' : ''}`}>
                                          <td className="py-1 pr-3 text-muted-foreground">{t.suspeita && <span className="text-red-600 mr-1" title="Sem par no ContaHub">⚠</span>}{fmtHora(t.hora)}</td><td className="py-1 pr-3 font-medium">{t.bandeira}</td>
                                          <td className="py-1 pr-3 text-muted-foreground">{t.tipo}{t.parcelas > 1 ? ` ${t.parcelas}x` : ''}</td>
                                          <td className="py-1 pr-3 text-muted-foreground font-mono text-[10px]">{t.cartao}</td>
                                          <td className={`py-1 pr-3 text-right ${t.suspeita ? 'text-red-600 font-semibold' : ''}`}>{fmtBRL(t.bruto)}</td><td className="py-1 pr-3 text-right text-muted-foreground">{fmtBRL(t.taxa)}</td><td className="py-1 pr-3 text-right">{fmtBRL(t.liquido)}</td>
                                          <td className="py-1 pr-3 text-muted-foreground">{t.previsao ? fmtData(t.previsao) : '—'}</td>
                                          <td className="py-1 text-muted-foreground font-mono text-[10px]">{t.maquininha || '—'}{t.chargeback && <span className="ml-1 text-red-600">CB</span>}{t.suspeita && <span className="ml-1 text-red-600">sem par</span>}</td>
                                        </tr>))}</tbody>
                                    </table></div>
                                    {dia.transacoes.length > lim && <button onClick={() => setVerTxAte((p) => ({ ...p, [r.data]: lim + 100 }))} className="mt-2 text-xs text-primary hover:underline">Ver mais ({dia.transacoes.length - lim} restantes)</button>}
                                  </div>
                                  </>)}
                                </div>
                              ) : null}
                            </td></tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}
          </>
        )}

        {/* ===================== ABA CONFERÊNCIA (NF × Stone × ContaHub) ===================== */}
        {aba === 'conferencia' && (
          (loadingContahubNf || loadingNfStone) ? <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
          : contahubNf.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground"><Building2 className="w-9 h-9 mx-auto mb-2 opacity-40" />Sem dados no período.</CardContent></Card>
          : (() => {
              const cnpjPorDia: Record<string, any[]> = {};
              const cnpjMap = new Map<number, { cnpj_indice: number; cnpj_label: string; cnpj_documento: string }>();
              nfStone.forEach((r: any) => {
                (cnpjPorDia[r.data] ??= []).push(r);
                if (!cnpjMap.has(r.cnpj_indice)) cnpjMap.set(r.cnpj_indice, { cnpj_indice: r.cnpj_indice, cnpj_label: r.cnpj_label, cnpj_documento: r.cnpj_documento });
              });
              const cnpjsDoBar = Array.from(cnpjMap.values()).sort((a, b) => a.cnpj_indice - b.cnpj_indice);
              // Totais do MÊS por CNPJ (igual tinha antes).
              const porCnpjMes: Record<number, { label: string; doc: string; nf: number; stone: number }> = {};
              nfStone.forEach((r: any) => {
                const k = r.cnpj_indice;
                if (!porCnpjMes[k]) porCnpjMes[k] = { label: r.cnpj_label, doc: r.cnpj_documento, nf: 0, stone: 0 };
                porCnpjMes[k].nf += Number(r.nf_autorizado || 0);
                porCnpjMes[k].stone += Number(r.stone_bruto || 0);
              });
              // Dias com venda (NF ou Stone) nos 2 CNPJs → ⚠ (possível venda no CNPJ errado).
              const ativPorDia: Record<string, number> = {};
              nfStone.forEach((r: any) => { if (Number(r.nf_autorizado || 0) > 0 || Number(r.stone_bruto || 0) > 0) ativPorDia[r.data] = (ativPorDia[r.data] || 0) + 1; });
              const diasDoisCnpjs = new Set(Object.keys(ativPorDia).filter((d) => ativPorDia[d] >= 2));
              const frac = (a: number, b: number) => { const m = Math.max(Math.abs(a), Math.abs(b), 1); return Math.abs(a - b) / m; };
              const corOk = (f: number) => f > 0.05 ? 'text-red-600 dark:text-red-400 font-semibold' : f > 0.005 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
              const t = contahubNf.reduce((a: any, r: any) => ({ stone: a.stone + Number(r.stone_bruto || 0), cartao: a.cartao + Number(r.contahub_cartao || 0), nf: a.nf + Number(r.nf_autorizado || 0), total: a.total + Number(r.contahub_total || 0) }), { stone: 0, cartao: 0, nf: 0, total: 0 });
              // Flag principal: venda Stone > NF emitida (POR CNPJ) = vendeu mais do que emitiu. Soma o excedente do dia.
              const TOL = 0.5; // verde só quando a NF cobre a Stone (ignora só centavos de arredondamento)
              const gapStoneDia = (d: string) => (cnpjPorDia[d] || []).reduce((s: number, c: any) => s + Math.max(0, Number(c.stone_bruto || 0) - Number(c.nf_autorizado || 0)), 0);
              const subem = Object.keys(cnpjPorDia).reduce((a: any, d: string) => { const g = gapStoneDia(d); return g > TOL ? { dias: a.dias + 1, total: a.total + g } : a; }, { dias: 0, total: 0 });
              return (
                <>
                  <p className="text-xs text-muted-foreground mb-3">Conferência por dia (base gerencial): <strong>NF emitida × ContaHub-total</strong> — emitiu nota de tudo? NF abaixo do ContaHub = <span className="text-amber-600 dark:text-amber-400 font-medium">falta de emissão</span> (menos grave). <span className="text-amber-600 dark:text-amber-400 font-medium">⚠ no dia = teve venda nos 2 CNPJs</span> — confira se não vendeu/emitiu no CNPJ errado. Cartão Stone × ContaHub fica na aba <strong>Conciliação</strong>. Clique no dia p/ abrir os 2 CNPJs.</p>
                  {subem.dias > 0 && (
                    <Card className="mb-3 border-red-300 dark:border-red-800 bg-red-50/60 dark:bg-red-900/10">
                      <CardContent className="py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                        <span className="flex items-center gap-1.5 font-semibold text-red-700 dark:text-red-300"><AlertTriangle className="w-4 h-4" />Alertas fiscais</span>
                        <span><strong className="text-red-600 dark:text-red-400">{subem.dias}</strong> {subem.dias === 1 ? 'dia' : 'dias'} com <strong>venda Stone acima da NF</strong> · {fmtBRL(subem.total)}</span>
                      </CardContent>
                    </Card>
                  )}
                  {/* Totais do mês por CNPJ (igual antes) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {cnpjsDoBar.map((cj, i) => { const p = porCnpjMes[cj.cnpj_indice] || { nf: 0, stone: 0 }; return (
                      <Card key={i}><CardContent className="py-3">
                        <div className="text-xs font-medium mb-1">{cj.cnpj_label} <span className="text-muted-foreground">({cj.cnpj_documento})</span></div>
                        <div className="flex gap-6">
                          <div><div className="text-[11px] text-muted-foreground">NF emitida (mês)</div><div className="text-base font-bold">{fmtBRL(p.nf)}</div></div>
                          <div><div className="text-[11px] text-muted-foreground">Venda Stone (mês)</div><div className="text-base font-bold">{fmtBRL(p.stone)}</div></div>
                        </div>
                      </CardContent></Card>
                    ); })}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Venda Stone</div><div className="text-base font-bold">{fmtBRL(t.stone)}</div></CardContent></Card>
                    <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">NF emitida</div><div className="text-base font-bold">{fmtBRL(t.nf)}</div></CardContent></Card>
                    <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">ContaHub total</div><div className="text-base font-bold">{fmtBRL(t.total)}</div></CardContent></Card>
                  </div>
                  <Card className="p-0 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground border-b"><tr>
                        <th className="px-3 py-2 w-8"></th><th className="text-left px-3 py-2">Dia</th>
                        <th className="text-right px-3 py-2 whitespace-nowrap border-l">Venda Stone</th>
                        <th className="text-right px-3 py-2 whitespace-nowrap border-l">NF emitida</th><th className="text-right px-3 py-2 whitespace-nowrap">CH total</th>
                        <th className="text-left px-3 py-2">Diagnóstico</th>
                      </tr></thead>
                      <tbody>
                        {contahubNf.map((r: any) => {
                          const stone = Number(r.stone_bruto || 0), nf = Number(r.nf_autorizado || 0), total = Number(r.contahub_total || 0);
                          const fNT = frac(nf, total);
                          // Venda Stone > NF emitida (em qualquer CNPJ, ou no total do dia) = VERMELHO, mostrando o valor.
                          // 2 CNPJs sem isso = amarelo (conferir).
                          const cnpjsDia = cnpjPorDia[r.data] || [];
                          const dois = diasDoisCnpjs.has(r.data);
                          const gapStone = cnpjsDia.reduce((s: number, c: any) => s + Math.max(0, Number(c.stone_bruto || 0) - Number(c.nf_autorizado || 0)), 0);
                          const excedenteStone = Math.max(gapStone, stone - nf);
                          let diag = '🟢 OK', diagCls = 'text-emerald-600 dark:text-emerald-400';
                          if (excedenteStone > TOL) { diag = `🔴 ${fmtBRL(-excedenteStone)}`; diagCls = 'text-red-600 dark:text-red-400 font-semibold'; }
                          else if (dois) { diag = '🟡 2 CNPJs · conferir'; diagCls = 'text-amber-600 dark:text-amber-400 font-medium'; }
                          else if (fNT > 0.05 && nf < total) { diag = '🟡 NF a emitir'; diagCls = 'text-amber-600 dark:text-amber-400 font-medium'; }
                          else if (fNT > 0.05 && nf > total) { diag = '🔴 NF acima do ContaHub'; diagCls = 'text-red-600 dark:text-red-400 font-medium'; }
                          const aberto = confDia === r.data;
                          return (
                            <Fragment key={r.data}>
                              <tr onClick={() => setConfDia(aberto ? null : r.data)} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer">
                                <td className="px-3 py-1.5">{cnpjsDoBar.length > 0 && <ChevronDown className={`w-4 h-4 transition-transform ${aberto ? 'rotate-180' : ''}`} />}</td>
                                <td className="px-3 py-1.5 whitespace-nowrap font-medium">{diasDoisCnpjs.has(r.data) && <AlertTriangle className="inline w-3.5 h-3.5 text-amber-500 mr-1 align-text-bottom" />}{fmtData(r.data)}</td>
                                <td className="px-3 py-1.5 text-right whitespace-nowrap border-l">{fmtBRL(stone)}</td>
                                <td className="px-3 py-1.5 text-right whitespace-nowrap border-l">{fmtBRL(nf)}</td>
                                <td className={`px-3 py-1.5 text-right whitespace-nowrap ${corOk(fNT)}`}>{fmtBRL(total)}</td>
                                <td className={`px-3 py-1.5 text-xs whitespace-nowrap ${diagCls}`}>{diag}</td>
                              </tr>
                              {aberto && cnpjsDoBar.map((cj) => {
                                const c = (cnpjPorDia[r.data] || []).find((x: any) => x.cnpj_indice === cj.cnpj_indice);
                                const nfv = Number(c?.nf_autorizado || 0), stv = Number(c?.stone_bruto || 0);
                                const cardSemNf = stv - nfv > 0.5; // Stone (cartão) acima da NF nesse CNPJ → possível CNPJ errado / NF não emitida
                                return (
                                  <tr key={`${r.data}-${cj.cnpj_indice}`} className="bg-muted/20 text-xs border-b last:border-0">
                                    <td></td>
                                    <td className="px-3 py-1 pl-7 text-muted-foreground whitespace-nowrap">↳ {cj.cnpj_label} <span className="opacity-70">({cj.cnpj_documento})</span></td>
                                    <td className="px-3 py-1 text-right whitespace-nowrap border-l">{fmtBRL(stv)}</td>
                                    <td className="px-3 py-1 text-right whitespace-nowrap border-l">{fmtBRL(nfv)}</td>
                                    <td className="px-3 py-1 text-right whitespace-nowrap text-muted-foreground/50">—</td>
                                    <td className={`px-3 py-1 whitespace-nowrap ${cardSemNf ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'}`}>{cardSemNf && '🚨 '}NF − Stone: {fmtBRL(nfv - stv)}</td>
                                  </tr>
                                );
                              })}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </Card>
                </>
              );
            })()
        )}


        {/* ===================== ABA ANÁLISES (sub-abas) ===================== */}
        {aba === 'analises' && (
          <div className="flex flex-wrap gap-1.5 mb-4 border-b pb-3">
            {SUB_ANALISES.map((s) => {
              const Icon = s.icon; const ativo = analiseSub === s.id;
              return (
                <button key={s.id} onClick={() => setAnaliseSub(s.id)}
                  className={`flex items-center gap-1.5 text-sm rounded-md px-3 py-1.5 transition-colors ${ativo ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted text-muted-foreground'}`}>
                  <Icon className="w-3.5 h-3.5" />{s.label}
                </button>
              );
            })}
          </div>
        )}

        {aba === 'analises' && analiseSub === 'pendencias' && (
          loadingPend ? <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
          : (() => {
            const porData = (a: any, b: any) => String(b.data).localeCompare(String(a.data)); // mais recente primeiro
            const reais = pendencias.filter((p) => p.classificacao === 'real').sort(porData);
            const gaps = pendencias.filter((p) => p.classificacao !== 'real').sort(porData);
            const CLS: Record<string, { txt: string; cls: string }> = {
              real: { txt: 'divergência', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
              gap_stone: { txt: 'falta Stone', cls: 'bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300' },
              gap_contahub: { txt: 'falta ContaHub', cls: 'bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300' },
            };
            const linha = (p: any) => (
              <tr key={p.data} onClick={() => { setAba('conciliacao'); abrirDia(p.data); }} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer">
                <td className="px-3 py-1.5 font-medium whitespace-nowrap">{fmtData(p.data)}</td>
                <td className="px-3 py-1.5"><span className={`text-[10px] rounded px-1.5 py-0.5 ${CLS[p.classificacao]?.cls}`}>{CLS[p.classificacao]?.txt}</span></td>
                <td className={`px-3 py-1.5 text-right font-medium ${p.status === 'verificar' ? 'text-red-600' : 'text-amber-600'}`}>{fmtBRL(p.diferenca)}</td>
                <td className="px-3 py-1.5 text-right text-muted-foreground whitespace-nowrap">{p.so_stone_qtd ? `${p.so_stone_qtd} · ${fmtBRL(p.so_stone_valor)}` : '—'}</td>
                <td className="px-3 py-1.5 text-right text-muted-foreground whitespace-nowrap">{p.so_ch_qtd ? `${p.so_ch_qtd} · ${fmtBRL(p.so_ch_valor)}` : '—'}</td>
              </tr>
            );
            return pendencias.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground"><CheckCircle2 className="w-9 h-9 mx-auto mb-2 text-emerald-600 opacity-60" />Tudo conciliado no período. 🎉</CardContent></Card>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">Fila de trabalho do período. Clique num dia para abrir o detalhe na aba Conciliação. &quot;Falta Stone/ContaHub&quot; = gap de cobertura (um lado sem dado), não furo real.</p>
                <div>
                  <div className="text-sm font-semibold mb-1 flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-red-600" />Divergências reais ({reais.length})</div>
                  <Card className="p-0 overflow-x-auto"><table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground border-b"><tr><th className="text-left px-3 py-2">Dia</th><th className="text-left px-3 py-2">Tipo</th><th className="text-right px-3 py-2">Diferença</th><th className="text-right px-3 py-2">Só Stone</th><th className="text-right px-3 py-2">Só ContaHub</th></tr></thead>
                    <tbody>{reais.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Nenhuma divergência real. 🎉</td></tr> : reais.map(linha)}</tbody>
                  </table></Card>
                </div>
                {gaps.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold mb-1 text-muted-foreground">Gaps de cobertura ({gaps.length}) — um lado sem dado</div>
                    <Card className="p-0 overflow-x-auto"><table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground border-b"><tr><th className="text-left px-3 py-2">Dia</th><th className="text-left px-3 py-2">Tipo</th><th className="text-right px-3 py-2">Diferença</th><th className="text-right px-3 py-2">Só Stone</th><th className="text-right px-3 py-2">Só ContaHub</th></tr></thead>
                      <tbody>{gaps.map(linha)}</tbody>
                    </table></Card>
                  </div>
                )}
              </div>
            );
          })()
        )}

        {/* ===================== SUB-ABAS DE ANÁLISE (Taxas/Recebíveis/Mix/Chargebacks) ===================== */}
        {aba === 'analises' && analiseSub !== 'pendencias' && (
          loadingAn ? <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
          : !an ? <Card><CardContent className="py-12 text-center text-muted-foreground">Sem dados no período.</CardContent></Card>
          : (
            <>
              {/* ---- TAXAS (MDR) ---- */}
              {analiseSub === 'taxas' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Bruto</div><div className="text-base font-bold">{fmtBRL(totais.bruto)}</div></CardContent></Card>
                    <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Taxa paga</div><div className="text-base font-bold text-amber-600">{fmtBRL(totais.taxa)}</div></CardContent></Card>
                    <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">MDR médio</div><div className="text-lg font-bold">{mdrMedio.toFixed(2)}%</div></CardContent></Card>
                    <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Líquido</div><div className="text-base font-bold text-emerald-600">{fmtBRL(totais.liquido)}</div></CardContent></Card>
                  </div>
                  <Card className="p-0 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground border-b"><tr><th className="text-left px-3 py-2">Bandeira</th><th className="text-left px-3 py-2">Tipo</th><th className="text-right px-3 py-2">Qtd</th><th className="text-right px-3 py-2">Bruto</th><th className="text-right px-3 py-2">Taxa</th><th className="text-right px-3 py-2">MDR %</th></tr></thead>
                      <tbody>{bandeiras.map((b, i) => {
                        const mdr = Number(b.bruto) > 0 ? Number(b.taxa) / Number(b.bruto) * 100 : 0;
                        return (<tr key={i} onClick={() => abrirTaxasDia(b.brand_id, b.account_type)} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" title="Clique para ver a taxa por dia">
                          <td className="px-3 py-1.5 font-medium"><span className="inline-flex items-center gap-1"><ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />{brandName(b.brand_id)}</span></td><td className="px-3 py-1.5 text-muted-foreground">{accountName(b.account_type)}</td>
                          <td className="px-3 py-1.5 text-right">{fmtNum(b.qtd)}</td><td className="px-3 py-1.5 text-right">{fmtBRL(b.bruto)}</td><td className="px-3 py-1.5 text-right text-muted-foreground">{fmtBRL(b.taxa)}</td>
                          <td className={`px-3 py-1.5 text-right font-medium ${mdr >= 2 ? 'text-red-600' : mdr >= 1.5 ? 'text-amber-600' : ''}`}>{mdr.toFixed(2)}%</td>
                        </tr>);
                      })}</tbody>
                    </table>
                  </Card>
                  <p className="text-xs text-muted-foreground">MDR % = taxa / bruto. Vermelho ≥ 2% (caro), âmbar ≥ 1,5%.</p>
                </div>
              )}

              {/* ---- RECEBÍVEIS ---- */}
              {analiseSub === 'recebiveis' && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-semibold mb-2 flex items-center gap-1"><CalendarClock className="w-4 h-4" />A receber (líquido futuro) · {fmtBRL(totais.a_receber_total)}</div>
                    <Card className="p-0 overflow-x-auto"><table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground border-b"><tr><th className="text-left px-3 py-2">Data prevista</th><th className="text-right px-3 py-2">Transações</th><th className="text-right px-3 py-2">Líquido</th></tr></thead>
                      <tbody>{(an.a_receber || []).length === 0 ? <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">Nada a receber.</td></tr>
                        : an.a_receber.map((r: any, i: number) => (<tr key={i} className="border-b last:border-0"><td className="px-3 py-1.5">{fmtData(r.dt)}</td><td className="px-3 py-1.5 text-right text-muted-foreground">{r.qtd}</td><td className="px-3 py-1.5 text-right font-medium text-emerald-600">{fmtBRL(r.liquido)}</td></tr>))}</tbody>
                    </table></Card>
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-2 flex items-center gap-1"><Banknote className="w-4 h-4" />Repasses já feitos (período) · {fmtBRL(totais.repasses_total)}</div>
                    <Card className="p-0 overflow-x-auto"><table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground border-b"><tr><th className="text-left px-3 py-2">Data</th><th className="text-right px-3 py-2">Pagamentos</th><th className="text-right px-3 py-2">Valor</th></tr></thead>
                      <tbody>{(an.repasses || []).length === 0 ? <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">Sem repasses no período.</td></tr>
                        : an.repasses.map((r: any, i: number) => (<tr key={i} className="border-b last:border-0"><td className="px-3 py-1.5">{fmtData(r.dt)}</td><td className="px-3 py-1.5 text-right text-muted-foreground">{r.qtd}</td><td className="px-3 py-1.5 text-right font-medium">{fmtBRL(r.valor)}</td></tr>))}</tbody>
                    </table></Card>
                  </div>
                </div>
              )}

              {/* ---- MIX & MAQUININHAS ---- */}
              {analiseSub === 'mix' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Transações</div><div className="text-lg font-bold">{fmtNum(totais.qtd)}</div></CardContent></Card>
                    <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Ticket médio</div><div className="text-lg font-bold">{fmtBRL(ticketMedio)}</div></CardContent></Card>
                    <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Bruto</div><div className="text-base font-bold">{fmtBRL(totais.bruto)}</div></CardContent></Card>
                    <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Maquininhas</div><div className="text-lg font-bold">{(an.por_maquininha || []).length}</div></CardContent></Card>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card><CardContent className="py-3">
                      <div className="text-sm font-semibold mb-2">Mix por tipo</div>
                      {mixTipo.itens.map((m, i) => (<div key={i} className="mb-2"><div className="flex justify-between text-xs mb-0.5"><span>{m.nome}</span><span className="text-muted-foreground">{m.perc.toFixed(1)}% · {fmtBRL(m.bruto)}</span></div><Barra v={m.bruto} max={mixTipo.tot} /></div>))}
                    </CardContent></Card>
                    <Card><CardContent className="py-3">
                      <div className="text-sm font-semibold mb-2">Mix por bandeira</div>
                      {mixBandeira.map((m, i) => (<div key={i} className="mb-2"><div className="flex justify-between text-xs mb-0.5"><span>{m.nome}</span><span className="text-muted-foreground">{m.perc.toFixed(1)}% · {fmtBRL(m.bruto)}</span></div><Barra v={m.bruto} max={mixBandeira[0]?.bruto || 1} cor="bg-indigo-500" /></div>))}
                    </CardContent></Card>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card><CardContent className="py-3">
                      <div className="text-sm font-semibold mb-2">Por dia da semana</div>
                      {(an.por_dia_semana || []).map((d: any, i: number) => { const max = Math.max(...(an.por_dia_semana || []).map((x: any) => Number(x.bruto)), 1); return (<div key={i} className="mb-2"><div className="flex justify-between text-xs mb-0.5"><span>{DOW[d.dow]}</span><span className="text-muted-foreground">{fmtBRL(d.bruto)}</span></div><Barra v={Number(d.bruto)} max={max} cor="bg-emerald-500" /></div>); })}
                    </CardContent></Card>
                    <Card><CardContent className="py-3">
                      <div className="text-sm font-semibold mb-2">Por hora</div>
                      <div className="flex items-end gap-0.5 h-32">{(an.por_hora || []).map((h: any, i: number) => { const max = Math.max(...(an.por_hora || []).map((x: any) => Number(x.bruto)), 1); const ht = Math.max(3, Number(h.bruto) / max * 100); return (<div key={i} className="flex-1 flex flex-col items-center justify-end" title={`${h.hora}h · ${fmtBRL(h.bruto)}`}><div className="w-full bg-primary/70 rounded-t" style={{ height: `${ht}%` }} /><span className="text-[8px] text-muted-foreground mt-0.5">{h.hora}</span></div>); })}</div>
                    </CardContent></Card>
                  </div>
                  <Card className="p-0 overflow-x-auto">
                    <div className="text-sm font-semibold px-3 pt-3">Faturamento por maquininha</div>
                    <table className="w-full text-sm mt-1"><thead className="text-xs text-muted-foreground border-b"><tr><th className="text-left px-3 py-2">Terminal (serial)</th><th className="text-right px-3 py-2">Qtd</th><th className="text-right px-3 py-2">Bruto</th><th className="text-right px-3 py-2">MDR %</th></tr></thead>
                      <tbody>{(an.por_maquininha || []).map((m: any, i: number) => (<tr key={i} className="border-b last:border-0 hover:bg-muted/30"><td className="px-3 py-1.5 font-mono text-xs">{m.poi}</td><td className="px-3 py-1.5 text-right">{fmtNum(m.qtd)}</td><td className="px-3 py-1.5 text-right">{fmtBRL(m.bruto)}</td><td className="px-3 py-1.5 text-right text-muted-foreground">{pct(Number(m.taxa), Number(m.bruto))}</td></tr>))}</tbody>
                    </table>
                  </Card>
                </div>
              )}

              {/* ---- CHARGEBACKS ---- */}
              {analiseSub === 'chargebacks' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-red-600" />Chargebacks</div><div className="text-lg font-bold text-red-600">{totais.chargebacks_qtd}</div></CardContent></Card>
                    <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Cancelamentos</div><div className="text-lg font-bold text-amber-600">{totais.cancelamentos_qtd}</div></CardContent></Card>
                    <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Eventos listados</div><div className="text-lg font-bold">{(an.chargebacks || []).length}</div></CardContent></Card>
                  </div>
                  <Card className="p-0 overflow-x-auto"><table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground border-b"><tr><th className="text-left px-3 py-2">Dia</th><th className="text-left px-3 py-2">Bandeira</th><th className="text-left px-3 py-2">Tipo</th><th className="text-left px-3 py-2">Cartão</th><th className="text-right px-3 py-2">Valor</th><th className="text-right px-3 py-2">CB</th><th className="text-right px-3 py-2">Canc.</th></tr></thead>
                    <tbody>{(an.chargebacks || []).length === 0 ? <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground"><CheckCircle2 className="w-7 h-7 mx-auto mb-1 text-emerald-600 opacity-60" />Nenhum chargeback ou cancelamento no período. 🎉</td></tr>
                      : an.chargebacks.map((c: any, i: number) => (<tr key={i} className="border-b last:border-0 hover:bg-muted/30"><td className="px-3 py-1.5">{fmtData(c.op_day)}</td><td className="px-3 py-1.5 font-medium">{brandName(c.brand_id)}</td><td className="px-3 py-1.5 text-muted-foreground">{accountName(c.account_type)}</td><td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{c.card_number_masked}</td><td className="px-3 py-1.5 text-right">{fmtBRL(c.gross_amount)}</td><td className="px-3 py-1.5 text-right text-red-600">{c.chargebacks || ''}</td><td className="px-3 py-1.5 text-right text-amber-600">{c.cancelamentos || ''}</td></tr>))}</tbody>
                  </table></Card>
                </div>
              )}
            </>
          )
        )}

        {/* Modal: taxa por dia de uma bandeira+tipo (clique numa linha da aba Taxas) */}
        {taxasModal.open && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setTaxasModal(m => ({ ...m, open: false }))}>
            <div className="bg-background rounded-lg shadow-xl border border-border max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="font-semibold text-sm flex items-center gap-2"><CreditCard className="w-4 h-4" />Taxa por dia — {taxasModal.titulo}</div>
                <button onClick={() => setTaxasModal(m => ({ ...m, open: false }))} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
              </div>
              <div className="overflow-auto">
                {taxasModal.loading ? <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
                : taxasModal.erro ? <div className="py-8 text-center text-sm text-red-600">{taxasModal.erro}</div>
                : taxasModal.rows.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">Sem transações no período.</div>
                : (() => {
                    const tot = taxasModal.rows.reduce((a: any, r: any) => ({ bruto: a.bruto + Number(r.bruto || 0), taxa: a.taxa + Number(r.taxa || 0), qtd: a.qtd + Number(r.qtd || 0) }), { bruto: 0, taxa: 0, qtd: 0 });
                    const mdrTot = tot.bruto > 0 ? tot.taxa / tot.bruto * 100 : 0;
                    return (
                      <table className="w-full text-sm">
                        <thead className="text-xs text-muted-foreground border-b sticky top-0 bg-background"><tr><th className="text-left px-3 py-2">Dia</th><th className="text-right px-3 py-2">Qtd</th><th className="text-right px-3 py-2">Bruto</th><th className="text-right px-3 py-2">Taxa</th><th className="text-right px-3 py-2">MDR %</th></tr></thead>
                        <tbody>{taxasModal.rows.map((r: any, i: number) => { const mdr = Number(r.mdr || 0); return (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-3 py-1.5 font-medium whitespace-nowrap">{fmtData(r.data)}</td>
                            <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtNum(r.qtd)}</td>
                            <td className="px-3 py-1.5 text-right">{fmtBRL(r.bruto)}</td>
                            <td className="px-3 py-1.5 text-right text-muted-foreground">{fmtBRL(r.taxa)}</td>
                            <td className={`px-3 py-1.5 text-right font-medium ${mdr >= 2 ? 'text-red-600' : mdr >= 1.5 ? 'text-amber-600' : ''}`}>{mdr.toFixed(2)}%</td>
                          </tr>); })}
                        </tbody>
                        <tfoot className="border-t bg-muted/30 font-semibold"><tr>
                          <td className="px-3 py-2">Total</td>
                          <td className="px-3 py-2 text-right">{fmtNum(tot.qtd)}</td>
                          <td className="px-3 py-2 text-right">{fmtBRL(tot.bruto)}</td>
                          <td className="px-3 py-2 text-right">{fmtBRL(tot.taxa)}</td>
                          <td className="px-3 py-2 text-right">{mdrTot.toFixed(2)}%</td>
                        </tr></tfoot>
                      </table>
                    );
                  })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
