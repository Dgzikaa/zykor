'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { ReceiptText, Loader2, FileText, Ban, CalendarDays, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type Cnpj = { indice: number; label: string; documento: string | null };
type DiaCnpj = { total_autorizado: number; total_nfe: number; total_cancelado: number; qtd_notas: number; qtd_nfe: number };
type Dia = { data: string; por_cnpj: Record<string, DiaCnpj>; total_autorizado: number; total_cancelado: number; qtd_notas: number };
type Mes = { ym: string; por_cnpj: Record<string, number>; total_autorizado: number; total_nfe: number; qtd_notas: number; total_ano_anterior: number | null; yoy_pct: number | null };

const fmtBRL = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const fmtBRLk = (v: any) => { const n = Number(v || 0); return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n); };
const fmtNum = (v: any) => new Intl.NumberFormat('pt-BR').format(Number(v || 0));
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const fmtData = (d: string) => { try { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y.slice(2)}`; } catch { return d; } };
const dow = (d: string) => { try { const [y, m, dd] = d.split('-').map(Number); return DOW[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]; } catch { return ''; } };

const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const labelMes = (ym: string) => { const [y, m] = ym.split('-'); return `${MESES_PT[Number(m) - 1]}/${y}`; };
const labelMesCurto = (ym: string) => { const [y, m] = ym.split('-'); return `${MESES_ABBR[Number(m) - 1]}/${y.slice(2)}`; };

// cores por índice de CNPJ
const CNPJ_TXT = ['text-sky-600 dark:text-sky-400', 'text-violet-600 dark:text-violet-400', 'text-amber-600 dark:text-amber-400', 'text-emerald-600 dark:text-emerald-400'];
const CNPJ_HEX = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981'];
const txtCnpj = (i: number) => CNPJ_TXT[i % CNPJ_TXT.length];
const hexCnpj = (i: number) => CNPJ_HEX[i % CNPJ_HEX.length];

function YoY({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-muted-foreground/40">—</span>;
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const cls = up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  return <span className={`inline-flex items-center gap-0.5 ${cls}`}><Icon className="h-3.5 w-3.5" />{up ? '+' : ''}{pct.toFixed(0)}%</span>;
}

function NotasFiscaisInner() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();

  const [aba, setAba] = useState<'diario' | 'mensal'>('diario');
  const [meses, setMeses] = useState<string[]>([]);
  const [mesSel, setMesSel] = useState<string>('');
  const [cnpjs, setCnpjs] = useState<Cnpj[]>([]);
  const [dias, setDias] = useState<Dia[]>([]);
  const [resumo, setResumo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [mensal, setMensal] = useState<Mes[]>([]);
  const [cnpjsMensal, setCnpjsMensal] = useState<Cnpj[]>([]);
  const [loadingMensal, setLoadingMensal] = useState(false);

  const periodo = useMemo(() => {
    if (!mesSel) return null;
    const [y, m] = mesSel.split('-').map(Number);
    const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { de: `${mesSel}-01`, ate: `${mesSel}-${String(ultimo).padStart(2, '0')}` };
  }, [mesSel]);

  const carregarDiario = useCallback(async () => {
    if (!selectedBar?.id) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (periodo) { qs.set('de', periodo.de); qs.set('ate', periodo.ate); }
      const r = await api.get(`/api/financeiro/notas-fiscais?${qs.toString()}`);
      if (!r?.success) throw new Error(r?.error || 'Falha ao carregar');
      setCnpjs(r.cnpjs || []);
      setDias(r.dias || []);
      setResumo(r.resumo || null);
      if ((r.meses_disponiveis || []).length) {
        setMeses(r.meses_disponiveis);
        if (!mesSel) setMesSel(r.meses_disponiveis[0]);
      }
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar notas fiscais', message: e?.message });
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, periodo, mesSel, showToast]);

  const carregarMensal = useCallback(async () => {
    if (!selectedBar?.id) return;
    setLoadingMensal(true);
    try {
      const r = await api.get('/api/financeiro/notas-fiscais/mensal');
      if (!r?.success) throw new Error(r?.error || 'Falha ao carregar');
      setCnpjsMensal(r.cnpjs || []);
      setMensal(r.meses || []);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar série mensal', message: e?.message });
    } finally {
      setLoadingMensal(false);
    }
  }, [selectedBar?.id, showToast]);

  useEffect(() => { carregarDiario(); }, [carregarDiario]);
  useEffect(() => { if (aba === 'mensal' && mensal.length === 0) carregarMensal(); }, [aba, mensal.length, carregarMensal]);

  const maxDia = useMemo(() => Math.max(1, ...dias.map((d) => d.total_autorizado)), [dias]);

  const chartData = useMemo(() => mensal.map((m) => {
    const row: any = { ym: m.ym, label: labelMesCurto(m.ym) };
    for (const c of cnpjsMensal) row[`c${c.indice}`] = m.por_cnpj[c.indice] || 0;
    return row;
  }), [mensal, cnpjsMensal]);

  return (
    <div className="p-4 md:p-6 mx-auto space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5"><ReceiptText className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-xl font-semibold">Notas Fiscais</h1>
            <p className="text-sm text-muted-foreground">Total emitido em NF, consolidado por CNPJ (ContaHub).</p>
          </div>
        </div>
        {aba === 'diario' && (
          <div className="flex items-center gap-2">
            <select value={mesSel} onChange={(e) => setMesSel(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
              {meses.length === 0 && <option value="">—</option>}
              {meses.map((m) => <option key={m} value={m}>{labelMes(m)}</option>)}
            </select>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b">
        {([['diario', 'Diário', CalendarDays], ['mensal', 'Mensal (YoY)', BarChart3]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${aba === id ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {aba === 'diario' && (
        <>
          {/* Cards resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Total emitido</div>
                <div className="text-2xl font-semibold mt-1">{fmtBRL(resumo?.total_autorizado)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {fmtNum(resumo?.qtd_notas)} notas · {fmtNum(resumo?.dias)} dias
                  {resumo?.total_nfe > 0 ? ` · NFe ${fmtBRL(resumo.total_nfe)}` : ''}
                </div>
              </CardContent>
            </Card>
            {cnpjs.map((c) => (
              <Card key={c.indice}>
                <CardContent className="p-4">
                  <div className={`text-xs font-medium flex items-center gap-1.5 ${txtCnpj(c.indice)}`}><ReceiptText className="h-3.5 w-3.5" /> {c.label}</div>
                  <div className="text-2xl font-semibold mt-1">{fmtBRL(resumo?.por_cnpj?.[c.indice]?.total_autorizado)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{fmtNum(resumo?.por_cnpj?.[c.indice]?.qtd_notas)} notas{c.documento ? ` · ${c.documento}` : ''}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabela diária pivotada por CNPJ */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left font-medium px-4 py-2.5">Dia</th>
                      {cnpjs.map((c) => <th key={c.indice} className={`text-right font-medium px-4 py-2.5 ${txtCnpj(c.indice)}`}>{c.label}</th>)}
                      <th className="text-right font-medium px-4 py-2.5">Total do dia</th>
                      <th className="text-right font-medium px-4 py-2.5">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dias.map((d) => (
                      <tr key={d.data} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className="font-medium">{fmtData(d.data)}</span>
                          <span className="text-xs text-muted-foreground ml-1.5">{dow(d.data)}</span>
                        </td>
                        {cnpjs.map((c) => {
                          const v = d.por_cnpj[c.indice];
                          return (
                            <td key={c.indice} className="px-4 py-2 text-right tabular-nums">
                              {v ? fmtBRL(v.total_autorizado) : <span className="text-muted-foreground/40">—</span>}
                              {v && v.total_nfe > 0 && <span className="block text-[10px] text-violet-500">NFe {fmtBRL(v.total_nfe)}</span>}
                              {v && v.total_cancelado > 0 && (
                                <span className="text-[10px] text-red-500 flex items-center justify-end gap-0.5"><Ban className="h-2.5 w-2.5" /> {fmtBRL(v.total_cancelado)}</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2 text-right tabular-nums font-semibold">
                          <div>{fmtBRL(d.total_autorizado)}</div>
                          <div className="mt-1 h-1.5 rounded bg-muted/40"><div className="h-1.5 rounded bg-primary" style={{ width: `${Math.max(2, (d.total_autorizado / maxDia) * 100)}%` }} /></div>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{fmtNum(d.qtd_notas)}</td>
                      </tr>
                    ))}
                    {!loading && dias.length === 0 && (
                      <tr><td colSpan={cnpjs.length + 3} className="px-4 py-10 text-center text-muted-foreground">Nenhuma nota fiscal no período.</td></tr>
                    )}
                  </tbody>
                  {dias.length > 0 && (
                    <tfoot>
                      <tr className="border-t bg-muted/20 font-semibold">
                        <td className="px-4 py-2.5">Total</td>
                        {cnpjs.map((c) => <td key={c.indice} className="px-4 py-2.5 text-right tabular-nums">{fmtBRL(resumo?.por_cnpj?.[c.indice]?.total_autorizado)}</td>)}
                        <td className="px-4 py-2.5 text-right tabular-nums">{fmtBRL(resumo?.total_autorizado)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{fmtNum(resumo?.qtd_notas)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {aba === 'mensal' && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium">Total emitido por mês (empilhado por CNPJ)</h2>
                {loadingMensal && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRLk(v)} width={44} />
                    <Tooltip
                      formatter={(v: any, name: any) => [fmtBRL(v), cnpjsMensal.find((c) => `c${c.indice}` === name)?.label || name]}
                      labelFormatter={(l) => `Mês: ${l}`}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Legend formatter={(name) => cnpjsMensal.find((c) => `c${c.indice}` === name)?.label || name} wrapperStyle={{ fontSize: 12 }} />
                    {cnpjsMensal.map((c) => (
                      <Bar key={c.indice} dataKey={`c${c.indice}`} stackId="nf" fill={hexCnpj(c.indice)} radius={[2, 2, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left font-medium px-4 py-2.5">Mês</th>
                      {cnpjsMensal.map((c) => <th key={c.indice} className={`text-right font-medium px-4 py-2.5 ${txtCnpj(c.indice)}`}>{c.label}</th>)}
                      <th className="text-right font-medium px-4 py-2.5">Total</th>
                      <th className="text-right font-medium px-4 py-2.5">vs ano ant.</th>
                      <th className="text-right font-medium px-4 py-2.5">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...mensal].reverse().map((m) => (
                      <tr key={m.ym} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2 whitespace-nowrap font-medium">{labelMes(m.ym)}</td>
                        {cnpjsMensal.map((c) => (
                          <td key={c.indice} className="px-4 py-2 text-right tabular-nums">
                            {m.por_cnpj[c.indice] ? fmtBRL(m.por_cnpj[c.indice]) : <span className="text-muted-foreground/40">—</span>}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtBRL(m.total_autorizado)}</td>
                        <td className="px-4 py-2 text-right tabular-nums"><YoY pct={m.yoy_pct} /></td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{fmtNum(m.qtd_notas)}</td>
                      </tr>
                    ))}
                    {!loadingMensal && mensal.length === 0 && (
                      <tr><td colSpan={cnpjsMensal.length + 4} className="px-4 py-10 text-center text-muted-foreground">Sem dados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Consolidado pela data contábil de emissão da nota. YoY compara com o mesmo mês do ano anterior. Rótulos de CNPJ em <code>financial.nf_cnpj_labels</code>.
      </p>
    </div>
  );
}

export default function NotasFiscaisPage() {
  return (
    <ProtectedRoute>
      <NotasFiscaisInner />
    </ProtectedRoute>
  );
}
