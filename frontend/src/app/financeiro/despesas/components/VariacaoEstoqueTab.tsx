'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Boxes, Loader2, Send, Check, AlertTriangle, ArrowRight } from 'lucide-react';

type Linha = {
  key: 'bebida' | 'comida' | 'drink';
  label: string;
  inicial: number;
  final: number;
  variacao: number;
  sinal: 'RECEITA' | 'DESPESA';
  ja_lancado: boolean;
  valor_lancado: number | null;
};
type Preview = { bar_id: number; ano: number; mes: number; competencia: string; semanaIni: string; semanaFim: string; linhas: Linha[] };

const fmtBRL = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** Últimos N meses como {ano, mes, label}, começando pelo mês anterior. */
function ultimosMeses(n: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1); // começa no mês anterior
  const out: { ano: number; mes: number; label: string; key: string }[] = [];
  for (let i = 0; i < n; i++) {
    const ano = d.getFullYear();
    const mes = d.getMonth() + 1;
    out.push({ ano, mes, label: `${MESES[mes - 1]}/${ano}`, key: `${ano}-${mes}` });
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

export function VariacaoEstoqueTab() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const opcoesMes = useMemo(() => ultimosMeses(12), []);
  const [sel, setSel] = useState(opcoesMes[0]?.key || '');
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [lancando, setLancando] = useState(false);

  const { ano, mes } = useMemo(() => {
    const [a, m] = sel.split('-').map(Number);
    return { ano: a, mes: m };
  }, [sel]);

  const carregar = useCallback(async () => {
    if (!selectedBar?.id || !ano || !mes) return;
    setLoading(true);
    setConfirmando(false);
    try {
      const r = await api.get(`/api/financeiro/fechamento/variacao-estoque?bar_id=${selectedBar.id}&ano=${ano}&mes=${mes}`);
      if (r?.error) throw new Error(r.error);
      setData(r);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar variação de estoque', message: e?.message });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, ano, mes, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const linhas = data?.linhas || [];
  const pendentes = linhas.filter((l) => Math.abs(l.variacao) >= 0.01 && !l.ja_lancado);
  const todosZerados = linhas.every((l) => Math.abs(l.variacao) < 0.01);

  const [lancandoChave, setLancandoChave] = useState<string | null>(null);

  const postLancar = async (extra: any) => {
    if (!selectedBar?.id) return;
    try {
      const r = await api.post('/api/financeiro/fechamento/variacao-estoque', { bar_id: selectedBar.id, ano, mes, ...extra });
      if (r?.ok || r?.skipped) {
        showToast({ type: 'success', title: r?.skipped ? 'Nada a lançar' : 'Variação lançada no Conta Azul' });
      } else {
        const err = (r?.resultados || []).find((x: any) => !x.ok)?.erro || r?.error || r?.erro || 'Erro';
        showToast({ type: 'error', title: 'Falha ao lançar', message: err });
      }
      await carregar();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Falha ao lançar', message: e?.message });
    }
  };
  const lancarTodos = async () => { setLancando(true); try { await postLancar({}); } finally { setLancando(false); setConfirmando(false); } };
  const lancarUm = async (key: string) => { setLancandoChave(key); try { await postLancar({ chave: key }); } finally { setLancandoChave(null); } };
  const ocupado = lancando || lancandoChave !== null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5"><Boxes className="h-5 w-5 text-primary" /></div>
          <div>
            <h2 className="font-semibold">Variação de Estoque</h2>
            <p className="text-sm text-muted-foreground">Estoque Final − Estoque Inicial por categoria, no fechamento do mês.</p>
          </div>
        </div>
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
          {opcoesMes.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Lançado por <b>competência</b> (sem baixa). Convenção contábil: variação <b>positiva</b> (estoque cresceu) reduz o CMV →
          entra como <b>receita</b> em <b>&quot;VARIAÇÃO DE ESTOQUE&quot;</b>; variação <b>negativa</b> → <b>despesa</b> em <b>&quot;Variação de Estoque&quot;</b>.
          O Conta Azul não permite excluir lançamento — confira antes de lançar.
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium px-4 py-2.5">Categoria</th>
                  <th className="text-right font-medium px-4 py-2.5">Estoque inicial</th>
                  <th className="text-right font-medium px-4 py-2.5">Estoque final</th>
                  <th className="text-right font-medium px-4 py-2.5">Variação</th>
                  <th className="text-left font-medium px-4 py-2.5">Destino no CA</th>
                  <th className="text-center font-medium px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const zero = Math.abs(l.variacao) < 0.01;
                  return (
                    <tr key={l.key} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">{l.label}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{fmtBRL(l.inicial)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{fmtBRL(l.final)}</td>
                      <td className={`px-4 py-2 text-right tabular-nums font-semibold ${zero ? 'text-muted-foreground/50' : l.variacao > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {l.variacao > 0 ? '+' : ''}{fmtBRL(l.variacao)}
                      </td>
                      <td className="px-4 py-2">
                        {zero ? <span className="text-muted-foreground/40">—</span> : (
                          <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 ${l.sinal === 'RECEITA' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                            {l.sinal === 'RECEITA' ? 'Receita' : 'Despesa'} <ArrowRight className="h-3 w-3" /> {l.sinal === 'RECEITA' ? 'VARIAÇÃO DE ESTOQUE' : 'Variação de Estoque'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {l.ja_lancado ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> lançado</span>
                        ) : zero ? (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        ) : (
                          <button onClick={() => lancarUm(l.key)} disabled={ocupado}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted/60 disabled:opacity-50" title="Lançar esta linha no Conta Azul">
                            {lancandoChave === l.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Lançar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!loading && linhas.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Sem dados de estoque no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : `Fonte: contagem de estoque (semanas ${data?.semanaIni} → ${data?.semanaFim}). Competência ${data?.competencia || '—'}.`}
        </p>
        {confirmando ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Confirmar {pendentes.length} lançamento(s) no CA?</span>
            <button onClick={() => setConfirmando(false)} className="rounded-md border px-3 h-9 text-sm hover:bg-muted/60">Cancelar</button>
            <button onClick={lancarTodos} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-9 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {lancando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Confirmar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmando(true)}
            disabled={loading || ocupado || pendentes.length === 0 || todosZerados}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-9 text-sm font-medium text-primary-foreground disabled:opacity-50"
            title={pendentes.length === 0 ? 'Nada pendente para lançar' : `Lançar todos os ${pendentes.length} no Conta Azul`}
          >
            <Send className="h-4 w-4" /> Lançar todos os pendentes{pendentes.length ? ` (${pendentes.length})` : ''}
          </button>
        )}
      </div>
    </div>
  );
}
