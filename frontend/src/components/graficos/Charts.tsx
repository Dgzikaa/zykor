'use client';

// Biblioteca de gráficos do hub /graficos (Apache ECharts). Estende o GraficoBase (linha/área/barra)
// com os tipos que o catálogo pede: barra-horizontal, donut, heatmap, waterfall, scatter/bolha, radar,
// gauge — + StatTile/HeroRow pros indicadores. Segue o dataviz skill: paleta VALIDADA em ordem fixa,
// UM eixo, legenda p/ ≥2 séries, grid recessivo, dark mode desenhado, tooltip sempre.
import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useGraficoTheme } from './GraficoBase';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

const hexA = (hex: string, a: number) => {
  const h = (hex || '#000').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};
const fmtNum = (v: any) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const baseTextStyle = { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' };

type Fmt = (v: number) => string;

// ---------------------------------------------------------------------------
// StatTile / HeroRow — KPIs com valor grande + tendência (seta colorida)
// ---------------------------------------------------------------------------
export type Kpi = {
  label: string;
  valor: string;
  delta?: number | null;       // variação (ex.: % vs período anterior); + verde, − vermelho
  deltaLabel?: string;         // texto custom no lugar do delta
  sub?: string;                // linha auxiliar
  cor?: string;                // cor de destaque do valor (opcional)
  invLower?: boolean;          // true = menor é melhor (inverte a cor da seta)
  icon?: React.ComponentType<{ className?: string }>;
};

export function StatTile({ k }: { k: Kpi }) {
  const positivo = k.delta == null ? null : (k.invLower ? k.delta < 0 : k.delta > 0);
  const corDelta = positivo == null ? 'text-gray-400'
    : positivo ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  const Icon = k.icon;
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3.5 min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] truncate">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}<span className="truncate">{k.label}</span>
      </div>
      <div className="mt-1 text-2xl font-bold leading-tight truncate" style={k.cor ? { color: k.cor } : undefined} title={k.valor}>
        {k.valor}
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-[11px]">
        {k.deltaLabel != null ? <span className="text-[hsl(var(--muted-foreground))]">{k.deltaLabel}</span>
          : k.delta != null ? (
            <span className={`inline-flex items-center gap-0.5 font-medium ${corDelta}`}>
              {k.delta > 0 ? <TrendingUp className="h-3 w-3" /> : k.delta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {Math.abs(k.delta).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
            </span>
          ) : null}
        {k.sub && <span className="text-[hsl(var(--muted-foreground))] truncate">{k.sub}</span>}
      </div>
    </div>
  );
}

export function HeroRow({ kpis, cols = 6 }: { kpis: Kpi[]; cols?: number }) {
  const gc: Record<number, string> = {
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  };
  return <div className={`grid ${gc[cols] || gc[6]} gap-2.5`}>{kpis.map((k, i) => <StatTile key={i} k={k} />)}</div>;
}

// ---------------------------------------------------------------------------
// GraficoBarraH — barra horizontal (ranking / divergente)
// ---------------------------------------------------------------------------
export function GraficoBarraH({
  data, xKey, valueKey, height = 340, formatV, diverging = false, cor, maxItens = 14, corPorItem,
}: {
  data: any[]; xKey: string; valueKey: string; height?: number; formatV?: Fmt; diverging?: boolean; cor?: string; maxItens?: number;
  // cor por barra (ex.: cor por categoria). Recebe o DADO da linha e o índice.
  corPorItem?: (dado: any, index: number) => string;
}) {
  const th = useGraficoTheme();
  const rows = useMemo(() => [...(data || [])].slice(0, maxItens).reverse(), [data, maxItens]);
  const corPos = cor || th.cores[0];
  const option = useMemo(() => ({
    textStyle: baseTextStyle,
    grid: { top: 8, right: 56, bottom: 8, left: 6, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: hexA(th.muted, 0.08) } }, backgroundColor: th.surface, borderColor: th.eixo, borderWidth: 1, textStyle: { color: th.texto, fontSize: 12 }, valueFormatter: (v: any) => (formatV ? formatV(Number(v)) : fmtNum(v)) },
    xAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: th.grid } }, axisLabel: { color: th.muted, fontSize: 11, formatter: (v: number) => (formatV ? formatV(v) : fmtNum(v)) } },
    yAxis: { type: 'category', data: rows.map((d) => d[xKey]), axisLine: { lineStyle: { color: th.eixo } }, axisTick: { show: false }, axisLabel: { color: th.texto2, fontSize: 11, width: 130, overflow: 'truncate' } },
    series: [{
      type: 'bar', data: rows.map((d) => Number(d[valueKey]) || 0),
      barMaxWidth: 18,
      itemStyle: { borderRadius: [0, 4, 4, 0], color: corPorItem ? (p: any) => corPorItem(rows[p.dataIndex], p.dataIndex) : (p: any) => (diverging ? (p.value < 0 ? th.cores[5] : th.cores[1]) : corPos) },
      label: { show: true, position: 'right', color: th.texto2, fontSize: 11, formatter: (p: any) => (formatV ? formatV(p.value) : fmtNum(p.value)) },
    }],
  }), [th, rows, xKey, valueKey, formatV, diverging, corPos, corPorItem]);
  if (!rows.length) return <Vazio height={height} />;
  return <ReactECharts option={option} style={{ height, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge lazyUpdate />;
}

// ---------------------------------------------------------------------------
// GraficoBarra — barra vertical (série temporal) com linha opcional (eixo 2º)
// ---------------------------------------------------------------------------
export function GraficoBarra({
  data, xKey, valueKey, lineKey, height = 320, formatV, formatLine,
  cor, corLinha, nomeBarra = 'Valor', nomeLinha = '%', mostrarRotulo = false, mediaLinha = false, rotacaoX = 0, corPorItem,
}: {
  data: any[]; xKey: string; valueKey: string; lineKey?: string; height?: number;
  formatV?: Fmt; formatLine?: Fmt; cor?: string; corLinha?: string;
  nomeBarra?: string; nomeLinha?: string; mostrarRotulo?: boolean; mediaLinha?: boolean; rotacaoX?: number;
  // cor condicional por barra (ex.: destacar pico, positivo/negativo). Recebe (valor, índice).
  corPorItem?: (valor: number, index: number) => string;
}) {
  const th = useGraficoTheme();
  const rows = useMemo(() => data || [], [data]);
  const corBar = cor || th.cores[0];
  const corLin = corLinha || th.cores[3];
  const temLinha = !!lineKey;
  const option = useMemo(() => ({
    textStyle: baseTextStyle,
    grid: { top: mostrarRotulo ? 20 : 12, right: temLinha ? 52 : 14, bottom: temLinha ? 44 : 24, left: 6, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: hexA(th.muted, 0.08) } }, backgroundColor: th.surface, borderColor: th.eixo, borderWidth: 1, textStyle: { color: th.texto, fontSize: 12 } },
    legend: temLinha ? { bottom: 0, icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { color: th.texto2, fontSize: 11 } } : undefined,
    xAxis: { type: 'category', data: rows.map((d) => d[xKey]), axisLine: { lineStyle: { color: th.eixo } }, axisTick: { show: false }, axisLabel: { color: th.texto2, fontSize: 11, rotate: rotacaoX, hideOverlap: true } },
    yAxis: temLinha ? [
      { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: th.grid } }, axisLabel: { color: th.muted, fontSize: 11, formatter: (v: number) => (formatV ? formatV(v) : fmtNum(v)) } },
      { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { color: th.muted, fontSize: 11, formatter: (v: number) => (formatLine ? formatLine(v) : fmtNum(v)) } },
    ] : { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: th.grid } }, axisLabel: { color: th.muted, fontSize: 11, formatter: (v: number) => (formatV ? formatV(v) : fmtNum(v)) } },
    series: [
      { name: nomeBarra, type: 'bar', data: rows.map((d) => Number(d[valueKey]) || 0), barMaxWidth: 30, itemStyle: { borderRadius: [4, 4, 0, 0], color: corPorItem ? (p: any) => corPorItem(Number(p.value) || 0, p.dataIndex) : corBar }, label: mostrarRotulo ? { show: true, position: 'top', color: th.texto2, fontSize: 10, formatter: (p: any) => (formatV ? formatV(p.value) : fmtNum(p.value)) } : undefined },
      ...(temLinha ? [{
        name: nomeLinha, type: 'line', yAxisIndex: 1,
        data: rows.map((d) => (d[lineKey!] == null ? null : Number(d[lineKey!]))),
        smooth: true, symbol: 'circle', symbolSize: 6, connectNulls: true,
        lineStyle: { width: 2, color: corLin }, itemStyle: { color: corLin },
        label: { show: true, position: 'top', color: corLin, fontSize: 10, formatter: (p: any) => (p.value == null ? '' : formatLine ? formatLine(p.value) : fmtNum(p.value)) },
        markLine: mediaLinha ? {
          silent: true, symbol: 'none',
          data: [{ type: 'average', name: 'Média' }],
          lineStyle: { color: corLin, type: 'dashed', width: 1, opacity: 0.7 },
          label: { color: corLin, fontSize: 9, formatter: (p: any) => `média ${formatLine ? formatLine(p.value) : fmtNum(p.value)}` },
        } : undefined,
      }] : []),
    ],
  }), [th, rows, xKey, valueKey, lineKey, formatV, formatLine, corBar, corLin, temLinha, nomeBarra, nomeLinha, mostrarRotulo, mediaLinha, rotacaoX, corPorItem]);
  if (!rows.length) return <Vazio height={height} />;
  return <ReactECharts option={option} style={{ height, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge lazyUpdate />;
}

// ---------------------------------------------------------------------------
// GraficoLinha — série(s) temporal(is) em linha (com área opcional)
// ---------------------------------------------------------------------------
export function GraficoLinha({
  data, xKey, series, height = 300, formatV, cores, area = false, rotacaoX = 0, markLines, tooltipFormatter, connectNulls = false,
}: {
  data: any[]; xKey: string; series: { key: string; nome: string; cor?: string; dashed?: boolean }[];
  height?: number; formatV?: Fmt; cores?: string[]; area?: boolean; rotacaoX?: number;
  // linhas de referência horizontais (meta, zero, threshold). Ex.: [{ valor: 0 }, { valor: 34, label: 'Meta', cor: '#f00' }]
  markLines?: { valor: number; label?: string; cor?: string }[];
  // tooltip totalmente custom (recebe os params do ECharts, retorna HTML string)
  tooltipFormatter?: (params: any) => string;
  // conecta pontos através de gaps (null) em vez de zerar — para séries esparsas
  connectNulls?: boolean;
}) {
  const th = useGraficoTheme();
  const rows = useMemo(() => data || [], [data]);
  const paleta = cores && cores.length ? cores : th.cores;
  const option = useMemo(() => ({
    textStyle: baseTextStyle,
    grid: { top: 12, right: 14, bottom: series.length > 1 ? 44 : 24, left: 6, containLabel: true },
    tooltip: { trigger: 'axis', backgroundColor: th.surface, borderColor: th.eixo, borderWidth: 1, textStyle: { color: th.texto, fontSize: 12 }, ...(tooltipFormatter ? { formatter: tooltipFormatter } : { valueFormatter: (v: any) => (formatV ? formatV(Number(v)) : fmtNum(v)) }) },
    legend: series.length > 1 ? { bottom: 0, icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { color: th.texto2, fontSize: 11 } } : undefined,
    xAxis: { type: 'category', data: rows.map((d) => d[xKey]), boundaryGap: false, axisLine: { lineStyle: { color: th.eixo } }, axisTick: { show: false }, axisLabel: { color: th.texto2, fontSize: 11, rotate: rotacaoX, hideOverlap: true } },
    yAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: th.grid } }, axisLabel: { color: th.muted, fontSize: 11, formatter: (v: number) => (formatV ? formatV(v) : fmtNum(v)) } },
    series: series.map((s, i) => ({
      name: s.nome, type: 'line', data: rows.map((d) => { const v = d[s.key]; return connectNulls && v == null ? null : (Number(v) || 0); }),
      smooth: true, symbol: 'circle', symbolSize: 6, connectNulls: connectNulls || undefined,
      lineStyle: { width: 2, color: s.cor || paleta[i % paleta.length], type: s.dashed ? 'dashed' : 'solid' }, itemStyle: { color: s.cor || paleta[i % paleta.length] },
      areaStyle: area ? { color: hexA(s.cor || paleta[i % paleta.length], 0.12) } : undefined,
      // linhas de referência anexadas à 1ª série
      markLine: (i === 0 && markLines && markLines.length) ? {
        silent: true, symbol: 'none',
        data: markLines.map((m) => ({
          yAxis: m.valor,
          lineStyle: { color: m.cor || th.muted, type: 'dashed', width: 1.2 },
          label: { show: !!m.label, formatter: m.label || '', color: m.cor || th.muted, fontSize: 10, position: 'insideEndTop' },
        })),
      } : undefined,
    })),
  }), [th, rows, xKey, series, formatV, paleta, area, rotacaoX, markLines, tooltipFormatter, connectNulls]);
  if (!rows.length) return <Vazio height={height} />;
  return <ReactECharts option={option} style={{ height, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge lazyUpdate />;
}

// ---------------------------------------------------------------------------
// GraficoBarrasAgrupadas — N séries de barra lado a lado + linha opcional (2º eixo)
// ---------------------------------------------------------------------------
export function GraficoBarrasAgrupadas({
  data, xKey, series, lineKey, height = 300, formatV, formatLine, cores, nomeLinha = '%', corLinha, mostrarRotulo = false, rotacaoX = 0, corPorItem,
}: {
  data: any[]; xKey: string; series: { key: string; nome: string; cor?: string }[]; lineKey?: string;
  height?: number; formatV?: Fmt; formatLine?: Fmt; cores?: string[]; nomeLinha?: string; corLinha?: string; mostrarRotulo?: boolean; rotacaoX?: number;
  // cor condicional por barra numa série (ex.: realizado verde/vermelho vs meta). null/undefined = usa a cor da série.
  corPorItem?: (serieKey: string, dado: any, index: number) => string | null | undefined;
}) {
  const th = useGraficoTheme();
  const rows = useMemo(() => data || [], [data]);
  const paleta = cores && cores.length ? cores : th.cores;
  const temLinha = !!lineKey;
  const corLin = corLinha || th.cores[3];
  const option = useMemo(() => ({
    textStyle: baseTextStyle,
    grid: { top: mostrarRotulo ? 20 : 12, right: temLinha ? 52 : 14, bottom: 44, left: 6, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: hexA(th.muted, 0.08) } }, backgroundColor: th.surface, borderColor: th.eixo, borderWidth: 1, textStyle: { color: th.texto, fontSize: 12 } },
    legend: { bottom: 0, icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { color: th.texto2, fontSize: 11 } },
    xAxis: { type: 'category', data: rows.map((d) => d[xKey]), axisLine: { lineStyle: { color: th.eixo } }, axisTick: { show: false }, axisLabel: { color: th.texto2, fontSize: 11, rotate: rotacaoX, hideOverlap: true } },
    yAxis: temLinha ? [
      { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: th.grid } }, axisLabel: { color: th.muted, fontSize: 11, formatter: (v: number) => (formatV ? formatV(v) : fmtNum(v)) } },
      { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { color: th.muted, fontSize: 11, formatter: (v: number) => (formatLine ? formatLine(v) : fmtNum(v)) } },
    ] : { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: th.grid } }, axisLabel: { color: th.muted, fontSize: 11, formatter: (v: number) => (formatV ? formatV(v) : fmtNum(v)) } },
    series: [
      ...series.map((s, i) => ({
        name: s.nome, type: 'bar', data: rows.map((d) => Number(d[s.key]) || 0), barMaxWidth: 22,
        itemStyle: { borderRadius: [3, 3, 0, 0], color: corPorItem ? (p: any) => (corPorItem(s.key, rows[p.dataIndex], p.dataIndex) || s.cor || paleta[i % paleta.length]) : (s.cor || paleta[i % paleta.length]) },
        label: mostrarRotulo ? { show: true, position: 'top', color: th.texto2, fontSize: 9, formatter: (p: any) => (formatV ? formatV(p.value) : fmtNum(p.value)) } : undefined,
      })),
      ...(temLinha ? [{
        name: nomeLinha, type: 'line', yAxisIndex: 1, data: rows.map((d) => Number(d[lineKey]) || 0),
        smooth: true, symbol: 'circle', symbolSize: 5, lineStyle: { width: 2, color: corLin }, itemStyle: { color: corLin },
        label: mostrarRotulo ? { show: true, position: 'top', color: corLin, fontSize: 9, formatter: (p: any) => (formatLine ? formatLine(p.value) : fmtNum(p.value)) } : undefined,
      }] : []),
    ],
  }), [th, rows, xKey, series, lineKey, formatV, formatLine, paleta, temLinha, nomeLinha, corLin, mostrarRotulo, rotacaoX, corPorItem]);
  if (!rows.length) return <Vazio height={height} />;
  return <ReactECharts option={option} style={{ height, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge lazyUpdate />;
}

// ---------------------------------------------------------------------------
// GraficoBarrasAgrupadasH — N séries de barra HORIZONTAL por categoria, com rótulo
// no fim de cada barra (bom p/ dia-da-semana × mês: números não se sobrepõem)
// ---------------------------------------------------------------------------
export function GraficoBarrasAgrupadasH({
  data, yKey, series, height = 340, formatV, cores, mostrarRotulo = true, mostrarVariacao = false,
}: {
  data: any[]; yKey: string; series: { key: string; nome: string; cor?: string }[];
  height?: number; formatV?: Fmt; cores?: string[]; mostrarRotulo?: boolean; mostrarVariacao?: boolean;
}) {
  const th = useGraficoTheme();
  const rows = useMemo(() => data || [], [data]);
  const paleta = cores && cores.length ? cores : th.cores;
  const option = useMemo(() => ({
    textStyle: baseTextStyle,
    grid: { top: 8, right: mostrarVariacao ? 104 : 66, bottom: 40, left: 6, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: hexA(th.muted, 0.08) } }, backgroundColor: th.surface, borderColor: th.eixo, borderWidth: 1, textStyle: { color: th.texto, fontSize: 12 }, valueFormatter: (v: any) => (formatV ? formatV(Number(v)) : fmtNum(v)) },
    legend: { bottom: 0, icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { color: th.texto2, fontSize: 11 } },
    xAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: th.grid } }, axisLabel: { color: th.muted, fontSize: 11, formatter: (v: number) => (formatV ? formatV(v) : fmtNum(v)) } },
    yAxis: { type: 'category', data: rows.map((d) => d[yKey]), axisLine: { lineStyle: { color: th.eixo } }, axisTick: { show: false }, axisLabel: { color: th.texto2, fontSize: 11 } },
    series: series.map((s, i) => ({
      name: s.nome, type: 'bar', data: rows.map((d) => Number(d[s.key]) || 0),
      barMaxWidth: 11,
      itemStyle: { borderRadius: [0, 3, 3, 0], color: s.cor || paleta[i % paleta.length] },
      label: mostrarRotulo ? {
        show: true, position: 'right', color: th.texto2, fontSize: 9,
        formatter: (p: any) => {
          const base = formatV ? formatV(p.value) : fmtNum(p.value);
          if (!mostrarVariacao) return base;
          const v = rows[p.dataIndex]?.[`${s.key}__var`];
          return v == null ? base : `${base}  ${v >= 0 ? '+' : ''}${fmtNum(v)}%`;
        },
      } : undefined,
    })),
  }), [th, rows, yKey, series, formatV, paleta, mostrarRotulo, mostrarVariacao]);
  if (!rows.length) return <Vazio height={height} />;
  return <ReactECharts option={option} style={{ height, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge lazyUpdate />;
}

// ---------------------------------------------------------------------------
// GraficoDonut — composição (rosca) com total no centro
// ---------------------------------------------------------------------------
export function GraficoDonut({
  data, nameKey, valueKey, height = 300, formatV, cores, centro,
}: {
  data: any[]; nameKey: string; valueKey: string; height?: number; formatV?: Fmt; cores?: string[]; centro?: string;
}) {
  const th = useGraficoTheme();
  const paleta = cores && cores.length ? cores : th.cores;
  const rows = (data || []).filter((d) => Number(d[valueKey]) > 0);
  const option = useMemo(() => ({
    textStyle: baseTextStyle, color: paleta,
    tooltip: { trigger: 'item', backgroundColor: th.surface, borderColor: th.eixo, borderWidth: 1, textStyle: { color: th.texto, fontSize: 12 }, valueFormatter: (v: any) => (formatV ? formatV(Number(v)) : fmtNum(v)) },
    legend: { bottom: 0, icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { color: th.texto2, fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['52%', '74%'], center: ['50%', '44%'], avoidLabelOverlap: true,
      itemStyle: { borderColor: th.surface, borderWidth: 2 },
      label: { show: !!centro, position: 'center', formatter: () => centro || '', color: th.texto, fontSize: 15, fontWeight: 600 },
      emphasis: { label: { show: !!centro } },
      data: rows.map((d) => ({ name: d[nameKey], value: Number(d[valueKey]) || 0 })),
    }],
  }), [th, rows, nameKey, valueKey, formatV, paleta, centro]);
  if (!rows.length) return <Vazio height={height} />;
  return <ReactECharts option={option} style={{ height, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge lazyUpdate />;
}

// ---------------------------------------------------------------------------
// GraficoHeatmap — dia-da-semana × hora, ou coorte (linhas × colunas)
// ---------------------------------------------------------------------------
export function GraficoHeatmap({
  data, xs, ys, height = 340, formatV, cor,
}: {
  data: [number, number, number][]; // [xIndex, yIndex, valor]
  xs: string[]; ys: string[]; height?: number; formatV?: Fmt; cor?: string;
}) {
  const th = useGraficoTheme();
  const base = cor || th.cores[0];
  const max = useMemo(() => Math.max(1, ...data.map((d) => d[2] || 0)), [data]);
  const option = useMemo(() => ({
    textStyle: baseTextStyle,
    grid: { top: 8, right: 12, bottom: 56, left: 6, containLabel: true },
    tooltip: { position: 'top', backgroundColor: th.surface, borderColor: th.eixo, borderWidth: 1, textStyle: { color: th.texto, fontSize: 12 },
      formatter: (p: any) => `${ys[p.value[1]]} · ${xs[p.value[0]]}<br/><b>${formatV ? formatV(p.value[2]) : fmtNum(p.value[2])}</b>` },
    xAxis: { type: 'category', data: xs, splitArea: { show: false }, axisLine: { lineStyle: { color: th.eixo } }, axisTick: { show: false }, axisLabel: { color: th.muted, fontSize: 10, hideOverlap: true } },
    yAxis: { type: 'category', data: ys, splitArea: { show: false }, axisLine: { lineStyle: { color: th.eixo } }, axisTick: { show: false }, axisLabel: { color: th.texto2, fontSize: 11 } },
    visualMap: { min: 0, max, calculable: true, orient: 'horizontal', left: 'center', bottom: 8, itemWidth: 12, itemHeight: 120,
      inRange: { color: [hexA(base, 0.08), base] }, textStyle: { color: th.muted, fontSize: 10 }, formatter: (v: any) => (formatV ? formatV(v) : fmtNum(v)) },
    series: [{ type: 'heatmap', data, label: { show: false }, itemStyle: { borderColor: th.surface, borderWidth: 1.5, borderRadius: 3 }, emphasis: { itemStyle: { borderColor: th.texto2, borderWidth: 1.5 } } }],
  }), [th, data, xs, ys, formatV, base, max]);
  if (!data.length) return <Vazio height={height} />;
  return <ReactECharts option={option} style={{ height, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge lazyUpdate />;
}

// ---------------------------------------------------------------------------
// GraficoWaterfall — cascata (ex.: DRE Receita→custos→Resultado)
// ---------------------------------------------------------------------------
export function GraficoWaterfall({
  passos, height = 340, formatV,
}: {
  passos: { nome: string; valor: number; tipo?: 'total' | 'delta' }[]; // total = barra do zero; delta = flutuante
  height?: number; formatV?: Fmt;
}) {
  const th = useGraficoTheme();
  const { base, visivel, cores } = useMemo(() => {
    let acc = 0; const base: number[] = []; const visivel: number[] = []; const cores: string[] = [];
    for (const p of passos) {
      if (p.tipo === 'total') { base.push(0); visivel.push(p.valor); cores.push(th.cores[0]); acc = p.valor; }
      else { const ini = acc; acc += p.valor; base.push(Math.min(ini, acc)); visivel.push(Math.abs(p.valor)); cores.push(p.valor >= 0 ? th.cores[1] : th.cores[5]); }
    }
    return { base, visivel, cores };
  }, [passos, th]);
  const option = useMemo(() => ({
    textStyle: baseTextStyle,
    grid: { top: 16, right: 16, bottom: 24, left: 6, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: hexA(th.muted, 0.08) } }, backgroundColor: th.surface, borderColor: th.eixo, borderWidth: 1, textStyle: { color: th.texto, fontSize: 12 },
      formatter: (ps: any) => { const i = ps[0].dataIndex; return `${passos[i].nome}<br/><b>${formatV ? formatV(passos[i].valor) : fmtNum(passos[i].valor)}</b>`; } },
    xAxis: { type: 'category', data: passos.map((p) => p.nome), axisLine: { lineStyle: { color: th.eixo } }, axisTick: { show: false }, axisLabel: { color: th.muted, fontSize: 10, interval: 0, hideOverlap: true } },
    yAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: th.grid } }, axisLabel: { color: th.muted, fontSize: 11, formatter: (v: number) => (formatV ? formatV(v) : fmtNum(v)) } },
    series: [
      { type: 'bar', stack: 'w', silent: true, itemStyle: { color: 'transparent' }, data: base, barMaxWidth: 34 },
      { type: 'bar', stack: 'w', data: visivel.map((v, i) => ({ value: v, itemStyle: { color: cores[i], borderRadius: 3 } })), barMaxWidth: 34,
        label: { show: true, position: 'top', color: th.texto2, fontSize: 10, formatter: (p: any) => (formatV ? formatV(passos[p.dataIndex].valor) : fmtNum(passos[p.dataIndex].valor)) } },
    ],
  }), [th, passos, base, visivel, cores, formatV]);
  if (!passos.length) return <Vazio height={height} />;
  return <ReactECharts option={option} style={{ height, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge lazyUpdate />;
}

// ---------------------------------------------------------------------------
// GraficoScatter — dispersão / bolha (ex.: recência × frequência, bolha=valor)
// ---------------------------------------------------------------------------
export function GraficoScatter({
  data, xKey, yKey, sizeKey, nameKey, height = 340, formatX, formatY, xLabel, yLabel, cor, ref45,
}: {
  data: any[]; xKey: string; yKey: string; sizeKey?: string; nameKey?: string; height?: number;
  formatX?: Fmt; formatY?: Fmt; xLabel?: string; yLabel?: string; cor?: string; ref45?: boolean;
}) {
  const th = useGraficoTheme();
  const base = cor || th.cores[0];
  const maxSize = useMemo(() => (sizeKey ? Math.max(1, ...data.map((d) => Number(d[sizeKey]) || 0)) : 1), [data, sizeKey]);
  const pts = useMemo(() => data.map((d) => ({
    value: [Number(d[xKey]) || 0, Number(d[yKey]) || 0, sizeKey ? Number(d[sizeKey]) || 0 : 0, d[nameKey || ''] ?? ''],
  })), [data, xKey, yKey, sizeKey, nameKey]);
  const option = useMemo(() => ({
    textStyle: baseTextStyle,
    grid: { top: 16, right: 20, bottom: yLabel ? 40 : 30, left: 6, containLabel: true },
    tooltip: { trigger: 'item', backgroundColor: th.surface, borderColor: th.eixo, borderWidth: 1, textStyle: { color: th.texto, fontSize: 12 },
      formatter: (p: any) => `${p.value[3] ? `<b>${p.value[3]}</b><br/>` : ''}${xLabel || 'x'}: ${formatX ? formatX(p.value[0]) : fmtNum(p.value[0])}<br/>${yLabel || 'y'}: ${formatY ? formatY(p.value[1]) : fmtNum(p.value[1])}${sizeKey ? `<br/>${fmtNum(p.value[2])}` : ''}` },
    xAxis: { type: 'value', name: xLabel, nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: th.muted, fontSize: 11 }, axisLine: { lineStyle: { color: th.eixo } }, axisTick: { show: false }, splitLine: { lineStyle: { color: th.grid } }, axisLabel: { color: th.muted, fontSize: 11, formatter: (v: number) => (formatX ? formatX(v) : fmtNum(v)) } },
    yAxis: { type: 'value', name: yLabel, nameTextStyle: { color: th.muted, fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: th.grid } }, axisLabel: { color: th.muted, fontSize: 11, formatter: (v: number) => (formatY ? formatY(v) : fmtNum(v)) } },
    series: [
      ...(ref45 ? [{ type: 'line', silent: true, showSymbol: false, lineStyle: { color: th.eixo, type: 'dashed', width: 1 }, data: (() => { const mx = Math.max(...pts.map((p) => Math.max(p.value[0], p.value[1])), 1); return [[0, 0], [mx, mx]]; })() } as any] : []),
      { type: 'scatter', data: pts, symbolSize: (val: any) => (sizeKey ? 8 + (val[2] / maxSize) * 34 : 10), itemStyle: { color: hexA(base, 0.6), borderColor: base, borderWidth: 1 }, emphasis: { itemStyle: { color: base } } },
    ],
  }), [th, pts, formatX, formatY, xLabel, yLabel, sizeKey, maxSize, base, ref45]);
  if (!pts.length) return <Vazio height={height} />;
  return <ReactECharts option={option} style={{ height, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge lazyUpdate />;
}

// ---------------------------------------------------------------------------
// GraficoRadar — perfil multi-dimensão (ex.: NPS por dimensão, felicidade)
// ---------------------------------------------------------------------------
export function GraficoRadar({
  indicadores, series, height = 320, max,
}: {
  indicadores: { nome: string; max?: number }[];
  series: { nome: string; valores: number[] }[];
  height?: number; max?: number;
}) {
  const th = useGraficoTheme();
  const option = useMemo(() => ({
    textStyle: baseTextStyle, color: th.cores,
    tooltip: { trigger: 'item', backgroundColor: th.surface, borderColor: th.eixo, borderWidth: 1, textStyle: { color: th.texto, fontSize: 12 } },
    legend: series.length > 1 ? { bottom: 0, icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { color: th.texto2, fontSize: 11 } } : undefined,
    radar: {
      indicator: indicadores.map((i) => ({ name: i.nome, max: i.max ?? max ?? 5 })),
      center: ['50%', '48%'], radius: '66%',
      axisName: { color: th.texto2, fontSize: 10 },
      splitLine: { lineStyle: { color: th.grid } }, splitArea: { areaStyle: { color: [hexA(th.muted, 0.03), 'transparent'] } },
      axisLine: { lineStyle: { color: th.grid } },
    },
    series: [{ type: 'radar', data: series.map((s, i) => ({ name: s.nome, value: s.valores, areaStyle: { color: hexA(th.cores[i % th.cores.length], 0.18) }, lineStyle: { width: 2 }, symbolSize: 4 })) }],
  }), [th, indicadores, series, max]);
  if (!indicadores.length) return <Vazio height={height} />;
  return <ReactECharts option={option} style={{ height, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge lazyUpdate />;
}

// ---------------------------------------------------------------------------
// GraficoGauge — indicador radial (ex.: cobertura de ficha, atingimento de meta)
// ---------------------------------------------------------------------------
export function GraficoGauge({ valor, max = 100, height = 220, sufixo = '%', cor, alvo }: { valor: number; max?: number; height?: number; sufixo?: string; cor?: string; alvo?: number }) {
  const th = useGraficoTheme();
  const c = cor || th.cores[0];
  const option = useMemo(() => ({
    textStyle: baseTextStyle,
    series: [{
      type: 'gauge', startAngle: 210, endAngle: -30, min: 0, max, radius: '92%', center: ['50%', '58%'],
      progress: { show: true, width: 12, itemStyle: { color: c } },
      axisLine: { lineStyle: { width: 12, color: [[1, hexA(th.muted, 0.12)]] } },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false },
      anchor: { show: false },
      detail: { valueAnimation: true, fontSize: 26, fontWeight: 700, color: th.texto, offsetCenter: [0, 0], formatter: (v: number) => `${fmtNum(v)}${sufixo}` },
      data: [{ value: valor }],
      markLine: alvo != null ? {} : undefined,
    }],
  }), [th, valor, max, c, sufixo, alvo]);
  return <ReactECharts option={option} style={{ height, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge lazyUpdate />;
}

function Vazio({ height }: { height: number }) {
  return <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>Sem dados no período.</div>;
}

// Card padrão que envolve um gráfico (título + subtítulo + corpo). `span` = colunas no grid xl.
export function ChartCard({ titulo, subtitulo, children, right, span = 1, className = '' }: {
  titulo: string; subtitulo?: string; children: React.ReactNode; right?: React.ReactNode; span?: 1 | 2 | 3; className?: string;
}) {
  const spanCls = span === 3 ? 'xl:col-span-3' : span === 2 ? 'xl:col-span-2' : '';
  return (
    <div className={`rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 ${spanCls} ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{titulo}</h3>
          {subtitulo && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitulo}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {children}
    </div>
  );
}

// Grid de cards responsivo (1 col mobile, 2 md, 3 xl — aproveita a tela cheia)
export function ChartGrid({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 }) {
  return <div className={`grid grid-cols-1 md:grid-cols-2 ${cols === 3 ? 'xl:grid-cols-3' : ''} gap-3`}>{children}</div>;
}
