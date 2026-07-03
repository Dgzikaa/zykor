'use client';

import { useState, useCallback, useMemo, memo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { useBadges } from '@/contexts/BadgesContext';
import { useBar } from '@/contexts/BarContext';
import { corDoBar } from '@/lib/bar-theme';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { MENU_TREE } from '@/lib/navigation/menu';
import { iconFor } from '@/lib/navigation/menu-icons';

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
  // Token dedicado da tela de Controle de Produção: visível p/ quem tem 'gestao'
  // (comportamento atual) E p/ o perfil de cozinha/kiosk ('operacional_producoes').
  controle_producao: ['gestao', 'operacional_producoes'],
};

// Itens do menu derivados da FONTE ÚNICA (lib/navigation/menu.ts).
// Os ícones (string em menu.ts) viram componentes via iconFor (lib/navigation/menu-icons).
const defaultSidebarItems: SidebarItem[] = MENU_TREE.map(section => ({
  icon: iconFor(section.icon),
  label: section.label,
  href: section.href,
  permission: section.permission,
  subItems: section.subItems.map(item => ({
    icon: iconFor(item.icon),
    label: item.label,
    href: item.href,
    permission: item.permission,
  })),
}));

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
      style={isActive ? { boxShadow: 'inset 3px 0 0 0 var(--bar-accent)' } : undefined}
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
                  style={isSubActive ? { boxShadow: 'inset 3px 0 0 0 var(--bar-accent)' } : undefined}
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
  const { selectedBar } = useBar();
  const accent = corDoBar(selectedBar?.id);
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

    // Casa uma permissão de menu (seção ou item) com as do usuário, via mapeamento
    // (mesma lógica do BottomNavigation, p/ desktop e mobile não divergirem).
    const matchPermission = (permission?: string) => {
      if (!permission) return true;
      if (hasPermission('todos')) return true;
      const permissions = PERMISSION_MAPPINGS[permission] || [permission];
      return permissions.some(p => hasPermission(p));
    };

    return defaultSidebarItems
      .map(item => ({
        ...item,
        subItems: item.subItems?.filter(subItem => matchPermission(subItem.permission)),
      }))
      // Mostra a seção se ela própria libera OU se sobrou algum sub-item visível
      // (evita seção vazia e revela a seção quando o usuário só tem 1 item dela).
      .filter(item => matchPermission(item.permission) || (item.subItems?.length ?? 0) > 0);
  }, [hasPermission, permissionsLoading]);

  return (
    <aside
      className="hidden lg:flex lg:flex-col w-64 bg-[hsl(var(--muted))] p-2"
      style={{ ['--bar-accent' as string]: accent } as React.CSSProperties}
    >
      {/* Faixa de identidade do bar selecionado */}
      <div className="mx-2 mt-1 h-1 rounded-full" style={{ background: accent }} />
      {/* Logo */}
      <div className="h-16 flex items-center px-4">
        <Link href="/home" className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ background: accent }}
          >
            <span className="text-white font-bold text-sm">Z</span>
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
