'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { GraficoLinha, GraficoBarra } from '@/components/graficos/Charts';

export function useRechartsTheme() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return {
    grid: isDark ? '#374151' : '#e5e7eb',
    text: isDark ? '#e5e7eb' : '#111827',
    axis: isDark ? '#9ca3af' : '#6b7280',
    tooltipBg: isDark ? '#111827' : '#ffffff',
    tooltipBorder: isDark ? '#374151' : '#e5e7eb',
  };
}

// API pública mantida (data, xKey, yKey, color, height) — corpo delega ao ECharts (GraficoLinha/GraficoBarra).
export function RechartsLine({ data, xKey, yKey, color = '#4A90E2', height = 260 }: any) {
  return (
    <div className="card-dark p-4">
      <GraficoLinha
        data={data}
        xKey={xKey}
        series={[{ key: yKey, nome: yKey, cor: color }]}
        height={height}
      />
    </div>
  );
}

export function RechartsBar({ data, xKey, yKey, color = '#8B5FBF', height = 260 }: any) {
  return (
    <div className="card-dark p-4">
      <GraficoBarra
        data={data}
        xKey={xKey}
        valueKey={yKey}
        cor={color}
        height={height}
        nomeBarra={yKey}
      />
    </div>
  );
}

const chartComponents = { RechartsLine, RechartsBar };

export default chartComponents;


