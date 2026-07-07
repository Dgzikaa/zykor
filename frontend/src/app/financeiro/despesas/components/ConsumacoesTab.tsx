'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { HandCoins, Loader2, Send, Check, AlertTriangle } from 'lucide-react';

type Item = { chave: string; label: string; categoria: string; sinal: 'DESPESA' | 'RECEITA'; valor: number; ja_lancado: boolean };
type Preview = { bar_id: number; dia: string; totalDespesas: number; ignorado: number; soma_zero: number; itens: Item[] };

const fmtBRL = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const brDate = (d: string) => (d ? d.split('-').reverse().join('/') : '');

function ontemISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function ConsumacoesTab() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const [dia, setDia] = useState(ontemISO());
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [lancando, setLancando] = useState(false);

  const carregar = useCallback(async () => {
    if (!selectedBar?.id || !dia) return;
    setLoading(true);
    setConfirmando(false);
    try {
      const r = await api.get(`/api/financeiro/fechamento/consumacao?bar_id=${selectedBar.id}&data=${dia}`);
      if (r?.error) throw new Error(r.error);
      setData(r);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar consumações', message: e?.message });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, dia, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const itens = data?.itens || [];
  const pendentes = itens.filter((i) => !i.ja_lancado);

  const [lancandoChave, setLancandoChave] = useState<string | null>(null);

  const postLancar = async (extra: any) => {
    if (!selectedBar?.id) return;
    try {
      const r = await api.post('/api/financeiro/fechamento/consumacao', { bar_id: selectedBar.id, data: dia, ...extra });
      if (r?.ok || r?.skipped) {
        showToast({ type: 'success', title: r?.skipped ? 'Nada a lançar' : 'Consumações lançadas no Conta Azul' });
      } else {
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
          <div className="rounded-xl bg-primary/10 p-2.5"><HandCoins className="h-5 w-5 text-primary" /></div>
          <div>
            <h2 className="font-semibold">Consumações</h2>
            <p className="text-sm text-muted-foreground">Cortesias do dia por categoria (custo da ficha), soma-zero com o Ajuste CMV.</p>
          </div>
        </div>
        <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm" />
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Cada categoria entra como <b>despesa</b>; o total entra como <b>receita</b> em <b>&quot;[Consumação] Ajuste CMV&quot;</b> — soma do dia = <b>zero</b>. Competência = o dia, sem baixa.</span>
      </div>

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
                {itens.map((i) => (
                  <tr key={i.chave} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{i.categoria}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex text-xs rounded-full px-2 py-0.5 ${i.sinal === 'RECEITA' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                        {i.sinal === 'RECEITA' ? 'Receita' : 'Despesa'}
                      </span>
                    </td>
                    <td className={`px-4 py-2 text-right tabular-nums font-semibold ${i.sinal === 'RECEITA' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{fmtBRL(i.valor)}</td>
                    <td className="px-4 py-2 text-center">
                      {i.ja_lancado
                        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> lançado</span>
                        : (
                          <button onClick={() => lancarUm(i.chave)} disabled={ocupado}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted/60 disabled:opacity-50" title="Lançar esta categoria no Conta Azul">
                            {lancandoChave === i.chave ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Lançar
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
                {!loading && itens.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Sem consumações nesse dia.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : (
            <>Total despesas {fmtBRL(data?.totalDespesas)} · soma-zero: {data ? fmtBRL(data.soma_zero) : '—'}
            {data && data.ignorado > 0 ? <> · não lançado (motivo/outros): {fmtBRL(data.ignorado)}</> : null}</>
          )}
        </p>
        {confirmando ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Confirmar {pendentes.length} lançamento(s) de {brDate(dia)}?</span>
            <button onClick={() => setConfirmando(false)} className="rounded-md border px-3 h-9 text-sm hover:bg-muted/60">Cancelar</button>
            <button onClick={lancarTodos} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-9 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {lancando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Confirmar
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmando(true)} disabled={loading || ocupado || pendentes.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-9 text-sm font-medium text-primary-foreground disabled:opacity-50">
            <Send className="h-4 w-4" /> Lançar dia inteiro no Conta Azul{pendentes.length ? ` (${pendentes.length})` : ''}
          </button>
        )}
      </div>
    </div>
  );
}
