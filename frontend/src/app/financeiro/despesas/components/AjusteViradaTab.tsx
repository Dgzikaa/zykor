'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { CalendarSync, Loader2, Send, Check, AlertTriangle } from 'lucide-react';

type Perna = { chave: 'receita' | 'despesa'; sinal: 'RECEITA' | 'DESPESA'; competencia: string; label: string; valor: number; ja_lancado: boolean };
type Preview = { bar_id: number; ano: number; mes: number; competencia: string; valor: number; madrugadaDia?: string; pernas: Perna[] };

const fmtBRL = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const brDate = (d: string) => (d ? d.split('-').reverse().join('/') : '—');
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function ultimosMeses(n: number) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  const out: { ano: number; mes: number; label: string; key: string }[] = [];
  for (let i = 0; i < n; i++) { const ano = d.getFullYear(), mes = d.getMonth() + 1; out.push({ ano, mes, label: `${MESES[mes - 1]}/${ano}`, key: `${ano}-${mes}` }); d.setMonth(d.getMonth() - 1); }
  return out;
}

export function AjusteViradaTab() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const opcoesMes = useMemo(() => ultimosMeses(12), []);
  const [sel, setSel] = useState(opcoesMes[0]?.key || '');
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [lancando, setLancando] = useState(false);

  const { ano, mes } = useMemo(() => { const [a, m] = sel.split('-').map(Number); return { ano: a, mes: m }; }, [sel]);

  const carregar = useCallback(async () => {
    if (!selectedBar?.id || !ano || !mes) return;
    setLoading(true); setConfirmando(false);
    try {
      const r = await api.get(`/api/financeiro/fechamento/ajuste-virada?bar_id=${selectedBar.id}&ano=${ano}&mes=${mes}`);
      if (r?.error) throw new Error(r.error);
      setData(r);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar ajuste da virada', message: e?.message });
      setData(null);
    } finally { setLoading(false); }
  }, [selectedBar?.id, ano, mes, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const pernas = data?.pernas || [];
  const pendentes = pernas.filter((p) => !p.ja_lancado);
  const temValor = !!data && data.valor > 0;

  const [lancandoChave, setLancandoChave] = useState<string | null>(null);

  const postLancar = async (extra: any) => {
    if (!selectedBar?.id) return;
    try {
      const r = await api.post('/api/financeiro/fechamento/ajuste-virada', { bar_id: selectedBar.id, ano, mes, ...extra });
      if (r?.ok || r?.skipped) showToast({ type: 'success', title: r?.skipped ? 'Nada a lançar' : 'Ajuste da virada lançado no Conta Azul' });
      else {
        const err = (r?.resultados || []).find((x: any) => !x.ok)?.erro || r?.error || 'Erro';
        showToast({ type: 'error', title: 'Falha ao lançar', message: err });
      }
      await carregar();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Falha ao lançar', message: e?.message });
    }
  };
  const lancarTodos = async () => { setLancando(true); try { await postLancar({}); } finally { setLancando(false); setConfirmando(false); } };
  const lancarUm = async (chave: string) => { setLancandoChave(chave); try { await postLancar({ chave }); } finally { setLancandoChave(null); } };
  const ocupado = lancando || lancandoChave !== null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5"><CalendarSync className="h-5 w-5 text-primary" /></div>
          <div>
            <h2 className="font-semibold">Ajuste Receita Virada do Mês</h2>
            <p className="text-sm text-muted-foreground">Faturamento Stone da madrugada (00h–06h) que fecha o mês, movido pra competência certa.</p>
          </div>
        </div>
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
          {opcoesMes.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>+Receita na competência do último dia e −Despesa (mesmo valor) no dia 01 do mês seguinte, ambos em <b>&quot;Ajuste Receita Virada do Mês&quot;</b>. Soma total = zero, sem baixa.</span>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Faturamento Stone na madrugada 00:00–06:00{data?.madrugadaDia ? ` de ${brDate(data.madrugadaDia)}` : ''} (última noite operacional do mês — soma todas as empresas do bar)</div>
          <div className="text-3xl font-semibold mt-1">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : fmtBRL(data?.valor)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left font-medium px-4 py-2.5">Lançamento</th>
                <th className="text-left font-medium px-4 py-2.5">Competência</th>
                <th className="text-right font-medium px-4 py-2.5">Valor</th>
                <th className="text-center font-medium px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {pernas.map((p) => (
                <tr key={p.chave} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <span className={`inline-flex text-xs rounded-full px-2 py-0.5 mr-2 ${p.sinal === 'RECEITA' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>{p.sinal === 'RECEITA' ? 'Receita' : 'Despesa'}</span>
                    {p.label}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground tabular-nums">{brDate(p.competencia)}</td>
                  <td className={`px-4 py-2 text-right tabular-nums font-semibold ${p.sinal === 'RECEITA' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{p.sinal === 'RECEITA' ? '+' : '−'}{fmtBRL(p.valor)}</td>
                  <td className="px-4 py-2 text-center">
                    {p.ja_lancado ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> lançado</span>
                      : temValor ? (
                        <button onClick={() => lancarUm(p.chave)} disabled={ocupado}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted/60 disabled:opacity-50" title="Lançar esta perna no Conta Azul">
                          {lancandoChave === p.chave ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Lançar
                        </button>
                      ) : <span className="text-xs text-muted-foreground/40">—</span>}
                  </td>
                </tr>
              ))}
              {!loading && pernas.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Sem dados.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {confirmando ? (
          <>
            <span className="text-xs text-muted-foreground">Confirmar {pendentes.length} lançamento(s) no CA?</span>
            <button onClick={() => setConfirmando(false)} className="rounded-md border px-3 h-9 text-sm hover:bg-muted/60">Cancelar</button>
            <button onClick={lancarTodos} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-9 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {lancando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Confirmar
            </button>
          </>
        ) : (
          <button onClick={() => setConfirmando(true)} disabled={loading || ocupado || !temValor || pendentes.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-9 text-sm font-medium text-primary-foreground disabled:opacity-50">
            <Send className="h-4 w-4" /> Lançar todos os pendentes{pendentes.length ? ` (${pendentes.length})` : ''}
          </button>
        )}
      </div>
    </div>
  );
}
