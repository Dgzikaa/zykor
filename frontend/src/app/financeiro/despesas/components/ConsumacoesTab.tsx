'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { HandCoins, Loader2, Send, Check, AlertTriangle, ChevronRight } from 'lucide-react';

type Item = { chave: string; label: string; categoria: string; sinal: 'DESPESA' | 'RECEITA'; valor: number; ja_lancado: boolean };
type DiaResumo = { dia: string; total: number; n_itens: number; n_lancados: number; n_pendentes: number };
type Gran = 'dia' | 'semana' | 'mes';

const fmtBRL = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const brDate = (d: string) => (d ? d.split('-').reverse().join('/') : '');
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const dow = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return DOW[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]; };

function ontemISO() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }
function semanaDe(dataISO: string) {
  const d = new Date(`${dataISO}T00:00:00Z`);
  const n = d.getUTCDay() || 7;
  const seg = new Date(d); seg.setUTCDate(d.getUTCDate() - (n - 1));
  const dom = new Date(seg); dom.setUTCDate(seg.getUTCDate() + 6);
  return { de: seg.toISOString().slice(0, 10), ate: dom.toISOString().slice(0, 10) };
}
function mesDe(dataISO: string) {
  const [y, m] = dataISO.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { de: `${y}-${String(m).padStart(2, '0')}-01`, ate: `${y}-${String(m).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}` };
}

export function ConsumacoesTab() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const [gran, setGran] = useState<Gran>('dia');
  const [dataRef, setDataRef] = useState(ontemISO());
  const [dia, setDia] = useState<{ itens: Item[]; totalDespesas: number; ignorado: number; soma_zero: number } | null>(null);
  const [periodo, setPeriodo] = useState<{ dias: DiaResumo[]; total: number; dias_pendentes: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [lancandoChave, setLancandoChave] = useState<string | null>(null);
  const [lancandoDia, setLancandoDia] = useState<string | null>(null);
  const [lancandoLote, setLancandoLote] = useState(false);

  const range = useMemo(() => gran === 'dia' ? { de: dataRef, ate: dataRef } : gran === 'semana' ? semanaDe(dataRef) : mesDe(dataRef), [gran, dataRef]);

  const carregar = useCallback(async () => {
    if (!selectedBar?.id || !dataRef) return;
    setLoading(true);
    try {
      if (gran === 'dia') {
        const r = await api.get(`/api/financeiro/fechamento/consumacao?bar_id=${selectedBar.id}&data=${dataRef}`);
        if (r?.error) throw new Error(r.error);
        setDia(r); setPeriodo(null);
      } else {
        const { de, ate } = range;
        const r = await api.get(`/api/financeiro/fechamento/consumacao?bar_id=${selectedBar.id}&de=${de}&ate=${ate}`);
        if (r?.error) throw new Error(r.error);
        setPeriodo(r); setDia(null);
      }
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar consumações', message: e?.message });
      setDia(null); setPeriodo(null);
    } finally { setLoading(false); }
  }, [selectedBar?.id, gran, dataRef, range, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const ocupado = lancandoChave !== null || lancandoDia !== null || lancandoLote;

  const postDia = async (d: string, extra: any = {}) => {
    const r = await api.post('/api/financeiro/fechamento/consumacao', { bar_id: selectedBar!.id, data: d, ...extra });
    if (!(r?.ok || r?.skipped)) {
      const err = (r?.resultados || []).find((x: any) => !x.ok)?.erro || r?.error || 'Erro';
      throw new Error(err);
    }
  };
  const lancarUm = async (chave: string) => {
    if (!selectedBar?.id) return;
    setLancandoChave(chave);
    try { await postDia(dataRef, { chave }); showToast({ type: 'success', title: 'Lançado no Conta Azul' }); await carregar(); }
    catch (e: any) { showToast({ type: 'error', title: 'Falha ao lançar', message: e?.message }); }
    finally { setLancandoChave(null); }
  };
  const lancarDia = async (d: string) => {
    if (!selectedBar?.id) return;
    setLancandoDia(d);
    try { await postDia(d); showToast({ type: 'success', title: `Dia ${brDate(d)} lançado` }); await carregar(); }
    catch (e: any) { showToast({ type: 'error', title: 'Falha ao lançar', message: e?.message }); }
    finally { setLancandoDia(null); }
  };
  const lancarLote = async () => {
    if (!selectedBar?.id || !periodo?.dias_pendentes?.length) return;
    setLancandoLote(true);
    let ok = 0, erros = 0;
    for (const d of periodo.dias_pendentes) {
      try { await postDia(d); ok++; } catch { erros++; }
    }
    showToast({ type: erros ? 'error' : 'success', title: `${ok} dia(s) lançado(s)${erros ? `, ${erros} com erro` : ''}` });
    setLancandoLote(false);
    await carregar();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5"><HandCoins className="h-5 w-5 text-primary" /></div>
          <div>
            <h2 className="font-semibold">Consumações</h2>
            <p className="text-sm text-muted-foreground">Cortesias por categoria (custo da ficha), soma-zero. Lançamento é por dia.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border p-0.5">
            {(['dia', 'semana', 'mes'] as const).map((g) => (
              <button key={g} onClick={() => setGran(g)}
                className={`px-2.5 h-8 text-xs rounded-md capitalize ${gran === g ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {g === 'mes' ? 'mês' : g}
              </button>
            ))}
          </div>
          <input type="date" value={dataRef} onChange={(e) => setDataRef(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm" />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {gran === 'dia'
            ? <>Cada categoria entra como <b>despesa</b>; o total entra como <b>receita</b> em <b>&quot;[Consumação] Ajuste CMV&quot;</b> — soma do dia = <b>zero</b>. Competência = o dia, sem baixa.</>
            : <>Visão de <b>{gran === 'semana' ? 'semana' : 'mês'}</b> ({brDate(range.de)} a {brDate(range.ate)}) — cada dia é lançado com a sua própria competência. Clique num dia pra ver as categorias.</>}
        </span>
      </div>

      {/* MODO DIA — categorias */}
      {gran === 'dia' && (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left font-medium px-4 py-2.5">Categoria</th>
                      <th className="text-left font-medium px-4 py-2.5">Tipo</th>
                      <th className="text-right font-medium px-4 py-2.5">Valor (custo)</th>
                      <th className="text-center font-medium px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dia?.itens || []).map((i) => (
                      <tr key={i.chave} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2 font-medium">{i.categoria}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex text-xs rounded-full px-2 py-0.5 ${i.sinal === 'RECEITA' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>{i.sinal === 'RECEITA' ? 'Receita' : 'Despesa'}</span>
                        </td>
                        <td className={`px-4 py-2 text-right tabular-nums font-semibold ${i.sinal === 'RECEITA' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{fmtBRL(i.valor)}</td>
                        <td className="px-4 py-2 text-center">
                          {i.ja_lancado
                            ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> lançado</span>
                            : <button onClick={() => lancarUm(i.chave)} disabled={ocupado} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted/60 disabled:opacity-50">
                                {lancandoChave === i.chave ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Lançar
                              </button>}
                        </td>
                      </tr>
                    ))}
                    {!loading && (dia?.itens || []).length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Sem consumações nesse dia.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : <>Total despesas {fmtBRL(dia?.totalDespesas)} · soma-zero: {dia ? fmtBRL(dia.soma_zero) : '—'}{dia && dia.ignorado > 0 ? <> · não lançado: {fmtBRL(dia.ignorado)}</> : null}</>}
            </p>
            <button onClick={() => lancarDia(dataRef)} disabled={ocupado || !(dia?.itens || []).some((i) => !i.ja_lancado)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-9 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {lancandoDia === dataRef ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Lançar dia inteiro
            </button>
          </div>
        </>
      )}

      {/* MODO PERÍODO — dias */}
      {gran !== 'dia' && (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left font-medium px-4 py-2.5">Dia</th>
                      <th className="text-right font-medium px-4 py-2.5">Total (custo)</th>
                      <th className="text-center font-medium px-4 py-2.5">Lançados</th>
                      <th className="text-center font-medium px-4 py-2.5">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(periodo?.dias || []).map((d) => {
                      const completo = d.n_pendentes === 0;
                      return (
                        <tr key={d.dia} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-2">
                            <button onClick={() => { setGran('dia'); setDataRef(d.dia); }} className="inline-flex items-center gap-1 hover:text-primary">
                              <span className="font-medium">{brDate(d.dia)}</span>
                              <span className="text-xs text-muted-foreground">{dow(d.dia)}</span>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtBRL(d.total)}</td>
                          <td className="px-4 py-2 text-center text-xs tabular-nums">
                            {completo ? <span className="text-emerald-600 dark:text-emerald-400">{d.n_lancados}/{d.n_itens} ✓</span> : <span className="text-amber-600 dark:text-amber-400">{d.n_lancados}/{d.n_itens}</span>}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {completo
                              ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> ok</span>
                              : <button onClick={() => lancarDia(d.dia)} disabled={ocupado} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted/60 disabled:opacity-50">
                                  {lancandoDia === d.dia ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Lançar dia
                                </button>}
                          </td>
                        </tr>
                      );
                    })}
                    {!loading && (periodo?.dias || []).length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Sem consumações no período.</td></tr>
                    )}
                  </tbody>
                  {(periodo?.dias || []).length > 0 && (
                    <tfoot>
                      <tr className="border-t bg-muted/20 font-semibold">
                        <td className="px-4 py-2.5">Total do período</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{fmtBRL(periodo?.total)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : `${(periodo?.dias_pendentes || []).length} dia(s) pendente(s) no período.`}
            </p>
            <button onClick={lancarLote} disabled={ocupado || !(periodo?.dias_pendentes || []).length}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-9 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {lancandoLote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Lançar todos os dias pendentes{(periodo?.dias_pendentes || []).length ? ` (${periodo!.dias_pendentes.length})` : ''}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
