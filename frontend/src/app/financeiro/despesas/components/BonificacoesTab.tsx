'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Gift, Loader2, Send, Check, Plus, Trash2, AlertTriangle } from 'lucide-react';

type Bonif = { id: number; fornecedor: string; referente: string | null; valor: number; competencia: string; data_chegada: string | null; ca_lancado: boolean };
type Preview = { bar_id: number; ano: number; mes: number; competencia: string; total: number; total_lancado: number; bonificacoes: Bonif[] };

const fmtBRL = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const brDate = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—');
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Aceita "1.234,56" | "1234,56" | "1234.56" | "1234" (input type=text inputMode=decimal, locale pt-BR).
function parseValorBR(s: string): number {
  let t = String(s).trim();
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return Number(t);
}

function ultimosMeses(n: number) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  const out: { ano: number; mes: number; label: string; key: string }[] = [];
  for (let i = 0; i < n; i++) { const ano = d.getFullYear(), mes = d.getMonth() + 1; out.push({ ano, mes, label: `${MESES[mes - 1]}/${ano}`, key: `${ano}-${mes}` }); d.setMonth(d.getMonth() - 1); }
  return out;
}

export function BonificacoesTab() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const opcoesMes = useMemo(() => ultimosMeses(12), []);
  const [sel, setSel] = useState(opcoesMes[0]?.key || '');
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [lancandoId, setLancandoId] = useState<number | null>(null);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  // form de cadastro
  const [fornecedor, setFornecedor] = useState('');
  const [valor, setValor] = useState('');
  const [referente, setReferente] = useState('');
  const [dataChegada, setDataChegada] = useState('');
  const [salvando, setSalvando] = useState(false);

  const { ano, mes } = useMemo(() => { const [a, m] = sel.split('-').map(Number); return { ano: a, mes: m }; }, [sel]);

  const carregar = useCallback(async () => {
    if (!selectedBar?.id || !ano || !mes) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/financeiro/fechamento/bonificacoes?bar_id=${selectedBar.id}&ano=${ano}&mes=${mes}`);
      if (r?.error) throw new Error(r.error);
      setData(r);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar bonificações', message: e?.message });
      setData(null);
    } finally { setLoading(false); }
  }, [selectedBar?.id, ano, mes, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const cadastrar = async () => {
    if (!selectedBar?.id) return;
    const v = parseValorBR(valor);
    if (!fornecedor.trim()) { showToast({ type: 'error', title: 'Informe o fornecedor' }); return; }
    if (!(v > 0)) { showToast({ type: 'error', title: 'Valor inválido' }); return; }
    setSalvando(true);
    try {
      const r = await api.post('/api/financeiro/fechamento/bonificacoes', {
        bar_id: selectedBar.id, fornecedor: fornecedor.trim(), valor: v, referente: referente.trim() || null,
        ano, mes, data_chegada: dataChegada || null,
      });
      if (r?.ok) {
        showToast({ type: 'success', title: 'Bonificação cadastrada' });
        setFornecedor(''); setValor(''); setReferente(''); setDataChegada('');
        await carregar();
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
      if (r?.ok) showToast({ type: 'success', title: r?.skipped ? 'Já estava lançada' : 'Bonificação lançada no Conta Azul' });
      else showToast({ type: 'error', title: 'Falha ao lançar', message: r?.error || r?.erro || 'Erro' });
      await carregar();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Falha ao lançar', message: e?.message });
    } finally { setLancandoId(null); }
  };

  const excluir = async (id: number) => {
    if (!selectedBar?.id) return;
    setExcluindoId(id);
    try {
      const r = await api.delete(`/api/financeiro/fechamento/bonificacoes?bar_id=${selectedBar.id}&id=${id}`);
      if (r?.ok) { showToast({ type: 'success', title: 'Bonificação excluída' }); await carregar(); }
      else showToast({ type: 'error', title: 'Não foi possível excluir', message: r?.error || 'Erro' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não foi possível excluir', message: e?.message });
    } finally { setExcluindoId(null); }
  };

  const bonificacoes = data?.bonificacoes || [];
  const ocupado = lancandoId !== null || excluindoId !== null || salvando;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5"><Gift className="h-5 w-5 text-primary" /></div>
          <div>
            <h2 className="font-semibold">Bonificações</h2>
            <p className="text-sm text-muted-foreground">Cadastre cada bonificação quando ela chega; lance uma a uma em &quot;Ajuste Bonificações&quot;.</p>
          </div>
        </div>
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
          {opcoesMes.map((o) => <option key={o.key} value={o.key}>Competência {o.label}</option>)}
        </select>
      </div>

      {/* form de cadastro */}
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-2">Nova bonificação — competência <b>{MESES[mes - 1]}/{ano}</b></div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
            <div className="md:col-span-3">
              <label className="text-xs text-muted-foreground">Fornecedor</label>
              <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Ambev, Diageo…" className="h-9 mt-1" />
            </div>
            <div className="md:col-span-4">
              <label className="text-xs text-muted-foreground">Referente a</label>
              <Input value={referente} onChange={(e) => setReferente(e.target.value)} placeholder="Contrato, cashback, uniformes…" className="h-9 mt-1" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Valor</label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" className="h-9 mt-1 text-right" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Chegou em</label>
              <Input type="date" value={dataChegada} onChange={(e) => setDataChegada(e.target.value)} className="h-9 mt-1" />
            </div>
            <div className="md:col-span-1">
              <button onClick={cadastrar} disabled={ocupado}
                className="w-full inline-flex items-center justify-center gap-1 rounded-md bg-primary h-9 text-sm font-medium text-primary-foreground disabled:opacity-50">
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Cada bonificação vira <b>1 lançamento</b> de despesa em <b>&quot;Ajuste Bonificações&quot;</b> (competência do mês, sem baixa). Depois de lançada no CA, não dá pra excluir (o CA não tem DELETE).</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium px-4 py-2.5">Fornecedor</th>
                  <th className="text-left font-medium px-4 py-2.5">Referente</th>
                  <th className="text-left font-medium px-4 py-2.5">Chegou</th>
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
                    <td className="px-4 py-2 text-muted-foreground tabular-nums">{brDate(b.data_chegada)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtBRL(b.valor)}</td>
                    <td className="px-4 py-2 text-center">
                      {b.ca_lancado ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> lançado</span>
                      ) : (
                        <button onClick={() => lancar(b.id)} disabled={ocupado}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted/60 disabled:opacity-50" title="Lançar no Conta Azul">
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
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Nenhuma bonificação cadastrada nessa competência.</td></tr>
                )}
              </tbody>
              {bonificacoes.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-muted/20 font-semibold">
                    <td className="px-4 py-2.5" colSpan={3}>Total ({bonificacoes.length}) · lançado {fmtBRL(data?.total_lancado)}</td>
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
