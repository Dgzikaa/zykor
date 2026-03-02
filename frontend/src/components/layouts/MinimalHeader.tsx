'use client';

import { useState, useRef, useEffect } from 'react';
import { useBar } from '@/contexts/BarContext';
import { useUser } from '@/contexts/UserContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import {
  ChevronDown,
  User,
  LogOut,
  Moon,
  Sun,
  ChevronRight,
  Home,
  Check,
  Menu,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import {
  CommandPaletteSearchPlaceholder,
  CommandPaletteIconTrigger,
} from '@/components/ui/command-palette-trigger';
import { NotificationCenter } from '@/components/NotificationCenter';

const routeMapping: Record<string, { name: string }> = {
  '/home': { name: 'Home' },
  '/operacoes': { name: 'Operações' },
  '/operacoes/checklists': { name: 'Checklists' },
  '/operacoes/checklists/checklists-funcionario': { name: 'Meus Checklists' },
  '/configuracoes/fichas-tecnicas': { name: 'Fichas Técnicas' },
  '/ferramentas/terminal': { name: 'Terminal de Produção' },
  '/relatorios': { name: 'Relatórios' },
  '/relatorios/visao-geral': { name: 'Visão Geral' },
  '/analitico': { name: 'Analítico' },
  '/analitico/clientes': { name: 'Clientes' },
  '/analitico/semanal': { name: 'Semanal' },
  '/marketing': { name: 'Marketing' },
  '/marketing/marketing-360': { name: 'Marketing 360' },
  '/estrategico': { name: 'Estratégico' },
  '/estrategico/visao-geral': { name: 'Visão Geral' },
  '/estrategico/visao-mensal': { name: 'Visão Mensal' },
  '/estrategico/desempenho': { name: 'Desempenho' },
  '/estrategico/planejamento-comercial': { name: 'Planejamento Comercial' },
  '/estrategico/orcamentacao': { name: 'Orçamentação' },
  '/operacional': { name: 'Operacional' },
  '/operacional/dre': { name: 'DRE' },
  '/operacional/agendamentos': { name: 'Agendamentos' },
  '/ferramentas': { name: 'Ferramentas' },
  '/ferramentas/agendamento': { name: 'Agendamento' },
  '/financeiro': { name: 'Financeiro' },
  '/configuracoes': { name: 'Configurações' },
  '/configuracoes/checklists': { name: 'Checklists' },
  '/configuracoes/metas': { name: 'Metas' },
  '/configuracoes/integracoes': { name: 'Integrações' },
  '/configuracoes/seguranca': { name: 'Segurança' },
  '/configuracoes/whatsapp': { name: 'WhatsApp' },
  '/configuracoes/usuarios': { name: 'Usuários' },
  '/usuarios/minha-conta': { name: 'Minha Conta' },
  '/login': { name: 'Login' },
};

function generateBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: Array<{
    name: string;
    href: string;
    isLast?: boolean;
  }> = [];

  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const route = routeMapping[currentPath];
    
    if (route) {
      breadcrumbs.push({
        name: route.name,
        href: currentPath,
        isLast: index === segments.length - 1,
      });
    }
  });

  return breadcrumbs;
}

export function MinimalHeader() {
  const pathname = usePathname();
  const { selectedBar, availableBars, setSelectedBar } = useBar();
  const { user } = useUser();
  const { theme, setTheme } = useTheme();
  const { pageTitle } = usePageTitle();
  const [showBarDropdown, setShowBarDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const barDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const breadcrumbs = generateBreadcrumbs(pathname);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (barDropdownRef.current && !barDropdownRef.current.contains(event.target as Node)) {
        setShowBarDropdown(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <header className="h-16 bg-[hsl(var(--background))] flex items-center justify-between px-6 gap-4 border-b border-[hsl(var(--border))]">
      {/* Left: Menu Toggle + Search + Page Title */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Menu Toggle Button */}
        <button
          className="lg:hidden p-2 rounded-md hover:bg-[hsl(var(--muted))] transition-colors"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search - Logo no início */}
        <div className="flex items-center gap-2">
          <CommandPaletteSearchPlaceholder />
          <CommandPaletteIconTrigger />
        </div>

        {/* Page Title */}
        {pageTitle && <h1 className="text-lg font-semibold">{pageTitle}</h1>}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">

        {/* Notifications */}
        <NotificationCenter />

        {/* Bar Selector */}
        {availableBars.length > 1 && (
          <div className="relative" ref={barDropdownRef}>
            <button
              onClick={() => setShowBarDropdown(!showBarDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <span className="font-medium truncate max-w-[120px]">
                {selectedBar?.nome || 'Selecione'}
              </span>
              <ChevronDown className="w-4 h-4 flex-shrink-0" />
            </button>

            {showBarDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-lg shadow-lg py-1 z-50">
                {availableBars.map((bar) => (
                  <button
                    key={bar.id}
                    onClick={() => {
                      setSelectedBar(bar);
                      setShowBarDropdown(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
                  >
                    <span className="truncate">{bar.nome}</span>
                    {selectedBar?.id === bar.id && (
                      <Check className="w-4 h-4 text-[hsl(var(--primary))]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-md hover:bg-[hsl(var(--muted))] transition-colors"
          aria-label="Alternar tema"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>

        {/* User Menu */}
        <div className="relative" ref={userDropdownRef}>
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm hover:bg-[hsl(var(--muted))] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center">
              <span className="text-xs font-medium text-[hsl(var(--primary-foreground))]">
                {user?.nome?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-lg shadow-lg py-1 z-50">
              <div className="px-3 py-2 border-b border-[hsl(var(--border))]">
                <p className="text-sm font-medium truncate">{user?.nome}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{user?.email}</p>
              </div>

              <Link
                href="/usuarios/minha-conta"
                className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
                onClick={() => setShowUserDropdown(false)}
              >
                <User className="w-4 h-4" />
                Minha Conta
              </Link>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
