'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useBar } from '@/contexts/BarContext';

interface Props {
  dataInicio: string;
  dataFim: string;
}

interface ApiData {
  resumo: {
    faturamento_total: number;
    faturamento_medio_dia: number;
    hora_pico: number;
    hora_pico_faturamento: number;
  };
  distribuicao_por_hora: Array<{ hora: number; faturamento_total: number; faturamento_medio_dia: number; transacoes: number }>;
  blocos_horarios: Array<{ nome: string; faturamento: number; pct: number }>;
  periodo: { total_dias: number };
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function CurvaHorariaTab({ dataInicio, dataFim }: Props) {
  const { selectedBar } = useBar();
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBar) return;
    setLoading(true);
    setError(null);
    fetch(`/api/ferramentas/insights/curva-horaria?bar_id=${selectedBar.id}&data_inicio=${dataInicio}&data_fim=${dataFim}`)
      .then(r => r.json())
      .then(r => {
        if (r.success) setData(r);
        else setError(r.error || 'Erro');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedBar?.id, dataInicio, dataFim]);

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Faturamento total" value={fmtBRL(data.resumo.faturamento_total)} />
        <KpiCard label="Média por dia" value={fmtBRL(data.resumo.faturamento_medio_dia)} />
        <KpiCard label="Hora de pico" value={`${data.resumo.hora_pico}h`} />
        <KpiCard label="Dias analisados" value={String(data.periodo.total_dias)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Faturamento médio por hora (período)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.distribuicao_por_hora}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="hora" tickFormatter={h => `${h}h`} />
              <YAxis tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} />
              <RTooltip
                formatter={(v: any) => fmtBRL(Number(v))}
                labelFormatter={h => `${h}h`}
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="faturamento_medio_dia" name="Médio/dia">
                {data.distribuicao_por_hora.map((d, i) => (
                  <Cell key={i} fill={d.hora === data.resumo.hora_pico ? '#10b981' : '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição por bloco horário</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.blocos_horarios.map(b => (
              <div key={b.nome} className="flex items-center justify-between gap-3">
                <span className="text-sm w-44">{b.nome}</span>
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded h-3 overflow-hidden">
                  <div className="bg-blue-500 h-full" style={{ width: `${b.pct}%` }} />
                </div>
                <span className="text-sm w-28 text-right">{fmtBRL(b.faturamento)}</span>
                <span className="text-xs w-12 text-right text-gray-500">{b.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
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
