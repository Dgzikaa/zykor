'use client';

import { useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Sparkles as Crystal, Users, DollarSign, RefreshCw, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ErrorBar } from 'recharts';
import { useToast } from '@/hooks/use-toast';

const fmtMoeda = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n));
const fmt = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('pt-BR').format(n));
const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

export default function PrevisaoPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recalc, setRecalc] = useState(false);

  const carregar = async () => {
    if (!selectedBar?.id) return;
    setLoading(true);
    const r = await fetch(`/api/previsao?bar_id=${selectedBar.id}`);
    setData(await r.json());
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [selectedBar?.id]);

  const recalcular = async () => {
    if (!selectedBar?.id) return;
    setRecalc(true);
    try {
      await fetch(`/api/previsao?bar_id=${selectedBar.id}`, { method: 'POST' });
      toast({ title: 'Recalculado!', description: 'Previsões atualizadas.' });
      await carregar();
    } finally { setRecalc(false); }
  };

  if (loading) return <main className="max-w-7xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  const previsoes = data?.previsoes ?? [];
  const proximoFimSemana = previsoes.find((p: any) => [5, 6].includes(new Date(p.data_evento + 'T12:00:00').getDay()));
  const chartData = previsoes.slice(0, 14).map((p: any) => ({
    dia: `${dias[new Date(p.data_evento + 'T12:00:00').getDay()]} ${p.data_evento.slice(8, 10)}/${p.data_evento.slice(5, 7)}`,
    fat: p.fat_previsto,
    erro: [p.fat_previsto - p.ic_inferior, p.ic_superior - p.fat_previsto],
  }));

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Crystal className="w-6 h-6 text-pink-600" /> Previsão de Demanda</h1>
          <p className="text-sm text-gray-500">Próximos 14 dias. Mediana das últimas 8 ocorrências por dia da semana + ajuste por atração.</p>
        </div>
        <Button onClick={recalcular} disabled={recalc} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${recalc ? 'animate-spin' : ''}`} />
          {recalc ? 'Recalculando…' : 'Recalcular'}
        </Button>
      </div>

      {proximoFimSemana && (
        <Card className="p-6 bg-pink-50 dark:bg-pink-900/10 border-2 border-pink-200">
          <h2 className="font-semibold text-pink-700 dark:text-pink-400 mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Próximo fim de semana
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Kpi rotulo="Data" valor={new Date(proximoFimSemana.data_evento + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })} />
            <Kpi rotulo="Faturamento previsto" valor={fmtMoeda(proximoFimSemana.fat_previsto)} icone={<DollarSign className="w-4 h-4" />} />
            <Kpi rotulo="Público previsto" valor={fmt(proximoFimSemana.publico_previsto)} icone={<Users className="w-4 h-4" />} />
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Intervalo confiança 80%: {fmtMoeda(proximoFimSemana.ic_inferior)} a {fmtMoeda(proximoFimSemana.ic_superior)}
          </p>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Faturamento previsto — próximos 14 dias</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="dia" fontSize={10} angle={-30} textAnchor="end" height={70} />
            <YAxis tickFormatter={fmtMoeda} fontSize={11} />
            <Tooltip formatter={(v: any) => fmtMoeda(v)} />
            <Bar dataKey="fat" fill="#ec4899" radius={[4, 4, 0, 0]}>
              <ErrorBar dataKey="erro" stroke="#9ca3af" width={4} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Detalhe das previsões</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                <th className="text-left py-2">Data</th>
                <th className="text-left py-2">Dia</th>
                <th className="text-right py-2">Fat. previsto</th>
                <th className="text-right py-2">IC 80% (–)</th>
                <th className="text-right py-2">IC 80% (+)</th>
                <th className="text-right py-2">Público</th>
                <th className="text-right py-2">Base (n)</th>
                <th className="text-right py-2">Ajuste atração</th>
              </tr>
            </thead>
            <tbody>
              {previsoes.map((p: any) => (
                <tr key={p.data_evento} className="border-b last:border-0">
                  <td className="py-2">{new Date(p.data_evento + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="py-2">{dias[new Date(p.data_evento + 'T12:00:00').getDay()]}</td>
                  <td className="py-2 text-right tabular-nums font-semibold">{fmtMoeda(p.fat_previsto)}</td>
                  <td className="py-2 text-right tabular-nums text-gray-500">{fmtMoeda(p.ic_inferior)}</td>
                  <td className="py-2 text-right tabular-nums text-gray-500">{fmtMoeda(p.ic_superior)}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(p.publico_previsto)}</td>
                  <td className="py-2 text-right tabular-nums text-xs">{p.base_n_ocorrencias}</td>
                  <td className="py-2 text-right tabular-nums text-xs">{p.ajuste_atracao ? `${Number(p.ajuste_atracao).toFixed(2)}x` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}

function Kpi({ rotulo, valor, icone }: { rotulo: string; valor: any; icone?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">{icone}{rotulo}</div>
      <div className="text-xl font-bold tabular-nums">{valor}</div>
    </div>
  );
}
