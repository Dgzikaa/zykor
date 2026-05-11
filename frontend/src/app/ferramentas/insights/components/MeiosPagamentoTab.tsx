'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, Legend } from 'recharts';
import { useBar } from '@/contexts/BarContext';

interface Props { dataInicio: string; dataFim: string }

interface ApiData {
  resumo: { faturamento_bruto_total: number; total_transacoes: number; meios_distintos: number };
  distribuicao: Array<{
    meio: string;
    qtd_transacoes: number;
    valor_bruto: number;
    valor_liquido: number;
    ticket_medio: number;
    pct: number;
  }>;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const CORES = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export function MeiosPagamentoTab({ dataInicio, dataFim }: Props) {
  const { selectedBar } = useBar();
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBar) return;
    setLoading(true);
    setError(null);
    fetch(`/api/ferramentas/insights/meios-pagamento?bar_id=${selectedBar.id}&data_inicio=${dataInicio}&data_fim=${dataFim}`)
      .then(r => r.json())
      .then(r => { if (r.success) setData(r); else setError(r.error || 'Erro'); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedBar?.id, dataInicio, dataFim]);

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard label="Faturamento bruto" value={fmtBRL(data.resumo.faturamento_bruto_total)} />
        <KpiCard label="Transações" value={data.resumo.total_transacoes.toLocaleString('pt-BR')} />
        <KpiCard label="Meios distintos" value={String(data.resumo.meios_distintos)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Mix de pagamento</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.distribuicao}
                  dataKey="valor_bruto"
                  nameKey="meio"
                  cx="50%" cy="50%"
                  outerRadius={100}
                  label={(e: any) => `${e.pct.toFixed(1)}%`}
                >
                  {data.distribuicao.map((_, i) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
                  ))}
                </Pie>
                <RTooltip
                  formatter={(v: any) => fmtBRL(Number(v))}
                  contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ticket médio por meio</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.distribuicao.map((d, i) => {
              const max = Math.max(...data.distribuicao.map(x => x.ticket_medio), 1);
              return (
                <div key={d.meio} className="flex items-center gap-2 text-sm">
                  <span className="w-32 truncate" title={d.meio}>{d.meio}</span>
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded h-3 overflow-hidden">
                    <div className="h-full" style={{ width: `${(d.ticket_medio / max) * 100}%`, background: CORES[i % CORES.length] }} />
                  </div>
                  <span className="w-24 text-right tabular-nums">{fmtBRL(d.ticket_medio)}</span>
                  <span className="text-xs text-gray-500 w-12 text-right">{d.qtd_transacoes}x</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
