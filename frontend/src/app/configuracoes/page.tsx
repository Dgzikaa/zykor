'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Settings,
  Database,
  Shield,
  MessageSquare,
  Users,
  Bell,
  Key,
  UserCog,
  Search,
  BarChart3,
  CheckCircle,
  Calendar,
  ClipboardList,
  FileText,
  History,
  Target,
  Lock,
  Eye,
  TestTube,
  Clock,
  Webhook,
  Globe,
  RefreshCcw,
  ChefHat,
} from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/layouts/PageHeader';

interface ConfigStats {
  usuarios: number;
  integracoes: number;
  alertas: number;
}

interface ConfigItem {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  badge: string;
  badgeColor: string;
  iconBgColor: string;
  iconTextColor: string;
  buttonBgColor: string;
  buttonBorderColor: string;
  buttonTextColor: string;
  features?: string;
  category: 'principal' | 'integracao' | 'admin' | 'dev';
}

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [stats, setStats] = useState<ConfigStats>({
    usuarios: 0,
    integracoes: 5,
    alertas: 3,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Carregar estatísticas reais
  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        
        // Buscar contagem real de usuários
        const usuariosResponse = await fetch('/api/configuracoes/usuarios');
        if (usuariosResponse.ok) {
          const usuariosData = await usuariosResponse.json();
          setStats(prev => ({
            ...prev,
            usuarios: usuariosData.usuarios?.length || 0,
          }));
        }
      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const configuracoes: ConfigItem[] = [
    // === PRINCIPAL ===
    {
      title: 'Usuários',
      description: 'Gerencie usuários e suas informações no sistema',
      icon: Users,
      href: '/configuracoes/usuarios',
      badge: 'Ativo',
      badgeColor: 'border-[hsl(var(--border))] text-[hsl(var(--foreground))]',
      iconBgColor: 'bg-[hsl(var(--muted))]',
      iconTextColor: 'text-[hsl(var(--foreground))]',
      buttonBgColor: 'bg-[hsl(var(--muted))]',
      buttonBorderColor: 'border-[hsl(var(--border))]',
      buttonTextColor: 'text-[hsl(var(--foreground))]',
      features: 'Cadastro • Edição • Permissões',
      category: 'principal'
    },
    {
      title: 'Permissões',
      description: 'Configure níveis de acesso e permissões do sistema',
      icon: Lock,
      href: '/configuracoes/permissoes',
      badge: 'Admin',
      badgeColor: 'border-[hsl(var(--border))] text-[hsl(var(--foreground))]',
      iconBgColor: 'bg-[hsl(var(--muted))]',
      iconTextColor: 'text-[hsl(var(--foreground))]',
      buttonBgColor: 'bg-[hsl(var(--muted))]',
      buttonBorderColor: 'border-[hsl(var(--border))]',
      buttonTextColor: 'text-[hsl(var(--foreground))]',
      features: 'Roles • Módulos • Acessos',
      category: 'principal'
    },
    {
      title: 'Segurança',
      description: 'Configure segurança e proteções do sistema',
      icon: Shield,
      href: '/configuracoes/seguranca',
      badge: 'Crítico',
      badgeColor: 'border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
      iconBgColor: 'bg-red-50 dark:bg-red-950',
      iconTextColor: 'text-red-600 dark:text-red-400',
      buttonBgColor: 'bg-red-50 dark:bg-red-950',
      buttonBorderColor: 'border-red-200 dark:border-red-800',
      buttonTextColor: 'text-red-600 dark:text-red-400',
      features: 'Autenticação • Proteção',
      category: 'principal'
    },
    {
      title: 'Privacidade',
      description: 'Configurações de privacidade e dados pessoais',
      icon: Eye,
      href: '/configuracoes/privacidade',
      badge: 'Ativo',
      badgeColor: 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300',
      iconBgColor: 'bg-slate-100 dark:bg-slate-900/30',
      iconTextColor: 'text-slate-600 dark:text-slate-400',
      buttonBgColor: 'bg-slate-500/10 dark:bg-slate-900/20',
      buttonBorderColor: 'border-slate-500 dark:border-slate-700',
      buttonTextColor: 'text-slate-600 dark:text-slate-400',
      features: 'LGPD • Dados • Consentimento',
      category: 'principal'
    },
    {
      title: 'Notificações',
      description: 'Configure alertas e notificações do sistema',
      icon: Bell,
      href: '/configuracoes/notifications',
      badge: 'Ativo',
      badgeColor: 'border-orange-200 text-orange-700 dark:border-orange-700 dark:text-orange-300',
      iconBgColor: 'bg-orange-100 dark:bg-orange-900/30',
      iconTextColor: 'text-orange-600 dark:text-orange-400',
      buttonBgColor: 'bg-orange-500/10 dark:bg-orange-900/20',
      buttonBorderColor: 'border-orange-500 dark:border-orange-700',
      buttonTextColor: 'text-orange-600 dark:text-orange-400',
      features: 'Email • Discord • WhatsApp • Push',
      category: 'principal'
    },
    {
      title: 'Metas',
      description: 'Configure metas e objetivos do negócio',
      icon: Target,
      href: '/configuracoes/metas',
      badge: 'Ativo',
      badgeColor: 'border-emerald-200 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300',
      iconBgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconTextColor: 'text-emerald-600 dark:text-emerald-400',
      buttonBgColor: 'bg-emerald-500/10 dark:bg-emerald-900/20',
      buttonBorderColor: 'border-emerald-500 dark:border-emerald-700',
      buttonTextColor: 'text-emerald-600 dark:text-emerald-400',
      features: 'Faturamento • CMV • Indicadores',
      category: 'principal'
    },
    {
      title: 'Checklists',
      description: 'Configure templates de checklists operacionais',
      icon: ClipboardList,
      href: '/configuracoes/checklists',
      badge: 'Ativo',
      badgeColor: 'border-teal-200 text-teal-700 dark:border-teal-700 dark:text-teal-300',
      iconBgColor: 'bg-teal-100 dark:bg-teal-900/30',
      iconTextColor: 'text-teal-600 dark:text-teal-400',
      buttonBgColor: 'bg-teal-500/10 dark:bg-teal-900/20',
      buttonBorderColor: 'border-teal-500 dark:border-teal-700',
      buttonTextColor: 'text-teal-600 dark:text-teal-400',
      features: 'Templates • Tarefas • Operacional',
      category: 'principal'
    },
    {
      title: 'Fichas Técnicas',
      description: 'Gerencie fichas técnicas de produtos',
      icon: ChefHat,
      href: '/configuracoes/fichas-tecnicas',
      badge: 'Ativo',
      badgeColor: 'border-amber-200 text-amber-700 dark:border-amber-700 dark:text-amber-300',
      iconBgColor: 'bg-amber-100 dark:bg-amber-900/30',
      iconTextColor: 'text-amber-600 dark:text-amber-400',
      buttonBgColor: 'bg-amber-500/10 dark:bg-amber-900/20',
      buttonBorderColor: 'border-amber-500 dark:border-amber-700',
      buttonTextColor: 'text-amber-600 dark:text-amber-400',
      features: 'Receitas • Insumos • Custo',
      category: 'principal'
    },
    {
      title: 'Calendário Operacional',
      description: 'Configure calendário e eventos operacionais',
      icon: Calendar,
      href: '/configuracoes/calendario-operacional',
      badge: 'Ativo',
      badgeColor: 'border-indigo-200 text-indigo-700 dark:border-indigo-700 dark:text-indigo-300',
      iconBgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
      iconTextColor: 'text-indigo-600 dark:text-indigo-400',
      buttonBgColor: 'bg-indigo-500/10 dark:bg-indigo-900/20',
      buttonBorderColor: 'border-indigo-500 dark:border-indigo-700',
      buttonTextColor: 'text-indigo-600 dark:text-indigo-400',
      features: 'Eventos • Analytics • Histórico',
      category: 'principal'
    },

    // === INTEGRAÇÕES ===
    {
      title: 'Integrações',
      description: 'Configure integrações com sistemas externos',
      icon: Database,
      href: '/configuracoes/integracoes',
      badge: `${stats.integracoes} Ativas`,
      badgeColor: 'border-violet-200 text-violet-700 dark:border-violet-700 dark:text-violet-300',
      iconBgColor: 'bg-violet-100 dark:bg-violet-900/30',
      iconTextColor: 'text-violet-600 dark:text-violet-400',
      buttonBgColor: 'bg-violet-500/10 dark:bg-violet-900/20',
      buttonBorderColor: 'border-violet-500 dark:border-violet-700',
      buttonTextColor: 'text-violet-600 dark:text-violet-400',
      features: 'ContaHub • ContaAzul • Discord',
      category: 'integracao'
    },
    {
      title: 'WhatsApp',
      description: 'Configure integração com WhatsApp Business',
      icon: MessageSquare,
      href: '/configuracoes/whatsapp',
      badge: 'Conectado',
      badgeColor: 'border-green-200 text-green-700 dark:border-green-700 dark:text-green-300',
      iconBgColor: 'bg-green-100 dark:bg-green-900/30',
      iconTextColor: 'text-green-600 dark:text-green-400',
      buttonBgColor: 'bg-green-500/10 dark:bg-green-900/20',
      buttonBorderColor: 'border-green-500 dark:border-green-700',
      buttonTextColor: 'text-green-600 dark:text-green-400',
      features: 'Mensagens • Automações',
      category: 'integracao'
    },
    {
      title: 'Webhooks',
      description: 'Configure webhooks para integrações externas',
      icon: Webhook,
      href: '/configuracoes/webhooks',
      badge: 'Ativo',
      badgeColor: 'border-cyan-200 text-cyan-700 dark:border-cyan-700 dark:text-cyan-300',
      iconBgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
      iconTextColor: 'text-cyan-600 dark:text-cyan-400',
      buttonBgColor: 'bg-cyan-500/10 dark:bg-cyan-900/20',
      buttonBorderColor: 'border-cyan-500 dark:border-cyan-700',
      buttonTextColor: 'text-cyan-600 dark:text-cyan-400',
      features: 'Endpoints • Callbacks • Eventos',
      category: 'integracao'
    },
    {
      title: 'Qualidade ContaHub',
      description: 'Monitore a integridade e precisão dos dados do ContaHub',
      icon: BarChart3,
      href: '/configuracoes/qualidade-contahub',
      badge: '99.7% Precisão',
      badgeColor: 'border-emerald-200 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300',
      iconBgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconTextColor: 'text-emerald-600 dark:text-emerald-400',
      buttonBgColor: 'bg-emerald-500/10 dark:bg-emerald-900/20',
      buttonBorderColor: 'border-emerald-500 dark:border-emerald-700',
      buttonTextColor: 'text-emerald-600 dark:text-emerald-400',
      features: 'Validação • Alertas • Relatórios',
      category: 'integracao'
    },
    {
      title: 'ContaHub Raw',
      description: 'Visualize dados brutos do ContaHub',
      icon: FileText,
      href: '/configuracoes/contahub-raw',
      badge: 'Debug',
      badgeColor: 'border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300',
      iconBgColor: 'bg-gray-100 dark:bg-gray-900/30',
      iconTextColor: 'text-gray-600 dark:text-gray-400',
      buttonBgColor: 'bg-gray-500/10 dark:bg-gray-900/20',
      buttonBorderColor: 'border-gray-500 dark:border-gray-700',
      buttonTextColor: 'text-gray-600 dark:text-gray-400',
      features: 'Dados Raw • Debug • Análise',
      category: 'integracao'
    },
    {
      title: 'ContaHub Retroativo',
      description: 'Importe dados históricos do ContaHub',
      icon: RefreshCcw,
      href: '/configuracoes/contahub-retroativo',
      badge: 'Admin',
      badgeColor: 'border-rose-200 text-rose-700 dark:border-rose-700 dark:text-rose-300',
      iconBgColor: 'bg-rose-100 dark:bg-rose-900/30',
      iconTextColor: 'text-rose-600 dark:text-rose-400',
      buttonBgColor: 'bg-rose-500/10 dark:bg-rose-900/20',
      buttonBorderColor: 'border-rose-500 dark:border-rose-700',
      buttonTextColor: 'text-rose-600 dark:text-rose-400',
      features: 'Importação • Histórico • Sync',
      category: 'integracao'
    },
    {
      title: 'Importação de Histórico',
      description: 'Importe dados históricos de outros sistemas',
      icon: History,
      href: '/configuracoes/importacao-historico',
      badge: 'Admin',
      badgeColor: 'border-yellow-200 text-yellow-700 dark:border-yellow-700 dark:text-yellow-300',
      iconBgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      iconTextColor: 'text-yellow-600 dark:text-yellow-400',
      buttonBgColor: 'bg-yellow-500/10 dark:bg-yellow-900/20',
      buttonBorderColor: 'border-yellow-500 dark:border-yellow-700',
      buttonTextColor: 'text-yellow-600 dark:text-yellow-400',
      features: 'CSV • JSON • Migrações',
      category: 'integracao'
    },

    // === ADMIN/DEV ===
    {
      title: 'Configuração Geral',
      description: 'Configurações gerais do sistema',
      icon: Settings,
      href: '/configuracoes/configuracao',
      badge: 'Sistema',
      badgeColor: 'border-neutral-200 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300',
      iconBgColor: 'bg-neutral-100 dark:bg-neutral-900/30',
      iconTextColor: 'text-neutral-600 dark:text-neutral-400',
      buttonBgColor: 'bg-neutral-500/10 dark:bg-neutral-900/20',
      buttonBorderColor: 'border-neutral-500 dark:border-neutral-700',
      buttonTextColor: 'text-neutral-600 dark:text-neutral-400',
      features: 'Geral • Sistema • Preferências',
      category: 'admin'
    },
    {
      title: 'Teste de Produção',
      description: 'Teste funcionalidades em ambiente de produção',
      icon: TestTube,
      href: '/configuracoes/teste-producao',
      badge: 'Dev',
      badgeColor: 'border-pink-200 text-pink-700 dark:border-pink-700 dark:text-pink-300',
      iconBgColor: 'bg-pink-100 dark:bg-pink-900/30',
      iconTextColor: 'text-pink-600 dark:text-pink-400',
      buttonBgColor: 'bg-pink-500/10 dark:bg-pink-900/20',
      buttonBorderColor: 'border-pink-500 dark:border-pink-700',
      buttonTextColor: 'text-pink-600 dark:text-pink-400',
      features: 'Testes • Validação • QA',
      category: 'dev'
    },
    {
      title: 'Debug Timezone',
      description: 'Depuração de problemas com timezone',
      icon: Clock,
      href: '/configuracoes/timezone-debug',
      badge: 'Debug',
      badgeColor: 'border-stone-200 text-stone-700 dark:border-stone-700 dark:text-stone-300',
      iconBgColor: 'bg-stone-100 dark:bg-stone-900/30',
      iconTextColor: 'text-stone-600 dark:text-stone-400',
      buttonBgColor: 'bg-stone-500/10 dark:bg-stone-900/20',
      buttonBorderColor: 'border-stone-500 dark:border-stone-700',
      buttonTextColor: 'text-stone-600 dark:text-stone-400',
      features: 'Timezone • Horários • Debug',
      category: 'dev'
    },
  ];

  const filteredConfiguracoes = configuracoes.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.features && c.features.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const groupedConfiguracoes = {
    principal: filteredConfiguracoes.filter(c => c.category === 'principal'),
    integracao: filteredConfiguracoes.filter(c => c.category === 'integracao'),
    admin: filteredConfiguracoes.filter(c => c.category === 'admin'),
    dev: filteredConfiguracoes.filter(c => c.category === 'dev'),
  };

  return (
    <ProtectedRoute requiredModule="configuracoes">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-6">
          {/* Header com busca */}
          <div className="card-dark p-6 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Configurações do Sistema
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Gerencie todas as configurações e integrações do sistema
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar configurações..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
            <Card className="card-dark shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                      Configurações
                    </p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                      {configuracoes.length}
                    </p>
                  </div>
                  <div className="p-1.5 sm:p-2 bg-[hsl(var(--muted))] rounded-lg">
                    <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-[hsl(var(--foreground))]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-dark shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                      Integrações
                    </p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                      {loading ? '...' : stats.integracoes}
                    </p>
                  </div>
                  <div className="p-1.5 sm:p-2 bg-[hsl(var(--muted))] rounded-lg">
                    <Database className="w-5 h-5 sm:w-6 sm:h-6 text-[hsl(var(--foreground))]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-dark shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                      Usuários
                    </p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                      {loading ? '...' : stats.usuarios}
                    </p>
                  </div>
                  <div className="p-1.5 sm:p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-dark shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                      Alertas
                    </p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                      {loading ? '...' : stats.alertas}
                    </p>
                  </div>
                  <div className="p-1.5 sm:p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Seção Principal */}
          {groupedConfiguracoes.principal.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Configurações Principais
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-8">
                {groupedConfiguracoes.principal.map((config, index) => {
                  const Icon = config.icon;
                  return (
                    <Card key={index} className="card-dark shadow-lg hover:shadow-xl transition-all duration-300 group">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 ${config.iconBgColor} rounded-lg group-hover:scale-110 transition-transform`}>
                              <Icon className={`w-5 h-5 ${config.iconTextColor}`} />
                            </div>
                            <div>
                              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                                {config.title}
                              </CardTitle>
                              <Badge variant="outline" className={`text-xs mt-1 ${config.badgeColor}`}>
                                {config.badge}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <CardDescription className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          {config.description}
                        </CardDescription>
                        {config.features && (
                          <div className="space-y-2 mb-4">
                            <div className="text-xs text-gray-500 dark:text-gray-500">
                              {config.features}
                            </div>
                          </div>
                        )}
                        <Link href={config.href}>
                          <Button className={`w-full ${config.buttonBgColor} border ${config.buttonBorderColor} ${config.buttonTextColor} hover:opacity-80`}>
                            <Icon className="w-4 h-4 mr-2" />
                            Acessar
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {/* Seção Integrações */}
          {groupedConfiguracoes.integracao.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Integrações
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-8">
                {groupedConfiguracoes.integracao.map((config, index) => {
                  const Icon = config.icon;
                  return (
                    <Card key={index} className="card-dark shadow-lg hover:shadow-xl transition-all duration-300 group">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 ${config.iconBgColor} rounded-lg group-hover:scale-110 transition-transform`}>
                              <Icon className={`w-5 h-5 ${config.iconTextColor}`} />
                            </div>
                            <div>
                              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                                {config.title}
                              </CardTitle>
                              <Badge variant="outline" className={`text-xs mt-1 ${config.badgeColor}`}>
                                {config.badge}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <CardDescription className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          {config.description}
                        </CardDescription>
                        {config.features && (
                          <div className="space-y-2 mb-4">
                            <div className="text-xs text-gray-500 dark:text-gray-500">
                              {config.features}
                            </div>
                          </div>
                        )}
                        <Link href={config.href}>
                          <Button className={`w-full ${config.buttonBgColor} border ${config.buttonBorderColor} ${config.buttonTextColor} hover:opacity-80`}>
                            <Icon className="w-4 h-4 mr-2" />
                            Configurar
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {/* Seção Admin/Dev */}
          {(groupedConfiguracoes.admin.length > 0 || groupedConfiguracoes.dev.length > 0) && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Administração & Desenvolvimento
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {[...groupedConfiguracoes.admin, ...groupedConfiguracoes.dev].map((config, index) => {
                  const Icon = config.icon;
                  return (
                    <Card key={index} className="card-dark shadow-lg hover:shadow-xl transition-all duration-300 group">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 ${config.iconBgColor} rounded-lg group-hover:scale-110 transition-transform`}>
                              <Icon className={`w-5 h-5 ${config.iconTextColor}`} />
                            </div>
                            <div>
                              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                                {config.title}
                              </CardTitle>
                              <Badge variant="outline" className={`text-xs mt-1 ${config.badgeColor}`}>
                                {config.badge}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <CardDescription className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          {config.description}
                        </CardDescription>
                        {config.features && (
                          <div className="space-y-2 mb-4">
                            <div className="text-xs text-gray-500 dark:text-gray-500">
                              {config.features}
                            </div>
                          </div>
                        )}
                        <Link href={config.href}>
                          <Button className={`w-full ${config.buttonBgColor} border ${config.buttonBorderColor} ${config.buttonTextColor} hover:opacity-80`}>
                            <Icon className="w-4 h-4 mr-2" />
                            Acessar
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {filteredConfiguracoes.length === 0 && (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Nenhuma configuração encontrada para &quot;{searchTerm}&quot;</p>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
