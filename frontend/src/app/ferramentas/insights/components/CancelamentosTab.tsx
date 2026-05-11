'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBar } from '@/contexts/BarContext';

interface Props { dataInicio: string; dataFim: string }

interface ApiData {
  resumo: {
    total_qtd_cancelada: number;
    total_valor_perdido: number;
    faturamento_bruto_periodo: number;
    pct_cancelamento: number;
    ticket_medio_cancelado: number;
  };
  top_motivos: Array<{ nome: string; qtd: number; valor: number }>;
  top_grupos: Array<{ nome: string; qtd: number; valor: number }>;
  top_produtos: Array<{ nome: string; qtd: number; valor: number }>;
  top_cancelou: Array<{ nome: string; qtd: number; valor: number }>;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

export function CancelamentosTab({ dataInicio, dataFim }: Props) {
  const { selectedBar } = useBar();
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBar) return;
    setLoading(true);
    setError(null);
    fetch(`/api/ferramentas/insights/cancelamentos?bar_id=${selectedBar.id}&data_inicio=${dataInicio}&data_fim=${dataFim}`)
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
        <KpiCard label="Itens cancelados" value={data.resumo.total_qtd_cancelada.toLocaleString('pt-BR')} />
        <KpiCard label="Prejuízo R$" value={fmtBRL(data.resumo.total_valor_perdido)} tone="danger" />
        <KpiCard label="% do faturamento" value={`${data.resumo.pct_cancelamento.toFixed(2)}%`} tone={data.resumo.pct_cancelamento > 3 ? 'danger' : 'normal'} />
        <KpiCard label="Ticket cancelado médio" value={fmtBRL(data.resumo.ticket_medio_cancelado)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TopList title="Top motivos" items={data.top_motivos} />
        <TopList title="Top grupos" items={data.top_grupos} />
        <TopList title="Top produtos cancelados" items={data.top_produtos} />
        <TopList title="Top responsáveis pelo cancelamento" items={data.top_cancelou} />
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'danger' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`text-xl font-bold mt-1 ${tone === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function TopList({ title, items }: { title: string; items: Array<{ nome: string; qtd: number; valor: number }> }) {
  const max = Math.max(...items.map(i => i.valor), 1);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {items.length === 0 && <p className="text-sm text-gray-500">Sem dados</p>}
        {items.map(it => (
          <div key={it.nome} className="flex items-center gap-2 text-sm">
            <span className="truncate flex-1" title={it.nome}>{it.nome}</span>
            <span className="text-xs text-gray-500 w-12 text-right">{it.qtd.toFixed(0)}</span>
            <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded h-2 overflow-hidden">
              <div className="bg-red-500 h-full" style={{ width: `${(it.valor / max) * 100}%` }} />
            </div>
            <span className="w-24 text-right tabular-nums">{fmtBRL(it.valor)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
