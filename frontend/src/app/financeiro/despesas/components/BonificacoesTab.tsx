'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Gift, Loader2, Send, Check, Plus, Trash2, AlertTriangle } from 'lucide-react';

type Bonif = {
  id: number; fornecedor: string; referente: string | null; valor: number;
  competencia_receita: string; competencia_despesa: string;
  categoria_receita: string; categoria_despesa: string; ca_lancado: boolean;
};
type Preview = { bar_id: number; ano: number; mes: number; total: number; total_lancado: number; bonificacoes: Bonif[]; categorias: { receita: string[]; despesa: string[] } };

const fmtBRL = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const brDate = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—');
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function parseValorBR(s: string): number {
  let t = String(s).trim();
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return Number(t);
}
const hojeISO = () => new Date().toISOString().slice(0, 10);
const primeiroDiaISO = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}-01`;

function ultimosMeses(n: number) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  const out: { ano: number; mes: number; label: string; key: string }[] = [];
  for (let i = 0; i < n; i++) { const ano = d.getFullYear(), mes = d.getMonth() + 1; out.push({ ano, mes, label: `${MESES[mes - 1]}/${ano}`, key: `${ano}-${mes}` }); d.setMonth(d.getMonth() - 1); }
  return out;
}
const acha = (lista: string[], termo: string) => lista.find((c) => c.toLowerCase().includes(termo)) || '';

export function BonificacoesTab() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const opcoesMes = useMemo(() => ultimosMeses(12), []);
  const [sel, setSel] = useState(opcoesMes[0]?.key || '');
  const [lancandoId, setLancandoId] = useState<number | null>(null);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  // form
  const [fornecedor, setFornecedor] = useState('');
  const [referente, setReferente] = useState('');
  const [valor, setValor] = useState('');
  const [compReceita, setCompReceita] = useState('');
  const [compDespesa, setCompDespesa] = useState(hojeISO());
  const [catReceita, setCatReceita] = useState('');
  const [catDespesa, setCatDespesa] = useState('');
  const [salvando, setSalvando] = useState(false);

  const { ano, mes } = useMemo(() => { const [a, m] = sel.split('-').map(Number); return { ano: a, mes: m }; }, [sel]);

  // Cache via SWR: a chave inclui bar + ano + mes; trocar re-busca. mutate() = refetch pós-POST.
  const { data, isLoading: loading, mutate } = useApiSWR<Preview>(
    selectedBar?.id && ano && mes
      ? `/api/financeiro/fechamento/bonificacoes?bar_id=${selectedBar.id}&ano=${ano}&mes=${mes}`
      : null,
    { onError: (e: any) => showToast({ type: 'error', title: 'Erro ao carregar bonificações', message: e?.message }) }
  );

  // default da competência da receita = 1º dia do mês selecionado
  useEffect(() => { setCompReceita(primeiroDiaISO(ano, mes)); }, [ano, mes]);
  // defaults de categoria assim que a lista chega
  useEffect(() => {
    if (!data?.categorias) return;
    setCatReceita((v) => v || acha(data.categorias.receita, 'bonific') || acha(data.categorias.receita, 'variaç'));
    setCatDespesa((v) => v || acha(data.categorias.despesa, 'ajuste bonific') || acha(data.categorias.despesa, 'bonific'));
  }, [data?.categorias]);

  const cadastrar = async () => {
    if (!selectedBar?.id) return;
    const v = parseValorBR(valor);
    if (!fornecedor.trim()) { showToast({ type: 'error', title: 'Informe o fornecedor' }); return; }
    if (!(v > 0)) { showToast({ type: 'error', title: 'Valor inválido' }); return; }
    if (!compReceita || !compDespesa) { showToast({ type: 'error', title: 'Preencha as duas competências' }); return; }
    if (!catReceita || !catDespesa) { showToast({ type: 'error', title: 'Escolha as duas categorias' }); return; }
    setSalvando(true);
    try {
      const r = await api.post('/api/financeiro/fechamento/bonificacoes', {
        bar_id: selectedBar.id, fornecedor: fornecedor.trim(), referente: referente.trim() || null, valor: v,
        competencia_receita: compReceita, competencia_despesa: compDespesa,
        categoria_receita: catReceita, categoria_despesa: catDespesa,
      });
      if (r?.ok) {
        showToast({ type: 'success', title: 'Bonificação cadastrada' });
        setFornecedor(''); setReferente(''); setValor(''); setCompDespesa(hojeISO());
        await mutate();
      } else showToast({ type: 'error', title: 'Falha ao cadastrar', message: r?.error || 'Erro' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Falha ao cadastrar', message: e?.message });
    } finally { setSalvando(false); }
  };

  const lancar = async (id: number) => {
    if (!selectedBar?.id) return;
    setLancandoId(id);
    try {
      const r = await api.post('/api/financeiro/fechamento/bonificacoes/lancar', { bar_id: selectedBar.id, id });
      if (r?.ok) showToast({ type: 'success', title: r?.skipped ? 'Já estava lançada' : 'Bonificação lançada no CA (receita + despesa)' });
      else showToast({ type: 'error', title: 'Falha ao lançar', message: (r?.resultados || []).find((x: any) => !x.ok)?.erro || r?.error || 'Erro' });
      await mutate();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Falha ao lançar', message: e?.message });
    } finally { setLancandoId(null); }
  };

  const excluir = async (id: number) => {
    if (!selectedBar?.id) return;
    setExcluindoId(id);
    try {
      const r = await api.delete(`/api/financeiro/fechamento/bonificacoes?bar_id=${selectedBar.id}&id=${id}`);
      if (r?.ok) { showToast({ type: 'success', title: 'Bonificação excluída' }); await mutate(); }
      else showToast({ type: 'error', title: 'Não foi possível excluir', message: r?.error || 'Erro' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não foi possível excluir', message: e?.message });
    } finally { setExcluindoId(null); }
  };

  const bonificacoes = data?.bonificacoes || [];
  const catsReceita = data?.categorias?.receita || [];
  const catsDespesa = data?.categorias?.despesa || [];
  const ocupado = lancandoId !== null || excluindoId !== null || salvando;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5"><Gift className="h-5 w-5 text-primary" /></div>
          <div>
            <h2 className="font-semibold">Bonificações</h2>
            <p className="text-sm text-muted-foreground">Cada bonificação vira um par soma-zero no CA: 1 receita + 1 despesa (mesmo valor).</p>
          </div>
        </div>
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
          {opcoesMes.map((o) => <option key={o.key} value={o.key}>Chegadas em {o.label}</option>)}
        </select>
      </div>

      {/* form de cadastro */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="text-xs text-muted-foreground">Nova bonificação</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Fornecedor</label>
              <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Ambev, Diageo…" className="h-9 mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Referente a</label>
              <Input value={referente} onChange={(e) => setReferente(e.target.value)} placeholder="Contrato, cashback, uniformes…" className="h-9 mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Valor (nas duas pernas)</label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" className="h-9 mt-1 text-right" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="rounded-lg border p-2.5 space-y-2">
              <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Receita</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground">Competência</label>
                  <Input type="date" value={compReceita} onChange={(e) => setCompReceita(e.target.value)} className="h-9 mt-1" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Categoria</label>
                  <select value={catReceita} onChange={(e) => setCatReceita(e.target.value)} className="w-full h-9 mt-1 rounded-md border bg-background px-2 text-sm">
                    <option value="">Escolher…</option>
                    {catsReceita.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="rounded-lg border p-2.5 space-y-2">
              <div className="text-xs font-medium text-red-600 dark:text-red-400">Despesa</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground">Competência (chegou em)</label>
                  <Input type="date" value={compDespesa} onChange={(e) => setCompDespesa(e.target.value)} className="h-9 mt-1" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Categoria</label>
                  <select value={catDespesa} onChange={(e) => setCatDespesa(e.target.value)} className="w-full h-9 mt-1 rounded-md border bg-background px-2 text-sm">
                    <option value="">Escolher…</option>
                    {catsDespesa.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={cadastrar} disabled={ocupado}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 h-9 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Cadastrar bonificação
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Ao lançar, cada bonificação vira <b>2 lançamentos</b> (1 receita + 1 despesa, mesmo valor, soma zero), cada um na sua competência e categoria, sem baixa. Depois de lançada, não dá pra excluir (o CA não tem DELETE).</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium px-4 py-2.5">Fornecedor</th>
                  <th className="text-left font-medium px-4 py-2.5">Referente</th>
                  <th className="text-left font-medium px-4 py-2.5">Receita (comp. · categoria)</th>
                  <th className="text-left font-medium px-4 py-2.5">Despesa (comp. · categoria)</th>
                  <th className="text-right font-medium px-4 py-2.5">Valor</th>
                  <th className="text-center font-medium px-4 py-2.5">CA</th>
                  <th className="text-center font-medium px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {bonificacoes.map((b) => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{b.fornecedor}</td>
                    <td className="px-4 py-2 text-muted-foreground">{b.referente || <span className="text-muted-foreground/40">—</span>}</td>
                    <td className="px-4 py-2 text-xs"><span className="tabular-nums">{brDate(b.competencia_receita)}</span> · <span className="text-emerald-600 dark:text-emerald-400">{b.categoria_receita}</span></td>
                    <td className="px-4 py-2 text-xs"><span className="tabular-nums">{brDate(b.competencia_despesa)}</span> · <span className="text-red-600 dark:text-red-400">{b.categoria_despesa}</span></td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtBRL(b.valor)}</td>
                    <td className="px-4 py-2 text-center">
                      {b.ca_lancado ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> lançado</span>
                      ) : (
                        <button onClick={() => lancar(b.id)} disabled={ocupado}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted/60 disabled:opacity-50" title="Lançar o par (receita + despesa) no Conta Azul">
                          {lancandoId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Lançar
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {!b.ca_lancado && (
                        <button onClick={() => excluir(b.id)} disabled={ocupado} title="Excluir"
                          className="text-muted-foreground hover:text-red-500 disabled:opacity-40">
                          {excluindoId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && bonificacoes.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nenhuma bonificação com chegada nesse mês.</td></tr>
                )}
              </tbody>
              {bonificacoes.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-muted/20 font-semibold">
                    <td className="px-4 py-2.5" colSpan={4}>Total ({bonificacoes.length}) · lançado {fmtBRL(data?.total_lancado)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtBRL(data?.total)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
