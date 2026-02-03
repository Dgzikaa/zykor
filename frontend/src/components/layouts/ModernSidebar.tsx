'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { usePermissions } from '@/hooks/usePermissions';
import { useMenuBadges } from '@/hooks/useMenuBadges';
import {
  Home,
  CheckSquare,
  Settings,
  BarChart3,
  Calendar,
  Users,
  Database,
  Zap,
  FileText,
  ChevronDown,
  ChevronRight,
  Clock,
  Shield,
  Target,
  Smartphone,
  DollarSign,
  MessageSquare,
  MessageCircle,
  TrendingUp,
  Briefcase,
  Wrench,
  Package,
  AlertTriangle,
  ChefHat,
  Sparkles,
  Send,
  FileSearch,
  Activity,
  Wallet,
  Megaphone,
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
  color?: string;
  permission?: string;
  subItems?: SubMenuItem[];
}

// Permission mapping para cada item do sidebar
const PERMISSION_MAPPINGS: Record<string, string[]> = {
  // Permissões principais - 'todos' só é checado pelo hook hasPermission
  home: ['home'],
  operacoes: ['operacoes', 'checklists', 'terminal_producao', 'receitas_insumos', 'operacoes_checklists', 'operacoes_receitas', 'operacoes_meus_checklists', 'operacoes_terminal'],
  gestao: ['gestao', 'tempo', 'planejamento'],
  marketing: ['marketing', 'marketing_360'],
  financeiro: ['financeiro', 'financeiro_agendamento', 'dashboard_financeiro_mensal'],
  relatorios: ['relatorios', 'dashboard_financeiro_mensal', 'marketing_360'],
  configuracoes: ['configuracoes'],
  
  // Mapeamento específico para Ferramentas - incluir todas as permissões relacionadas
  ferramentas: ['operacoes', 'checklists', 'terminal_producao', 'receitas_insumos', 'operacoes_checklists', 'operacoes_receitas', 'operacoes_meus_checklists', 'operacoes_terminal', 'financeiro_agendamento'],
  
  // Submenu mappings específicos - SEM 'todos' para testar permissões granulares
  checklists: ['checklists', 'operacoes_checklists', 'operacoes_meus_checklists'],
  terminal_producao: ['terminal_producao', 'operacoes_terminal'],
  receitas_insumos: ['receitas_insumos', 'operacoes_receitas'],
  tempo: ['tempo'],
  planejamento: ['planejamento'],
  marketing_360: ['marketing_360'],
  financeiro_agendamento: ['financeiro_agendamento'],
  dashboard_financeiro_mensal: ['dashboard_financeiro_mensal'],
  configuracoes_checklists: ['configuracoes_checklists'],
  configuracoes_metas: ['configuracoes_metas'],
  configuracoes_integracoes: ['configuracoes_integracoes'],
  configuracoes_seguranca: ['configuracoes_seguranca'],
  configuracoes_whatsapp: ['configuracoes_whatsapp'],
  configuracoes_contahub: ['configuracoes_contahub'],
  configuracoes_meta_config: ['configuracoes_meta_config'],
  configuracoes_templates: ['configuracoes_templates'],
  configuracoes_analytics: ['configuracoes_analytics'],
  configuracoes_pwa: ['configuracoes_pwa'],
};

// Estrutura base do sidebar
const defaultSidebarItems: SidebarItem[] = [
    {
      icon: Target,
      label: 'Estratégico',
      href: '/estrategico',
      color: 'text-blue-600 dark:text-blue-400',
      permission: 'gestao',
      subItems: [
        {
          icon: TrendingUp,
          label: 'Visão Geral',
          href: '/estrategico/visao-geral',
          description: 'Visão estratégica completa do negócio',
          permission: 'home',
        },
        // {
        //   icon: Calendar,
        //   label: 'Visão Mensal',
        //   href: '/estrategico/visao-mensal',
        //   description: 'Comparativo mensal dos últimos 3 meses',
        //   permission: 'home',
        // },
        {
          icon: BarChart3,
          label: 'Desempenho',
          href: '/estrategico/desempenho',
          description: 'Análise semanal de performance',
          permission: 'gestao',
        },
        {
          icon: Calendar,
          label: 'Planejamento Comercial',
          href: '/estrategico/planejamento-comercial',
          description: 'Estratégia comercial e metas',
          permission: 'planejamento',
        },
        {
          icon: DollarSign,
          label: 'Orçamentação',
          href: '/estrategico/orcamentacao',
          description: 'Gestão orçamentária integrada',
          permission: 'home',
        },
      ],
    },
    // {
    //   icon: Zap,
    //   label: 'Operacional',
    //   href: '/operacional',
    //   color: 'text-orange-600 dark:text-orange-400',
    //   permission: 'operacoes',
    //   subItems: [
    //     {
    //       icon: BarChart3,
    //       label: 'DRE',
    //       href: '/operacional/dre',
    //       description: 'Demonstrativo de Resultado Operacional',
    //       permission: 'dashboard_financeiro_mensal',
    //     },
    //   ],
    // },
    {
      icon: Wrench,
      label: 'Ferramentas',
      href: '/ferramentas',
      color: 'text-green-600 dark:text-green-400',
      permission: 'ferramentas',
      subItems: [
        // {
        //   icon: Calendar,
        //   label: 'Calendário',
        //   href: '/ferramentas/calendario',
        //   description: 'Calendário visual de eventos e reservas',
        //   permission: 'operacoes',
        // },
        {
          icon: Megaphone,
          label: 'Central Comercial',
          href: '/ferramentas/comercial',
          description: 'Planejamento 2026: feriados, Copa, eventos',
          permission: 'gestao',
        },
        {
          icon: Package,
          label: 'Produção e Insumos',
          href: '/ferramentas/producao-insumos',
          description: 'Gestão de insumos, receitas e produção',
          permission: 'operacoes',
        },
        {
          icon: Package,
          label: 'Contagem de Estoque',
          href: '/ferramentas/contagem-estoque',
          description: 'Registro de contagem com validações inteligentes',
          permission: 'operacoes',
        },
        {
          icon: Package,
          label: 'Contagem Rápida',
          href: '/ferramentas/contagem-rapida',
          description: 'Contagem rápida de estoque de insumos',
          permission: 'operacoes',
        },
        {
          icon: Calendar,
          label: 'Agendamento',
          href: '/ferramentas/agendamento',
          description: 'Ferramenta de agendamento avançado',
          permission: 'financeiro_agendamento',
        },
        {
          icon: FileSearch,
          label: 'Consultas NIBO',
          href: '/ferramentas/consultas',
          description: 'Consulta de lançamentos retroativos',
          permission: 'financeiro_agendamento',
        },
        {
          icon: Users,
          label: 'NPS Funcionários',
          href: '/ferramentas/nps',
          description: 'Pesquisa NPS e Felicidade dos funcionários',
          permission: 'gestao',
        },
        {
          icon: DollarSign,
          label: 'DRE',
          href: '/ferramentas/dre',
          description: 'Demonstrativo de Resultado do Exercício',
          permission: 'dashboard_financeiro_mensal',
        },
        {
          icon: Target,
          label: 'NPS Clientes',
          href: '/ferramentas/nps/categorizado',
          description: 'Pesquisa de satisfação de clientes por categoria',
          permission: 'gestao',
        },
        {
          icon: MessageCircle,
          label: 'Voz do Cliente',
          href: '/ferramentas/voz-cliente',
          description: 'Feedbacks positivos, negativos e sugestões',
          permission: 'gestao',
        },
        {
          icon: TrendingUp,
          label: 'CMV Semanal',
          href: '/ferramentas/cmv-semanal',
          description: 'Custo de Mercadoria Vendida semanal',
          permission: 'gestao',
        },
        {
          icon: Users,
          label: 'Simulação de CMO',
          href: '/ferramentas/simulacao-cmo',
          description: 'Simulação de Custo de Mão de Obra mensal',
          permission: 'gestao',
        },
        {
          icon: AlertTriangle,
          label: 'Stockout',
          href: '/ferramentas/stockout',
          description: 'Controle de disponibilidade de produtos',
          permission: 'gestao',
        },
        // {
        //   icon: Wallet,
        //   label: 'CFP - Finanças',
        //   href: '/fp',
        //   description: 'Controle Financeiro Pessoal',
        //   permission: 'home',
        // }, // TODO: Implementar
        // {
        //   icon: MessageSquare,
        //   label: 'Agente',
        //   href: '/ferramentas/agente',
        //   description: 'Assistente AI integrado com análise de dados',
        //   permission: 'operacoes',
        // },
      ],
    },
    {
      icon: BarChart3,
      label: 'Analítico',
      href: '/analitico',
      color: 'text-indigo-600 dark:text-indigo-400',
      permission: 'relatorios',
      subItems: [
        {
          icon: Users,
          label: 'Clientes',
          href: '/analitico/clientes',
          description: 'Análise de clientes e base ativa',
          permission: 'relatorios',
        },
        {
          icon: Clock,
          label: 'Eventos',
          href: '/analitico/eventos',
          description: 'Análise de horários de pico e produtos por evento',
          permission: 'relatorios',
        },
        {
          icon: Sparkles,
          label: 'Retrospectiva 2025',
          href: '/retrospectiva-2025',
          description: 'Retrospectiva completa do ano de 2025',
          permission: 'home',
        },
      ],
    },
    {
      icon: MessageCircle,
      label: 'CRM',
      href: '/crm',
      color: 'text-pink-600 dark:text-pink-400',
      permission: 'gestao',
      subItems: [
        {
          icon: Send,
          label: 'Umbler Talk',
          href: '/crm/umbler',
          description: 'Conversas e Campanhas WhatsApp',
          permission: 'gestao',
        },
        {
          icon: Sparkles,
          label: 'Segmentação RFM',
          href: '/crm/inteligente',
          description: 'Análise RFM com 7 segmentos',
          permission: 'gestao',
        },
        {
          icon: AlertTriangle,
          label: 'Predição Churn',
          href: '/crm/churn-prediction',
          description: 'Clientes em risco de abandono',
          permission: 'gestao',
        },
        {
          icon: DollarSign,
          label: 'LTV e Engajamento',
          href: '/crm/ltv-engajamento',
          description: 'Lifetime Value dos clientes',
          permission: 'gestao',
        },
        {
          icon: Target,
          label: 'Padrões',
          href: '/crm/padroes-comportamento',
          description: 'Hábitos e preferências',
          permission: 'gestao',
        },
      ],
    },
    {
      icon: Settings,
      label: 'Configurações',
      href: '/configuracoes',
      color: 'text-gray-600 dark:text-gray-400',
      permission: 'configuracoes',
      subItems: [
        {
          icon: Users,
          label: 'Usuários',
          href: '/configuracoes/usuarios',
          description: 'Gerenciar usuários e permissões do sistema',
          permission: 'configuracoes',
        },
        {
          icon: ChefHat,
          label: 'Fichas Técnicas',
          href: '/configuracoes/fichas-tecnicas',
          description: 'Gerenciar e atualizar fichas técnicas de produção',
          permission: 'operacoes',
        },
        {
          icon: CheckSquare,
          label: 'Checklists',
          href: '/configuracoes/checklists',
          description: 'Configurar templates de checklists',
          permission: 'configuracoes',
        },
        {
          icon: Target,
          label: 'Metas',
          href: '/configuracoes/metas',
          description: 'Definir metas e indicadores',
          permission: 'configuracoes',
        },
        {
          icon: ChefHat,
          label: 'Teste de Produção',
          href: '/configuracoes/teste-producao',
          description: 'Teste de fichas técnicas em produção',
          permission: 'operacoes',
        },
        {
          icon: Calendar,
          label: 'Calendário Operacional',
          href: '/configuracoes/calendario-operacional',
          description: 'Gerencie dias de abertura e fechamento do bar',
          permission: 'operacoes',
        },
        {
          icon: MessageCircle,
          label: 'WhatsApp',
          href: '/configuracoes/whatsapp',
          description: 'Configurar integração WhatsApp Business',
          permission: 'configuracoes',
        },
        {
          icon: FileSearch,
          label: 'Auditoria',
          href: '/configuracoes/auditoria',
          description: 'Rastreamento de alterações em eventos',
          permission: 'configuracoes',
        },
        {
          icon: Shield,
          label: 'Saúde dos Dados',
          href: '/configuracoes/saude-dados',
          description: 'Monitoramento de integridade dos dados',
          permission: 'configuracoes',
        },
        {
          icon: Activity,
          label: 'Monitoramento',
          href: '/configuracoes/monitoramento',
          description: 'Status do sistema e cron jobs',
          permission: 'configuracoes',
        },
      ],
    },
  ];

// Loading skeleton para quando estiver carregando
function SidebarSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col gap-4 p-4 w-16"
    >
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.1 }}
          className="h-10 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-xl relative overflow-hidden"
        >
          <motion.div
            animate={{ x: ['-100%', '100%'] }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity, 
              ease: "linear",
              delay: i * 0.2
            }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-gray-500/20 to-transparent"
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

// Componente helper para conteúdo do item
function ItemContent({
  item,
  isItemActive,
  isHovered,
}: {
  item: SidebarItem;
  isItemActive: boolean;
  isHovered: boolean;
}) {
  return (
    <>
      <motion.div
        whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="relative"
      >
        <item.icon
          className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ${
            isItemActive
              ? 'text-blue-600 dark:text-blue-400 drop-shadow-sm'
              : item.color || 'text-gray-500 dark:text-gray-400'
          }`}
        />
        {isItemActive && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.6 }}
            className="absolute inset-0 bg-blue-400 dark:bg-blue-500 rounded-full blur-md -z-10"
          />
        )}
      </motion.div>
      
      <AnimatePresence>
        {isHovered && (
          <motion.span
            initial={{ opacity: 0, x: -20, width: 0 }}
            animate={{ opacity: 1, x: 0, width: 'auto' }}
            exit={{ opacity: 0, x: -20, width: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="ml-3 font-medium flex-1 overflow-hidden whitespace-nowrap"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {item.badge && isHovered && (
          <motion.span
            initial={{ opacity: 0, scale: 0, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0, x: 20 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="ml-auto bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full px-2 py-0.5 shadow-lg border border-red-400/20"
          >
            <motion.span
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [1, 0.8, 1]
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              {item.badge}
            </motion.span>
          </motion.span>
        )}
      </AnimatePresence>
    </>
  );
}

export function ModernSidebar() {
  // 1. Estados do componente
  const [isHovered, setIsHovered] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [manuallyToggledItems, setManuallyToggledItems] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // Controles de animação
  const sidebarControls = useAnimation();
  const backgroundControls = useAnimation();

  // 2. Hooks de contexto
  const pathname = usePathname();
  const { hasPermission, user, loading: userLoading } = usePermissions();
  const { badges } = useMenuBadges();

  // 3. Função helper para verificar permissões
  const hasAnyMappedPermission = useCallback((permissionKey: string) => {
    if (!permissionKey) return false;
    
    // Se o usuário tem permissão "todos", dar acesso a tudo
    if (hasPermission('todos')) {
      return true;
    }
    
    const mappedPermissions = PERMISSION_MAPPINGS[permissionKey] || [permissionKey];
    
    // Verifica cada permissão mapeada
    const permissionResults = mappedPermissions.map(perm => ({
      permission: perm,
      hasAccess: hasPermission(perm)
    }));
    
    const hasAccess = permissionResults.some(result => result.hasAccess);
    
    return hasAccess;
  }, [hasPermission]);

  // 4. Items do sidebar filtrados por permissão
  const sidebarItems = useMemo(() => {
    if (!user || userLoading) return [];

    const filterItemsByPermissions = (items: SidebarItem[]): SidebarItem[] => {
      return items.filter(item => {
        // Verifica permissão do item principal
        const hasMainPermission = hasAnyMappedPermission(item.permission || '');

        // Se tem subitems, filtra eles também
        if (item.subItems) {
          const filteredSubItems = item.subItems.filter(subItem => {
            const hasSubPermission = hasAnyMappedPermission(subItem.permission || '');
            return hasSubPermission;
          });

          // Mostra o pai se tem pelo menos um subitem visível OU se tem permissão principal
          if (filteredSubItems.length > 0 || hasMainPermission) {
            item.subItems = filteredSubItems;
            return true;
          }
        }

        return hasMainPermission;
      });
    };

    // Aplica badges
    const itemsWithBadges = defaultSidebarItems.map(item => ({
      ...item,
      badge: item.label === 'Home' && badges?.home > 0 ? badges.home : undefined,
    }));

    return filterItemsByPermissions(itemsWithBadges);
  }, [user, userLoading, hasAnyMappedPermission, badges]);

  // 5. Callbacks
  const toggleExpanded = useCallback((label: string) => {
    setExpandedItems(prev => {
      const newState = prev.includes(label)
        ? prev.filter(item => item !== label)
        : [...prev, label];
      return newState;
    });

    setManuallyToggledItems(prev =>
      prev.includes(label) ? prev : [...prev, label]
    );
  }, []);

  const isActive = useCallback((href: string) => {
    if (!pathname) return false;
    if (href === '/home') return pathname === '/home';
    return pathname.startsWith(href);
  }, [pathname]);

  const hasActiveSubItem = useCallback((subItems?: SubMenuItem[]) => {
    if (!subItems || !pathname) return false;
    return subItems.some(subItem => pathname.startsWith(subItem.href));
  }, [pathname]);

  const isExpanded = useCallback((label: string) => {
    if (manuallyToggledItems.includes(label)) {
      return expandedItems.includes(label);
    }

    if (isHovered) {
      const item = sidebarItems.find(item => item.label === label);
      if (item?.subItems && hasActiveSubItem(item.subItems)) {
      return true;
      }
    }

    return false;
  }, [manuallyToggledItems, expandedItems, isHovered, hasActiveSubItem, sidebarItems]);

  // 6. Effects
  useEffect(() => {
    if (pathname?.includes('/analitico/dre') && !expandedItems.includes('Analítico')) {
      setExpandedItems(prev => [...prev, 'Analítico']);
    }
  }, [pathname, expandedItems]);

  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // 7. Handlers de mouse
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    sidebarControls.start({ width: 256 });
    backgroundControls.start({ opacity: 1 });
  }, [sidebarControls, backgroundControls]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    sidebarControls.start({ width: 56 });
    backgroundControls.start({ opacity: 0 });
    setTimeout(() => setManuallyToggledItems([]), 3000);
  }, [sidebarControls, backgroundControls]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  // 8. Loading and error states - DEPOIS de todos os hooks
  const isLoading = userLoading || !isInitialized;
  if (isLoading) {
    return <SidebarSkeleton />;
  }

  if (!user) {
    return null;
  }

  // 9. Render principal
  return (
    <motion.aside
      initial={{ width: 56, opacity: 0 }}
      animate={{ 
        width: isHovered ? 256 : 56,
        opacity: 1
      }}
      transition={{ 
        duration: 0.4, 
        ease: [0.4, 0, 0.2, 1],
        opacity: { duration: 0.2 }
      }}
      className="hidden md:flex flex-col flex-shrink-0 h-full relative overflow-hidden"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {/* Background com gradiente animado */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={backgroundControls}
        className="absolute inset-0 bg-gradient-to-br from-white via-gray-50/50 to-blue-50/30 dark:from-gray-900 dark:via-gray-800/50 dark:to-blue-900/10"
      />
      
      {/* Efeito de mouse seguidor */}
      <motion.div
        animate={{
          x: mousePosition.x - 50,
          y: mousePosition.y - 50,
        }}
        transition={{ type: "spring", damping: 30, stiffness: 200 }}
        className="absolute w-24 h-24 bg-gradient-to-r from-blue-400/10 to-purple-400/10 dark:from-blue-500/10 dark:to-purple-500/10 rounded-full blur-xl pointer-events-none"
        style={{ opacity: isHovered ? 0.6 : 0 }}
      />
      
      {/* Border animado */}
      <motion.div
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gray-200 to-transparent dark:via-gray-700"
        style={{ transformOrigin: 'top' }}
      />
      
      <div className="relative z-10 flex flex-col h-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
      <div className="flex flex-col h-full pt-2 pb-2">
        {/* Navigation items */}
        <nav className="flex-1 px-2 overflow-hidden">
          <motion.div 
            className="space-y-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, staggerChildren: 0.05 }}
          >
            {sidebarItems.map((item, index) => {
              const isItemActive = item.href
                ? isActive(item.href)
                : hasActiveSubItem(item.subItems);
              const itemExpanded = isExpanded(item.label);

              return (
                <motion.div 
                  key={item.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + (index * 0.05) }}
                >
                  {/* Item principal */}
                  <motion.div
                    whileHover={{ 
                      scale: 1.02,
                      x: isHovered ? 4 : 0,
                      transition: { duration: 0.2 }
                    }}
                    whileTap={{ scale: 0.98 }}
                    className={`group flex items-center h-10 px-3 transition-all duration-300 rounded-xl relative cursor-pointer overflow-hidden
                      ${ isHovered ? 'justify-start' : 'justify-center'}
                      ${ isItemActive
                          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/20 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200/50 dark:border-blue-700/30'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100/50 dark:hover:from-gray-800 dark:hover:to-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100 hover:shadow-sm'
                      }
                   `}
                  >
                    {/* Indicador ativo animado */}
                    {isItemActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-r-full"
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.3 }}
                      />
                    )}
                    
                    {/* Shimmer effect no hover */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                      initial={{ x: '-100%', opacity: 0 }}
                      whileHover={{ 
                        x: '100%', 
                        opacity: 1,
                        transition: { duration: 0.6, ease: "easeInOut" }
                      }}
                    />
                    {/* Link wrapper */}
                    {item.href ? (
                      <Link href={item.href} className="flex items-center flex-1">
                        <ItemContent
                          item={item}
                          isItemActive={isItemActive}
                          isHovered={isHovered}
                        />
                      </Link>
                    ) : (
                      <ItemContent
                        item={item}
                        isItemActive={isItemActive}
                        isHovered={isHovered}
                      />
                    )}

                    {/* Botão expand/collapse */}
                    <AnimatePresence>
                      {item.subItems && item.subItems.length > 0 && isHovered && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0 }}
                          whileHover={{ 
                            scale: 1.1,
                            backgroundColor: 'rgba(0,0,0,0.05)'
                          }}
                          whileTap={{ scale: 0.9 }}
                          onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleExpanded(item.label);
                          }}
                          className="ml-2 p-1.5 rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-all duration-200 relative overflow-hidden"
                        >
                          <motion.div
                            animate={{ rotate: itemExpanded ? 90 : 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                          >
                            <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          </motion.div>
                          
                          {/* Ripple effect */}
                          <motion.div
                            className="absolute inset-0 bg-blue-400/20 rounded-lg"
                            initial={{ scale: 0, opacity: 0 }}
                            whileTap={{ 
                              scale: 1.5, 
                              opacity: [0, 1, 0],
                              transition: { duration: 0.3 }
                            }}
                          />
                        </motion.button>
                      )}
                    </AnimatePresence>

                    {/* Tooltip modernizado */}
                    <AnimatePresence>
                      {!isHovered && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8, x: -10 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.8, x: -10 }}
                          transition={{ duration: 0.2 }}
                          className="absolute left-full ml-3 px-3 py-2 bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-700 dark:to-gray-600 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-gray-700/50"
                        >
                          {item.label}
                          <motion.div
                            className="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.1 }}
                          />
                          
                          {/* Glow effect */}
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg blur-sm -z-10" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Sub-items */}
                  <AnimatePresence>
                    {item.subItems && item.subItems.length > 0 && isHovered && itemExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -10 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -10 }}
                        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        className="ml-6 mt-2 space-y-1 overflow-hidden"
                      >
                        {item.subItems.map((subItem, subIndex) => {
                          const isSubActive = isActive(subItem.href);

                          return (
                            <motion.div
                              key={subItem.href}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: subIndex * 0.05 }}
                            >
                              <Link
                                href={subItem.href}
                                className={`group flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 text-sm relative overflow-hidden ${
                                  isSubActive
                                    ? 'bg-gradient-to-r from-blue-100 to-indigo-100/50 dark:from-blue-900/50 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200/30 dark:border-blue-700/20'
                                    : 'text-gray-500 dark:text-gray-500 hover:bg-gradient-to-r hover:from-gray-100/80 hover:to-gray-50 dark:hover:from-gray-700/50 dark:hover:to-gray-800/30 hover:text-gray-700 dark:hover:text-gray-300 hover:shadow-sm'
                                }`}
                              >
                                {/* Indicador ativo para subitem */}
                                {isSubActive && (
                                  <motion.div
                                    layoutId="activeSubIndicator"
                                    className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-r-full"
                                    initial={{ scaleY: 0 }}
                                    animate={{ scaleY: 1 }}
                                    transition={{ duration: 0.2 }}
                                  />
                                )}
                                
                                <motion.div
                                  whileHover={{ scale: 1.05, rotate: [0, -2, 2, 0] }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <subItem.icon className="w-4 h-4 flex-shrink-0" />
                                </motion.div>
                                
                                <span className="ml-3 font-medium">
                                  {subItem.label}
                                </span>
                                
                                {subItem.description && (
                                  <motion.div
                                    initial={{ opacity: 0 }}
                                    whileHover={{ opacity: 1 }}
                                    className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md pointer-events-none whitespace-nowrap z-50 shadow-lg"
                                  >
                                    {subItem.description}
                                  </motion.div>
                                )}
                                
                                <AnimatePresence>
                                  {subItem.badge && (
                                    <motion.span
                                      initial={{ opacity: 0, scale: 0 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0 }}
                                      whileHover={{ scale: 1.1 }}
                                      className="ml-auto bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full px-2 py-0.5 shadow-sm"
                                    >
                                      {subItem.badge}
                                    </motion.span>
                                  )}
                                </AnimatePresence>
                                
                                {/* Shimmer effect */}
                                <motion.div
                                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                                  initial={{ x: '-100%' }}
                                  whileHover={{ 
                                    x: '100%',
                                    transition: { duration: 0.5 }
                                  }}
                                />
                              </Link>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        </nav>

        {/* Footer */}
        <motion.div 
          className="px-2 pt-4 border-t border-gray-100/50 dark:border-gray-800/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div
            className={`flex items-center transition-all duration-300 ${
              isHovered ? 'justify-between px-3' : 'justify-center'
            }`}
          >
            <div className="flex items-center">
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  boxShadow: [
                    '0 0 0 0 rgba(34, 197, 94, 0.4)',
                    '0 0 0 4px rgba(34, 197, 94, 0.1)',
                    '0 0 0 0 rgba(34, 197, 94, 0.4)'
                  ]
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-2 h-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-500"
              />
              <AnimatePresence>
                {isHovered && (
                  <motion.span
                    initial={{ opacity: 0, x: -10, width: 0 }}
                    animate={{ opacity: 1, x: 0, width: 'auto' }}
                    exit={{ opacity: 0, x: -10, width: 0 }}
                    transition={{ duration: 0.3 }}
                    className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-medium"
                  >
                    Sistema Online
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="flex items-center space-x-2"
                >
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                    Zykor
                  </span>
                  <motion.span
                    animate={{ 
                      color: ['#6b7280', '#3b82f6', '#6b7280'],
                    }}
                    transition={{ 
                      duration: 3, 
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="text-xs font-bold"
                  >
                    v2.0
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
      </div>
    </motion.aside>
  );
}