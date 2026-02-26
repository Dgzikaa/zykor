import {
  DashboardSkeleton,
  RelatorioSkeleton,
  VisaoGeralSkeleton,
  ConfiguracoesSkeleton,
} from '@/components/skeletons/page-skeletons';

/**
 * Componente unificado de loading para todas as páginas
 * Usa o skeleton apropriado baseado no tipo de página
 */

type LoadingType = 'dashboard' | 'relatorio' | 'visao-geral' | 'configuracao' | 'default';

interface UnifiedLoadingProps {
  type?: LoadingType;
}

export function UnifiedLoading({ type = 'dashboard' }: UnifiedLoadingProps) {
  switch (type) {
    case 'dashboard':
      return <DashboardSkeleton />;
    case 'relatorio':
      return <RelatorioSkeleton />;
    case 'visao-geral':
      return <VisaoGeralSkeleton />;
    case 'configuracao':
      return <ConfiguracoesSkeleton />;
    default:
      return <DashboardSkeleton />;
  }
}

// Exports para facilitar uso direto
export const DashboardLoading = () => <UnifiedLoading type="dashboard" />;
export const RelatorioLoading = () => <UnifiedLoading type="relatorio" />;
export const VisaoGeralLoading = () => <UnifiedLoading type="visao-geral" />;
export const ConfiguracaoLoading = () => <UnifiedLoading type="configuracao" />;

export default DashboardLoading;
