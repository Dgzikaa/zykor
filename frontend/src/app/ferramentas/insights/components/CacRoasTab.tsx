'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useBar } from '@/contexts/BarContext';

interface ApiData {
  ano: number;
  resumo: {
    mkt_total: number;
    clientes_novos_total: number;
    fat_clientes_novos_total: number;
    cac_medio: number;
    roas_medio: number;
  };
  meses: Array<{
    mes: number;
    nome: string;
    mkt_investido: number;
    clientes_novos: number;
    fat_clientes_novos: number;
    cac: number;
    roas: number;
  }>;
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function CacRoasTab() {
  const { selectedBar } = useBar();
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/ferramentas/insights/cac-roas?bar_id=${selectedBar.id}&ano=${ano}`)
      .then(r => r.json())
      .then(r => { if (r.success) setData(r); else setError(r.error || 'Erro'); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedBar?.id, ano]);

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600 dark:text-gray-400">Ano:</label>
        <select
          value={ano}
          onChange={e => setAno(Number(e.target.value))}
          className="h-9 px-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
        >
          {[new Date().getFullYear(), new Date().getFullYear() - 1].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Investido mkt" value={fmtBRL(data.resumo.mkt_total)} />
        <KpiCard label="Clientes novos" value={data.resumo.clientes_novos_total.toLocaleString('pt-BR')} />
        <KpiCard label="Fat. dos novos" value={fmtBRL(data.resumo.fat_clientes_novos_total)} />
        <KpiCard
          label="CAC médio"
          value={fmtBRL(data.resumo.cac_medio)}
          tone={data.resumo.cac_medio > 100 ? 'danger' : 'normal'}
        />
        <KpiCard
          label="ROAS médio"
          value={data.resumo.roas_medio.toFixed(2) + 'x'}
          tone={data.resumo.roas_medio < 1 ? 'danger' : data.resumo.roas_medio > 3 ? 'good' : 'normal'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Marketing × Clientes novos por mês</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data.meses}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="nome" />
              <YAxis yAxisId="left" tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" />
              <RTooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
                itemStyle={{ color: '#fff' }}
                labelStyle={{ color: '#fff' }}
                formatter={(v: any, n: any) => {
                  if (n === 'Clientes novos') return v;
                  return fmtBRL(Number(v));
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="mkt_investido" fill="#f59e0b" name="Mkt investido" />
              <Bar yAxisId="left" dataKey="fat_clientes_novos" fill="#10b981" name="Fat. dos novos" />
              <Line yAxisId="right" type="monotone" dataKey="clientes_novos" stroke="#3b82f6" name="Clientes novos" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Detalhamento mensal</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left py-2 px-2">Mês</th>
                  <th className="text-right py-2 px-2">Mkt investido</th>
                  <th className="text-right py-2 px-2">Clientes novos</th>
                  <th className="text-right py-2 px-2">Fat. dos novos</th>
                  <th className="text-right py-2 px-2">CAC</th>
                  <th className="text-right py-2 px-2">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {data.meses.map(m => (
                  <tr key={m.mes} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 px-2">{m.nome}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{fmtBRL(m.mkt_investido)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{m.clientes_novos}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{fmtBRL(m.fat_clientes_novos)}</td>
                    <td className={`py-2 px-2 text-right tabular-nums ${m.cac > 100 ? 'text-red-600 dark:text-red-400 font-bold' : ''}`}>
                      {m.cac > 0 ? fmtBRL(m.cac) : '—'}
                    </td>
                    <td className={`py-2 px-2 text-right tabular-nums ${m.roas < 1 && m.roas > 0 ? 'text-red-600 dark:text-red-400 font-bold' : m.roas > 3 ? 'text-green-600 dark:text-green-400 font-bold' : ''}`}>
                      {m.roas > 0 ? m.roas.toFixed(2) + 'x' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Notas de atribuição</CardTitle></CardHeader>
        <CardContent className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <p><strong>Cliente novo</strong> = primeira visita histórica caiu naquele mês (telefone normalizado).</p>
          <p><strong>Fat. dos novos</strong> = soma das visitas DESSES clientes no mesmo mês em que viraram clientes.</p>
          <p><strong>Mkt investido</strong> = soma de <code>m_valor_investido</code> das semanas que tocam o mês (gold.desempenho).</p>
          <p>Atribuição simples (mês a mês). Não considera lag — vale como tendência, não como contabilidade exata.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'danger' | 'good' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`text-xl font-bold mt-1 ${
          tone === 'danger' ? 'text-red-600 dark:text-red-400'
          : tone === 'good' ? 'text-green-600 dark:text-green-400'
          : 'text-gray-900 dark:text-white'
        }`}>{value}</p>
      </CardContent>
    </Card>
  );
}
