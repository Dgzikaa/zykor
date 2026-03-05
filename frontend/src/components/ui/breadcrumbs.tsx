'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  Home, 
  Folder, 
  FileText, 
  Settings, 
  Users, 
  BarChart3,
  Calendar,
  Target,
  CreditCard,
  TrendingUp,
  MapPin,
  Clock,
  Star,
  Bookmark,
  History,
  ArrowLeft,
  MoreHorizontal,
  Search,
  Filter,
  Plus,
  Edit,
  Eye,
  Download,
  Share2,
  Trash2,
  Lock,
  Unlock,
  CheckCircle,
  AlertCircle,
  Info,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';
import { Button } from './button';
import { Badge } from './badge';
import { Card, CardContent } from './card';
import { cn } from '@/lib/utils';

// =====================================================
// 🍞 SISTEMA DE BREADCRUMBS INTELIGENTES - ZYKOR
// =====================================================

interface BreadcrumbItem {
  id: string;
  label: string;
  href: string;
  icon?: React.ReactNode;
  description?: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  isActive?: boolean;
  isClickable?: boolean;
  metadata?: Record<string, any>;
}

interface BreadcrumbsProps {
  className?: string;
  showHome?: boolean;
  showIcons?: boolean;
  showDescriptions?: boolean;
  showBadges?: boolean;
  maxItems?: number;
  separator?: React.ReactNode;
  variant?: 'default' | 'compact' | 'detailed' | 'smart';
  onItemClick?: (item: BreadcrumbItem) => void;
  showContextMenu?: boolean;
  showQuickActions?: boolean;
  showBreadcrumbHistory?: boolean;
}

interface SmartBreadcrumbsProps extends BreadcrumbsProps {
  enableSmartSuggestions?: boolean;
  enableContextualActions?: boolean;
  enableBreadcrumbAnalytics?: boolean;
}

// =====================================================
// 🎯 MAPPING DE ROTAS PARA BREADCRUMBS
// =====================================================

const ROUTE_MAPPINGS: Record<string, BreadcrumbItem> = {
  'home': {
    id: 'home',
    label: 'Home',
    href: '/home',
    icon: <Home className="w-4 h-4" />,
    description: 'Página inicial do sistema',
  },
  'dashboard': {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: <BarChart3 className="w-4 h-4" />,
    description: 'Visão geral e métricas',
  },
  'configuracoes': {
    id: 'configuracoes',
    label: 'Configurações',
    href: '/configuracoes',
    icon: <Settings className="w-4 h-4" />,
    description: 'Configurações do sistema',
  },
  'usuarios': {
    id: 'usuarios',
    label: 'Usuários',
    href: '/configuracoes/administracao/usuarios',
    icon: <Users className="w-4 h-4" />,
    description: 'Gerenciamento de usuários',
  },
  'checklists': {
    id: 'checklists',
    label: 'Checklists',
    href: '/extras/checklists',
    icon: <CheckCircle className="w-4 h-4" />,
    description: 'Gerenciamento de checklists',
  },
  'extras': {
    id: 'extras',
    label: 'Extras',
    href: '/extras',
    icon: <Star className="w-4 h-4" />,
    description: 'Módulos extras do sistema',
  },
  'administracao': {
    id: 'administracao',
    label: 'Administração',
    href: '/configuracoes/administracao/usuarios',
    icon: <Settings className="w-4 h-4" />,
    description: 'Gestão administrativa',
  },
  'relatorios': {
    id: 'relatorios',
    label: 'Relatórios',
    href: '/relatorios',
    icon: <FileText className="w-4 h-4" />,
    description: 'Relatórios e análises',
  },
  'eventos': {
    id: 'eventos',
    label: 'Eventos',
    href: '/eventos',
    icon: <Calendar className="w-4 h-4" />,
    description: 'Eventos e programações',
  },
  'operacoes': {
    id: 'operacoes',
    label: 'Operações',
    href: '/operacoes',
    icon: <Target className="w-4 h-4" />,
    description: 'Operações diárias',
  },
  'financeiro': {
    id: 'financeiro',
    label: 'Financeiro',
    href: '/financeiro',
    icon: <CreditCard className="w-4 h-4" />,
    description: 'Gestão financeira',
  },
  'marketing': {
    id: 'marketing',
    label: 'Marketing',
    href: '/marketing',
    icon: <TrendingUp className="w-4 h-4" />,
    description: 'Estratégias de marketing',
  },
  'analitico': {
    id: 'analitico',
    label: 'Analítico',
    href: '/analitico',
    icon: <BarChart3 className="w-4 h-4" />,
    description: 'Análises avançadas',
  },
  'estrategico': {
    id: 'estrategico',
    label: 'Estratégico',
    href: '/estrategico',
    icon: <Target className="w-4 h-4" />,
    description: 'Planejamento estratégico',
  },
  'funcionario': {
    id: 'funcionario',
    label: 'Funcionário',
    href: '/funcionario',
    icon: <Users className="w-4 h-4" />,
    description: 'Área do funcionário',
  },
  'visao-geral': {
    id: 'visao-geral',
    label: 'Visão Geral',
    href: '/visao-geral',
    icon: <Eye className="w-4 h-4" />,
    description: 'Visão geral do sistema',
  },
};

// =====================================================
// 🍞 COMPONENTE PRINCIPAL DE BREADCRUMBS
// =====================================================

export function Breadcrumbs({
  className = '',
  showHome = true,
  showIcons = true,
  showDescriptions = false,
  showBadges = true,
  maxItems = 5,
  separator = <ChevronRight className="w-4 h-4 text-gray-400" />,
  variant = 'default',
  onItemClick,
  showContextMenu = false,
  showQuickActions = false,
  showBreadcrumbHistory = false,
}: BreadcrumbsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [showCollapsed, setShowCollapsed] = useState(false);

  // Gerar breadcrumbs baseado no pathname
  useEffect(() => {
    const generateBreadcrumbs = (): BreadcrumbItem[] => {
      const segments = pathname.split('/').filter(Boolean);
      const items: BreadcrumbItem[] = [];

      // Adicionar home se habilitado
      if (showHome) {
        items.push({
          ...ROUTE_MAPPINGS['home'],
          isActive: segments.length === 0,
        });
      }

      // Processar segmentos da URL
      let currentPath = '';
      segments.forEach((segment, index) => {
        currentPath += `/${segment}`;
        
        // Buscar no mapping de rotas
        const routeMapping = ROUTE_MAPPINGS[segment];
        
        if (routeMapping) {
          items.push({
            ...routeMapping,
            href: currentPath,
            isActive: index === segments.length - 1,
            isClickable: true,
          });
        } else {
          // Fallback para rotas não mapeadas
          items.push({
            id: segment,
            label: formatSegmentLabel(segment),
            href: currentPath,
            icon: <Folder className="w-4 h-4" />,
            description: `Página ${formatSegmentLabel(segment)}`,
            isActive: index === segments.length - 1,
            isClickable: true,
          });
        }
      });

      return items;
    };

    setBreadcrumbs(generateBreadcrumbs());
  }, [pathname, showHome]);

  // Formatar label do segmento
  const formatSegmentLabel = (segment: string): string => {
    return segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Navegar para breadcrumb
  const navigateToBreadcrumb = useCallback((item: BreadcrumbItem) => {
    if (!item.isClickable || item.isActive) return;

    if (onItemClick) {
      onItemClick(item);
    } else {
      router.push(item.href);
    }
  }, [onItemClick, router]);

  // Renderizar breadcrumb item
  const renderBreadcrumbItem = (item: BreadcrumbItem, index: number) => {
    const isLast = index === breadcrumbs.length - 1;
    const shouldShow = index < maxItems || showCollapsed || isLast;

    if (!shouldShow) {
      if (index === maxItems - 1 && !showCollapsed) {
        return (
          <Button
            key="collapsed"
            variant="ghost"
            size="sm"
            onClick={() => setShowCollapsed(true)}
            className="px-2 py-1 h-auto"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        );
      }
      return null;
    }

    return (
      <motion.div
        key={item.id}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.1 }}
        className="flex items-center"
      >
        {index > 0 && (
          <span className="mx-2 text-gray-400">
            {separator}
          </span>
        )}

        <BreadcrumbItemComponent
          item={item}
          variant={variant}
          showIcon={showIcons}
          showDescription={showDescriptions}
          showBadge={showBadges}
          onClick={() => navigateToBreadcrumb(item)}
        />
      </motion.div>
    );
  };

  return (
    <nav className={cn('flex items-center space-x-1', className)} aria-label="Breadcrumb">
      {breadcrumbs.map(renderBreadcrumbItem)}
      
      {/* Ações rápidas */}
      {showQuickActions && (
        <div className="ml-4 flex items-center gap-2">
          <QuickActions />
        </div>
      )}
    </nav>
  );
}

// =====================================================
// 🎨 COMPONENTE DE ITEM DE BREADCRUMB
// =====================================================

interface BreadcrumbItemComponentProps {
  item: BreadcrumbItem;
  variant: string;
  showIcon: boolean;
  showDescription: boolean;
  showBadge: boolean;
  onClick: () => void;
}

function BreadcrumbItemComponent({
  item,
  variant,
  showIcon,
  showDescription,
  showBadge,
  onClick,
}: BreadcrumbItemComponentProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);

  const getItemClasses = () => {
    const baseClasses = 'flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200';
    
    if (item.isActive) {
      return cn(baseClasses, 'bg-blue-100 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 font-medium');
    }
    
    if (item.isClickable) {
      return cn(
        baseClasses,
        'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
      );
    }
    
    return cn(baseClasses, 'text-gray-500 dark:text-gray-400');
  };

  const renderContent = () => {
    switch (variant) {
      case 'compact':
        return (
          <div className="flex items-center gap-1">
            {showIcon && item.icon}
            <span className="text-sm">{item.label}</span>
            {showBadge && item.badge && (
              <Badge variant={item.badgeVariant || 'outline'} className="text-xs">
                {item.badge}
              </Badge>
            )}
          </div>
        );

      case 'detailed':
        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              {showIcon && item.icon}
              <span className="font-medium">{item.label}</span>
              {showBadge && item.badge && (
                <Badge variant={item.badgeVariant || 'outline'} className="text-xs">
                  {item.badge}
                </Badge>
              )}
            </div>
            {showDescription && item.description && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                {item.description}
              </span>
            )}
          </div>
        );

      case 'smart':
        return (
          <div className="flex items-center gap-2">
            {showIcon && item.icon}
            <div className="flex flex-col">
              <span className="text-sm font-medium">{item.label}</span>
              {showDescription && item.description && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {item.description}
                </span>
              )}
            </div>
            {showBadge && item.badge && (
              <Badge variant={item.badgeVariant || 'outline'} className="text-xs">
                {item.badge}
              </Badge>
            )}
            {item.isClickable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowContextMenu(!showContextMenu);
                }}
                className="h-6 w-6 p-0 ml-1"
              >
                <ChevronDown className="w-3 h-3" />
              </Button>
            )}
          </div>
        );

      default:
        return (
          <div className="flex items-center gap-2">
            {showIcon && item.icon}
            <span className="text-sm">{item.label}</span>
            {showBadge && item.badge && (
              <Badge variant={item.badgeVariant || 'outline'} className="text-xs">
                {item.badge}
              </Badge>
            )}
          </div>
        );
    }
  };

  return (
    <div className="relative">
      <div
        className={getItemClasses()}
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowContextMenu(!showContextMenu);
        }}
      >
        {renderContent()}
      </div>

      {/* Menu contextual */}
      {showContextMenu && item.isClickable && (
        <BreadcrumbContextMenu
          item={item}
          onClose={() => setShowContextMenu(false)}
        />
      )}
    </div>
  );
}

// =====================================================
// 🎯 MENU CONTEXTUAL DO BREADCRUMB
// =====================================================

interface BreadcrumbContextMenuProps {
  item: BreadcrumbItem;
  onClose: () => void;
}

function BreadcrumbContextMenu({ item, onClose }: BreadcrumbContextMenuProps) {
  const router = useRouter();

  const actions = [
    {
      label: 'Abrir',
      icon: <Eye className="w-4 h-4" />,
      action: () => {
        router.push(item.href);
        onClose();
      },
    },
    {
      label: 'Editar',
      icon: <Edit className="w-4 h-4" />,
      action: () => {
        router.push(`${item.href}/edit`);
        onClose();
      },
    },
    {
      label: 'Nova Aba',
      icon: <ExternalLink className="w-4 h-4" />,
      action: () => {
        window.open(item.href, '_blank');
        onClose();
      },
    },
    {
      label: 'Compartilhar',
      icon: <Share2 className="w-4 h-4" />,
      action: () => {
        navigator.share?.({ url: item.href, title: item.label });
        onClose();
      },
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        className="absolute top-full left-0 mt-1 z-50 min-w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1"
      >
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.action}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}

// =====================================================
// 🚀 BREADCRUMBS INTELIGENTES
// =====================================================

export function SmartBreadcrumbs({
  enableSmartSuggestions = true,
  enableContextualActions = true,
  enableBreadcrumbAnalytics = true,
  ...props
}: SmartBreadcrumbsProps) {
  const [suggestions, setSuggestions] = useState<BreadcrumbItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Gerar sugestões inteligentes
  useEffect(() => {
    if (enableSmartSuggestions) {
      // Mock de sugestões baseadas no contexto atual
      const mockSuggestions: BreadcrumbItem[] = [
        {
          id: 'suggestion-1',
          label: 'Página Relacionada',
          href: '/sugestao-1',
          icon: <Star className="w-4 h-4" />,
          description: 'Página frequentemente acessada junto',
          badge: 'Popular',
          badgeVariant: 'secondary',
          isClickable: true,
        },
        {
          id: 'suggestion-2',
          label: 'Ação Rápida',
          href: '/acao-rapida',
          icon: <Zap className="w-4 h-4" />,
          description: 'Ação comumente executada',
          badge: 'Rápido',
          badgeVariant: 'outline',
          isClickable: true,
        },
      ];
      setSuggestions(mockSuggestions);
    }
  }, [enableSmartSuggestions]);

  return (
    <div className="space-y-2">
      <Breadcrumbs
        {...props}
        variant="smart"
        showContextMenu={enableContextualActions}
        showQuickActions={true}
      />
      
      {/* Sugestões inteligentes */}
      {enableSmartSuggestions && suggestions.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Sugestões:</span>
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion.id}
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = suggestion.href}
              className="h-6 px-2 text-xs"
            >
              {suggestion.icon}
              {suggestion.label}
              {suggestion.badge && (
                <Badge variant={suggestion.badgeVariant || 'outline'} className="ml-1 text-xs">
                  {suggestion.badge}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================
// ⚡ AÇÕES RÁPIDAS
// =====================================================

function QuickActions() {
  const router = useRouter();

  const actions = [
    {
      label: 'Voltar',
      icon: <ArrowLeft className="w-4 h-4" />,
      action: () => router.back(),
    },
    {
      label: 'Home',
      icon: <Home className="w-4 h-4" />,
      action: () => router.push('/home'),
    },
    {
      label: 'Dashboard',
      icon: <BarChart3 className="w-4 h-4" />,
      action: () => router.push('/dashboard'),
    },
  ];

  return (
    <>
      {actions.map((action, index) => (
        <Button
          key={index}
          variant="ghost"
          size="sm"
          onClick={action.action}
          className="h-8 w-8 p-0"
          title={action.label}
        >
          {action.icon}
        </Button>
      ))}
    </>
  );
}

// =====================================================
// 🚀 HOOKS DE BREADCRUMBS
// =====================================================

export function useBreadcrumbs() {
  const pathname = usePathname();
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  useEffect(() => {
    const generateBreadcrumbs = (): BreadcrumbItem[] => {
      const segments = pathname.split('/').filter(Boolean);
      const items: BreadcrumbItem[] = [];

      items.push({
        ...ROUTE_MAPPINGS['home'],
        isActive: segments.length === 0,
      });

      let currentPath = '';
      segments.forEach((segment, index) => {
        currentPath += `/${segment}`;
        
        const routeMapping = ROUTE_MAPPINGS[segment];
        
        if (routeMapping) {
          items.push({
            ...routeMapping,
            href: currentPath,
            isActive: index === segments.length - 1,
            isClickable: true,
          });
        } else {
          items.push({
            id: segment,
            label: segment.charAt(0).toUpperCase() + segment.slice(1),
            href: currentPath,
            icon: <Folder className="w-4 h-4" />,
            isActive: index === segments.length - 1,
            isClickable: true,
          });
        }
      });

      return items;
    };

    setBreadcrumbs(generateBreadcrumbs());
  }, [pathname]);

  return {
    breadcrumbs,
    currentPath: pathname,
    navigateTo: (href: string) => window.location.href = href,
  };
}

export function useBreadcrumbHistory() {
  const [history, setHistory] = useState<string[]>([]);

  const addToHistory = useCallback((path: string) => {
    setHistory(prev => {
      const filtered = prev.filter(p => p !== path);
      return [path, ...filtered].slice(0, 10);
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    history,
    addToHistory,
    clearHistory,
  };
}

// =====================================================
// 📱 BREADCRUMBS RESPONSIVOS
// =====================================================

export function ResponsiveBreadcrumbs(props: BreadcrumbsProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const mobileProps = {
    maxItems: isMobile ? 3 : props.maxItems || 5,
    variant: isMobile ? 'compact' : props.variant || 'default',
    showDescriptions: !isMobile && props.showDescriptions,
    showQuickActions: !isMobile && props.showQuickActions,
  };

  return (
    <Breadcrumbs
      {...props}
      {...mobileProps}
    />
  );
}
