'use client';

import { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { useBadges } from '@/contexts/BadgesContext';
import { useBar } from '@/contexts/BarContext';
import { corDoBar } from '@/lib/bar-theme';
import { BarLogo } from '@/components/BarLogo';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronDown, Check, Home } from 'lucide-react';
import { MENU_TREE, isMenuLeaf } from '@/lib/navigation/menu';
import { iconFor } from '@/lib/navigation/menu-icons';

// Seletor de bar no topo do menu lateral: identidade (logo + nome do bar) + troca rápida.
function SidebarBarSwitcher() {
  const { selectedBar, availableBars, setSelectedBar } = useBar();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const podeTrocar = availableBars.length > 1;

  return (
    <div className="relative min-w-0 flex-1" ref={ref}>
      <button
        onClick={() => podeTrocar && setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[hsl(var(--background))]"
      >
        <BarLogo id={selectedBar?.id ?? 0} nome={selectedBar?.nome ?? 'Zykor'} logo={selectedBar?.logo_url} size={24} />
        <span className="min-w-0 flex-1 truncate text-left text-sm font-bold">{selectedBar?.nome || 'Zykor'}</span>
        {podeTrocar && <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-60" />}
      </button>
      {open && podeTrocar && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--popover))] py-1 shadow-lg">
          {availableBars.map((bar) => (
            <button
              key={bar.id}
              onClick={() => {
                setSelectedBar(bar);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-2.5 py-2 text-sm hover:bg-[hsl(var(--muted))]"
            >
              <BarLogo id={bar.id} nome={bar.nome} logo={bar.logo_url} />
              <span className="min-w-0 flex-1 truncate text-left">{bar.nome}</span>
              {selectedBar?.id === bar.id && <Check className="h-4 w-4 flex-shrink-0 text-emerald-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface SubMenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  badge?: number;
  description?: string;
  permission?: string;
  beta?: boolean;
}

interface SubMenuHeader {
  header: string;
}

type SubMenuNode = SubMenuItem | SubMenuHeader;

function isSubMenuItem(n: SubMenuNode): n is SubMenuItem {
  return 'href' in n;
}

interface SidebarItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  badge?: number;
  permission?: string;
  subItems?: SubMenuNode[];
  beta?: boolean;
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
  // Desperdício (Beta): visível p/ gestão E p/ quem recebeu o módulo específico
  // (ex.: perfis de produção bar/cozinha que só têm o grant granular, sem 'gestao').
  desperdicio: ['gestao', 'producao - cmv_desperdicio'],
};

// Itens do menu derivados da FONTE ÚNICA (lib/navigation/menu.ts).
// Os ícones (string em menu.ts) viram componentes via iconFor (lib/navigation/menu-icons).
const defaultSidebarItems: SidebarItem[] = MENU_TREE.map(section => ({
  icon: iconFor(section.icon),
  label: section.label,
  href: section.href,
  permission: section.permission,
  beta: section.beta,
  subItems: section.subItems.map(item =>
    isMenuLeaf(item)
      ? {
          icon: iconFor(item.icon),
          label: item.label,
          href: item.href,
          permission: item.permission,
          beta: item.beta,
        }
      : { header: item.header },
  ),
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
        {item.beta && (
          <span
            className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 flex-shrink-0"
            title="Em construção — módulo em testes"
          >
            Beta
          </span>
        )}
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
            {(() => {
              // "match mais específico vence": entre os irmãos-folha que casam com a rota, só
              // o de href mais longo fica ativo. Evita que um pai (ex.: /receitas) acenda junto
              // com o filho (/receitas/comunicacao), já que ambos casam por prefixo.
              const leaves = item.subItems!.filter(isSubMenuItem);
              const activeSubHref = leaves
                .filter((s) => pathname === s.href || pathname.startsWith(s.href + '/'))
                .reduce<string | null>((best, s) => (!best || s.href.length > best.length ? s.href : best), null);
              return item.subItems!.map((subItem, idx) => {
                // Header: rótulo pequeno em CAIXA ALTA — separa grupos visualmente, sem clique.
                // Primeiro header não leva margem-top (encosta no topo da seção).
                if (!isSubMenuItem(subItem)) {
                  const isFirst = idx === 0;
                  return (
                    <div
                      key={`h-${idx}-${subItem.header}`}
                      className={cn(
                        'px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]',
                        isFirst ? 'pt-1' : 'pt-3',
                      )}
                    >
                      {subItem.header}
                    </div>
                  );
                }
                const SubIcon = subItem.icon;
                const isSubActive = subItem.href === activeSubHref;
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
                      {subItem.beta && (
                        <span
                          className="px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 flex-shrink-0"
                          title="Em construção — módulo em testes"
                        >
                          Beta
                        </span>
                      )}
                    </div>
                    {subBadge && subBadge > 0 && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded">
                        {subBadge}
                      </span>
                    )}
                  </Link>
                );
              });
            })()}
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
      if (item.subItems?.some(sub => isSubMenuItem(sub) && pathname.startsWith(sub.href))) {
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

    // Portão POR BAR (independe do usuário): se o bar selecionado tem uma whitelist de rotas
    // (config.modulos_visiveis), o menu mostra só essas rotas — valendo pra TODOS, inclusive
    // admin (que fura o matchPermission). Vazio/ausente = mostra tudo (Ordinário/Deboche intactos).
    // Configurações fica sempre visível p/ admin, senão ele se tranca do lado de fora do bar enxuto.
    const ehAdmin = hasPermission('todos');
    const permitidas = Array.isArray(selectedBar?.modulos_visiveis) ? selectedBar!.modulos_visiveis : [];
    const barRestrito = permitidas.length > 0;
    const matchBar = (href?: string) => !barRestrito || (!!href && permitidas.includes(href));

    return defaultSidebarItems
      .map(item => {
        const isConfig = item.permission === 'configuracoes';
        // Filtra folhas por permissão do usuário E pelo portão do bar; headers sempre passam
        // (headers órfãos caem no passo seguinte). Config: folhas sempre visíveis p/ admin.
        const filtered = item.subItems?.filter(sub => {
          if (!isSubMenuItem(sub)) return true;
          if (isConfig && ehAdmin) return true;
          return matchPermission(sub.permission) && matchBar(sub.href);
        });
        const dropOrphanHeaders = filtered?.filter((sub, i) => {
          if (isSubMenuItem(sub)) return true;
          for (let j = i + 1; j < filtered.length; j++) {
            const next = filtered[j];
            if (!isSubMenuItem(next)) break; // outro header = este era órfão
            return true;
          }
          return false;
        });
        return { ...item, subItems: dropOrphanHeaders };
      })
      // Mostra a seção se sobrou algum sub-item visível. Quando o bar NÃO está restrito,
      // mantém o comportamento antigo (seção com permissão própria aparece mesmo sem folhas).
      // Config sempre aparece p/ admin.
      .filter(item => {
        if (item.permission === 'configuracoes' && ehAdmin) return true;
        const temFolha = item.subItems?.some(isSubMenuItem) ?? false;
        if (barRestrito) return temFolha;
        if (matchPermission(item.permission)) return true;
        return temFolha;
      });
  }, [hasPermission, permissionsLoading, selectedBar]);

  return (
    <aside
      className="hidden lg:flex lg:flex-col w-64 bg-[hsl(var(--muted))] p-2"
      style={{ ['--bar-accent' as string]: accent } as React.CSSProperties}
    >
      {/* Faixa de identidade do bar selecionado */}
      <div className="mx-2 mt-1 h-1 rounded-full" style={{ background: accent }} />
      {/* Bar atual = seletor (identidade + troca rápida) + atalho pra Home */}
      <div className="flex h-14 items-center gap-1 px-2">
        <SidebarBarSwitcher />
        <Link
          href="/home"
          title="Início"
          className="flex-none rounded-md p-2 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--background))] hover:text-[hsl(var(--foreground))]"
        >
          <Home className="h-4 w-4" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {filteredItems.map((item) => {
          // Seção acende se a rota casa com o href DELA ou com o de algum sub-item.
          // Guarda contra href vazio (''+'/' = '/' casaria com tudo).
          const matchHref = (h?: string) => !!h && (pathname === h || pathname.startsWith(h + '/'));
          const isActive = matchHref(item.href) || (item.subItems?.some((s) => isSubMenuItem(s) && matchHref(s.href)) ?? false);
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
