'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useBar } from '@/contexts/BarContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';

interface Props { dataInicio: string; dataFim: string }

interface ApiData {
  resumo: {
    total_reservas: number;
    presentes: number;
    canceladas: number;
    no_show: number;
    pendentes: number;
    total_pessoas: number;
    pessoas_presentes: number;
    taxa_comparecimento_pct: number;
    taxa_no_show_pct: number;
    taxa_cancelamento_pct: number;
    lead_time_medio_dias: number;
  };
  por_status: Array<{ status: string; qtd: number; pessoas: number }>;
  lead_time_distribuicao: Array<{ bucket: string; count: number; pct: number }>;
  por_dia_semana: Array<{ dia_semana: string; qtd: number; presentes: number; taxa_comparecimento: number }>;
  por_hora: Array<{ hora: number; qtd: number }>;
  por_origem: Array<{ origem: string; qtd: number }>;
  por_ocasiao: Array<{ ocasiao: string; qtd: number }>;
}

const STATUS_PT: Record<string, string> = {
  seated: 'Sentaram',
  confirmed: 'Confirmadas',
  pending: 'Pendentes',
  'canceled-agent': 'Canceladas (agente)',
  'canceled-user': 'Canceladas (cliente)',
  'no-show': 'No-show',
};

const STATUS_COR: Record<string, string> = {
  seated: 'bg-green-500',
  confirmed: 'bg-blue-500',
  pending: 'bg-amber-500',
  'canceled-agent': 'bg-orange-500',
  'canceled-user': 'bg-red-500',
  'no-show': 'bg-red-700',
};

export function ReservasTab({ dataInicio, dataFim }: Props) {
  const { selectedBar } = useBar();
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBar?.id) return;
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
        <KpiCard label="Total reservas" value={String(data.resumo.total_reservas)} sub={`${data.resumo.total_pessoas} pessoas`} />
        <KpiCard
          label="Sentaram"
          value={String(data.resumo.presentes)}
          sub={`${data.resumo.pessoas_presentes} pessoas · ${data.resumo.taxa_comparecimento_pct.toFixed(1)}%`}
          tone="good"
        />
        <KpiCard
          label="No-show"
          value={String(data.resumo.no_show)}
          sub={`${data.resumo.taxa_no_show_pct.toFixed(1)}%`}
          tone={data.resumo.taxa_no_show_pct > 15 ? 'danger' : 'normal'}
        />
        <KpiCard label="Lead time médio" value={`${data.resumo.lead_time_medio_dias.toFixed(1)} dias`} sub="antecedência da reserva" />
      </div>

      <Card>
        <CardHeader><CardTitle>Distribuição por status</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.por_status.map(s => {
            const total = data.resumo.total_reservas || 1;
            const pct = (s.qtd / total) * 100;
            return (
              <div key={s.status} className="flex items-center gap-2 text-sm">
                <span className="w-44 truncate" title={s.status}>{STATUS_PT[s.status] || s.status}</span>
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded h-3 overflow-hidden">
                  <div className={`h-full ${STATUS_COR[s.status] || 'bg-gray-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-12 text-right tabular-nums">{s.qtd}</span>
                <span className="text-xs text-gray-500 w-14 text-right">{s.pessoas} pess.</span>
                <span className="text-xs text-gray-500 w-12 text-right">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Antecedência da reserva</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.lead_time_distribuicao}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis />
                <RTooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }} itemStyle={{ color: '#fff' }} labelStyle={{ color: '#fff' }} />
                <Bar dataKey="count" fill="#8b5cf6" name="Reservas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Reservas + comparecimento por dia da semana</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.por_dia_semana}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="dia_semana" tick={{ fontSize: 11 }} />
                <YAxis />
                <RTooltip
                  contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
                  itemStyle={{ color: '#fff' }} labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="qtd" fill="#3b82f6" name="Reservas" />
                <Bar dataKey="presentes" fill="#10b981" name="Sentaram" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Horário preferido</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
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
          <CardHeader><CardTitle>Origem (campo info)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.por_origem.length === 0 && <p className="text-sm text-gray-500">Sem dados de origem.</p>}
            {data.por_origem.map(o => {
              const max = Math.max(...data.por_origem.map(x => x.qtd), 1);
              return (
                <div key={o.origem} className="flex items-center gap-2 text-sm">
                  <span className="w-40 truncate" title={o.origem}>{o.origem}</span>
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded h-2 overflow-hidden">
                    <div className="bg-purple-500 h-full" style={{ width: `${(o.qtd / max) * 100}%` }} />
                  </div>
                  <span className="w-12 text-right tabular-nums">{o.qtd}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {data.por_ocasiao.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Ocasião (custom field)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.por_ocasiao.map(o => (
                <Badge key={o.ocasiao} variant="secondary">
                  {o.ocasiao} · {o.qtd}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, tone = 'normal' }: { label: string; value: string; sub?: string; tone?: 'normal' | 'good' | 'danger' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`text-xl font-bold mt-1 ${
          tone === 'good' ? 'text-green-600 dark:text-green-400'
          : tone === 'danger' ? 'text-red-600 dark:text-red-400'
          : 'text-gray-900 dark:text-white'
        }`}>{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
