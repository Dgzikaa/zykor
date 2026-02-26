'use client';

import dynamic from 'next/dynamic';
import { ComponentType, ReactNode } from 'react';

/**
 * Componentes Lazy-Loaded para melhor performance
 * 
 * Use estes componentes em vez de importar diretamente bibliotecas pesadas.
 * Isso garante que o código só é carregado quando necessário.
 * 
 * @example
 * // Em vez de:
 * import { LineChart, Line, XAxis, YAxis } from 'recharts';
 * 
 * // Use:
 * import { LazyLineChart } from '@/lib/lazy-components';
 * <LazyLineChart data={data} />
 */

// Loading fallback padrão
const ChartLoadingFallback = () => (
  <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse flex items-center justify-center">
    <div className="text-gray-400 dark:text-gray-500 text-sm">Carregando gráfico...</div>
  </div>
);

const ComponentLoadingFallback = () => (
  <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
);

// ============================================
// RECHARTS - Lazy Loaded
// ============================================

/**
 * Wrapper lazy-loaded para Recharts
 * Só carrega quando o componente é renderizado
 */
export const LazyRechartsWrapper = dynamic(
  () => import('recharts').then((mod) => {
    // Retorna um componente wrapper que expõe todos os componentes do recharts
    const RechartsWrapper = ({ children }: { children: ReactNode }) => <>{children}</>;
    return RechartsWrapper;
  }),
  {
    loading: () => <ChartLoadingFallback />,
    ssr: false,
  }
);

// ============================================
// FRAMER-MOTION - Componentes Otimizados
// ============================================

/**
 * Motion wrapper com lazy loading
 * Use para animações que não são críticas para o primeiro render
 */
export const LazyMotionWrapper = dynamic(
  () => import('@/components/ui/motion-wrapper').then((mod) => mod.MotionWrapper),
  {
    loading: () => <ComponentLoadingFallback />,
    ssr: true,
  }
);

export const LazyStaggerContainer = dynamic(
  () => import('@/components/ui/motion-wrapper').then((mod) => mod.StaggerContainer),
  {
    loading: () => <ComponentLoadingFallback />,
    ssr: true,
  }
);

// ============================================
// COMPONENTES PESADOS - Lazy Loaded
// ============================================

/**
 * ModernSidebar lazy-loaded
 * O sidebar é um componente pesado com muitas animações
 */
export const LazyModernSidebar = dynamic(
  () => import('@/components/layouts/ModernSidebarOptimized').then((mod) => mod.ModernSidebarOptimized),
  {
    loading: () => (
      <div className="w-14 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 animate-pulse">
        <div className="p-2 space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          ))}
        </div>
      </div>
    ),
    ssr: false,
  }
);

/**
 * Calendar lazy-loaded (react-big-calendar)
 */
export const LazyCalendar = dynamic(
  () => import('react-big-calendar').then((mod) => mod.Calendar),
  {
    loading: () => (
      <div className="w-full h-96 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse flex items-center justify-center">
        <div className="text-gray-400 dark:text-gray-500 text-sm">Carregando calendário...</div>
      </div>
    ),
    ssr: false,
  }
);

/**
 * Editor de texto rico lazy-loaded
 * Retorna um textarea simples como fallback
 */
export const LazyRichTextEditor = dynamic(
  () => Promise.resolve({
    default: ({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
      <textarea 
        className={`w-full h-32 border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${className || ''}`}
        {...props}
      />
    )
  }),
  {
    loading: () => <ComponentLoadingFallback />,
    ssr: false,
  }
);

// ============================================
// UTILS
// ============================================

/**
 * Hook para detectar se deve usar lazy loading
 * Baseado no tamanho da tela e capacidade do dispositivo
 */
export function useShouldLazyLoad(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Não fazer lazy load em dispositivos com boa performance
  const isHighPerformance = 
    navigator.hardwareConcurrency > 4 && 
    (navigator as any).deviceMemory > 4;
  
  return !isHighPerformance;
}

/**
 * Prefetch de componentes pesados
 * Use quando sabe que o usuário vai precisar do componente em breve
 */
export function prefetchHeavyComponents() {
  // Prefetch recharts quando idle
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    requestIdleCallback(() => {
      import('recharts');
    });
  }
}

export default {
  LazyRechartsWrapper,
  LazyMotionWrapper,
  LazyStaggerContainer,
  LazyModernSidebar,
  LazyCalendar,
};

