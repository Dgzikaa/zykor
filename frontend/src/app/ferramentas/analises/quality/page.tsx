'use client';

import { useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Award, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { usePageTitle } from '@/contexts/PageTitleContext';

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(n);

function scoreColor(s: number | null) {
  if (s == null) return 'text-gray-400';
  if (s >= 85) return 'text-emerald-600';
  if (s >= 70) return 'text-amber-600';
  return 'text-red-600';
}
function scoreBg(s: number | null) {
  if (s == null) return 'bg-gray-100';
  if (s >= 85) return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200';
  if (s >= 70) return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200';
}
function scoreLabel(s: number | null) {
  if (s == null) return 'Sem dado';
  if (s >= 90) return 'Excelente';
  if (s >= 80) return 'Muito bom';
  if (s >= 70) return 'Bom';
  if (s >= 60) return 'Regular';
  return 'Atenção';
}

export default function QualidadePage() {
  const { selectedBar } = useBar();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { setPageTitle } = usePageTitle();

  useEffect(() => { setPageTitle('🏆 Quality Scorecard'); return () => setPageTitle(''); }, [setPageTitle]);

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    fetch(`/api/qualidade?bar_id=${selectedBar.id}&semanas=12`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [selectedBar?.id]);

  if (loading) return <main className="max-w-7xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  const atual = data?.atual ?? null;
  const score = atual ? Number(atual.score) : null;
  const variacao = data?.variacao ?? 0;
  const media = data?.media_periodo ?? 0;
  const historico = data?.historico ?? [];

  const componentes = atual ? [
    { rotulo: 'NPS Digital',       valor: Number(atual.comp_nps_digital),   peso: '25%' },
    { rotulo: 'Stockout',          valor: Number(atual.comp_stockout),      peso: '15%' },
    { rotulo: 'NPS Salão',         valor: Number(atual.comp_nps_salao),     peso: '10%' },
    { rotulo: 'Atrasos',           valor: Number(atual.comp_atrasos),       peso: '10%' },
    { rotulo: 'Reservas cumpridas', valor: Number(atual.comp_reservas),     peso: '10%' },
    { rotulo: 'Tempo cozinha',     valor: Number(atual.comp_tempo_cozinha), peso: '10%' },
    { rotulo: 'Tempo drinks',      valor: Number(atual.comp_tempo_drinks),  peso: '10%' },
    { rotulo: 'NPS Reservas',      valor: Number(atual.comp_nps_reservas),  peso: '5%' },
    { rotulo: 'IG engagement',     valor: Number(atual.comp_ig_engagement), peso: '5%' },
  ].filter(c => !isNaN(c.valor)) : [];

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Award className="w-6 h-6 text-pink-600" /></h1>
        <p className="text-sm text-gray-500">Indicador único de qualidade da operação por semana (0-100).</p>
      </div>

      {/* SCORE HERO */}
      <Card className={`p-8 border-2 ${scoreBg(score)}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
              Semana {atual?.numero_semana}/{atual?.ano}
            </p>
            <div className={`text-7xl font-bold tabular-nums ${scoreColor(score)}`}>
              {fmt(score)}
            </div>
            <p className={`text-lg font-semibold ${scoreColor(score)}`}>
              {scoreLabel(score)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Variação WoW</p>
            <div className={`text-3xl font-bold flex items-center gap-2 ${variacao > 0 ? 'text-emerald-600' : variacao < 0 ? 'text-red-600' : 'text-gray-500'}`}>
              {variacao > 0 ? <TrendingUp className="w-7 h-7" /> : variacao < 0 ? <TrendingDown className="w-7 h-7" /> : <Minus className="w-7 h-7" />}
              {variacao > 0 ? '+' : ''}{fmt(variacao)}
            </div>
            <p className="text-xs text-gray-500 mt-1">vs semana anterior</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Média 12 semanas</p>
            <div className="text-3xl font-bold tabular-nums text-gray-700 dark:text-gray-300">{fmt(media)}</div>
            <p className="text-xs text-gray-500 mt-1">{score && score > media ? 'Acima da média' : 'Abaixo da média'}</p>
          </div>
        </div>
      </Card>

      {/* EVOLUÇÃO */}
      <Card className="p-6">
        <h2 className="font-semibold mb-4">Evolução do score (12 semanas)</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={historico.map((h: any) => ({ semana: `S${h.numero_semana}`, score: Number(h.score) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="semana" fontSize={11} />
            <YAxis domain={[0, 100]} fontSize={11} />
            <Tooltip />
            <ReferenceLine y={85} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Excelente (85)', fontSize: 10, fill: '#10b981' }} />
            <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Bom (70)', fontSize: 10, fill: '#f59e0b' }} />
            <Line type="monotone" dataKey="score" stroke="#ec4899" strokeWidth={3} dot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* COMPONENTES */}
      <Card className="p-6">
        <h2 className="font-semibold mb-1">Breakdown do score</h2>
        <p className="text-xs text-gray-500 mb-4">
          Cada componente é normalizado pra 0-100 e ponderado. NULL = sem dado pra semana.
        </p>
        <div className="space-y-2">
          {componentes.map(c => (
            <div key={c.rotulo} className="flex items-center gap-3">
              <span className="w-44 text-sm text-gray-600 dark:text-gray-300">{c.rotulo}</span>
              <span className="text-xs text-gray-400 w-12">{c.peso}</span>
              <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full ${c.valor >= 85 ? 'bg-emerald-500' : c.valor >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, c.valor)}%` }}
                />
              </div>
              <span className={`text-sm font-semibold tabular-nums w-12 text-right ${scoreColor(c.valor)}`}>
                {fmt(c.valor)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
