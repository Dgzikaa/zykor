'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { GraficoBase } from '@/components/graficos/GraficoBase';
import { HeroRow, ChartCard, ChartGrid, GraficoBarraH, GraficoScatter, type Kpi } from '@/components/graficos/Charts';
import { mesBounds } from '../_periodo';
import { Music, Users, DollarSign, Gauge, Sparkles, Flame, Loader2 } from 'lucide-react';

const money = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const moneyK = (v: number) => `${v < 0 ? '-' : ''}R$ ${Math.abs(Math.round((v || 0) / 1000))}k`;
const num = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');

export function SecaoArtistico({ barId, periodo, mesRef }: { barId: number; periodo: number; mesRef: string | null }) {
  const [rank, setRank] = useState<any | null>(null);
  const [labels, setLabels] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    // No modo mês: recorta por data (de/ate) do mês escolhido; senão janela de `periodo` meses.
    const win = mesRef ? (() => { const b = mesBounds(mesRef); return `de=${b.de}&ate=${b.ate}`; })() : `periodo=${periodo}`;
    try {
      const [r, l] = await Promise.all([
        api.get(`/api/analitico/atracoes?${win}&bar_id=${barId}`),
        api.get(`/api/analitico/labels?${win}&bar_id=${barId}`),
      ]);
      setRank(r?.success ? r : null);
      setLabels(l?.success ? l : null);
    } catch { setRank(null); setLabels(null); }
    finally { setLoading(false); }
  }, [barId, periodo, mesRef]);
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

  // público médio por artista (poder de público — distinto de lift/saldo/retorno)
  const porPublico = useMemo(() => [...artistas].filter((a) => (a.publico_medio || 0) > 0)
    .sort((a, b) => (b.publico_medio || 0) - (a.publico_medio || 0)), [artistas]);

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

        <ChartCard titulo="Público médio por artista" subtitulo="poder de público — média de pessoas por noite quando o artista foi o principal" span={2}>
          <GraficoBarraH data={porPublico} xKey="nome" valueKey="publico_medio" formatV={num} height={360} maxItens={16} />
        </ChartCard>

        <ChartCard titulo="NPS por label" subtitulo="satisfação (promotores − detratores) por noite recorrente">
          <GraficoBarraH data={npsLabel} xKey="nome" valueKey="nps_score" diverging formatV={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}`} height={360} />
        </ChartCard>
      </ChartGrid>
    </div>
  );
}
