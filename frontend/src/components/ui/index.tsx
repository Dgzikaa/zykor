'use client';

// =====================================================
// 📦 DESIGN SYSTEM ZYKOR - EXPORTAÇÕES BÁSICAS (SIMPLIFICADO)
// =====================================================

// Re-export componentes base existentes
export { Button } from './button';
export { Input } from './input';
export { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
export { Badge } from './badge';
export { Switch } from './switch';
export { Slider } from './slider';
export { Alert, AlertDescription } from './alert';

// 🚨 Error Boundaries (apenas o que funciona)
export { default as ErrorBoundary } from './error-boundary';

// Componentes simples sem lazy loading
export const PageTransition = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const ScrollTrigger = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const TransitionWrapper = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const LoadingTransition = ({ children }: { children: React.ReactNode }) => <>{children}</>;

// Componentes modernos avançados (comentados temporariamente)
// export { SearchGlobal as GlobalSearch } from './global-search';
export { ScrollToTop } from './scroll-animations';
// export { default as CommandPalette } from './command-palette';
// KeyboardShortcuts não está implementado ainda
// export { KeyboardShortcuts } from './accessibility';

// Utility functions
export const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const throttle = (func: Function, limit: number) => {
  let inThrottle: boolean;
  return function executedFunction(...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const lerp = (start: number, end: number, factor: number) =>
  start + (end - start) * factor;

// Design System Configuration
export const DESIGN_SYSTEM_CONFIG = {
  animations: {
    duration: {
      fast: '150ms',
      normal: '300ms',
      slow: '500ms',
    },
    easing: {
      ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    },
  },
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },
};
