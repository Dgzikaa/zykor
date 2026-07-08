'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { GraficoBase } from '@/components/graficos/GraficoBase';
import { HeroRow, ChartCard, ChartGrid, GraficoBarraH, GraficoScatter, GraficoHeatmap, type Kpi } from '@/components/graficos/Charts';
import { Music, Users, DollarSign, Gauge, Sparkles, Flame, Loader2 } from 'lucide-react';

const money = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const moneyK = (v: number) => `${v < 0 ? '-' : ''}R$ ${Math.abs(Math.round((v || 0) / 1000))}k`;
const num = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');

export function SecaoArtistico({ barId, periodo }: { barId: number; periodo: number }) {
  const [rank, setRank] = useState<any | null>(null);
  const [labels, setLabels] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [r, l] = await Promise.all([
        api.get(`/api/analitico/atracoes?periodo=${periodo}&bar_id=${barId}`),
        api.get(`/api/analitico/labels?periodo=${periodo}&bar_id=${barId}`),
      ]);
      setRank(r?.success ? r : null);
      setLabels(l?.success ? l : null);
    } catch { setRank(null); setLabels(null); }
    finally { setLoading(false); }
  }, [barId, periodo]);
  useEffect(() => { carregar(); }, [carregar]);

  const artistas: any[] = useMemo(() => rank?.data || [], [rank]);
  const stats = rank?.stats;
  const labs: any[] = useMemo(() => labels?.labels || [], [labels]);

  const kpis: Kpi[] = useMemo(() => stats ? [
    { label: 'Artistas', valor: num(stats.total_atracoes), icon: Music },
    { label: 'Shows', valor: num(stats.total_shows), icon: Users },
    { label: 'Faturamento', valor: money(stats.fat_total), icon: DollarSign },
    { label: 'Cachê pago', valor: money(stats.custo_total), icon: DollarSign },
    { label: 'ROI médio', valor: stats.roi_medio != null ? `${Math.round(stats.roi_medio)}%` : '—', icon: Gauge },
    { label: 'Maior lift', valor: stats.top_lift || '—', sub: 'incremental', icon: Sparkles },
  ] : [], [stats]);

  // rankings ordenados
  const porLift = useMemo(() => [...artistas].filter((a) => a.lift_fat != null).sort((a, b) => b.lift_fat - a.lift_fat), [artistas]);
  const porSaldo = useMemo(() => {
    const withSaldo = artistas.map((a) => ({ ...a, _saldo: a.saldo_cachet != null ? a.saldo_cachet : (a.lift_fat != null ? a.lift_fat - (a.custo_medio || 0) : null) }));
    return withSaldo.filter((a) => a._saldo != null).sort((a, b) => b._saldo - a._saldo);
  }, [artistas]);
  const scatterRetorno = useMemo(() => artistas.filter((a) => a.retorno != null && a.custo_medio > 0), [artistas]);
  const scatterAquis = useMemo(() => artistas.filter((a) => (a.novos || 0) > 0 && a.pct_fideliza != null), [artistas]);
  const porFatLabel = useMemo(() => [...labs].sort((a, b) => b.fat_total - a.fat_total), [labs]);
  const npsLabel = useMemo(() => labs.filter((l) => l.nps_score != null).sort((a, b) => b.nps_score - a.nps_score), [labs]);

  // composição por label (top 8 por fat) — stacked R$
  const compData = useMemo(() => [...labs].sort((a, b) => b.fat_total - a.fat_total).slice(0, 8).map((l) => ({
    label: l.nome, bar: l.composicao?.bar || 0, couvert: l.composicao?.couvert || 0, bilheteria: l.composicao?.bilheteria || 0,
  })), [labs]);

  // matriz artista × label
  const matriz = useMemo(() => {
    const topLabels = [...labs].sort((a, b) => b.shows - a.shows).slice(0, 8);
    const artTot = new Map<string, { nome: string; shows: number }>();
    for (const l of topLabels) for (const a of l.artistas || []) {
      const k = a.artista_id ? `id:${a.artista_id}` : `n:${String(a.nome).toLowerCase()}`;
      const c = artTot.get(k) || { nome: a.nome, shows: 0 }; c.shows += a.shows; artTot.set(k, c);
    }
    const topArt = [...artTot.entries()].sort((a, b) => b[1].shows - a[1].shows).slice(0, 8);
    const artIdx = new Map(topArt.map(([k], i) => [k, i]));
    const cells: [number, number, number][] = [];
    topLabels.forEach((l, li) => { for (const a of l.artistas || []) { const k = a.artista_id ? `id:${a.artista_id}` : `n:${String(a.nome).toLowerCase()}`; const ai = artIdx.get(k); if (ai != null) cells.push([ai, li, Math.round(a.fat_medio)]); } });
    return { xs: topArt.map(([, a]) => a.nome), ys: topLabels.map((l) => l.nome), cells };
  }, [labs]);

  if (loading) return <div className="py-20 text-center text-gray-400"><Loader2 className="w-7 h-7 animate-spin mx-auto" /></div>;
  if (!artistas.length && !labs.length) return <div className="py-20 text-center text-gray-400">Sem dados artísticos no período.</div>;

  return (
    <div className="space-y-4">
      {kpis.length > 0 && <HeroRow kpis={kpis} cols={6} />}

      <ChartGrid>
        <ChartCard titulo="Lift de faturamento por artista" subtitulo="quanto rende ACIMA da média do mesmo dia-da-semana sem ele (valor incremental)">
          <GraficoBarraH data={porLift} xKey="nome" valueKey="lift_fat" diverging formatV={moneyK} height={360} />
        </ChartCard>

        <ChartCard titulo="Vale o cachê?" subtitulo="lift por show menos o cachê médio — positivo = traz mais do que custa">
          <GraficoBarraH data={porSaldo} xKey="nome" valueKey="_saldo" diverging formatV={moneyK} height={360} />
        </ChartCard>

        <ChartCard titulo="Retorno × cachê" subtitulo="cachê médio (x) × retorno R$fat/R$cachê (y) · bolha = público médio">
          <GraficoScatter data={scatterRetorno} xKey="custo_medio" yKey="retorno" sizeKey="publico_medio" nameKey="nome"
            xLabel="Cachê médio" yLabel="Retorno" formatX={moneyK} formatY={(v) => `${v.toFixed(1)}×`} height={360} />
        </ChartCard>

        <ChartCard titulo="Quem traz e fixa cliente" subtitulo="novos clientes (x) × % que fidelizou (y) · bolha = faturamento">
          <GraficoScatter data={scatterAquis} xKey="novos" yKey="pct_fideliza" sizeKey="fat_total" nameKey="nome"
            xLabel="Novos clientes" yLabel="% fideliza" formatX={num} formatY={(v) => `${Math.round(v)}%`} height={360} />
        </ChartCard>

        <ChartCard titulo="Faturamento por label" subtitulo="ranking das noites recorrentes">
          <GraficoBarraH data={porFatLabel} xKey="nome" valueKey="fat_total" formatV={moneyK} height={360} />
        </ChartCard>

        <ChartCard titulo="Composição do faturamento por label" subtitulo="de onde vem o dinheiro: Bar (consumo) · Couvert · Bilheteria (Yuzer/Sympla)">
          <GraficoBase tipo="barra" stacked data={compData} xKey="label" formatY={moneyK} height={360}
            series={[{ key: 'bar', label: 'Bar' }, { key: 'couvert', label: 'Couvert' }, { key: 'bilheteria', label: 'Bilheteria' }]} />
        </ChartCard>

        <ChartCard titulo="Matriz artista × label" subtitulo="faturamento médio/noite quando o artista foi o principal — mais escuro = fatura mais" span={2}>
          <GraficoHeatmap data={matriz.cells} xs={matriz.xs} ys={matriz.ys} formatV={moneyK} height={360} />
        </ChartCard>

        <ChartCard titulo="NPS por label" subtitulo="satisfação (promotores − detratores) por noite recorrente">
          <GraficoBarraH data={npsLabel} xKey="nome" valueKey="nps_score" diverging formatV={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}`} height={360} />
        </ChartCard>
      </ChartGrid>
    </div>
  );
}
