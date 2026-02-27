'use client';

import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { useUser } from '@/contexts/UserContext';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3,
  Settings,
  ArrowRight,
  Activity,
  PieChart,
  Wrench,
  MessageSquare,
  CreditCard,
  Package,
  AlertCircle,
  Star
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

// Otimização: AgenteDashboard carregado sob demanda (contém lógica pesada)
const AgenteDashboard = dynamic(
  () => import('@/components/dashboard/AgenteDashboard'),
  { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" /> }
);



interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badge?: string;
  // Permissões necessárias para ver este card (qualquer uma delas)
  permissions: string[];
}

// Todos os módulos disponíveis
const allQuickActions: QuickAction[] = [
  {
    title: 'Visão Geral Estratégica',
    description: 'Dashboard executivo com todos os indicadores',
    href: '/estrategico/visao-geral',
    icon: BarChart3,
    color: 'from-blue-500 to-blue-600',
    badge: 'Principal',
    permissions: ['todos', 'relatorios_visao_geral']
  },
  {
    title: 'Desempenho',
    description: 'Análise semanal e mensal dos resultados',
    href: '/estrategico/desempenho',
    icon: Activity,
    color: 'from-green-500 to-green-600',
    permissions: ['todos', 'gestao_desempenho']
  },
  {
    title: 'Agente IA',
    description: 'Chat inteligente e insights automáticos',
    href: '/ferramentas/agente',
    icon: MessageSquare,
    color: 'from-purple-500 to-pink-500',
    badge: 'Novo',
    permissions: ['todos', 'ferramentas'] // Agente IA faz parte de ferramentas
  },
  {
    title: 'Analítico',
    description: 'Clientes e eventos',
    href: '/analitico',
    icon: PieChart,
    color: 'from-violet-500 to-purple-600',
    permissions: ['todos', 'relatorios_eventos', 'relatorios_clientes', 'relatorios_clientes_ativos', 'gestao_crm']
  },
  {
    title: 'Extras',
    description: 'Retrospectiva, tempo de estadia e mais',
    href: '/extras',
    icon: Star,
    color: 'from-yellow-500 to-amber-500',
    permissions: ['todos']
  },
  {
    title: 'Ferramentas',
    description: 'Produção, estoque, CMV, CMO e mais',
    href: '/ferramentas',
    icon: Wrench,
    color: 'from-amber-500 to-orange-500',
    permissions: ['todos', 'ferramentas', 'operacoes', 'operacoes_contagem_estoque', 'operacoes_contagem_rapida', 'gestao_calendario', 'financeiro_agendamento', 'gestao_stockout']
  },
  {
    title: 'Agendamento',
    description: 'Agendar e gerenciar pagamentos PIX',
    href: '/ferramentas/agendamento',
    icon: CreditCard,
    color: 'from-emerald-500 to-teal-600',
    permissions: ['todos', 'ferramentas', 'financeiro_agendamento']
  },
  {
    title: 'Stockout',
    description: 'Gerenciar produtos em falta',
    href: '/ferramentas/stockout',
    icon: Package,
    color: 'from-red-500 to-rose-600',
    permissions: ['todos', 'ferramentas', 'gestao_stockout']
  },
  {
    title: 'Configurações',
    description: 'Ajustes e configurações do sistema',
    href: '/configuracoes',
    icon: Settings,
    color: 'from-gray-500 to-gray-600',
    permissions: ['todos', 'configuracoes_usuarios', 'configuracoes_fichas_tecnicas', 'configuracoes_checklists', 'configuracoes_metas']
  }
];

export default function HomePage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const { user } = useUser();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setPageTitle('🏠 Dashboard');
    setIsLoaded(true);
  }, [setPageTitle]);

  // Filtrar ações baseado nas permissões do usuário
  const quickActions = useMemo(() => {
    if (!user) return [];
    
    // Se é admin, mostrar tudo
    if (user.role === 'admin') {
      return allQuickActions;
    }
    
    // Obter permissões do usuário
    let userPermissions: string[] = [];
    if (Array.isArray(user.modulos_permitidos)) {
      userPermissions = user.modulos_permitidos;
    } else if (typeof user.modulos_permitidos === 'object' && user.modulos_permitidos) {
      userPermissions = Object.keys(user.modulos_permitidos).filter(
        key => user.modulos_permitidos[key] === true
      );
    }
    
    // Se tem permissão 'todos', mostrar tudo
    if (userPermissions.includes('todos')) {
      return allQuickActions;
    }
    
    // Filtrar cards que o usuário tem permissão
    return allQuickActions.filter(action => {
      return action.permissions.some(perm => userPermissions.includes(perm));
    });
  }, [user]);

  const currentTime = new Date().toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const currentDate = new Date().toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="h-full px-4 sm:px-6 py-4 sm:py-8 flex flex-col max-w-none">
        {/* Header - Apenas hora e data */}
        <motion.div 
          className="mb-8 flex-shrink-0"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : -20 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-end">
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {currentTime}
              </div>
              <div className="text-gray-600 dark:text-gray-400 text-sm capitalize">
                {currentDate}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Agente Dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mb-6"
        >
          <AgenteDashboard />
        </motion.div>

        {/* Main Content - Grid Full Width */}
        <motion.div 
          className="flex-1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {quickActions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16">
              <div className="p-4 bg-amber-100 dark:bg-amber-900/30 rounded-full mb-4">
                <AlertCircle className="w-12 h-12 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Nenhum módulo disponível
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
                Você ainda não tem permissões atribuídas. Entre em contato com um administrador para liberar seu acesso aos módulos do sistema.
              </p>
            </div>
          ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6 h-full">
            {quickActions.map((action, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 * index }}
                className="group"
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link href={action.href}>
                  <div className="relative h-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-8 cursor-pointer transition-all duration-300 hover:shadow-xl dark:hover:shadow-2xl hover:shadow-blue-500/10 dark:hover:shadow-blue-500/20 hover:border-blue-300 dark:hover:border-blue-600 overflow-hidden min-h-[140px] sm:min-h-[240px]">
                    
                    {/* Badge */}
                    {action.badge && (
                      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10">
                        <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-[10px] sm:text-xs font-semibold px-2 py-0.5 sm:px-3 sm:py-1 shadow-lg">
                          {action.badge}
                        </Badge>
                      </div>
                    )}
                    
                    {/* Content */}
                    <div className="relative flex flex-col items-center h-full justify-center text-center">
                      {/* Icon */}
                      <div className="relative mb-3 sm:mb-6">
                        <div className={`w-12 h-12 sm:w-20 sm:h-20 bg-gradient-to-br ${action.color} rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-all duration-300`}>
                          <action.icon className="w-6 h-6 sm:w-10 sm:h-10 text-white" />
                        </div>
                      </div>
                      
                      {/* Title */}
                      <h3 className="text-sm sm:text-xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-3 leading-tight">
                        {action.title}
                      </h3>
                      
                      {/* Description - Hidden on mobile */}
                      <p className="hidden sm:block text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                        {action.description}
                      </p>
                      
                      {/* Action button */}
                      <div className="mt-auto flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-xs sm:text-sm group-hover:gap-2 transition-all duration-300">
                        <span className="hidden sm:inline">Acessar</span>
                        <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform duration-300" />
                      </div>
                    </div>
                    
                    {/* Gradient overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl sm:rounded-2xl"></div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
          )}
        </motion.div>

      </div>
    </div>
  );
}