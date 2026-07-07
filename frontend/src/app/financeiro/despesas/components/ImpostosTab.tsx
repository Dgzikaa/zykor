'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Receipt, Loader2, Send, Check, AlertTriangle } from 'lucide-react';

type Tributo = { sigla: string; nome: string; valor: number; vencimento: string; periodicidade: 'mensal' | 'trimestral'; ja_lancado: boolean; valor_lancado: number | null };
type Base = { faturamento_nf: number; faturamento_stone: number; faturamento: number; couvert: number; gorjeta: number; bebidas_frias: number; base_lucro: number; base_monofasica: number };
type Preview = { bar_id: number; ano: number; mes: number; competencia: string; base: Base; tributos: Tributo[] };

const fmtBRL = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const brDate = (d: string) => (d ? d.split('-').reverse().join('/') : '—');
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function ultimosMeses(n: number) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  const out: { ano: number; mes: number; label: string; key: string }[] = [];
  for (let i = 0; i < n; i++) { const ano = d.getFullYear(), mes = d.getMonth() + 1; out.push({ ano, mes, label: `${MESES[mes - 1]}/${ano}`, key: `${ano}-${mes}` }); d.setMonth(d.getMonth() - 1); }
  return out;
}

export function ImpostosTab() {
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
      const r = await api.get(`/api/financeiro/fechamento/impostos?bar_id=${selectedBar.id}&ano=${ano}&mes=${mes}`);
      if (r?.error) throw new Error(r.error);
      setData(r);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar impostos', message: e?.message });
      setData(null);
    } finally { setLoading(false); }
  }, [selectedBar?.id, ano, mes, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const tributos = data?.tributos || [];
  const pendentes = tributos.filter((t) => t.valor >= 0.01 && !t.ja_lancado);
  const totalImpostos = tributos.reduce((s, t) => s + Number(t.valor || 0), 0);

  const lancar = async () => {
    if (!selectedBar?.id) return;
    setLancando(true);
    try {
      const r = await api.post('/api/financeiro/fechamento/impostos', { bar_id: selectedBar.id, ano, mes });
      if (r?.ok || r?.skipped) showToast({ type: 'success', title: r?.skipped ? 'Nada a lançar' : 'Impostos lançados no Conta Azul' });
      else {
        const err = (r?.resultados || []).find((x: any) => !x.ok)?.erro || r?.error || 'Erro';
        showToast({ type: 'error', title: 'Falha ao lançar', message: err });
      }
      await carregar();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Falha ao lançar', message: e?.message });
    } finally { setLancando(false); setConfirmando(false); }
  };

  const b = data?.base;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5"><Receipt className="h-5 w-5 text-primary" /></div>
          <div>
            <h2 className="font-semibold">Simulação de Impostos</h2>
            <p className="text-sm text-muted-foreground">Placeholder simulado (IRPJ, CSLL, ICMS, COFINS, PIS) — substituir pelo oficial depois.</p>
          </div>
        </div>
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
          {opcoesMes.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Faturamento = <b>maior</b> entre NF ContaHub e Stone. Base IRPJ/CSLL tira gorjeta e couvert; PIS/COFINS também tiram bebidas frias (monofásico). 5 despesas na categoria <b>&quot;IMPOSTO&quot;</b>, sem baixa.</span>
      </div>

      {/* base de cálculo */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><div className="text-xs text-muted-foreground">Faturamento (usado)</div><div className="font-semibold tabular-nums">{fmtBRL(b?.faturamento)}</div><div className="text-[10px] text-muted-foreground">NF {fmtBRL(b?.faturamento_nf)} · Stone {fmtBRL(b?.faturamento_stone)}</div></div>
            <div><div className="text-xs text-muted-foreground">Couvert</div><div className="font-semibold tabular-nums">{fmtBRL(b?.couvert)}</div></div>
            <div><div className="text-xs text-muted-foreground">Gorjeta</div><div className="font-semibold tabular-nums">{fmtBRL(b?.gorjeta)}</div></div>
            <div><div className="text-xs text-muted-foreground">Bebidas frias</div><div className="font-semibold tabular-nums">{fmtBRL(b?.bebidas_frias)}</div></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium px-4 py-2.5">Tributo</th>
                  <th className="text-left font-medium px-4 py-2.5">Periodicidade</th>
                  <th className="text-left font-medium px-4 py-2.5">Vencimento</th>
                  <th className="text-right font-medium px-4 py-2.5">Valor simulado</th>
                  <th className="text-center font-medium px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {tributos.map((t) => (
                  <tr key={t.sigla} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{t.sigla}</td>
                    <td className="px-4 py-2 text-muted-foreground">{t.periodicidade === 'trimestral' ? 'Trimestral' : 'Mensal'}</td>
                    <td className="px-4 py-2 text-muted-foreground tabular-nums">{brDate(t.vencimento)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtBRL(t.valor)}</td>
                    <td className="px-4 py-2 text-center">
                      {t.ja_lancado ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> lançado</span>
                        : t.valor >= 0.01 ? <span className="text-xs text-amber-600 dark:text-amber-400">pendente</span>
                        : <span className="text-xs text-muted-foreground/40">—</span>}
                    </td>
                  </tr>
                ))}
                {!loading && tributos.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Sem base no período.</td></tr>}
              </tbody>
              {tributos.length > 0 && (
                <tfoot><tr className="border-t bg-muted/20 font-semibold"><td className="px-4 py-2.5" colSpan={3}>Total impostos</td><td className="px-4 py-2.5 text-right tabular-nums">{fmtBRL(totalImpostos)}</td><td /></tr></tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {confirmando ? (
          <>
            <span className="text-xs text-muted-foreground">Confirmar {pendentes.length} imposto(s) no CA?</span>
            <button onClick={() => setConfirmando(false)} className="rounded-md border px-3 h-9 text-sm hover:bg-muted/60">Cancelar</button>
            <button onClick={lancar} disabled={lancando} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-9 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {lancando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Confirmar
            </button>
          </>
        ) : (
          <button onClick={() => setConfirmando(true)} disabled={loading || lancando || pendentes.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-9 text-sm font-medium text-primary-foreground disabled:opacity-50">
            <Send className="h-4 w-4" /> Lançar no Conta Azul{pendentes.length ? ` (${pendentes.length})` : ''}
          </button>
        )}
      </div>
    </div>
  );
}
