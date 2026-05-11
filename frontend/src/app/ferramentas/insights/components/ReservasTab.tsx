'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBar } from '@/contexts/BarContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';

interface Props { dataInicio: string; dataFim: string }

interface ApiData {
  resumo: {
    total_reservas: number;
    presentes: number;
    no_show: number;
    canceladas: number;
    total_pessoas: number;
    taxa_no_show_pct: number;
    taxa_cancelamento_pct: number;
    lead_time_medio_dias: number;
  };
  lead_time_distribuicao: Array<{ bucket: string; count: number; pct: number }>;
  por_dia_semana: Array<{ dia_semana: string; qtd: number }>;
  por_hora: Array<{ hora: number; qtd: number }>;
  por_setor: Array<{ setor: string; qtd: number }>;
}

export function ReservasTab({ dataInicio, dataFim }: Props) {
  const { selectedBar } = useBar();
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBar) return;
    setLoading(true);
    setError(null);
    fetch(`/api/ferramentas/insights/reservas?bar_id=${selectedBar.id}&data_inicio=${dataInicio}&data_fim=${dataFim}`)
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total reservas" value={String(data.resumo.total_reservas)} />
        <KpiCard label="Lead time médio" value={`${data.resumo.lead_time_medio_dias.toFixed(1)} dias`} />
        <KpiCard label="Taxa no-show" value={`${data.resumo.taxa_no_show_pct.toFixed(1)}%`} tone={data.resumo.taxa_no_show_pct > 15 ? 'danger' : 'normal'} />
        <KpiCard label="Taxa cancelamento" value={`${data.resumo.taxa_cancelamento_pct.toFixed(1)}%`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Antecedência da reserva</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.lead_time_distribuicao}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis />
                <RTooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }} itemStyle={{ color: '#fff' }} />
                <Bar dataKey="count" fill="#8b5cf6" name="Reservas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Reservas por dia da semana</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.por_dia_semana}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="dia_semana" />
                <YAxis />
                <RTooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }} itemStyle={{ color: '#fff' }} />
                <Bar dataKey="qtd" fill="#10b981" name="Reservas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Horário preferido de reserva</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.por_hora}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="hora" tickFormatter={h => `${h}h`} />
                <YAxis />
                <RTooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }} itemStyle={{ color: '#fff' }} labelFormatter={h => `${h}h`} />
                <Bar dataKey="qtd" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Reservas por setor</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.por_setor.length === 0 && <p className="text-sm text-gray-500">Sem dados</p>}
            {data.por_setor.map(s => {
              const max = Math.max(...data.por_setor.map(x => x.qtd), 1);
              return (
                <div key={s.setor} className="flex items-center gap-2 text-sm">
                  <span className="w-32 truncate" title={s.setor}>{s.setor}</span>
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded h-2 overflow-hidden">
                    <div className="bg-blue-500 h-full" style={{ width: `${(s.qtd / max) * 100}%` }} />
                  </div>
                  <span className="w-12 text-right tabular-nums">{s.qtd}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'danger' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`text-xl font-bold mt-1 ${tone === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
