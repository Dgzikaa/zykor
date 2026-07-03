'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useBar } from '@/contexts/BarContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Music, DollarSign, Users, TrendingUp, TrendingDown, Minus, Award, Gauge, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';

const money = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const num = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');
const pct = (v: number | null) => (v == null ? '—' : `${v >= 0 ? '' : ''}${Math.round(v)}%`);

type Sort = 'fat_total' | 'roi' | 'lift_fat' | 'publico_medio' | 'custo_total' | 'retorno';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'lift_fat', label: 'Maior lift' },
  { key: 'fat_total', label: 'Faturamento' },
  { key: 'roi', label: 'ROI' },
  { key: 'retorno', label: 'Retorno' },
  { key: 'publico_medio', label: 'Público' },
  { key: 'custo_total', label: 'Cachê pago' },
];

export default function FerramentasArtistasPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  const [periodo, setPeriodo] = useState(12);
  const [data, setData] = useState<any[] | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [sort, setSort] = useState<Sort>('lift_fat');

  const carregar = useCallback(async () => {
    if (!barId) return;
    setData(null);
    try {
      const r = await fetch(`/api/analitico/atracoes?periodo=${periodo}&bar_id=${barId}`, { cache: 'no-store' });
      const j = await r.json();
      setData(j.data || []); setStats(j.stats || null);
    } catch { setData([]); }
  }, [barId, periodo]);
  useEffect(() => { carregar(); }, [carregar]);

  const linhas = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => (Number(b[sort] ?? -Infinity)) - (Number(a[sort] ?? -Infinity)));
  }, [data, sort]);

  const kpis = stats ? [
    { icon: Music, cor: 'text-violet-500', label: 'Artistas', v: num(stats.total_atracoes) },
    { icon: Users, cor: 'text-blue-500', label: 'Shows', v: num(stats.total_shows) },
    { icon: DollarSign, cor: 'text-emerald-500', label: 'Faturamento', v: money(stats.fat_total) },
    { icon: DollarSign, cor: 'text-rose-500', label: `Cachê pago (${periodo}m)`, v: money(stats.custo_total) },
    { icon: Gauge, cor: 'text-amber-500', label: 'ROI médio', v: stats.roi_medio != null ? `${Math.round(stats.roi_medio)}%` : '—' },
    { icon: Sparkles, cor: 'text-pink-500', label: 'Maior lift', v: stats.top_lift || '—' },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-3 py-4 max-w-7xl space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Award className="h-6 w-6 text-amber-500" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Artistas — visão da casa</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">ROI, retorno e <b>lift</b> (o quanto o artista rende acima de uma noite típica do mesmo dia).</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[6, 12, 24].map(m => (
              <button key={m} onClick={() => setPeriodo(m)} className={`px-2.5 h-8 rounded-md text-sm border transition ${periodo === m ? 'border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-900/25 dark:text-violet-300' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>{m}m</button>
            ))}
            <Link href="/analitico/atracoes" className="text-sm rounded-md border border-gray-300 dark:border-gray-600 px-3 h-8 inline-flex items-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Visão do artista →</Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {(kpis.length ? kpis : Array.from({ length: 6 })).map((k: any, i) => (
            <Card key={i}><CardContent className="p-4">
              {k ? <>
                <div className="flex items-center gap-1.5 text-xs text-gray-500"><k.icon className={`h-3.5 w-3.5 ${k.cor}`} />{k.label}</div>
                <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white truncate" title={String(k.v)}>{k.v}</div>
              </> : <Skeleton className="h-10" />}
            </CardContent></Card>
          ))}
        </div>

        {/* Ordenar por */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-gray-400">Ordenar:</span>
          {SORTS.map(s => (
            <button key={s.key} onClick={() => setSort(s.key)} className={`h-7 px-2 rounded border ${sort === s.key ? 'border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-900/25 dark:text-violet-300' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>{s.label}</button>
          ))}
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Ranking interno</CardTitle><CardDescription>lift = fat médio do artista − média do mesmo dia-da-semana sem ele (valor incremental que ele traz)</CardDescription></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {data === null ? <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              : linhas.length === 0 ? <div className="py-12 text-center text-gray-500">Sem dados de atrações no período (precisa de eventos taggeados).</div>
                : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                      <th className="text-left px-3 py-2">#</th>
                      <th className="text-left px-3 py-2">Artista</th>
                      <th className="text-right px-3 py-2">Shows</th>
                      <th className="text-right px-3 py-2">Fat. médio/noite</th>
                      <th className="text-right px-3 py-2">Público médio</th>
                      <th className="text-right px-3 py-2" title={`Cachê pago no período (${periodo} meses). Na página do artista o total é do histórico completo — por isso pode diferir.`}>Cachê pago ({periodo}m)</th>
                      <th className="text-right px-3 py-2" title="R$ faturado por R$ de cachê">Retorno</th>
                      <th className="text-right px-3 py-2" title="% do faturamento que vira cachê">% cachê</th>
                      <th className="text-right px-3 py-2" title="Fat médio do artista menos a média do mesmo dia-da-semana sem ele">Lift fat</th>
                      <th className="text-right px-3 py-2" title="Público médio acima da média do mesmo dia sem ele">Lift púb.</th>
                      <th className="text-center px-3 py-2">Tend.</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {linhas.map((a, i) => (
                        <tr key={a.artista_id ?? a.nome} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-3 py-2 text-gray-400 tabular-nums">{i + 1}</td>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            {a.artista_id ? <Link href={`/analitico/atracoes?artista=${a.artista_id}`} className="hover:text-violet-600 hover:underline">{a.nome}</Link> : a.nome}
                            <span className="text-[11px] text-gray-400 capitalize"> · {a.tipo}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{a.shows}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(a.fat_medio)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{num(a.publico_medio)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(a.custo_total)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{a.retorno != null ? `${a.retorno.toFixed(1).replace('.', ',')}×` : '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-500">{a.pct_cachet != null ? `${Math.round(a.pct_cachet)}%` : '—'}</td>
                          <td className={`px-3 py-2 text-right tabular-nums font-medium ${a.lift_fat == null ? 'text-gray-400' : a.lift_fat >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {a.lift_fat == null ? '—' : <span className="inline-flex items-center gap-0.5">{a.lift_fat >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{money(Math.abs(a.lift_fat))}</span>}
                          </td>
                          <td className={`px-3 py-2 text-right tabular-nums ${a.lift_publico == null ? 'text-gray-400' : a.lift_publico >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {a.lift_publico == null ? '—' : `${a.lift_publico >= 0 ? '+' : ''}${num(a.lift_publico)}`}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {a.tendencia === 'subindo' ? <TrendingUp className="h-4 w-4 text-emerald-500 inline" /> : a.tendencia === 'caindo' ? <TrendingDown className="h-4 w-4 text-rose-500 inline" /> : <Minus className="h-4 w-4 text-gray-400 inline" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
          </CardContent>
        </Card>
        <p className="text-[11px] text-gray-400">Valores do <b>período selecionado</b> ({periodo} meses) e só de noites com faturamento &gt; R$1.000 — por isso o "cachê pago" aqui difere do <b>total histórico</b> na página do artista. Cachê exato do Conta Azul por artista (mesmo critério da trajetória, sem rateio). Consumação de cortesia fora deste cálculo.</p>
      </div>
    </div>
  );
}
