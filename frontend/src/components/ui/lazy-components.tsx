'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from './skeleton';

/**
 * Lazy-loaded heavy components
 * Melhora performance inicial da página
 */

// Componentes pesados que só carregam quando necessário
// Lazy load de DashboardCard (componente pesado com 585 linhas)
export const LazyDashboardCard = dynamic(
  () => import('./dashboard-card'),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-[200px]" />,
  }
);
