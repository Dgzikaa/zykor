'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageContentProps {
  children: ReactNode;
  /** Largura máxima do container */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full' | 'none';
  /** Padding do conteúdo */
  padding?: 'none' | 'tight' | 'normal' | 'loose';
  /** Classes adicionais */
  className?: string;
  /** Se deve usar o background padrão (apenas para casos onde o layout não fornece) */
  withBackground?: boolean;
}

const maxWidthClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full',
  none: '',
};

const paddingClasses: Record<string, string> = {
  none: '',
  tight: 'px-3 py-4',
  normal: 'px-4 py-6',
  loose: 'px-6 py-8',
};

/**
 * PageContent - Wrapper centralizado para conteúdo de páginas
 * 
 * Substitui o padrão repetitivo:
 * <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
 *   <div className="container mx-auto px-4 py-6">
 * 
 * @example
 * // Uso básico
 * <PageContent>
 *   <h1>Minha Página</h1>
 * </PageContent>
 * 
 * @example
 * // Com opções customizadas
 * <PageContent maxWidth="5xl" padding="loose">
 *   <h1>Minha Página</h1>
 * </PageContent>
 */
export function PageContent({
  children,
  maxWidth = '7xl',
  padding = 'normal',
  className,
  withBackground = false,
}: PageContentProps) {
  const content = (
    <div
      className={cn(
        'mx-auto w-full',
        maxWidthClasses[maxWidth],
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );

  // Se precisa do background (para páginas fora do layout com sidebar)
  if (withBackground) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {content}
      </div>
    );
  }

  return content;
}

/**
 * PageHeader - Header padrão para páginas
 */
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('card-dark p-6 mb-6', className)}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {title}
          </h1>
          {description && (
            <p className="text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * PageSection - Seção de página com card
 */
interface PageSectionProps {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function PageSection({
  children,
  title,
  description,
  actions,
  className,
  noPadding = false,
}: PageSectionProps) {
  return (
    <div className={cn('card-dark', !noPadding && 'p-6', className)}>
      {(title || description || actions) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export default PageContent;

