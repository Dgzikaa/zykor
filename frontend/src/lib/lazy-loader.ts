/**
 * Utility para lazy loading de componentes pesados
 * Melhora performance inicial e reduz bundle size
 */

import dynamic from 'next/dynamic';

/**
 * Cria um componente lazy com skeleton de loading
 */
export function createLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options?: {
    ssr?: boolean;
    loadingComponent?: () => React.ReactNode;
  }
) {
  return dynamic(importFn, {
    ssr: options?.ssr ?? false,
    loading: options?.loadingComponent,
  });
}

/**
 * Preload de componente para melhorar UX
 * Use quando souber que o usuário vai precisar do componente em breve
 */
export function preloadComponent(importFn: () => Promise<any>) {
  // Next.js vai fazer prefetch automaticamente
  importFn();
}

/**
 * Lazy load condicional - só carrega se condição for verdadeira
 */
export function conditionalLazyLoad<T>(
  condition: boolean,
  importFn: () => Promise<T>
): Promise<T> | null {
  if (condition) {
    return importFn();
  }
  return null;
}
