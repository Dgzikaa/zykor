'use client';

import { useState, useCallback, useEffect, useMemo, memo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { useMenuBadges } from '@/hooks/useMenuBadges';
import { cn } from '@/lib/utils';
import {
  Home,
  CheckSquare,
  Settings,
  BarChart3,
  Calendar,
  Users,
  Zap,
  ChevronDown,
  ChevronRight,
  Target,
  TrendingUp,
  Wrench,
  Package,
  AlertTriangle,
  ChefHat,
  Sparkles,
  DollarSign,
  Clock,
  Ticket,
  FileSearch,
  Activity,
  Send,
  MessageCircle,
  Wallet,
  Tag,
  Receipt,
  PieChart,
  Plug,
  Building2,
  Megaphone,
} from 'lucide-react';

/**
 * ModernSidebarOptimized
 * 
 * Versão otimizada do sidebar com:
 * - CSS transitions em vez de framer-motion (mais leve)
 * - Componentes memoizados para evitar re-renders
 * - Estrutura simplificada
 */

interface SubMenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  badge?: number;
  description?: string;
  permission?: string;
}

interface SidebarItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  badge?: number;
  color?: string;
  permission?: string;
  subItems?: SubMenuItem[];
}

// Permission mapping
const PERMISSION_MAPPINGS: Record<string, string[]> = {
  home: ['home'],
  operacoes: ['operacoes', 'checklists', 'terminal_producao', 'receitas_insumos'],
  gestao: ['gestao', 'tempo', 'planejamento'],
  relatorios: ['relatorios', 'dashboard_financeiro_mensal', 'marketing_360'],
  configuracoes: ['configuracoes'],
  ferramentas: ['operacoes', 'checklists', 'terminal_producao', 'receitas_insumos', 'financeiro_agendamento'],
  cfp: ['home'], // CFP disponível para todos
};

// Menu items - extraído para fora do componente
const defaultSidebarItems: SidebarItem[] = [
  {
    icon: Target,
    label: 'Estratégico',
    href: '/estrategico',
    color: 'text-blue-600 dark:text-blue-400',
    permission: 'gestao',
    subItems: [
      { icon: TrendingUp, label: 'Visão Geral', href: '/estrategico/visao-geral', permission: 'home' },
      { icon: BarChart3, label: 'Desempenho', href: '/estrategico/desempenho', permission: 'gestao' },
      { icon: Calendar, label: 'Planejamento', href: '/estrategico/planejamento-comercial', permission: 'planejamento' },
    ],
  },
  {
    icon: BarChart3,
    label: 'Analítico',
    href: '/analitico',
    color: 'text-indigo-600 dark:text-indigo-400',
    permission: 'relatorios',
    subItems: [
      { icon: Users, label: 'Clientes', href: '/analitico/clientes', permission: 'relatorios' },
      { icon: Clock, label: 'Tempo de Estadia', href: '/relatorios/tempo-estadia', permission: 'relatorios' },
      { icon: Ticket, label: 'Impacto Entrada', href: '/ferramentas/analise-couvert', permission: 'relatorios' },
      { icon: BarChart3, label: 'Eventos', href: '/analitico/eventos', permission: 'relatorios' },
      { icon: Sparkles, label: 'Retrospectiva 2025', href: '/retrospectiva-2025', permission: 'home' },
    ],
  },
  {
    icon: MessageCircle,
    label: 'CRM',
    href: '/crm',
    color: 'text-pink-600 dark:text-pink-400',
    permission: 'gestao',
    subItems: [
      { icon: Send, label: 'Umbler Talk', href: '/crm/umbler', description: 'Conversas e Campanhas', permission: 'gestao' },
      { icon: Sparkles, label: 'Segmentação RFM', href: '/crm/inteligente', permission: 'gestao' },
      { icon: AlertTriangle, label: 'Predição Churn', href: '/crm/churn-prediction', permission: 'gestao' },
      { icon: DollarSign, label: 'LTV e Engajamento', href: '/crm/ltv-engajamento', permission: 'gestao' },
      { icon: Target, label: 'Padrões', href: '/crm/padroes-comportamento', permission: 'gestao' },
    ],
  },
  {
    icon: Wrench,
    label: 'Ferramentas',
    href: '/ferramentas',
    color: 'text-green-600 dark:text-green-400',
    permission: 'ferramentas',
    subItems: [
      { icon: Megaphone, label: 'Central Comercial', href: '/ferramentas/comercial', permission: 'gestao' },
      { icon: Package, label: 'Produção e Insumos', href: '/ferramentas/producao-insumos', permission: 'operacoes' },
      { icon: Package, label: 'Contagem de Estoque', href: '/ferramentas/contagem-estoque', permission: 'operacoes' },
      { icon: Calendar, label: 'Agendamento', href: '/ferramentas/agendamento', permission: 'financeiro_agendamento' },
      { icon: Users, label: 'NPS Funcionários', href: '/ferramentas/nps', permission: 'gestao' },
      { icon: TrendingUp, label: 'CMV Semanal', href: '/ferramentas/cmv-semanal', permission: 'gestao' },
      { icon: AlertTriangle, label: 'Stockout', href: '/ferramentas/stockout', permission: 'gestao' },
      { icon: FileSearch, label: 'Consultas', href: '/ferramentas/consultas', permission: 'financeiro_agendamento' },
      { icon: DollarSign, label: 'DRE', href: '/ferramentas/dre', permission: 'dashboard_financeiro_mensal' },
      // { icon: Wallet, label: 'CFP - Finanças', href: '/fp', description: 'Controle Financeiro Pessoal', permission: 'home' }, // TODO: Implementar
    ],
  },
  {
    icon: Settings,
    label: 'Configurações',
    href: '/configuracoes',
    color: 'text-gray-600 dark:text-gray-400',
    permission: 'configuracoes',
    subItems: [
      { icon: Users, label: 'Usuários', href: '/configuracoes/usuarios', permission: 'configuracoes' },
      { icon: ChefHat, label: 'Fichas Técnicas', href: '/configuracoes/fichas-tecnicas', permission: 'operacoes' },
      { icon: CheckSquare, label: 'Checklists', href: '/configuracoes/checklists', permission: 'configuracoes' },
      { icon: Target, label: 'Metas', href: '/configuracoes/metas', permission: 'configuracoes' },
      { icon: ChefHat, label: 'Teste de Produção', href: '/configuracoes/teste-producao', permission: 'operacoes' },
      { icon: Calendar, label: 'Calendário Operacional', href: '/configuracoes/calendario-operacional', permission: 'operacoes' },
      { icon: FileSearch, label: 'Auditoria', href: '/configuracoes/auditoria', permission: 'configuracoes' },
      { icon: Target, label: 'Saúde dos Dados', href: '/configuracoes/saude-dados', permission: 'configuracoes' },
      { icon: Activity, label: 'Monitoramento', href: '/configuracoes/monitoramento', permission: 'configuracoes' },
    ],
  },
];

// Componente memoizado para item de navegação
const NavItem = memo(function NavItem({
  item,
  isActive,
  isExpanded,
  isHovered,
  hasActiveSubItem,
  onToggleExpand,
}: {
  item: SidebarItem;
  isActive: boolean;
  isExpanded: boolean;
  isHovered: boolean;
  hasActiveSubItem: boolean;
  onToggleExpand: () => void;
}) {
  const Icon = item.icon;
  const showAsActive = isActive || hasActiveSubItem;

  return (
    <div>
      <div
        className={cn(
          'group flex items-center h-10 px-3 rounded-xl cursor-pointer',
          'transition-all duration-200 ease-out',
          isHovered ? 'justify-start' : 'justify-center',
          showAsActive
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-700/30'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
        )}
      >
        {/* Indicador ativo */}
        {showAsActive && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
        )}

        {/* Link principal */}
        {item.href ? (
          <Link href={item.href} className="flex items-center flex-1 min-w-0">
            <Icon className={cn(
              'w-5 h-5 flex-shrink-0 transition-colors duration-200',
              showAsActive ? 'text-blue-600 dark:text-blue-400' : item.color || 'text-gray-500 dark:text-gray-400'
            )} />
            {isHovered && (
              <span className="ml-3 font-medium truncate animate-fadeIn">
                {item.label}
              </span>
            )}
          </Link>
        ) : (
          <>
            <Icon className={cn(
              'w-5 h-5 flex-shrink-0 transition-colors duration-200',
              showAsActive ? 'text-blue-600 dark:text-blue-400' : item.color || 'text-gray-500 dark:text-gray-400'
            )} />
            {isHovered && (
              <span className="ml-3 font-medium truncate animate-fadeIn">
                {item.label}
              </span>
            )}
          </>
        )}

        {/* Badge */}
        {item.badge && isHovered && (
          <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5 animate-fadeIn">
            {item.badge}
          </span>
        )}

        {/* Botão expand */}
        {item.subItems && item.subItems.length > 0 && isHovered && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleExpand();
            }}
            className="ml-2 p-1 rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>
        )}

        {/* Tooltip quando colapsado */}
        {!isHovered && (
          <div className="absolute left-full ml-3 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-xl">
            {item.label}
          </div>
        )}
      </div>

      {/* Sub-items */}
      {item.subItems && item.subItems.length > 0 && isHovered && isExpanded && (
        <div className="ml-6 mt-2 space-y-1 animate-slideDown">
          {item.subItems.map((subItem) => (
            <SubNavItem key={subItem.href} item={subItem} />
          ))}
        </div>
      )}
    </div>
  );
});

// Componente memoizado para sub-item
const SubNavItem = memo(function SubNavItem({ item }: { item: SubMenuItem }) {
  const pathname = usePathname();
  const isActive = pathname?.startsWith(item.href) ?? false;
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200',
        isActive
          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
          : 'text-gray-500 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-700 dark:hover:text-gray-300'
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="ml-3 font-medium">{item.label}</span>
      {item.badge && (
        <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
          {item.badge}
        </span>
      )}
    </Link>
  );
});

// Componente principal
export function ModernSidebarOptimized() {
  const [isHovered, setIsHovered] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const pathname = usePathname();
  const { hasPermission, user, loading: userLoading } = usePermissions();
  const { badges } = useMenuBadges();

  // Helper para verificar permissões
  const hasAnyMappedPermission = useCallback((permissionKey: string) => {
    if (!permissionKey) return false;
    if (hasPermission('todos')) return true;
    
    const mappedPermissions = PERMISSION_MAPPINGS[permissionKey] || [permissionKey];
    return mappedPermissions.some(perm => hasPermission(perm));
  }, [hasPermission]);

  // Filtrar items por permissão
  const sidebarItems = useMemo(() => {
    if (!user || userLoading) return [];

    return defaultSidebarItems.filter(item => {
      const hasMainPermission = hasAnyMappedPermission(item.permission || '');
      
      if (item.subItems) {
        const filteredSubItems = item.subItems.filter(subItem => 
          hasAnyMappedPermission(subItem.permission || '')
        );
        if (filteredSubItems.length > 0 || hasMainPermission) {
          item.subItems = filteredSubItems;
          return true;
        }
      }
      
      return hasMainPermission;
    }).map(item => ({
      ...item,
      badge: item.label === 'Home' && badges?.home > 0 ? badges.home : undefined,
    }));
  }, [user, userLoading, hasAnyMappedPermission, badges]);

  // Callbacks memoizados
  const isActive = useCallback((href: string) => {
    if (!pathname) return false;
    if (href === '/home') return pathname === '/home';
    return pathname.startsWith(href);
  }, [pathname]);

  const hasActiveSubItem = useCallback((subItems?: SubMenuItem[]) => {
    if (!subItems || !pathname) return false;
    return subItems.some(subItem => pathname.startsWith(subItem.href));
  }, [pathname]);

  const toggleExpand = useCallback((label: string) => {
    setExpandedItems(prev => 
      prev.includes(label) ? prev.filter(item => item !== label) : [...prev, label]
    );
  }, []);

  // Loading state
  if (userLoading) {
    return (
      <aside className="hidden md:flex flex-col w-14 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
        <div className="p-2 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </aside>
    );
  }

  if (!user) return null;

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col flex-shrink-0 h-full relative',
        'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm',
        'border-r border-gray-200 dark:border-gray-700',
        'transition-all duration-300 ease-out',
        isHovered ? 'w-64' : 'w-14'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        // Reset expanded items after delay
        setTimeout(() => setExpandedItems([]), 300);
      }}
    >
      {/* Navigation */}
      <nav className="flex-1 px-2 pt-2 overflow-hidden">
        <div className="space-y-1">
          {sidebarItems.map((item) => (
            <NavItem
              key={item.label}
              item={item}
              isActive={item.href ? isActive(item.href) : false}
              isExpanded={expandedItems.includes(item.label) || (isHovered && hasActiveSubItem(item.subItems))}
              isHovered={isHovered}
              hasActiveSubItem={hasActiveSubItem(item.subItems)}
              onToggleExpand={() => toggleExpand(item.label)}
            />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-2 py-4 border-t border-gray-100 dark:border-gray-800">
        <div className={cn(
          'flex items-center transition-all duration-200',
          isHovered ? 'justify-between px-3' : 'justify-center'
        )}>
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {isHovered && (
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-medium animate-fadeIn">
                Sistema Online
              </span>
            )}
          </div>
          {isHovered && (
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono animate-fadeIn">
              Zykor v2.0
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}

export default ModernSidebarOptimized;

