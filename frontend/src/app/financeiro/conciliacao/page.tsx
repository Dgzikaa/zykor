'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Scale, Loader2, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, ChevronDown, Banknote, CreditCard, Percent, CalendarClock, PieChart, ShieldAlert } from 'lucide-react';

type Row = {
  data: string; status: string; stone_cnpjs: string | null;
  contahub_cartao: number; stone_bruto: number; diferenca: number;
  stone_taxa: number; stone_liquido: number; stone_transacoes: number;
};

const BRAND: Record<number, string> = { 1: 'Visa', 2: 'Mastercard', 3: 'Amex', 4: 'Hipercard', 171: 'Elo' };
const ACCOUNT: Record<number, string> = { 1: 'Débito', 2: 'Crédito', 3: 'Voucher', 4: 'Private Label', 5: 'Outro' };
const brandName = (id: any) => BRAND[Number(id)] || (id == null ? '—' : `Bandeira ${id}`);
const accountName = (id: any) => ACCOUNT[Number(id)] || (id == null ? '—' : `Tipo ${id}`);
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const fmtBRL = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const fmtNum = (v: any) => new Intl.NumberFormat('pt-BR').format(Number(v || 0));
const fmtData = (d: string) => { try { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y.slice(2)}`; } catch { return d; } };
const fmtHora = (iso: string) => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const pct = (taxa: number, bruto: number) => bruto > 0 ? `${(taxa / bruto * 100).toFixed(2)}%` : '—';

const STATUS_BADGE: Record<string, { cls: string; txt: string }> = {
  ok: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', txt: '● bate' },
  leve: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', txt: '◆ pequena dif.' },
  verificar: { cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', txt: '▲ verificar' },
};
const StatusBadge = ({ s }: { s: string }) => {
  const b = STATUS_BADGE[s] || STATUS_BADGE.verificar;
  return <span className={`text-[10px] rounded px-1.5 py-0.5 ${b.cls}`}>{b.txt}</span>;
};
const corDifStatus = (s: string) => s === 'ok' ? 'text-muted-foreground' : s === 'leve' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400 font-semibold';

const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const labelMes = (ym: string) => { const [y, m] = ym.split('-'); return `${MESES_PT[Number(m) - 1]}/${y}`; };

const ABAS = [
  { id: 'conciliacao', label: 'Conciliação', icon: Scale },
  { id: 'taxas', label: 'Taxas (MDR)', icon: Percent },
  { id: 'recebiveis', label: 'Recebíveis', icon: CalendarClock },
  { id: 'mix', label: 'Mix & Maquininhas', icon: PieChart },
  { id: 'chargebacks', label: 'Chargebacks', icon: ShieldAlert },
] as const;
type AbaId = typeof ABAS[number]['id'];

// barra horizontal simples (proporção do maior valor)
function Barra({ v, max, cor = 'bg-primary' }: { v: number; max: number; cor?: string }) {
  const w = max > 0 ? Math.max(2, (v / max) * 100) : 0;
  return <div className="h-2 rounded bg-muted/40"><div className={`h-2 rounded ${cor}`} style={{ width: `${w}%` }} /></div>;
}

export default function ConciliacaoPage() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();

  const [aba, setAba] = useState<AbaId>('conciliacao');
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
  const [loading, setLoading] = useState(false);
  const [loadingAn, setLoadingAn] = useState(false);

  const [aberto, setAberto] = useState<string | null>(null);
  const [diaCache, setDiaCache] = useState<Record<string, any>>({});
  const [diaLoading, setDiaLoading] = useState<string | null>(null);
  const [verTxAte, setVerTxAte] = useState<Record<string, number>>({});

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

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { carregarAnalise(); }, [carregarAnalise]);

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
          <div className="flex items-center gap-1">
            <button onClick={() => irMes(+1)} disabled={mesIdx <= 0} className="p-1.5 rounded border disabled:opacity-30 hover:bg-muted/50"><ChevronLeft className="w-4 h-4" /></button>
            <select value={usarRange ? '' : mesSel} onChange={(e) => { setUsarRange(false); setMesSel(e.target.value); setAberto(null); }} className="text-sm font-medium border rounded px-2 py-1.5 bg-background min-w-[140px]">
              {meses.map((m) => <option key={m} value={m}>{labelMes(m)}</option>)}
            </select>
            <button onClick={() => irMes(-1)} disabled={mesIdx < 0 || mesIdx >= meses.length - 1} className="p-1.5 rounded border disabled:opacity-30 hover:bg-muted/50"><ChevronRight className="w-4 h-4" /></button>
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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Dias</div><div className="text-lg font-bold">{resumo.dias}</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-600" />Batendo</div><div className="text-lg font-bold text-emerald-600">{resumo.ok}</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-600" />Pequena dif.</div><div className="text-lg font-bold text-amber-600">{resumo.leve ?? 0}</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-600" />Verificar</div><div className="text-lg font-bold text-red-600">{resumo.verificar}</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Stone bruto</div><div className="text-base font-bold">{fmtBRL(resumo.stone_bruto_total)}</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Taxa (MDR)</div><div className="text-base font-bold">{fmtBRL(resumo.taxa_total)}</div></CardContent></Card>
              </div>
            )}

            {loading ? <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
            : rows.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground"><Scale className="w-9 h-9 mx-auto mb-2 opacity-40" />Sem dados no período.</CardContent></Card>
            : (
              <Card className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b"><tr>
                    <th className="px-3 py-2 w-8"></th><th className="text-left px-3 py-2">Dia</th><th className="text-left px-3 py-2">Status</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">ContaHub</th><th className="text-right px-3 py-2 whitespace-nowrap">Stone bruto</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">Diferença</th><th className="text-right px-3 py-2 whitespace-nowrap">Taxa</th><th className="text-right px-3 py-2">Tx</th>
                  </tr></thead>
                  <tbody>
                    {rows.map((r) => {
                      const dia = diaCache[r.data]; const lim = verTxAte[r.data] || 50;
                      return (
                        <Fragment key={r.data}>
                          <tr onClick={() => abrirDia(r.data)} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer">
                            <td className="px-3 py-1.5"><ChevronDown className={`w-4 h-4 transition-transform ${aberto === r.data ? 'rotate-180' : ''}`} /></td>
                            <td className="px-3 py-1.5 whitespace-nowrap font-medium">{fmtData(r.data)}</td>
                            <td className="px-3 py-1.5"><StatusBadge s={r.status} /></td>
                            <td className="px-3 py-1.5 text-right whitespace-nowrap">{fmtBRL(r.contahub_cartao)}</td>
                            <td className="px-3 py-1.5 text-right whitespace-nowrap">{fmtBRL(r.stone_bruto)}</td>
                            <td className={`px-3 py-1.5 text-right whitespace-nowrap ${corDifStatus(r.status)}`}>{fmtBRL(r.diferenca)}</td>
                            <td className="px-3 py-1.5 text-right whitespace-nowrap text-muted-foreground">{fmtBRL(r.stone_taxa)}</td>
                            <td className="px-3 py-1.5 text-right text-muted-foreground">{r.stone_transacoes ?? '—'}</td>
                          </tr>
                          {aberto === r.data && (
                            <tr className="border-b bg-muted/20"><td colSpan={8} className="px-3 py-3">
                              {diaLoading === r.data ? <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
                              : dia ? (
                                <div className="space-y-4">
                                  {dia.conciliacao && (
                                    <div>
                                      <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><Scale className="w-3.5 h-3.5" />Onde diverge (ContaHub × Stone)</div>
                                      <div className="overflow-x-auto"><table className="text-xs w-full max-w-md">
                                        <thead className="text-muted-foreground"><tr><th className="text-left py-1 pr-3">Tipo</th><th className="text-right py-1 pr-3">ContaHub</th><th className="text-right py-1 pr-3">Stone</th><th className="text-right py-1">Diferença</th></tr></thead>
                                        <tbody>{dia.conciliacao.linhas.map((l: any, i: number) => {
                                          const ok = Math.abs(l.dif) < 0.5; const total = l.tipo === 'Total';
                                          return (<tr key={i} className={`border-t border-border/50 ${total ? 'font-semibold' : ''}`}>
                                            <td className="py-1 pr-3">{l.tipo}</td>
                                            <td className="py-1 pr-3 text-right">{fmtBRL(l.contahub)}</td>
                                            <td className="py-1 pr-3 text-right">{fmtBRL(l.stone)}</td>
                                            <td className={`py-1 text-right ${ok ? 'text-muted-foreground' : 'text-red-600 dark:text-red-400 font-semibold'}`}>{fmtBRL(l.dif)}{!ok && ' ◀'}</td>
                                          </tr>);
                                        })}</tbody>
                                      </table></div>
                                      <p className="text-[11px] text-muted-foreground mt-1">A linha com ◀ em vermelho é onde está o furo (crédito ou débito). ContaHub crédito = vendas Cred; Stone crédito = bandeira créd/private label.</p>
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
                                              <tbody>{dia.divergencias.so_stone.map((t: any, i: number) => (<tr key={i} className="border-t border-border/40"><td className="py-0.5 pr-2 text-muted-foreground">{fmtHora(t.hora)}</td><td className="py-0.5 pr-2">{t.tipo}</td><td className="py-0.5 pr-2">{brandName(t.brand_id)}</td><td className="py-0.5 pr-2 font-mono">{t.cartao}</td><td className="py-0.5 text-right font-medium">{fmtBRL(t.valor)}</td></tr>))}</tbody>
                                            </table>
                                          )}
                                        </div>
                                        <div>
                                          <div className="text-[11px] font-medium text-muted-foreground mb-1">Só no ContaHub — lançado, faltando na Stone ({dia.divergencias.resumo.so_ch_qtd} · {fmtBRL(dia.divergencias.resumo.so_ch_valor)})</div>
                                          {dia.divergencias.so_ch.length === 0 ? <div className="text-[11px] text-muted-foreground">—</div> : (
                                            <table className="text-[11px] w-full"><thead className="text-muted-foreground"><tr><th className="text-left py-0.5 pr-2">Tipo</th><th className="text-left py-0.5 pr-2">Cliente</th><th className="text-left py-0.5 pr-2">Mesa</th><th className="text-left py-0.5 pr-2">Meio</th><th className="text-right py-0.5">Valor</th></tr></thead>
                                              <tbody>{dia.divergencias.so_ch.map((t: any, i: number) => (<tr key={i} className="border-t border-border/40"><td className="py-0.5 pr-2">{t.tipo}</td><td className="py-0.5 pr-2">{t.cliente || '—'}</td><td className="py-0.5 pr-2 text-muted-foreground">{t.mesa || '—'}</td><td className="py-0.5 pr-2 text-muted-foreground">{t.meio || '—'}</td><td className="py-0.5 text-right font-medium">{fmtBRL(t.valor)}</td></tr>))}</tbody>
                                            </table>
                                          )}
                                        </div>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground mt-2">Match por tipo + valor (ContaHub não fornece NSU/autorização). Valores negativos = estornos/ajustes lançados no ContaHub.</p>
                                    </div>
                                  )}

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
                                    <div className="text-xs font-semibold text-muted-foreground mb-1">Transações ({dia.resumo.transacoes}){dia.resumo.chargebacks > 0 && <span className="ml-2 text-red-600">· {dia.resumo.chargebacks} chargeback(s)</span>}</div>
                                    <div className="overflow-x-auto"><table className="text-xs w-full">
                                      <thead className="text-muted-foreground"><tr><th className="text-left py-1 pr-3">Hora</th><th className="text-left py-1 pr-3">Bandeira</th><th className="text-left py-1 pr-3">Tipo</th><th className="text-left py-1 pr-3">Cartão</th><th className="text-right py-1 pr-3">Bruto</th><th className="text-right py-1 pr-3">Taxa</th><th className="text-right py-1 pr-3">Líquido</th><th className="text-left py-1 pr-3">Prev.</th><th className="text-left py-1">Maquininha</th></tr></thead>
                                      <tbody>{dia.transacoes.slice(0, lim).map((t: any, i: number) => (
                                        <tr key={i} className={`border-t border-border/50 ${t.chargeback ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                                          <td className="py-1 pr-3 text-muted-foreground">{fmtHora(t.hora)}</td><td className="py-1 pr-3 font-medium">{t.bandeira}</td>
                                          <td className="py-1 pr-3 text-muted-foreground">{t.tipo}{t.parcelas > 1 ? ` ${t.parcelas}x` : ''}</td>
                                          <td className="py-1 pr-3 text-muted-foreground font-mono text-[10px]">{t.cartao}</td>
                                          <td className="py-1 pr-3 text-right">{fmtBRL(t.bruto)}</td><td className="py-1 pr-3 text-right text-muted-foreground">{fmtBRL(t.taxa)}</td><td className="py-1 pr-3 text-right">{fmtBRL(t.liquido)}</td>
                                          <td className="py-1 pr-3 text-muted-foreground">{t.previsao ? fmtData(t.previsao) : '—'}</td>
                                          <td className="py-1 text-muted-foreground font-mono text-[10px]">{t.maquininha || '—'}{t.chargeback && <span className="ml-1 text-red-600">CB</span>}</td>
                                        </tr>))}</tbody>
                                    </table></div>
                                    {dia.transacoes.length > lim && <button onClick={() => setVerTxAte((p) => ({ ...p, [r.data]: lim + 100 }))} className="mt-2 text-xs text-primary hover:underline">Ver mais ({dia.transacoes.length - lim} restantes)</button>}
                                  </div>
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

        {/* ===================== ABAS DE ANÁLISE ===================== */}
        {aba !== 'conciliacao' && (
          loadingAn ? <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
          : !an ? <Card><CardContent className="py-12 text-center text-muted-foreground">Sem dados no período.</CardContent></Card>
          : (
            <>
              {/* ---- TAXAS (MDR) ---- */}
              {aba === 'taxas' && (
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
                        return (<tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-1.5 font-medium">{brandName(b.brand_id)}</td><td className="px-3 py-1.5 text-muted-foreground">{accountName(b.account_type)}</td>
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
              {aba === 'recebiveis' && (
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
              {aba === 'mix' && (
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
              {aba === 'chargebacks' && (
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
      </div>
    </ProtectedRoute>
  );
}
