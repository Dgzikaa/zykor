'use client';

import { useState, useCallback, useMemo, memo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { useBadges } from '@/contexts/BadgesContext';
import { cn } from '@/lib/utils';
import {
  Home,
  CheckSquare,
  Settings,
  BarChart3,
  Calendar,
  Users,
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
  History,
  Bell,
  Star,
  Zap,
} from 'lucide-react';

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
  permission?: string;
  subItems?: SubMenuItem[];
}

const PERMISSION_MAPPINGS: Record<string, string[]> = {
  home: ['home'],
  operacoes: ['operacoes', 'checklists', 'terminal_producao', 'receitas_insumos'],
  gestao: ['gestao', 'tempo', 'planejamento'],
  relatorios: ['relatorios', 'dashboard_financeiro_mensal', 'marketing_360'],
  configuracoes: ['configuracoes'],
  ferramentas: ['operacoes', 'checklists', 'terminal_producao', 'receitas_insumos', 'financeiro_agendamento'],
  cfp: ['home'],
};

const defaultSidebarItems: SidebarItem[] = [
  {
    icon: Target,
    label: 'Estratégico',
    href: '/estrategico',
    permission: 'gestao',
    subItems: [
      { icon: TrendingUp, label: 'Visão Geral', href: '/estrategico/visao-geral', permission: 'home' },
      { icon: BarChart3, label: 'Desempenho', href: '/estrategico/desempenho', permission: 'gestao' },
      { icon: Calendar, label: 'Planejamento', href: '/estrategico/planejamento-comercial', permission: 'planejamento' },
      { icon: DollarSign, label: 'Orçamentação', href: '/estrategico/orcamentacao', permission: 'home' },
    ],
  },
  {
    icon: BarChart3,
    label: 'Analítico',
    href: '/analitico',
    permission: 'relatorios',
    subItems: [
      { icon: Users, label: 'Clientes', href: '/analitico/clientes', permission: 'relatorios' },
      { icon: BarChart3, label: 'Eventos', href: '/analitico/eventos', permission: 'relatorios' },
    ],
  },
  {
    icon: Wrench,
    label: 'Ferramentas',
    href: '/ferramentas',
    permission: 'ferramentas',
    subItems: [
      { icon: Zap, label: 'Insights Estratégicos', href: '/ferramentas/insights', permission: 'gestao' },
      { icon: Calendar, label: 'Agendamento', href: '/ferramentas/agendamento', permission: 'financeiro_agendamento' },
      { icon: MessageCircle, label: 'Voz do Cliente', href: '/ferramentas/voz-cliente', permission: 'gestao' },
      { icon: TrendingUp, label: 'CMV Semanal', href: '/ferramentas/cmv-semanal', permission: 'gestao' },
      { icon: Tag, label: 'Classificação de Consumos', href: '/ferramentas/consumos-classificacao', permission: 'gestao' },
      { icon: AlertTriangle, label: 'Stockout', href: '/ferramentas/stockout', permission: 'gestao' },
      { icon: FileSearch, label: 'Consultas', href: '/ferramentas/consultas', permission: 'financeiro_agendamento' },
    ],
  },
  {
    icon: Settings,
    label: 'Configurações',
    href: '/configuracoes',
    permission: 'configuracoes',
    subItems: [
      { icon: Users, label: 'Administração', href: '/configuracoes/administracao/usuarios', permission: 'configuracoes' },
      { icon: Target, label: 'Metas', href: '/configuracoes/metas', permission: 'configuracoes' },
      { icon: Activity, label: 'Teste de Produção', href: '/configuracoes/teste-producao', permission: 'configuracoes' },
      // Auditoria removida — libs deletadas
      { icon: Activity, label: 'Saúde dos Dados', href: '/configuracoes/saude-dados', permission: 'configuracoes' },
      { icon: Activity, label: 'Monitoramento', href: '/configuracoes/monitoramento', permission: 'configuracoes' },
    ],
  },
];

// Componente do item de menu (memoizado)
const SidebarMenuItem = memo(({ item, isActive, isExpanded, onToggle, badges }: {
  item: SidebarItem;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  badges: any;
}) => {
  const pathname = usePathname();
  const Icon = item.icon;
  const hasSubItems = item.subItems && item.subItems.length > 0;
  const badge = badges[item.href || ''] || item.badge;

  const content = (
    <div
      className={cn(
        'flex items-center justify-between w-full px-3 py-2 rounded-md text-sm transition-colors',
        'hover:bg-[hsl(var(--muted))]',
        isActive && 'bg-[hsl(var(--muted))]'
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="truncate font-medium">{item.label}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge && badge > 0 && (
          <span className="px-1.5 py-0.5 text-xs font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded">
            {badge}
          </span>
        )}
        {hasSubItems && (
          <ChevronRight
            className={cn(
              'w-4 h-4 transition-transform flex-shrink-0',
              isExpanded && 'rotate-90'
            )}
          />
        )}
      </div>
    </div>
  );

  if (hasSubItems) {
    return (
      <div>
        <button
          onClick={onToggle}
          className="w-full text-left"
        >
          {content}
        </button>
        {isExpanded && (
          <div className="ml-7 mt-1 space-y-1">
            {item.subItems!.map((subItem) => {
              const SubIcon = subItem.icon;
              const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + '/');
              const subBadge = badges[subItem.href] || subItem.badge;

              return (
                <Link
                  key={subItem.href}
                  href={subItem.href}
                  className={cn(
                    'flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-colors',
                    'hover:bg-[hsl(var(--muted))]',
                    isSubActive && 'bg-[hsl(var(--muted))] font-medium'
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <SubIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{subItem.label}</span>
                  </div>
                  {subBadge && subBadge > 0 && (
                    <span className="px-1.5 py-0.5 text-xs font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded">
                      {subBadge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link href={item.href!}>
      {content}
    </Link>
  );
});

SidebarMenuItem.displayName = 'SidebarMenuItem';

export function MinimalSidebar() {
  const pathname = usePathname();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { badges } = useBadges();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    const expanded = new Set<string>();
    defaultSidebarItems.forEach(item => {
      if (item.subItems?.some(sub => pathname.startsWith(sub.href))) {
        expanded.add(item.label);
      }
    });
    return expanded;
  });

  const toggleItem = useCallback((label: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }, []);

  const filteredItems = useMemo(() => {
    if (permissionsLoading) return [];
    
    return defaultSidebarItems.filter(item => {
      if (!item.permission) return true;
      const permissions = PERMISSION_MAPPINGS[item.permission] || [item.permission];
      return permissions.some(p => hasPermission(p));
    }).map(item => ({
      ...item,
      subItems: item.subItems?.filter(subItem => {
        if (!subItem.permission) return true;
        return hasPermission(subItem.permission);
      })
    }));
  }, [hasPermission, permissionsLoading]);

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 bg-[hsl(var(--muted))] p-2">
      {/* Logo */}
      <div className="h-16 flex items-center px-4">
        <Link href="/home" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[hsl(var(--primary))] rounded-md flex items-center justify-center">
            <span className="text-[hsl(var(--primary-foreground))] font-bold text-sm">Z</span>
          </div>
          <span className="font-semibold text-lg">Zykor</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {filteredItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith((item.href || '') + '/');
          const isExpanded = expandedItems.has(item.label);

          return (
            <SidebarMenuItem
              key={item.label}
              item={item}
              isActive={isActive}
              isExpanded={isExpanded}
              onToggle={() => toggleItem(item.label)}
              badges={badges}
            />
          );
        })}
      </nav>
    </aside>
  );
}
