'use client';

import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { useUser } from '@/contexts/UserContext';
import { userHasAnyModule } from '@/lib/permissions/resolver';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
// IMPORTANTE: As permissões devem bater com os IDs gerados em /lib/menu-config.ts
// Padrão: {categoria}_{nome_slug} (ex: estrategico_visao_geral, ferramentas_crm)
// Fallbacks genéricos: gestao, ferramentas, operacoes, relatorios, home, configuracoes, analitico, estrategico
const allQuickActions: QuickAction[] = [
  {
    title: 'Visão Geral Estratégica',
    description: 'Dashboard executivo com todos os indicadores',
    href: '/estrategico/visao-geral',
    icon: BarChart3,
    color: 'from-blue-500 to-blue-600',
    badge: 'Principal',
    permissions: ['todos', 'estrategico_visao_geral', 'estrategico', 'gestao', 'home', 'dashboard']
  },
  {
    title: 'Desempenho',
    description: 'Análise semanal e mensal dos resultados',
    href: '/estrategico/desempenho',
    icon: Activity,
    color: 'from-green-500 to-green-600',
    permissions: ['todos', 'estrategico_desempenho', 'estrategico', 'gestao', 'desempenho', 'home']
  },
  {
    title: 'Agente IA',
    description: 'Chat inteligente e insights automáticos',
    href: '/ferramentas/agente',
    icon: MessageSquare,
    color: 'from-purple-500 to-pink-500',
    badge: 'Novo',
    permissions: ['todos', 'ferramentas', 'operacoes', 'home']
  },
  {
    title: 'Analítico',
    description: 'Clientes e eventos',
    href: '/analitico',
    icon: PieChart,
    color: 'from-violet-500 to-purple-600',
    permissions: ['todos', 'analitico_clientes', 'analitico_eventos', 'analitico', 'relatorios', 'home']
  },
  {
    title: 'Extras',
    description: 'Retrospectiva, tempo de estadia e mais',
    href: '/extras',
    icon: Star,
    color: 'from-yellow-500 to-amber-500',
    permissions: ['todos', 'extras', 'home', 'relatorios']
  },
  {
    title: 'Ferramentas',
    description: 'Produção, estoque, CMV, CMO e mais',
    href: '/ferramentas',
    icon: Wrench,
    color: 'from-amber-500 to-orange-500',
    permissions: ['todos', 'ferramentas', 'operacoes', 'ferramentas_crm', 'ferramentas_cmv_semanal', 'ferramentas_cmo_mao_de_obra', 'ferramentas_stockout', 'home']
  },
  {
    title: 'Agendamento',
    description: 'Agendar e gerenciar pagamentos PIX',
    href: '/ferramentas/agendamento',
    icon: CreditCard,
    color: 'from-emerald-500 to-teal-600',
    permissions: ['todos', 'ferramentas_agendamento', 'financeiro_agendamento', 'ferramentas', 'operacoes', 'financeiro']
  },
  {
    title: 'Stockout',
    description: 'Gerenciar produtos em falta',
    href: '/ferramentas/stockout',
    icon: Package,
    color: 'from-red-500 to-rose-600',
    permissions: ['todos', 'ferramentas_stockout', 'gestao_stockout', 'ferramentas', 'operacoes']
  },
  {
    title: 'Configurações',
    description: 'Ajustes e configurações do sistema',
    href: '/configuracoes',
    icon: Settings,
    color: 'from-gray-500 to-gray-600',
    permissions: ['todos', 'configuracoes_administracao', 'configuracoes_metas', 'configuracoes']
  }
];

export default function HomePage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const { user, loading: userLoading } = useUser();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setPageTitle('🏠 Dashboard');
    setIsLoaded(true);
  }, [setPageTitle]);

  // Filtrar ações baseado nas permissões do usuário.
  // Usa o resolver único (@/lib/permissions/resolver) — mesma lógica de
  // alias/generic/'todos' do sidebar e dos route guards.
  const quickActions = useMemo(() => {
    if (!user) return [];

    // Admin sem permissões específicas = acesso total
    const modulos = user.modulos_permitidos;
    const isAdminFull =
      user.role === 'admin' &&
      !(Array.isArray(modulos) ? modulos.length > 0 : modulos && Object.values(modulos).some(Boolean));
    if (isAdminFull) {
      return allQuickActions;
    }

    return allQuickActions.filter(action => userHasAnyModule(modulos, action.permissions));
  }, [user]);

  // Tempo/data calculados em state + useEffect pra evitar hydration mismatch
  // (server vs client locale + timezone podem divergir).
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      setCurrentDate(now.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };
    tick();
    const id = setInterval(tick, 60_000); // atualiza a cada minuto
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="h-full px-4 sm:px-6 py-4 sm:py-8 flex flex-col max-w-none">
        {/* Header - Apenas hora e data */}
        <div className={cn("mb-8 flex-shrink-0 transition-all duration-500", isLoaded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-5")}>
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
        </div>

        {/* Agente Dashboard */}
        <div className={cn("mb-6 transition-all duration-500 delay-150", isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5")}>
          <AgenteDashboard />
        </div>

        {/* Main Content - Grid Full Width */}
        <div className={cn("flex-1 transition-all duration-500 delay-300", isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5")}>
          {userLoading || !user ? (
            <div className="flex flex-col items-center justify-center h-full py-16">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Carregando seus módulos...</p>
            </div>
          ) : quickActions.length === 0 ? (
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
              <div
                key={index}
                className="group animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <Link href={action.href}>
                  <div className="relative h-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-8 cursor-pointer transition-all duration-300 hover:shadow-xl dark:hover:shadow-2xl hover:shadow-blue-500/10 dark:hover:shadow-blue-500/20 hover:border-blue-300 dark:hover:border-blue-600 hover:-translate-y-1 active:scale-95 overflow-hidden min-h-[140px] sm:min-h-[240px]">
                    
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
                      <div className="mt-auto flex items-center justify-center text-[hsl(var(--primary))] font-semibold text-xs sm:text-sm group-hover:gap-2 transition-all">
                        <span className="hidden sm:inline">Acessar</span>
                        <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                    
                    {/* Gradient overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl sm:rounded-2xl"></div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
          )}
        </div>

      </div>
    </div>
  );
}