'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Gift, Loader2, Send, Check, AlertTriangle } from 'lucide-react';

type Preview = {
  bar_id: number; ano: number; mes: number; competencia: string;
  categoria: string; descricao: string; valor: number; ja_lancado: boolean; valor_lancado: number | null;
};

const fmtBRL = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function ultimosMeses(n: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const out: { ano: number; mes: number; label: string; key: string }[] = [];
  for (let i = 0; i < n; i++) {
    const ano = d.getFullYear();
    const mes = d.getMonth() + 1;
    out.push({ ano, mes, label: `${MESES[mes - 1]}/${ano}`, key: `${ano}-${mes}` });
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

export function BonificacoesTab() {
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
      const r = await api.get(`/api/financeiro/fechamento/bonificacoes?bar_id=${selectedBar.id}&ano=${ano}&mes=${mes}`);
      if (r?.error) throw new Error(r.error);
      setData(r);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar bonificações', message: e?.message });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, ano, mes, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const podeLancar = !!data && data.valor > 0 && !data.ja_lancado;

  const lancar = async () => {
    if (!selectedBar?.id) return;
    setLancando(true);
    try {
      const r = await api.post('/api/financeiro/fechamento/bonificacoes', { bar_id: selectedBar.id, ano, mes });
      if (r?.ok || r?.skipped) {
        showToast({ type: 'success', title: r?.skipped ? 'Nada a lançar' : 'Bonificação lançada no Conta Azul' });
      } else {
        showToast({ type: 'error', title: 'Falha ao lançar', message: r?.error || r?.erro || 'Erro' });
      }
      await carregar();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Falha ao lançar', message: e?.message });
    } finally {
      setLancando(false);
      setConfirmando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5"><Gift className="h-5 w-5 text-primary" /></div>
          <div>
            <h2 className="font-semibold">Bonificações</h2>
            <p className="text-sm text-muted-foreground">Total preenchido em Gestão CMV mensal, lançado como despesa &quot;Ajuste Bonificações&quot;.</p>
          </div>
        </div>
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
          {opcoesMes.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>1 despesa por mês na categoria <b>&quot;Ajuste Bonificações&quot;</b>, competência do mês, sem baixa. Valor = o que estiver preenchido em <b>Gestão CMV mensal</b>. O Conta Azul não permite excluir lançamento.</span>
      </div>

      <Card>
        <CardContent className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : !data ? (
            <div className="py-8 text-center text-muted-foreground">Sem dados.</div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-muted-foreground">{data.descricao}</div>
                <div className="text-3xl font-semibold mt-1">{fmtBRL(data.valor)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Categoria <b>{data.categoria}</b> · competência {data.competencia}
                </div>
              </div>
              <div className="text-right">
                {data.ja_lancado ? (
                  <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400"><Check className="h-4 w-4" /> lançado no CA</span>
                ) : data.valor > 0 ? (
                  <span className="text-sm text-amber-600 dark:text-amber-400">pendente</span>
                ) : (
                  <span className="text-sm text-muted-foreground">nada preenchido</span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {confirmando ? (
          <>
            <span className="text-xs text-muted-foreground">Confirmar lançamento de {fmtBRL(data?.valor)} no CA?</span>
            <button onClick={() => setConfirmando(false)} className="rounded-md border px-3 h-9 text-sm hover:bg-muted/60">Cancelar</button>
            <button onClick={lancar} disabled={lancando} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-9 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {lancando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Confirmar
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmando(true)}
            disabled={loading || lancando || !podeLancar}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-9 text-sm font-medium text-primary-foreground disabled:opacity-50"
            title={!podeLancar ? 'Nada pendente para lançar' : 'Lançar no Conta Azul'}
          >
            <Send className="h-4 w-4" /> Lançar no Conta Azul
          </button>
        )}
      </div>
    </div>
  );
}
