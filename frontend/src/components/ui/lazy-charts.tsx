'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from './skeleton';

/**
 * Lazy-loaded chart components
 * Reduz bundle inicial significativamente
 */

// Lazy load dos charts com skeleton de loading
export const LazyLineChart = dynamic(
  () => import('recharts').then((mod) => mod.LineChart),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-[300px]" />,
  }
);

export const LazyBarChart = dynamic(
  () => import('recharts').then((mod) => mod.BarChart),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-[300px]" />,
  }
);

export const LazyPieChart = dynamic(
  () => import('recharts').then((mod) => mod.PieChart),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-[300px]" />,
  }
);

export const LazyAreaChart = dynamic(
  () => import('recharts').then((mod) => mod.AreaChart),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-[300px]" />,
  }
);

// Lazy load de componentes de chart
export const LazyResponsiveContainer = dynamic(
  () => import('recharts').then((mod) => mod.ResponsiveContainer),
  {
    ssr: false,
  }
);

export const LazyXAxis = dynamic(
  () => import('recharts').then((mod) => mod.XAxis),
  {
    ssr: false,
  }
);

export const LazyYAxis = dynamic(
  () => import('recharts').then((mod) => mod.YAxis),
  {
    ssr: false,
  }
);

export const LazyCartesianGrid = dynamic(
  () => import('recharts').then((mod) => mod.CartesianGrid),
  {
    ssr: false,
  }
);

export const LazyTooltip = dynamic(
  () => import('recharts').then((mod) => mod.Tooltip),
  {
    ssr: false,
  }
);

export const LazyLegend = dynamic(
  () => import('recharts').then((mod) => mod.Legend),
  {
    ssr: false,
  }
);

export const LazyLine = dynamic(
  () => import('recharts').then((mod) => mod.Line),
  {
    ssr: false,
  }
);

export const LazyBar = dynamic(
  () => import('recharts').then((mod) => mod.Bar),
  {
    ssr: false,
  }
);

export const LazyArea = dynamic(
  () => import('recharts').then((mod) => mod.Area),
  {
    ssr: false,
  }
);

export const LazyPie = dynamic(
  () => import('recharts').then((mod) => mod.Pie),
  {
    ssr: false,
  }
);

export const LazyCell = dynamic(
  () => import('recharts').then((mod) => mod.Cell),
  {
    ssr: false,
  }
);
