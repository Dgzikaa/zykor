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
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import {
  CommandPaletteSearchPlaceholder,
  CommandPaletteIconTrigger,
} from '@/components/ui/command-palette-trigger';
import { NotificationCenter } from '@/components/NotificationCenter';
import Image from 'next/image';

// Mapeamento de rotas para breadcrumbs
const routeMapping: Record<
  string,
  { name: string; icon?: React.ComponentType<{ className?: string }> }
> = {
  '/home': { name: 'Home', icon: Home },

  // Operações
  '/operacoes': { name: 'Operações' },
  '/operacoes/checklists': { name: 'Checklists' },
  '/operacoes/checklists/checklists-funcionario': { name: 'Meus Checklists' },
  '/configuracoes/fichas-tecnicas': { name: 'Fichas Técnicas' },
  '/ferramentas/terminal': { name: 'Terminal de Produção' },

  // Relatórios
  '/relatorios': { name: 'Relatórios' },
  '/relatorios/visao-geral': { name: 'Visão Geral' },
  
  // Analítico
  '/analitico': { name: 'Analítico' },
  '/analitico/clientes': { name: 'Clientes' },
  '/analitico/semanal': { name: 'Semanal' },

  // Marketing
  '/marketing': { name: 'Marketing' },
  '/marketing/marketing-360': { name: 'Marketing 360' },

  // Estratégico
  '/estrategico': { name: 'Estratégico' },
  '/estrategico/visao-geral': { name: 'Visão Geral' },
  '/estrategico/visao-mensal': { name: 'Visão Mensal' },
  '/estrategico/desempenho': { name: 'Desempenho' },
  '/estrategico/planejamento-comercial': { name: 'Planejamento Comercial' },
  '/estrategico/orcamentacao': { name: 'Orçamentação' },

  // Operacional
  '/operacional': { name: 'Operacional' },
  '/operacional/dre': { name: 'DRE' },
  '/operacional/agendamentos': { name: 'Agendamentos' },

  // Ferramentas
  '/ferramentas': { name: 'Ferramentas' },
  '/ferramentas/agendamento': { name: 'Agendamento' },

  // Financeiro
  '/financeiro': { name: 'Financeiro' },

  // Configurações
  '/configuracoes': { name: 'Configurações' },
  '/configuracoes/checklists': { name: 'Checklists' },
  '/configuracoes/metas': { name: 'Metas' },
  '/configuracoes/integracoes': { name: 'Integrações' },
  '/configuracoes/seguranca': { name: 'Segurança' },
  '/configuracoes/whatsapp': { name: 'WhatsApp' },
  '/configuracoes/contahub-automatico': { name: 'ContaHub Auto' },
  '/configuracoes/meta-config': { name: 'Meta Config' },
  '/configuracoes/templates': { name: 'Templates' },
  '/configuracoes/analytics': { name: 'Analytics' },
  '/configuracoes/pwa': { name: 'PWA' },

  // Outras páginas
  '/usuarios/minha-conta': { name: 'Minha Conta' },
  '/login': { name: 'Login' },
};

function generateBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: Array<{
    name: string;
    href: string;
    icon?: React.ComponentType<{ className?: string }>;
    isLast?: boolean;
  }> = [];

  // Add home always
  breadcrumbs.push({
    name: 'ZYKOR',
    href: '/home',
    icon: Home,
  });

  // Build progressive paths
  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const route = routeMapping[currentPath];

    breadcrumbs.push({
      name: route
        ? route.name
        : segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '),
      href: currentPath,
      icon: route?.icon,
      isLast: index === segments.length - 1,
    });
  });

  if (breadcrumbs.length > 1) {
    breadcrumbs.pop();
  }

  return breadcrumbs;
}

export function DarkHeader() {
  const { selectedBar, availableBars, setSelectedBar } = useBar();
  const { user, logout } = useUser();
  const { pageTitle } = usePageTitle();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  // Logo principal ZYKOR
  const zykorLogo = '/logos/logo_zykor.png';
  
  // Logos específicos dos bares (quando implementados)
  const getBarLogo = (barName: string) => {
    const barLogos: Record<string, string> = {
      'ordinario': '/logos/ordinario-logo.png',
      'deboche': '/logos/deboche-logo.png',
    };
    
    const normalizedName = barName?.toLowerCase().replace(/[^a-z]/g, '');
    return barLogos[normalizedName] || zykorLogo;
  };
  
  const srcImage = zykorLogo; // Por enquanto, sempre ZYKOR principal

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showBarMenu, setShowBarMenu] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const barMenuRef = useRef<HTMLDivElement>(null);



  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
      if (
        barMenuRef.current &&
        !barMenuRef.current.contains(event.target as Node)
      ) {
        setShowBarMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDarkMode = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
  };

  const handleBarSelect = (bar: typeof selectedBar) => {
    if (bar) {
      setSelectedBar(bar);
    }
    setShowBarMenu(false);
  };

  return (
    <header className="sticky inset-x-0 top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 dark:bg-gray-900/95 dark:border-gray-700 shadow-sm">
      <div className="flex items-center h-10 px-2 sm:px-4 justify-between">
        {/* Esquerda - Logo ZYKOR + Título */}
        <div className="flex items-center gap-4">
          <Link href="/home" className="flex items-center p-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200">
            <Image
              src={srcImage}
              alt="Logo ZYKOR"
              width={64}
              height={64}
              priority
              className="h-10 w-auto object-contain hover:scale-105 transition-transform duration-200"
            />
          </Link>
          {pageTitle && (
            <div className="hidden lg:block">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {pageTitle}
              </h1>
            </div>
          )}
        </div>

        {/* Centro - Busca */}
        <div className="flex-1 max-w-xs lg:max-w-md mx-4 hidden md:block">
          <CommandPaletteSearchPlaceholder
            placeholder="Buscar..."
            className="w-full"
          />
        </div>

        {/* Direita - Controles */}
        <div className="flex items-center gap-2">
          {/* Busca mobile */}
          <div className="md:hidden">
            <CommandPaletteIconTrigger />
          </div>

          {/* Seletor de Bar */}
          <div className="relative" ref={barMenuRef}>
            <button
              onClick={() => setShowBarMenu(!showBarMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700"
            >
              <div className="w-6 h-6 rounded-full avatar-zykor text-xs font-bold">
                {selectedBar?.nome?.charAt(0)?.toUpperCase() || 'B'}
              </div>
              <span className="hidden sm:block truncate max-w-24">
                {selectedBar?.nome || 'Selecionar Bar'}
              </span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {/* Dropdown de Bares */}
            {showBarMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                <div className="px-3 pb-2 mb-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Estabelecimentos
                  </span>
                </div>
                {availableBars.map(bar => (
                  <button
                    key={bar.id}
                    onClick={() => handleBarSelect(bar)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full avatar-zykor text-xs font-bold">
                      {bar.nome?.charAt(0)?.toUpperCase()}
                    </div>
                    <span className="flex-1 text-left">{bar.nome}</span>
                    {selectedBar?.id === bar.id && (
                      <Check className="w-4 h-4 text-green-500" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Botão Atualizar */}
          <div className="relative">
            <button
              onClick={() => {
                // Recarregar a página atual
                window.location.reload();
              }}
              className="flex items-center gap-1 px-2 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700"
              title="Atualizar dados"
            >
              🔄
            </button>
          </div>

          {/* Notificações */}
          <div className="relative">
            <NotificationCenter />
          </div>

          {/* Menu do Usuário */}
          <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-2 py-1 rounded-[6px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="w-6 h-6 rounded-full avatar-zykor text-xs font-semibold">
                  {user?.nome?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span className="hidden sm:block text-xs text-gray-600 dark:text-gray-300 truncate max-w-24">
                  {user?.nome?.split(' ')[0]}
                </span>
                <ChevronDown className="w-3 h-3 text-gray-400 dark:text-gray-500" />
              </button>

              {/* Dropdown do Usuário */}
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-[8px] shadow-lg border border-gray-200 dark:border-gray-700 py-2 animate-slide-in-from-top">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full avatar-zykor text-sm font-semibold">
                        {user?.nome?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {user?.nome}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {user?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div>
                    <Link
                      href="/usuarios/minha-conta"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      Minha Conta
                    </Link>

                    <button
                      onClick={toggleDarkMode}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      {theme === 'dark' ? (
                        <>
                          <Sun className="w-4 h-4" />
                          Modo Claro
                        </>
                      ) : (
                        <>
                          <Moon className="w-4 h-4" />
                          Modo Escuro
                        </>
                      )}
                    </button>
                  </div>

                  {/* Separator */}
                  <div className="border-t border-gray-100 dark:border-gray-700 my-2"></div>

                  {/* Logout */}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </div>
              )}
          </div>
        </div>
      </div>
    </header>
  );
}
