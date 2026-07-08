'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Flame, TrendingUp } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';

const fmtBRL = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR');
const DOW_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function HeatmapVendasPage() {
  const { selectedBar } = useBar();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [metrica, setMetrica] = useState<'fat_medio' | 'fat_total'>('fat_medio');
  const { setPageTitle } = usePageTitle();

  useEffect(() => { setPageTitle('🔥 Mapa de calor: DOW × Hora'); return () => setPageTitle(''); }, [setPageTitle]);

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    fetch(`/api/heatmap-vendas?bar_id=${selectedBar.id}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [selectedBar?.id]);

  const { matriz, horas, max, totaisDow, topCelulas } = useMemo(() => {
    const celulas = data?.celulas || [];
    const horasSet = new Set<number>();
    const m: Record<string, any> = {};
    let max = 0;
    for (const c of celulas) {
      horasSet.add(c.hora_int);
      m[`${c.dow}|${c.hora_int}`] = c;
      const v = Number(c[metrica]) || 0;
      if (v > max) max = v;
    }
    const horas = Array.from(horasSet).sort((a, b) => a - b);
    const totaisDow: Record<number, number> = {};
    for (let d = 0; d < 7; d++) {
      totaisDow[d] = celulas.filter((c: any) => c.dow === d).reduce((s: number, c: any) => s + Number(c[metrica] || 0), 0);
    }
    const topCelulas = [...celulas].sort((a: any, b: any) => Number(b[metrica]) - Number(a[metrica])).slice(0, 10);
    return { matriz: m, horas, max, totaisDow, topCelulas };
  }, [data, metrica]);

  if (loading) return <main className="max-w-7xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  const corCelula = (val: number) => {
    if (val === 0) return 'bg-gray-50 dark:bg-gray-900';
    const intensity = Math.min(1, val / max);
    const opacity = Math.round(intensity * 100);
    return `bg-pink-500/${opacity > 80 ? 90 : opacity > 60 ? 70 : opacity > 40 ? 50 : opacity > 20 ? 30 : 15}`;
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Flame className="w-6 h-6 text-pink-600" /></h1>
          <p className="text-sm text-gray-500">
            Faturamento por dia da semana e hora — últimos 90 dias. Onde está o calor da operação? Use pra escala de equipe.
          </p>
        </div>
        <select value={metrica} onChange={e => setMetrica(e.target.value as any)}
          className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
          <option value="fat_medio">Faturamento médio/hora</option>
          <option value="fat_total">Faturamento total 90d</option>
        </select>
      </div>

      <Card className="p-4">
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="text-left py-2 pr-3 sticky left-0 bg-white dark:bg-gray-950">Hora</th>
                {DOW_LABELS.map((d, i) => (
                  <th key={i} className="text-center px-3 py-2 min-w-[80px]">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {horas.map(h => (
                <tr key={h} className="border-t border-gray-100 dark:border-gray-900">
                  <td className="py-1 pr-3 font-medium sticky left-0 bg-white dark:bg-gray-950">
                    {h > 24 ? `${h - 24}:00 (mad)` : `${h.toString().padStart(2, '0')}:00`}
                  </td>
                  {[0, 1, 2, 3, 4, 5, 6].map(d => {
                    const c = matriz[`${d}|${h}`];
                    const val = Number(c?.[metrica] || 0);
                    return (
                      <td key={d} className="px-1 py-1">
                        <div
                          className={`rounded text-center py-2 px-1 ${corCelula(val)} ${val > max * 0.4 ? 'text-white font-semibold' : 'text-gray-700 dark:text-gray-300'}`}
                          title={c ? `${DOW_LABELS[d]} ${h}h: ${fmtBRL(val)} | ${c.dias_obs} dias observados` : 'sem dado'}
                        >
                          {val > 0 ? fmtBRL(val) : '—'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 dark:border-gray-700">
                <td className="py-2 pr-3 font-bold sticky left-0 bg-white dark:bg-gray-950">Total</td>
                {[0, 1, 2, 3, 4, 5, 6].map(d => (
                  <td key={d} className="px-3 py-2 text-center font-bold text-pink-700">
                    {fmtBRL(totaisDow[d] || 0)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Top 10 momentos mais quentes</h2>
        <div className="space-y-1">
          {topCelulas.map((c: any, i: number) => (
            <div key={i} className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-800 rounded">
              <div>
                <span className="font-medium">{DOW_LABELS[c.dow]} {c.hora_int > 24 ? `${c.hora_int - 24}h (madrugada)` : `${c.hora_int}h`}</span>
                <span className="text-xs text-gray-500 ml-2">{c.dias_obs} dias observados</span>
              </div>
              <span className="font-bold text-pink-600">{fmtBRL(Number(c[metrica]))}</span>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
