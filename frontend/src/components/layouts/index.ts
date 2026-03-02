// Layout Components
export { default as StandardPageLayout } from './StandardPageLayout';
export { default as StandardPageWrapper } from './StandardPageWrapper';
export { DarkSidebarLayout } from './DarkSidebarLayout';
export { DashboardLayout } from './DashboardLayout';
export { AuthLayout } from './AuthLayout';
export { DarkHeader } from './DarkHeader';
export { ModernSidebarOptimized as ModernSidebar } from './ModernSidebarOptimized';
export { BottomNavigation } from './BottomNavigation';

// Minimal Layout (Novo - Estilo Notion)
export { MinimalLayout, SimpleDashboardLayout } from './MinimalLayout';
export { MinimalHeader } from './MinimalHeader';
export { MinimalSidebar } from './MinimalSidebar';

// Layout Factory (para criar layouts padronizados)
export { 
  createProtectedDashboardLayout,
  default as createDashboardLayout 
} from './createDashboardLayout';

// Page Content Components (centralizados)
export { PageContent, PageHeader, PageSection } from './PageContent';

// Re-export card components (usando card.tsx base)
export {
  Card as StandardCard,
  CardHeader as StandardCardHeader,
  CardTitle as StandardCardTitle,
  CardDescription as StandardCardDescription,
  CardContent as StandardCardContent,
} from '../ui/card';

// StatsCard - re-exportar Card com alias
import { Card } from '../ui/card';
export const StatsCard = Card;
