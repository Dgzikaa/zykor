'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Receipt, TrendingUp, TrendingDown } from 'lucide-react';

const fmtBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const fmtMes = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

export default function LancamentosPage() {
  const { selectedBar } = useBar();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [meses, setMeses] = useState(3);
  const [tipoFilter, setTipoFilter] = useState<'todos' | 'RECEITA' | 'DESPESA'>('DESPESA');

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    fetch(`/api/financeiro/lancamentos?bar_id=${selectedBar.id}&meses=${meses}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [selectedBar?.id, meses]);

  const { mesesUnicos, matriz, totaisMes } = useMemo(() => {
    const linhas = (data?.linhas || []).filter((l: any) => tipoFilter === 'todos' || l.tipo === tipoFilter);
    const mesesSet = new Set<string>();
    const catsSet = new Set<string>();
    for (const l of linhas) { mesesSet.add(l.mes); catsSet.add(l.categoria); }
    const mesesUnicos = Array.from(mesesSet).sort().reverse();
    const matriz: Record<string, Record<string, number>> = {};
    for (const l of linhas) {
      matriz[l.categoria] ??= {};
      matriz[l.categoria][l.mes] = Number(l.pago) || 0;
    }
    const totaisMes: Record<string, number> = {};
    for (const m of mesesUnicos) {
      totaisMes[m] = linhas.filter((l: any) => l.mes === m).reduce((s: number, l: any) => s + Number(l.pago || 0), 0);
    }
    const cats = Array.from(catsSet).sort((a, b) => {
      const sA = mesesUnicos.reduce((s, m) => s + (matriz[a]?.[m] || 0), 0);
      const sB = mesesUnicos.reduce((s, m) => s + (matriz[b]?.[m] || 0), 0);
      return sB - sA;
    });
    return { mesesUnicos, matriz: cats.map(c => ({ categoria: c, valores: matriz[c] })), totaisMes };
  }, [data, tipoFilter]);

  if (loading) return <main className="max-w-7xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="w-6 h-6 text-emerald-600" /> Lançamentos por categoria</h1>
          <p className="text-sm text-gray-500">Dados ContaAzul agregados por mês × categoria. Valores PAGOS efetivos.</p>
        </div>
        <div className="flex gap-2">
          <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value as any)}
            className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
            <option value="DESPESA">Despesa</option>
            <option value="RECEITA">Receita</option>
            <option value="todos">Todos</option>
          </select>
          <select value={meses} onChange={e => setMeses(parseInt(e.target.value, 10))}
            className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </select>
        </div>
      </div>

      <Card className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                <th className="text-left py-2 sticky left-0 bg-white dark:bg-gray-950 min-w-[260px]">Categoria</th>
                {mesesUnicos.map(m => <th key={m} className="text-right py-2 px-3">{fmtMes(m)}</th>)}
                <th className="text-right py-2 px-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {matriz.map(({ categoria, valores }) => {
                const total = mesesUnicos.reduce((s, m) => s + (valores[m] || 0), 0);
                return (
                  <tr key={categoria} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                    <td className="py-2 sticky left-0 bg-white dark:bg-gray-950 truncate max-w-[260px]" title={categoria}>{categoria}</td>
                    {mesesUnicos.map(m => (
                      <td key={m} className="py-2 px-3 text-right tabular-nums">
                        {valores[m] ? fmtBRL(valores[m]) : <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-right tabular-nums font-semibold">{fmtBRL(total)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                <td className="py-2 font-bold sticky left-0 bg-gray-50 dark:bg-gray-900/30">Total</td>
                {mesesUnicos.map(m => (
                  <td key={m} className="py-2 px-3 text-right font-bold text-emerald-700 tabular-nums">{fmtBRL(totaisMes[m] || 0)}</td>
                ))}
                <td className="py-2 px-3 text-right font-bold text-emerald-700 tabular-nums">
                  {fmtBRL(Object.values(totaisMes).reduce((s, v) => s + v, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
