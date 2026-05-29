'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';

const fmtBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const fmtData = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

const corAnomalia: Record<string, string> = {
  queda_critica: 'bg-red-500 text-white',
  queda_alta: 'bg-amber-500 text-white',
  pico_anormal: 'bg-purple-500 text-white',
};

export default function ConciliacaoPagamentosPage() {
  const { selectedBar } = useBar();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    fetch(`/api/conciliacao-pagamentos?bar_id=${selectedBar.id}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [selectedBar?.id]);

  const matriz = useMemo(() => {
    if (!data?.linhas) return { datas: [], meios: [], cells: {} };
    const datasSet = new Set<string>();
    const meiosSet = new Set<string>();
    const cells: Record<string, any> = {};
    for (const l of data.linhas) {
      datasSet.add(l.data_pagamento);
      meiosSet.add(l.meio);
      cells[`${l.data_pagamento}|${l.meio}`] = l;
    }
    const datas = Array.from(datasSet).sort().reverse().slice(0, 21);
    const meios = Array.from(meiosSet).sort();
    return { datas, meios, cells };
  }, [data]);

  if (loading) return <main className="max-w-7xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  const s = data?.stats || {};
  const anomalias = data?.anomalias || [];

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="w-6 h-6 text-blue-600" /> Conciliação Pagamentos</h1>
        <p className="text-sm text-gray-500">
          Detecta quando algum meio de pagamento &ldquo;some&rdquo; ou aparece em pico anormal. Sinal de problema com adquirente, fraude ou erro de lançamento.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-gray-500">Dias analisados</p><p className="text-2xl font-bold">{s.total_dias ?? 0}</p></Card>
        <Card className="p-4 border-l-4 border-l-red-500"><p className="text-xs text-gray-500">Quedas críticas</p><p className="text-2xl font-bold text-red-600">{s.queda_critica ?? 0}</p></Card>
        <Card className="p-4 border-l-4 border-l-amber-500"><p className="text-xs text-gray-500">Quedas altas</p><p className="text-2xl font-bold text-amber-600">{s.queda_alta ?? 0}</p></Card>
        <Card className="p-4 border-l-4 border-l-purple-500"><p className="text-xs text-gray-500">Picos anormais</p><p className="text-2xl font-bold text-purple-600">{s.picos ?? 0}</p></Card>
      </div>

      {anomalias.length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Anomalias detectadas</h2>
          <div className="space-y-2">
            {anomalias.slice(0, 15).map((a: any, i: number) => {
              const icone = a.anomalia === 'pico_anormal' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />;
              return (
                <div key={i} className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-800 rounded-md">
                  <div className="flex items-center gap-3">
                    <Badge className={`${corAnomalia[a.anomalia]} flex items-center gap-1 text-xs`}>
                      {icone} {a.anomalia.replace('_', ' ')}
                    </Badge>
                    <span className="font-medium">{a.meio}</span>
                    <span className="text-xs text-gray-500">{fmtData(a.data_pagamento)}</span>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">{fmtBRL(Number(a.bruto))}</p>
                    <p className="text-xs text-gray-500">média: {fmtBRL(Number(a.media_bruto_30d))} ({a.variacao_vs_media_pct > 0 ? '+' : ''}{a.variacao_vs_media_pct}%)</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Matriz Data × Meio (últimos 21 dias)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left py-2 sticky left-0 bg-white dark:bg-gray-950 z-10">Data</th>
                {matriz.meios.map(m => <th key={m} className="text-right py-2 px-2">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {matriz.datas.map(d => (
                <tr key={d} className="border-t border-gray-200 dark:border-gray-800">
                  <td className="py-2 font-medium sticky left-0 bg-white dark:bg-gray-950 z-10">{fmtData(d)}</td>
                  {matriz.meios.map(m => {
                    const c = matriz.cells[`${d}|${m}`];
                    if (!c) return <td key={m} className="py-2 px-2 text-right text-gray-300">—</td>;
                    const cor = c.anomalia === 'queda_critica' ? 'text-red-600 font-semibold' :
                                c.anomalia === 'queda_alta' ? 'text-amber-600' :
                                c.anomalia === 'pico_anormal' ? 'text-purple-600 font-semibold' : '';
                    return (
                      <td key={m} className={`py-2 px-2 text-right tabular-nums ${cor}`}>
                        {fmtBRL(Number(c.bruto))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
