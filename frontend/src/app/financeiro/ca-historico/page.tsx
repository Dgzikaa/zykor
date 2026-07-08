'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { History, Loader2, ArrowUpCircle, ArrowDownCircle, Wallet, ListTree } from 'lucide-react';

type Lanc = { origem: string; sinal: 'RECEITA' | 'DESPESA'; competencia: string; descricao: string; categoria: string | null; valor: number; ca_status: string | null; criado_por: string | null; quando: string };
type Resp = { de: string; ate: string; total: number; resumo: Record<string, { n: number; receita: number; despesa: number }>; total_receita: number; total_despesa: number; lancamentos: Lanc[] };

const fmtBRL = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const brDate = (d: string) => (d ? d.split('T')[0].split('-').reverse().join('/') : '—');
const brDateTime = (d: string) => { if (!d) return '—'; const dt = new Date(d); return `${brDate(d)} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`; };

const ORIGEM_LABEL: Record<string, string> = {
  variacao_estoque: 'Variação Estoque', consumacao: 'Consumação', imposto: 'Imposto', ajuste_virada: 'Ajuste Virada',
  bonificacao: 'Bonificação', entrada_dinheiro: 'Entrada Dinheiro', saida_dinheiro: 'Saída Dinheiro', sympla: 'Sympla', stone: 'Stone',
};
const origemLabel = (o: string) => ORIGEM_LABEL[o] || o;

function HistoricoInner() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const { setPageTitle } = usePageTitle();
  useEffect(() => {
    setPageTitle('📜 Histórico Conta Azul');
    return () => setPageTitle('');
  }, [setPageTitle]);
  const hoje = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const de30 = useMemo(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), []);
  const [de, setDe] = useState(de30);
  const [ate, setAte] = useState(hoje);
  const [origem, setOrigem] = useState('');
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    if (!selectedBar?.id) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ bar_id: String(selectedBar.id), de, ate });
      if (origem) qs.set('origem', origem);
      const r = await api.get(`/api/financeiro/ca-historico?${qs.toString()}`);
      if (r?.error) throw new Error(r.error);
      setData(r);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar histórico', message: e?.message });
      setData(null);
    } finally { setLoading(false); }
  }, [selectedBar?.id, de, ate, origem, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const lancamentos = data?.lancamentos || [];
  const origens = useMemo(() => Object.keys(data?.resumo || {}).sort(), [data?.resumo]);
  const liquido = (data?.total_receita || 0) - (data?.total_despesa || 0);

  return (
    <div className="p-4 md:p-6 mx-auto space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5"><History className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-xl font-semibold">Histórico Conta Azul</h1>
            <p className="text-sm text-muted-foreground">Tudo que o Zykor lançou no Conta Azul — por origem.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm" />
          <span className="text-muted-foreground text-sm">a</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm" />
          <select value={origem} onChange={(e) => setOrigem(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
            <option value="">Todas as origens</option>
            {Object.keys(ORIGEM_LABEL).map((o) => <option key={o} value={o}>{ORIGEM_LABEL[o]}</option>)}
          </select>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500" /> Receitas</div>
          <div className="text-2xl font-semibold mt-1 text-emerald-600 dark:text-emerald-400">{fmtBRL(data?.total_receita)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><ArrowDownCircle className="h-3.5 w-3.5 text-red-500" /> Despesas</div>
          <div className="text-2xl font-semibold mt-1 text-red-600 dark:text-red-400">{fmtBRL(data?.total_despesa)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Líquido</div>
          <div className="text-2xl font-semibold mt-1">{fmtBRL(liquido)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><ListTree className="h-3.5 w-3.5" /> Lançamentos</div>
          <div className="text-2xl font-semibold mt-1">{data?.total ?? 0}</div>
        </CardContent></Card>
      </div>

      {origens.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {origens.map((o) => (
            <button key={o} onClick={() => setOrigem(origem === o ? '' : o)}
              className={`text-xs rounded-full border px-3 py-1 ${origem === o ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted/60'}`}>
              {origemLabel(o)} <span className="opacity-70">· {data!.resumo[o].n}</span>
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium px-4 py-2.5">Competência</th>
                  <th className="text-left font-medium px-4 py-2.5">Origem</th>
                  <th className="text-left font-medium px-4 py-2.5">Descrição</th>
                  <th className="text-left font-medium px-4 py-2.5">Categoria</th>
                  <th className="text-right font-medium px-4 py-2.5">Valor</th>
                  <th className="text-left font-medium px-4 py-2.5">Lançado</th>
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((l, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 whitespace-nowrap tabular-nums">{brDate(l.competencia)}</td>
                    <td className="px-4 py-2"><span className="text-xs rounded-full bg-muted px-2 py-0.5">{origemLabel(l.origem)}</span></td>
                    <td className="px-4 py-2 max-w-[280px] truncate" title={l.descricao}>{l.descricao}</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{l.categoria || '—'}</td>
                    <td className={`px-4 py-2 text-right tabular-nums font-semibold ${l.sinal === 'RECEITA' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {l.sinal === 'RECEITA' ? '+' : '−'}{fmtBRL(l.valor)}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {brDateTime(l.quando)}{l.criado_por ? <span className="block text-[10px]">{l.criado_por}</span> : null}
                    </td>
                  </tr>
                ))}
                {!loading && lancamentos.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Nenhum lançamento no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Fonte: logs de lançamento do Zykor (fechamentos, bonificações, entradas/saídas de dinheiro, Sympla, Stone). Filtro por competência.</p>
    </div>
  );
}

export default function CaHistoricoPage() {
  return <ProtectedRoute><HistoricoInner /></ProtectedRoute>;
}
