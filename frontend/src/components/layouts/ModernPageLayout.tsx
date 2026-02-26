'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  MotionWrapper, 
  PageTransition, 
  HoverMotion,
  StaggerContainer 
} from '@/components/ui/motion-wrapper';
import { 
  Skeleton, 
  SkeletonCard
} from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

// Componentes de acessibilidade simplificados
const AccessibleText = ({ children, level, className }: any) => {
  const Tag = level ? `h${level}` as any : 'span';
  return <Tag className={className}>{children}</Tag>;
};
const SkipLink = () => null;
const FocusRing = ({ children }: any) => <>{children}</>;
import { ChevronLeft, ChevronRight, MoreVertical, Maximize2, Filter } from 'lucide-react';

/**
 * Layout moderno universal para todas as páginas do Zykor
 * Incorpora: animações, acessibilidade, skeleton loading, PWA features
 */

interface ModernPageLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
  loading?: boolean;
  skeletonType?: 'dashboard' | 'form' | 'table' | 'chart' | 'list';
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  showBackButton?: boolean;
  showSettingsButton?: boolean;
  showFullscreenButton?: boolean;
  showFilterButton?: boolean;
  onBack?: () => void;
  onSettings?: () => void;
  onFullscreen?: () => void;
  onFilter?: () => void;
}

export function ModernPageLayout({
  children,
  title,
  description,
  className,
  loading = false,
  skeletonType = 'dashboard',
  actions,
  breadcrumbs,
  showBackButton = false,
  showSettingsButton = false,
  showFullscreenButton = false,
  showFilterButton = false,
  onBack,
  onSettings,
  onFullscreen,
  onFilter
}: ModernPageLayoutProps) {
  const showSkeleton = loading;
  const { toast } = useToast();

  // Componente de skeleton baseado no tipo
  const renderSkeleton = () => {
    switch (skeletonType) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <SkeletonCard />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        );
      case 'form':
        return (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        );
      case 'table':
        return (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-6" />
                ))}
              </div>
            ))}
          </div>
        );
      case 'chart':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        );
      case 'list':
        return (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-4 card-dark">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        );
      default:
        return (
          <div className="space-y-6">
            <SkeletonCard />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        );
    }
  };

  return (
    <PageTransition className={cn('min-h-screen bg-gray-50 dark:bg-gray-900', className)}>
      {/* Skip Link para acessibilidade */}
      <SkipLink />
      
      <div className="container mx-auto px-4 py-6">
        {/* Header da Página */}
        <MotionWrapper variant="slideDown" className="mb-8">
          <div className="card-dark p-6">
            {/* Breadcrumbs */}
            {breadcrumbs && breadcrumbs.length > 0 && (
              <nav className="mb-4" aria-label="Breadcrumb">
                <ol className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  {breadcrumbs.map((crumb, index) => (
                    <li key={index} className="flex items-center">
                      {index > 0 && <ChevronRight className="h-4 w-4 mx-2" />}
                      {crumb.href ? (
                        <HoverMotion hoverEffect="scale">
                          <a 
                            href={crumb.href}
                            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            {crumb.label}
                          </a>
                        </HoverMotion>
                      ) : (
                        <span className="text-gray-900 dark:text-gray-100 font-medium">
                          {crumb.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
            )}

            {/* Header principal */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Botão voltar */}
                {showBackButton && (
                  <FocusRing>
                    <HoverMotion hoverEffect="scale">
                      <button
                        onClick={onBack}
                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                        aria-label="Voltar"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                    </HoverMotion>
                  </FocusRing>
                )}

                {/* Título e descrição */}
                <div>
                  <AccessibleText level={1} className="text-2xl font-bold text-gray-900 dark:text-white">
                    {title}
                  </AccessibleText>
                  {description && (
                    <AccessibleText className="text-gray-600 dark:text-gray-400 mt-1">
                      {description}
                    </AccessibleText>
                  )}
                </div>
              </div>

              {/* Actions e botões */}
              <div className="flex items-center space-x-3">
                {actions}
                
                {/* Botões de ação */}
                <div className="flex items-center space-x-2">
                  {showFilterButton && (
                    <FocusRing>
                      <HoverMotion hoverEffect="scale">
                        <button
                          onClick={onFilter}
                          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                          aria-label="Filtrar"
                        >
                          <Filter className="h-4 w-4" />
                        </button>
                      </HoverMotion>
                    </FocusRing>
                  )}

                  {showFullscreenButton && (
                    <FocusRing>
                      <HoverMotion hoverEffect="scale">
                        <button
                          onClick={onFullscreen}
                          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                          aria-label="Tela cheia"
                        >
                          <Maximize2 className="h-4 w-4" />
                        </button>
                      </HoverMotion>
                    </FocusRing>
                  )}

                  {showSettingsButton && (
                    <FocusRing>
                      <HoverMotion hoverEffect="scale">
                        <button
                          onClick={onSettings}
                          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                          aria-label="Configurações"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </HoverMotion>
                    </FocusRing>
                  )}
                </div>
              </div>
            </div>
          </div>
        </MotionWrapper>

        {/* Conteúdo principal */}
        <main id="main-content" className="focus:outline-none" tabIndex={-1}>
          {showSkeleton ? (
            <MotionWrapper variant="fadeIn" delay={0.1}>
              {renderSkeleton()}
            </MotionWrapper>
          ) : (
            <StaggerContainer staggerDelay={0.1}>
              {children}
            </StaggerContainer>
          )}
        </main>
      </div>
    </PageTransition>
  );
}

// Componente de card moderno para usar nas páginas
interface ModernCardProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  loading?: boolean;
  hoverable?: boolean;
  actions?: React.ReactNode;
}

export function ModernCard({
  children,
  title,
  description,
  className,
  loading = false,
  hoverable = false,
  actions
}: ModernCardProps) {
  const showSkeleton = loading;

  if (showSkeleton) {
    return <SkeletonCard className={className} />;
  }

  const CardWrapper = hoverable ? HoverMotion : motion.div;
  const hoverProps = hoverable ? { hoverEffect: 'lift' as const } : {};

  return (
    <MotionWrapper variant="slideUp">
      <CardWrapper {...hoverProps}>
        <div className={cn('card-dark p-6', className)}>
          {(title || description || actions) && (
            <div className="flex items-center justify-between mb-4">
              <div>
                {title && (
                  <AccessibleText level={3} className="text-lg font-semibold text-gray-900 dark:text-white">
                    {title}
                  </AccessibleText>
                )}
                {description && (
                  <AccessibleText className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {description}
                  </AccessibleText>
                )}
              </div>
              {actions && <div className="flex items-center space-x-2">{actions}</div>}
            </div>
          )}
          {children}
        </div>
      </CardWrapper>
    </MotionWrapper>
  );
}

// Componente de grid moderno
interface ModernGridProps {
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4 | 6;
  gap?: 4 | 6 | 8;
  className?: string;
}

export function ModernGrid({ 
  children, 
  cols = 3, 
  gap = 6, 
  className 
}: ModernGridProps) {
  const colsClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 lg:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
  };

  const gapClasses = {
    4: 'gap-4',
    6: 'gap-6',
    8: 'gap-8'
  };

  return (
    <StaggerContainer
      className={cn(
        'grid',
        colsClasses[cols],
        gapClasses[gap],
        className
      )}
    >
      {children}
    </StaggerContainer>
  );
}

// Componente de estatística/métrica moderna
interface ModernStatProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  className?: string;
}

export function ModernStat({
  label,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  loading = false,
  className
}: ModernStatProps) {
  const showSkeleton = loading;

  if (showSkeleton) {
    return (
      <div className={cn('card-dark p-4', className)}>
        <Skeleton className="h-4 w-20 mb-2" />
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-24" />
      </div>
    );
  }

  const changeColors = {
    positive: 'text-green-600 dark:text-green-400',
    negative: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-600 dark:text-gray-400'
  };

  return (
    <HoverMotion hoverEffect="lift">
      <div className={cn('card-dark p-4', className)}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <AccessibleText className="text-sm text-gray-600 dark:text-gray-400">
              {label}
            </AccessibleText>
            <AccessibleText className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </AccessibleText>
            {change && (
              <AccessibleText className={cn('text-sm mt-1', changeColors[changeType])}>
                {change}
              </AccessibleText>
            )}
          </div>
          {Icon && (
            <Icon className="h-8 w-8 text-gray-400 dark:text-gray-600" />
          )}
        </div>
      </div>
    </HoverMotion>
  );
}

export default ModernPageLayout;
