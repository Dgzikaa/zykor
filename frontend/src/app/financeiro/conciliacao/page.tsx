'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Scale, Loader2, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, ChevronDown, Banknote, CreditCard } from 'lucide-react';

type Row = {
  data: string; status: string; stone_cnpjs: string | null;
  contahub_cartao: number; stone_bruto: number; diferenca: number;
  stone_taxa: number; stone_liquido: number; stone_transacoes: number;
};

const fmtBRL = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const fmtData = (d: string) => { try { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y.slice(2)}`; } catch { return d; } };
const fmtHora = (iso: string) => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const labelMes = (ym: string) => { const [y, m] = ym.split('-'); return `${MESES_PT[Number(m) - 1]}/${y}`; };

export default function ConciliacaoPage() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();

  const [meses, setMeses] = useState<string[]>([]);
  const [mesSel, setMesSel] = useState<string>('');     // YYYY-MM
  const [cnpjs, setCnpjs] = useState<string[]>([]);

  // filtros
  const [status, setStatus] = useState<'' | 'ok' | 'verificar'>('');
  const [cnpj, setCnpj] = useState('');
  const [apenasDif, setApenasDif] = useState(false);
  const [usarRange, setUsarRange] = useState(false);
  const [rangeDe, setRangeDe] = useState('');
  const [rangeAte, setRangeAte] = useState('');

  const [rows, setRows] = useState<Row[]>([]);
  const [resumo, setResumo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // drill-down
  const [aberto, setAberto] = useState<string | null>(null);
  const [diaCache, setDiaCache] = useState<Record<string, any>>({});
  const [diaLoading, setDiaLoading] = useState<string | null>(null);
  const [verTxAte, setVerTxAte] = useState<Record<string, number>>({});

  // intervalo efetivo: range custom > mês selecionado
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
      // default: mês mais recente
      if (!mesSel && !usarRange && (r.meses_disponiveis || []).length) setMesSel(r.meses_disponiveis[0]);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar conciliação', message: e?.message });
    } finally { setLoading(false); }
  }, [selectedBar, periodo, status, cnpj, apenasDif, mesSel, usarRange, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

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

  const corDif = (v: number) => Math.abs(v) < 0.01 ? 'text-muted-foreground' : v > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-3 py-5 max-w-6xl">
        <div className="flex items-center gap-2 mb-1">
          <Scale className="w-5 h-5" /><h1 className="text-xl font-bold">Conciliação Stone × ContaHub</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Vendas no cartão (ContaHub) × recebimento na Stone, por dia operacional. Clique num dia para ver transações e repasses.
        </p>

        {/* Controles: mês + filtros */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex items-center gap-1">
            <button onClick={() => irMes(+1)} disabled={mesIdx <= 0} className="p-1.5 rounded border disabled:opacity-30 hover:bg-muted/50"><ChevronLeft className="w-4 h-4" /></button>
            <select
              value={usarRange ? '' : mesSel}
              onChange={(e) => { setUsarRange(false); setMesSel(e.target.value); setAberto(null); }}
              className="text-sm font-medium border rounded px-2 py-1.5 bg-background min-w-[140px]"
            >
              {meses.map((m) => <option key={m} value={m}>{labelMes(m)}</option>)}
            </select>
            <button onClick={() => irMes(-1)} disabled={mesIdx < 0 || mesIdx >= meses.length - 1} className="p-1.5 rounded border disabled:opacity-30 hover:bg-muted/50"><ChevronRight className="w-4 h-4" /></button>
          </div>

          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="text-sm border rounded px-2 py-1.5 bg-background">
            <option value="">Status: todos</option>
            <option value="ok">● Batendo</option>
            <option value="verificar">▲ A verificar</option>
          </select>

          {cnpjs.length > 1 && (
            <select value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="text-sm border rounded px-2 py-1.5 bg-background max-w-[180px]">
              <option value="">CNPJ: todos</option>
              {cnpjs.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          <label className="flex items-center gap-1.5 text-sm border rounded px-2 py-1.5 cursor-pointer hover:bg-muted/50">
            <input type="checkbox" checked={apenasDif} onChange={(e) => setApenasDif(e.target.checked)} />
            Só diferenças ≠ 0
          </label>

          <label className="flex items-center gap-1.5 text-sm border rounded px-2 py-1.5 cursor-pointer hover:bg-muted/50">
            <input type="checkbox" checked={usarRange} onChange={(e) => { setUsarRange(e.target.checked); setAberto(null); }} />
            Intervalo custom
          </label>
          {usarRange && (
            <div className="flex items-center gap-1">
              <input type="date" value={rangeDe} onChange={(e) => setRangeDe(e.target.value)} className="text-sm border rounded px-2 py-1.5 bg-background" />
              <span className="text-muted-foreground text-xs">até</span>
              <input type="date" value={rangeAte} onChange={(e) => setRangeAte(e.target.value)} className="text-sm border rounded px-2 py-1.5 bg-background" />
            </div>
          )}
        </div>

        {resumo && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Dias</div><div className="text-lg font-bold">{resumo.dias}</div></CardContent></Card>
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-600" />Batendo</div><div className="text-lg font-bold text-emerald-600">{resumo.ok}</div></CardContent></Card>
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-600" />Verificar</div><div className="text-lg font-bold text-amber-600">{resumo.verificar}</div></CardContent></Card>
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Stone bruto</div><div className="text-base font-bold">{fmtBRL(resumo.stone_bruto_total)}</div></CardContent></Card>
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Taxa (MDR)</div><div className="text-base font-bold">{fmtBRL(resumo.taxa_total)}</div></CardContent></Card>
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Transações</div><div className="text-lg font-bold">{resumo.transacoes_total}</div></CardContent></Card>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground"><Scale className="w-9 h-9 mx-auto mb-2 opacity-40" />Sem dados de conciliação no período.</CardContent></Card>
        ) : (
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b"><tr>
                <th className="text-left px-3 py-2 w-8"></th>
                <th className="text-left px-3 py-2">Dia</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">ContaHub cartão</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">Stone bruto</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">Diferença</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">Taxa</th>
                <th className="text-right px-3 py-2">Tx</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => {
                  const dia = diaCache[r.data];
                  const lim = verTxAte[r.data] || 50;
                  return (
                    <Fragment key={r.data}>
                      <tr onClick={() => abrirDia(r.data)} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer">
                        <td className="px-3 py-1.5"><ChevronDown className={`w-4 h-4 transition-transform ${aberto === r.data ? 'rotate-180' : ''}`} /></td>
                        <td className="px-3 py-1.5 whitespace-nowrap font-medium">{fmtData(r.data)}</td>
                        <td className="px-3 py-1.5">
                          {r.status === 'ok'
                            ? <span className="text-[10px] rounded px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">● bate</span>
                            : <span className="text-[10px] rounded px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">▲ verificar</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap">{fmtBRL(r.contahub_cartao)}</td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap">{fmtBRL(r.stone_bruto)}</td>
                        <td className={`px-3 py-1.5 text-right whitespace-nowrap font-medium ${corDif(r.diferenca)}`}>{fmtBRL(r.diferenca)}</td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap text-muted-foreground">{fmtBRL(r.stone_taxa)}</td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">{r.stone_transacoes ?? '—'}</td>
                      </tr>
                      {aberto === r.data && (
                        <tr className="border-b bg-muted/20">
                          <td colSpan={8} className="px-3 py-3">
                            {diaLoading === r.data ? (
                              <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
                            ) : dia ? (
                              <div className="space-y-4">
                                {/* Resumo por bandeira */}
                                <div>
                                  <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" />Por bandeira</div>
                                  <div className="overflow-x-auto"><table className="text-xs w-full">
                                    <thead className="text-muted-foreground"><tr>
                                      <th className="text-left py-1 pr-3">Bandeira</th><th className="text-left py-1 pr-3">Tipo</th>
                                      <th className="text-right py-1 pr-3">Qtd</th><th className="text-right py-1 pr-3">Bruto</th>
                                      <th className="text-right py-1 pr-3">Taxa</th><th className="text-right py-1">Líquido</th>
                                    </tr></thead>
                                    <tbody>
                                      {dia.por_bandeira.map((b: any, i: number) => (
                                        <tr key={i} className="border-t border-border/50">
                                          <td className="py-1 pr-3 font-medium">{b.bandeira}</td><td className="py-1 pr-3 text-muted-foreground">{b.tipo}</td>
                                          <td className="py-1 pr-3 text-right">{b.qtd}</td><td className="py-1 pr-3 text-right">{fmtBRL(b.bruto)}</td>
                                          <td className="py-1 pr-3 text-right text-muted-foreground">{fmtBRL(b.taxa)}</td><td className="py-1 text-right">{fmtBRL(b.liquido)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table></div>
                                </div>

                                {/* Repasses do dia */}
                                {dia.repasses.length > 0 && (
                                  <div>
                                    <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><Banknote className="w-3.5 h-3.5" />Repasses ao banco ({dia.repasses.length}) · {fmtBRL(dia.resumo.repasses_total)}</div>
                                    <div className="overflow-x-auto"><table className="text-xs w-full">
                                      <thead className="text-muted-foreground"><tr><th className="text-left py-1 pr-3">Pagamento</th><th className="text-left py-1 pr-3">Conta destino</th><th className="text-right py-1">Valor</th></tr></thead>
                                      <tbody>
                                        {dia.repasses.map((p: any, i: number) => (
                                          <tr key={i} className="border-t border-border/50"><td className="py-1 pr-3 text-muted-foreground">{p.payment_id}</td><td className="py-1 pr-3">{p.conta}</td><td className="py-1 text-right font-medium">{fmtBRL(p.valor)}</td></tr>
                                        ))}
                                      </tbody>
                                    </table></div>
                                  </div>
                                )}

                                {/* Transações */}
                                <div>
                                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                                    Transações ({dia.resumo.transacoes}){dia.resumo.chargebacks > 0 && <span className="ml-2 text-red-600">· {dia.resumo.chargebacks} chargeback(s)</span>}
                                  </div>
                                  <div className="overflow-x-auto"><table className="text-xs w-full">
                                    <thead className="text-muted-foreground"><tr>
                                      <th className="text-left py-1 pr-3">Hora</th><th className="text-left py-1 pr-3">Bandeira</th><th className="text-left py-1 pr-3">Tipo</th>
                                      <th className="text-left py-1 pr-3">Cartão</th><th className="text-right py-1 pr-3">Bruto</th><th className="text-right py-1 pr-3">Taxa</th>
                                      <th className="text-right py-1 pr-3">Líquido</th><th className="text-left py-1 pr-3">Prev. pgto</th><th className="text-left py-1">Maquininha</th>
                                    </tr></thead>
                                    <tbody>
                                      {dia.transacoes.slice(0, lim).map((t: any, i: number) => (
                                        <tr key={i} className={`border-t border-border/50 ${t.chargeback ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                                          <td className="py-1 pr-3 text-muted-foreground">{fmtHora(t.hora)}</td>
                                          <td className="py-1 pr-3 font-medium">{t.bandeira}</td>
                                          <td className="py-1 pr-3 text-muted-foreground">{t.tipo}{t.parcelas > 1 ? ` ${t.parcelas}x` : ''}</td>
                                          <td className="py-1 pr-3 text-muted-foreground font-mono text-[10px]">{t.cartao}</td>
                                          <td className="py-1 pr-3 text-right">{fmtBRL(t.bruto)}</td>
                                          <td className="py-1 pr-3 text-right text-muted-foreground">{fmtBRL(t.taxa)}</td>
                                          <td className="py-1 pr-3 text-right">{fmtBRL(t.liquido)}</td>
                                          <td className="py-1 pr-3 text-muted-foreground">{t.previsao ? fmtData(t.previsao) : '—'}</td>
                                          <td className="py-1 text-muted-foreground font-mono text-[10px]">{t.maquininha || '—'}{t.chargeback && <span className="ml-1 text-red-600">CB</span>}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table></div>
                                  {dia.transacoes.length > lim && (
                                    <button onClick={() => setVerTxAte((p) => ({ ...p, [r.data]: lim + 100 }))} className="mt-2 text-xs text-primary hover:underline">
                                      Ver mais ({dia.transacoes.length - lim} restantes)
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
}
