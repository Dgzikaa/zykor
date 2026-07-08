'use client';

// Componente de gráfico padrão do hub /graficos — Apache ECharts (avançado): gradientes,
// animação suave, zoom/scrub no tempo (dataZoom), tooltip cruzado, barras arredondadas.
// Design segue o dataviz skill: paleta VALIDADA em ordem fixa, UM eixo, legenda p/ ≥2 séries,
// grid recessivo, dark mode DESENHADO (steps próprios pro fundo escuro).
import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from '@/contexts/ThemeContext';

// dynamic + ssr:false — ECharts é client-only (acessa window); evita erro de SSR no Next.
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

// Paleta categórica validada (light worst adjacent CVD ΔE 24,2 / dark 10,3) — ordem fixa, nunca cicla.
export const SERIES_LIGHT = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834'];
export const SERIES_DARK = ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767', '#d55181', '#d95926'];

export function useGraficoTheme() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return {
    dark,
    cores: dark ? SERIES_DARK : SERIES_LIGHT,
    grid: dark ? '#2c2c2a' : '#e1e0d9',
    eixo: dark ? '#383835' : '#c3c2b7',
    muted: '#898781',
    texto: dark ? '#ffffff' : '#0b0b0b',
    texto2: dark ? '#c3c2b7' : '#52514e',
    surface: dark ? '#1a1a19' : '#fcfcfb',
  };
}

export type Serie = { key: string; label: string };
type Fmt = (v: number) => string;

const fmtNum = (v: any) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
// hex #rrggbb → rgba com alpha
const hexA = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

export function GraficoBase({
  tipo, data, xKey, series, stacked = false, height = 320, formatY, area = false,
}: {
  tipo: 'linha' | 'area' | 'barra';
  data: any[];
  xKey: string;
  series: Serie[];
  stacked?: boolean;
  height?: number;
  formatY?: Fmt;
  formatX?: (v: any) => string;
  area?: boolean;
}) {
  const th = useGraficoTheme();
  const cor = (i: number) => th.cores[i % th.cores.length];
  const ehArea = tipo === 'area' || area;
  const ehBarra = tipo === 'barra';
  const xs = useMemo(() => data.map((d) => d[xKey]), [data, xKey]);
  const zoom = data.length > 14; // série longa → habilita scrub/zoom

  const option = useMemo(() => ({
    color: th.cores,
    animationDuration: 700,
    animationEasing: 'cubicOut',
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    grid: { top: series.length > 1 ? 40 : 16, right: 18, bottom: zoom ? 60 : 26, left: 6, containLabel: true },
    legend: series.length > 1 ? { top: 4, icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { color: th.texto2, fontSize: 12 } } : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: ehBarra ? 'shadow' : 'cross', lineStyle: { color: th.muted, type: 'dashed' }, crossStyle: { color: th.muted }, label: { show: false }, shadowStyle: { color: hexA(th.muted, 0.08) } },
      backgroundColor: th.surface, borderColor: th.eixo, borderWidth: 1, padding: [8, 10],
      textStyle: { color: th.texto, fontSize: 12 },
      valueFormatter: (v: any) => (v == null ? '—' : (formatY ? formatY(Number(v)) : fmtNum(v))),
    },
    xAxis: {
      type: 'category', data: xs, boundaryGap: ehBarra,
      axisLine: { lineStyle: { color: th.eixo } }, axisTick: { show: false },
      axisLabel: { color: th.muted, fontSize: 11, hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false }, axisTick: { show: false },
      splitLine: { lineStyle: { color: th.grid } },
      axisLabel: { color: th.muted, fontSize: 11, formatter: (v: number) => (formatY ? formatY(v) : fmtNum(v)) },
    },
    dataZoom: zoom ? [
      { type: 'inside', throttle: 40 },
      { type: 'slider', height: 16, bottom: 14, borderColor: 'transparent', backgroundColor: hexA(th.muted, 0.06), fillerColor: hexA(th.cores[0], 0.14), handleStyle: { color: th.cores[0] }, moveHandleStyle: { color: th.eixo }, dataBackground: { lineStyle: { color: th.eixo }, areaStyle: { color: hexA(th.muted, 0.1) } }, textStyle: { color: th.muted, fontSize: 10 } },
    ] : undefined,
    series: series.map((s, i) => ({
      name: s.label,
      type: ehBarra ? 'bar' : 'line',
      data: data.map((d) => d[s.key]),
      smooth: !ehBarra ? 0.35 : undefined,
      showSymbol: false,
      symbolSize: 7,
      stack: stacked ? 'total' : undefined,
      lineStyle: !ehBarra ? { width: 2.2 } : undefined,
      areaStyle: ehArea ? {
        opacity: 1,
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
          { offset: 0, color: hexA(cor(i), stacked ? 0.85 : 0.32) },
          { offset: 1, color: hexA(cor(i), stacked ? 0.5 : 0.02) },
        ] },
      } : undefined,
      itemStyle: ehBarra ? { borderRadius: stacked ? [0, 0, 0, 0] : [4, 4, 0, 0], color: cor(i) } : { color: cor(i) },
      barMaxWidth: 30,
      emphasis: { focus: 'series' },
    })),
  }), [th, xs, data, series, ehArea, ehBarra, stacked, zoom, formatY]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>Sem dados no período.</div>;
  }

  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
      lazyUpdate
    />
  );
}
