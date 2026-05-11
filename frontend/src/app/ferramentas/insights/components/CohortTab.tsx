'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBar } from '@/contexts/BarContext';

interface ApiData {
  periodo: { data_inicio: string; weeks: number; modo: 'aquisicao' | 'periodo' };
  cohorts: Array<{
    week_start: string;
    total_clientes: number;
    semanas: Array<{ week_offset: number; retained: number; pct: number }>;
  }>;
  media_por_offset: Array<{ week_offset: number; pct_medio: number }>;
}

const fmtData = (d: string) => {
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}`;
};

// Cor da célula em função do pct (0-100): vermelho → amarelo → verde
function corPct(pct: number): string {
  if (pct <= 0) return 'bg-gray-100 dark:bg-gray-800 text-gray-400';
  if (pct >= 50) return 'bg-green-600 text-white';
  if (pct >= 30) return 'bg-green-400 text-white';
  if (pct >= 15) return 'bg-yellow-400 text-gray-900';
  if (pct >= 5) return 'bg-orange-400 text-white';
  return 'bg-red-400 text-white';
}

interface Props {
  weeks?: number;
}

export function CohortTab({ weeks: weeksDefault = 24 }: Props) {
  const { selectedBar } = useBar();
  const [weeks, setWeeks] = useState<number>(weeksDefault);
  const [modo, setModo] = useState<'aquisicao' | 'periodo'>('aquisicao');
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/ferramentas/insights/cohort?bar_id=${selectedBar.id}&weeks=${weeks}&modo=${modo}`)
      .then(r => r.json())
      .then(r => { if (r.success) setData(r); else setError(r.error || 'Erro'); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedBar?.id, weeks, modo]);

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!data) return null;

  const maxOffset = Math.max(...data.cohorts.map(c => c.semanas.length), 0);
  const offsets = Array.from({ length: maxOffset }, (_, i) => i);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>
              Retenção {modo === 'aquisicao' ? 'por semana de aquisição' : 'por semana do período'}
            </CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {modo === 'aquisicao'
                ? 'Cada linha = clientes NOVOS naquela semana (1ª visita histórica). Colunas = % deles que voltaram nas semanas seguintes.'
                : 'Cada linha = clientes cuja 1ª visita DO PERÍODO foi naquela semana (mesmo que fossem antigos). Colunas = % deles que voltaram.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <select
              value={modo}
              onChange={e => setModo(e.target.value as any)}
              className="h-8 px-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs"
            >
              <option value="aquisicao">Aquisição (novos)</option>
              <option value="periodo">Período (todos)</option>
            </select>
            <select
              value={weeks}
              onChange={e => setWeeks(Number(e.target.value))}
              className="h-8 px-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs"
            >
              {[12, 24, 36, 52].map(w => <option key={w} value={w}>{w} sem</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 sticky left-0 bg-white dark:bg-gray-800 z-10 border-r border-gray-200 dark:border-gray-700">
                    Cohort
                  </th>
                  <th className="text-right p-2 border-r border-gray-200 dark:border-gray-700">N</th>
                  {offsets.map(off => (
                    <th key={off} className="text-center p-2 min-w-[55px]">
                      S+{off}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.cohorts.map(c => (
                  <tr key={c.week_start} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="p-2 sticky left-0 bg-white dark:bg-gray-800 font-medium whitespace-nowrap border-r border-gray-200 dark:border-gray-700">
                      {fmtData(c.week_start)}
                    </td>
                    <td className="p-2 text-right text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">
                      {c.total_clientes}
                    </td>
                    {offsets.map(off => {
                      const cell = c.semanas.find(s => s.week_offset === off);
                      if (!cell) {
                        return <td key={off} className="p-2"></td>;
                      }
                      return (
                        <td
                          key={off}
                          className={`p-2 text-center font-medium ${corPct(cell.pct)}`}
                          title={`${cell.retained}/${c.total_clientes}`}
                        >
                          {cell.pct.toFixed(0)}%
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Média */}
                <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 font-bold">
                  <td className="p-2 sticky left-0 bg-gray-50 dark:bg-gray-700/50 border-r border-gray-200 dark:border-gray-700">
                    Média
                  </td>
                  <td className="p-2 border-r border-gray-200 dark:border-gray-700"></td>
                  {offsets.map(off => {
                    const m = data.media_por_offset.find(x => x.week_offset === off);
                    if (!m) return <td key={off} className="p-2"></td>;
                    return (
                      <td key={off} className={`p-2 text-center ${corPct(m.pct_medio)}`}>
                        {m.pct_medio.toFixed(0)}%
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Como ler</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
          <p><strong>S+0</strong> = mesma semana em que o cliente veio pela primeira vez (sempre 100% por definição).</p>
          <p><strong>S+1</strong> = % de quem voltou na semana seguinte. Quanto maior, mais retenção.</p>
          <p>Quanto mais verde, melhor. Vermelho = perda de cliente após a primeira visita.</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            <strong>Aquisição</strong> = cohort só com clientes verdadeiramente novos.
            <strong> Período</strong> = qualquer cliente que veio (útil quando a maioria já era cliente antes).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
