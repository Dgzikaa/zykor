'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Calculator, RefreshCw, Search, Loader2, TrendingUp, TrendingDown } from 'lucide-react';

const fmtBRL = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: any) => v == null ? '—' : `${Number(v).toFixed(1)}%`;
const corCmv = (v: any) => v == null ? 'text-gray-400' : v > 45 ? 'text-red-600 dark:text-red-400' : v > 33 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';

export default function CmvTeoricoPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const barId = selectedBar?.id;
  const [produtos, setProdutos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [recalc, setRecalc] = useState(false);
  const [busca, setBusca] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [dataAnterior, setDataAnterior] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!barId) return; setLoading(true);
    try {
      const r = await api.get(`/api/operacional/cmv-teorico?bar_id=${barId}`);
      if (r.success) { setProdutos(r.produtos || []); setDataAnterior(r.data_anterior || null); }
    } finally { setLoading(false); }
  }, [barId]);
  useEffect(() => { carregar(); }, [carregar]);

  const recalcular = async () => {
    if (!barId) return; setRecalc(true);
    try {
      const r = await api.post('/api/operacional/cmv-teorico', { bar_id: barId, action: 'recalcular' });
      if (!r.success) throw new Error(r.error);
      toast({ title: 'CMV recalculado' });
      await carregar();
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
    finally { setRecalc(false); }
  };

  const cats = useMemo(() => Array.from(new Set(produtos.map(p => p.categoria).filter(Boolean))).sort(), [produtos]);
  const view = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return produtos.filter(p => (!cat || p.categoria === cat) && (!s || (p.nome || '').toLowerCase().includes(s) || (p.codigo || '').toLowerCase().includes(s)));
  }, [produtos, busca, cat]);

  const comCmv = produtos.filter(p => p.cmv_pct != null);
  const cmvMedio = comCmv.length ? comCmv.reduce((s, p) => s + Number(p.cmv_pct), 0) / comCmv.length : null;
  const semFicha = produtos.filter(p => !p.custo || p.custo === 0).length;
  const semPreco = produtos.filter(p => !p.preco_venda).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-xl"><Calculator className="w-6 h-6 text-amber-600 dark:text-amber-400" /></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CMV Teórico do Cardápio</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Custo da ficha (último preço) ÷ preço de venda (ContaHub) · {selectedBar?.nome || `Bar ${barId ?? ''}`}</p>
            </div>
          </div>
          <Button onClick={recalcular} disabled={recalc} variant="outline"><RefreshCw className={`w-4 h-4 mr-2 ${recalc ? 'animate-spin' : ''}`} />{recalc ? 'Recalculando…' : 'Recalcular'}</Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">CMV médio</div><div className={`text-2xl font-bold ${corCmv(cmvMedio)}`}>{fmtPct(cmvMedio)}</div></CardContent></Card>
          <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Produtos c/ CMV</div><div className="text-2xl font-bold">{comCmv.length}</div></CardContent></Card>
          <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Sem ficha</div><div className="text-2xl font-bold text-gray-400">{semFicha}</div></CardContent></Card>
          <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Sem preço CH</div><div className="text-2xl font-bold text-gray-400">{semPreco}</div></CardContent></Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto…" className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setCat(null)} className={`text-xs rounded px-2.5 py-1 border ${!cat ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>Todas</button>
            {cats.map(c => <button key={c} onClick={() => setCat(c)} className={`text-xs rounded px-2.5 py-1 border ${cat === c ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{c}</button>)}
          </div>
        </div>

        <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
              <th className="text-left font-medium px-3 py-2">Cód.</th>
              <th className="text-left font-medium px-3 py-2">Produto</th>
              <th className="text-left font-medium px-3 py-2">Categoria</th>
              <th className="text-right font-medium px-3 py-2">Custo (ficha)</th>
              <th className="text-right font-medium px-3 py-2">Preço (CH)</th>
              <th className="text-right font-medium px-3 py-2">Margem</th>
              <th className="text-right font-medium px-3 py-2">CMV %</th>
              {dataAnterior && <th className="text-right font-medium px-3 py-2" title={`vs ${dataAnterior}`}>Δ</th>}
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? <tr><td colSpan={dataAnterior ? 8 : 7} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : view.length === 0 ? <tr><td colSpan={dataAnterior ? 8 : 7} className="px-3 py-10 text-center text-gray-400">Sem produtos. Monte as fichas e clique em Recalcular.</td></tr>
              : view.map((p: any) => (
                <tr key={p.produto_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.codigo}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{p.nome}</td>
                  <td className="px-3 py-2"><Badge variant="outline">{p.categoria || '—'}</Badge></td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.custo ? fmtBRL(p.custo) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">{fmtBRL(p.preco_venda)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.margem != null ? fmtBRL(p.margem) : '—'}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-bold ${corCmv(p.cmv_pct)}`}>{fmtPct(p.cmv_pct)}</td>
                  {dataAnterior && <td className="px-3 py-2 text-right tabular-nums text-xs">
                    {p.delta_cmv == null ? '—' : <span className={p.delta_cmv > 0 ? 'text-red-500' : p.delta_cmv < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}>{p.delta_cmv > 0 ? <TrendingUp className="w-3 h-3 inline" /> : p.delta_cmv < 0 ? <TrendingDown className="w-3 h-3 inline" /> : null} {p.delta_cmv > 0 ? '+' : ''}{p.delta_cmv}pp</span>}
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div></CardContent></Card>
      </div>
    </div>
  );
}
