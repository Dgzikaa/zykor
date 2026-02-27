'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Search,
  BarChart3,
  Calendar,
  Clock,
  TrendingUp,
  Users,
  Package,
  Settings,
  Zap,
  Bot,
  FileText,
  Database,
  Activity,
  PieChart,
  LineChart,
  DollarSign,
  ClipboardCheck,
  Calculator,
  Smile,
  Target,
  MapPin,
  Terminal,
  Coffee,
  Wallet,
  Megaphone
} from 'lucide-react';
import Link from 'next/link';

interface FerramentaItem {
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
  status: 'active' | 'soon' | 'dev';
}

export default function FerramentasPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const ferramentas: FerramentaItem[] = [
    // CFP - Controle Financeiro Pessoal
    {
      title: 'CFP - Financeiro Pessoal',
      description: 'Controle financeiro pessoal com integração Pluggy',
      icon: Wallet,
      href: '/fp',
      badge: 'Destaque',
      badgeColor: 'border-green-200 text-green-700 dark:border-green-700 dark:text-green-300',
      iconBgColor: 'bg-green-100 dark:bg-green-900/30',
      iconTextColor: 'text-green-600 dark:text-green-400',
      buttonBgColor: 'bg-green-500/10 dark:bg-green-900/20',
      buttonBorderColor: 'border-green-500 dark:border-green-700',
      buttonTextColor: 'text-green-600 dark:text-green-400',
      features: 'Transações • Contas • Categorias • Importar',
      status: 'active'
    },
    // Produção e Insumos
    {
      title: 'Produção e Insumos',
      description: 'Gestão completa de insumos, receitas e controle de produção',
      icon: Package,
      href: '/ferramentas/producao-insumos',
      badge: 'Ativo',
      badgeColor: 'border-indigo-200 text-indigo-700 dark:border-indigo-700 dark:text-indigo-300',
      iconBgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
      iconTextColor: 'text-indigo-600 dark:text-indigo-400',
      buttonBgColor: 'bg-indigo-500/10 dark:bg-indigo-900/20',
      buttonBorderColor: 'border-indigo-500 dark:border-indigo-700',
      buttonTextColor: 'text-indigo-600 dark:text-indigo-400',
      features: 'Cadastro de Insumos • Receitas • Terminal de Produção',
      status: 'active'
    },
    // Terminal
    {
      title: 'Terminal de Produção',
      description: 'Terminal para registro de produção em tempo real',
      icon: Terminal,
      href: '/ferramentas/terminal',
      badge: 'Ativo',
      badgeColor: 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300',
      iconBgColor: 'bg-slate-100 dark:bg-slate-900/30',
      iconTextColor: 'text-slate-600 dark:text-slate-400',
      buttonBgColor: 'bg-slate-500/10 dark:bg-slate-900/20',
      buttonBorderColor: 'border-slate-500 dark:border-slate-700',
      buttonTextColor: 'text-slate-600 dark:text-slate-400',
      features: 'Registro de Produção • Baixas • Controle',
      status: 'active'
    },
    // CMV Semanal
    {
      title: 'CMV Semanal',
      description: 'Análise de Custo de Mercadoria Vendida semanal',
      icon: DollarSign,
      href: '/ferramentas/cmv-semanal',
      badge: 'Ativo',
      badgeColor: 'border-emerald-200 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300',
      iconBgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconTextColor: 'text-emerald-600 dark:text-emerald-400',
      buttonBgColor: 'bg-emerald-500/10 dark:bg-emerald-900/20',
      buttonBorderColor: 'border-emerald-500 dark:border-emerald-700',
      buttonTextColor: 'text-emerald-600 dark:text-emerald-400',
      features: 'Tabela CMV • Visualização • Análise Semanal',
      status: 'active'
    },
    // DRE
    {
      title: 'DRE',
      description: 'Demonstrativo de Resultado do Exercício',
      icon: FileText,
      href: '/ferramentas/dre',
      badge: 'Ativo',
      badgeColor: 'border-cyan-200 text-cyan-700 dark:border-cyan-700 dark:text-cyan-300',
      iconBgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
      iconTextColor: 'text-cyan-600 dark:text-cyan-400',
      buttonBgColor: 'bg-cyan-500/10 dark:bg-cyan-900/20',
      buttonBorderColor: 'border-cyan-500 dark:border-cyan-700',
      buttonTextColor: 'text-cyan-600 dark:text-cyan-400',
      features: 'Receitas • Despesas • Lucro/Prejuízo',
      status: 'active'
    },
    // Contagem de Estoque
    {
      title: 'Contagem de Estoque',
      description: 'Sistema completo de contagem e gestão de estoque',
      icon: ClipboardCheck,
      href: '/ferramentas/contagem-estoque',
      badge: 'Ativo',
      badgeColor: 'border-amber-200 text-amber-700 dark:border-amber-700 dark:text-amber-300',
      iconBgColor: 'bg-amber-100 dark:bg-amber-900/30',
      iconTextColor: 'text-amber-600 dark:text-amber-400',
      buttonBgColor: 'bg-amber-500/10 dark:bg-amber-900/20',
      buttonBorderColor: 'border-amber-500 dark:border-amber-700',
      buttonTextColor: 'text-amber-600 dark:text-amber-400',
      features: 'Contagem • Histórico • Anomalias • Consolidado',
      status: 'active'
    },
    // Contagem Rápida
    {
      title: 'Contagem Rápida',
      description: 'Contagem simplificada e rápida de itens',
      icon: Zap,
      href: '/ferramentas/contagem-rapida',
      badge: 'Ativo',
      badgeColor: 'border-yellow-200 text-yellow-700 dark:border-yellow-700 dark:text-yellow-300',
      iconBgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      iconTextColor: 'text-yellow-600 dark:text-yellow-400',
      buttonBgColor: 'bg-yellow-500/10 dark:bg-yellow-900/20',
      buttonBorderColor: 'border-yellow-500 dark:border-yellow-700',
      buttonTextColor: 'text-yellow-600 dark:text-yellow-400',
      features: 'Contagem Expressa • Simplicidade',
      status: 'active'
    },
    // Áreas de Contagem
    {
      title: 'Áreas de Contagem',
      description: 'Gestão de áreas e locais de contagem',
      icon: MapPin,
      href: '/ferramentas/areas-contagem',
      badge: 'Ativo',
      badgeColor: 'border-pink-200 text-pink-700 dark:border-pink-700 dark:text-pink-300',
      iconBgColor: 'bg-pink-100 dark:bg-pink-900/30',
      iconTextColor: 'text-pink-600 dark:text-pink-400',
      buttonBgColor: 'bg-pink-500/10 dark:bg-pink-900/20',
      buttonBorderColor: 'border-pink-500 dark:border-pink-700',
      buttonTextColor: 'text-pink-600 dark:text-pink-400',
      features: 'Áreas • Locais • Organização',
      status: 'active'
    },
    // NPS/Felicidade
    {
      title: 'NPS e Felicidade',
      description: 'Análise de satisfação e NPS dos clientes',
      icon: Smile,
      href: '/ferramentas/nps',
      badge: 'Ativo',
      badgeColor: 'border-lime-200 text-lime-700 dark:border-lime-700 dark:text-lime-300',
      iconBgColor: 'bg-lime-100 dark:bg-lime-900/30',
      iconTextColor: 'text-lime-600 dark:text-lime-400',
      buttonBgColor: 'bg-lime-500/10 dark:bg-lime-900/20',
      buttonBorderColor: 'border-lime-500 dark:border-lime-700',
      buttonTextColor: 'text-lime-600 dark:text-lime-400',
      features: 'NPS • Categorizado • Análise de Satisfação',
      status: 'active'
    },
    // Simulação CMO
    {
      title: 'Simulação CMO',
      description: 'Simulador de Custo de Mão de Obra',
      icon: Calculator,
      href: '/ferramentas/simulacao-cmo',
      badge: 'Ativo',
      badgeColor: 'border-violet-200 text-violet-700 dark:border-violet-700 dark:text-violet-300',
      iconBgColor: 'bg-violet-100 dark:bg-violet-900/30',
      iconTextColor: 'text-violet-600 dark:text-violet-400',
      buttonBgColor: 'bg-violet-500/10 dark:bg-violet-900/20',
      buttonBorderColor: 'border-violet-500 dark:border-violet-700',
      buttonTextColor: 'text-violet-600 dark:text-violet-400',
      features: 'Simulação • Cálculo CMO • Cenários',
      status: 'active'
    },
    // Análise de Couvert
    {
      title: 'Análise de Couvert',
      description: 'Análise detalhada de couvert e cover charge',
      icon: Coffee,
      href: '/ferramentas/analise-couvert',
      badge: 'Ativo',
      badgeColor: 'border-orange-200 text-orange-700 dark:border-orange-700 dark:text-orange-300',
      iconBgColor: 'bg-orange-100 dark:bg-orange-900/30',
      iconTextColor: 'text-orange-600 dark:text-orange-400',
      buttonBgColor: 'bg-orange-500/10 dark:bg-orange-900/20',
      buttonBorderColor: 'border-orange-500 dark:border-orange-700',
      buttonTextColor: 'text-orange-600 dark:text-orange-400',
      features: 'Couvert • Análise • Relatórios',
      status: 'active'
    },
    // Calendário
    {
      title: 'Calendário',
      description: 'Visualização de eventos e agenda',
      icon: Calendar,
      href: '/ferramentas/calendario',
      badge: 'Ativo',
      badgeColor: 'border-blue-200 text-blue-700 dark:border-blue-700 dark:text-blue-300',
      iconBgColor: 'bg-blue-100 dark:bg-blue-900/30',
      iconTextColor: 'text-blue-600 dark:text-blue-400',
      buttonBgColor: 'bg-blue-500/10 dark:bg-blue-900/20',
      buttonBorderColor: 'border-blue-500 dark:border-blue-700',
      buttonTextColor: 'text-blue-600 dark:text-blue-400',
      features: 'Eventos • Agenda • Visualização',
      status: 'active'
    },
    // Agendamento
    {
      title: 'Agendamento Automático',
      description: 'Automatização de processos e sincronização de dados',
      icon: Clock,
      href: '/ferramentas/agendamento',
      badge: 'Ativo',
      badgeColor: 'border-green-200 text-green-700 dark:border-green-700 dark:text-green-300',
      iconBgColor: 'bg-green-100 dark:bg-green-900/30',
      iconTextColor: 'text-green-600 dark:text-green-400',
      buttonBgColor: 'bg-green-500/10 dark:bg-green-900/20',
      buttonBorderColor: 'border-green-500 dark:border-green-700',
      buttonTextColor: 'text-green-600 dark:text-green-400',
      features: 'Execução Automática • Sincronização',
      status: 'active'
    },
    // Stockout
    {
      title: 'Controle Stockout',
      description: 'Monitore produtos em falta e disponibilidade em tempo real',
      icon: Package,
      href: '/ferramentas/stockout',
      badge: 'Ativo',
      badgeColor: 'border-rose-200 text-rose-700 dark:border-rose-700 dark:text-rose-300',
      iconBgColor: 'bg-rose-100 dark:bg-rose-900/30',
      iconTextColor: 'text-rose-600 dark:text-rose-400',
      buttonBgColor: 'bg-rose-500/10 dark:bg-rose-900/20',
      buttonBorderColor: 'border-rose-500 dark:border-rose-700',
      buttonTextColor: 'text-rose-600 dark:text-rose-400',
      features: 'Análise Diária • Histórico • Por Local',
      status: 'active'
    },
    // Agente IA
    {
      title: 'Agente IA',
      description: 'Assistente inteligente para análises e insights automáticos',
      icon: Bot,
      href: '/ferramentas/agente',
      badge: 'Em Breve',
      badgeColor: 'border-yellow-200 text-yellow-700 dark:border-yellow-700 dark:text-yellow-300',
      iconBgColor: 'bg-purple-100 dark:bg-purple-900/30',
      iconTextColor: 'text-purple-600 dark:text-purple-400',
      buttonBgColor: 'bg-gray-500/10',
      buttonBorderColor: 'border-gray-500',
      buttonTextColor: 'text-gray-500',
      features: 'Em desenvolvimento',
      status: 'dev'
    },
    // Relatórios (link externo)
    {
      title: 'Relatórios',
      description: 'Relatórios detalhados de ContaHub, ContaAzul e análises',
      icon: FileText,
      href: '/relatorios',
      badge: 'Ativo',
      badgeColor: 'border-orange-200 text-orange-700 dark:border-orange-700 dark:text-orange-300',
      iconBgColor: 'bg-orange-100 dark:bg-orange-900/30',
      iconTextColor: 'text-orange-600 dark:text-orange-400',
      buttonBgColor: 'bg-orange-500/10 dark:bg-orange-900/20',
      buttonBorderColor: 'border-orange-500 dark:border-orange-700',
      buttonTextColor: 'text-orange-600 dark:text-orange-400',
      features: 'ContaHub • ContaAzul • Analítico',
      status: 'active'
    },
    // Configurações (link externo)
    {
      title: 'Configurações',
      description: 'Configurações do sistema, usuários e integrações',
      icon: Settings,
      href: '/configuracoes',
      badge: 'Admin',
      badgeColor: 'border-red-200 text-red-700 dark:border-red-700 dark:text-red-300',
      iconBgColor: 'bg-red-100 dark:bg-red-900/30',
      iconTextColor: 'text-red-600 dark:text-red-400',
      buttonBgColor: 'bg-red-500/10 dark:bg-red-900/20',
      buttonBorderColor: 'border-red-500 dark:border-red-700',
      buttonTextColor: 'text-red-600 dark:text-red-400',
      features: 'Usuários • Segurança • Integrações',
      status: 'active'
    },
    // Monitoramento (link externo)
    {
      title: 'Monitoramento',
      description: 'Monitoramento de performance e saúde do sistema',
      icon: Activity,
      href: '/visao-geral',
      badge: 'Ativo',
      badgeColor: 'border-teal-200 text-teal-700 dark:border-teal-700 dark:text-teal-300',
      iconBgColor: 'bg-teal-100 dark:bg-teal-900/30',
      iconTextColor: 'text-teal-600 dark:text-teal-400',
      buttonBgColor: 'bg-teal-500/10 dark:bg-teal-900/20',
      buttonBorderColor: 'border-teal-500 dark:border-teal-700',
      buttonTextColor: 'text-teal-600 dark:text-teal-400',
      features: 'APIs • Banco • Sincronização',
      status: 'active'
    },
    // Analítico (link externo)
    {
      title: 'Analítico',
      description: 'Análise detalhada de horários de pico, produtos e resumos',
      icon: BarChart3,
      href: '/analitico',
      badge: 'Ativo',
      badgeColor: 'border-blue-200 text-blue-700 dark:border-blue-700 dark:text-blue-300',
      iconBgColor: 'bg-blue-100 dark:bg-blue-900/30',
      iconTextColor: 'text-blue-600 dark:text-blue-400',
      buttonBgColor: 'bg-blue-500/10 dark:bg-blue-900/20',
      buttonBorderColor: 'border-blue-500 dark:border-blue-700',
      buttonTextColor: 'text-blue-600 dark:text-blue-400',
      features: 'Horário de Pico • Produtos do Dia • Resumo Semanal',
      status: 'active'
    },
  ];

  const filteredFerramentas = ferramentas.filter(f => 
    f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.features && f.features.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const activeCount = ferramentas.filter(f => f.status === 'active').length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header com busca */}
        <div className="card-dark p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Ferramentas de Análise
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Ferramentas avançadas para análise de dados e insights do negócio
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar ferramentas..."
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
                    Total Ferramentas
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {ferramentas.length}
                  </p>
                </div>
                <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-dark shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                    Ativas
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {activeCount}
                  </p>
                </div>
                <div className="p-1.5 sm:p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-dark shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                    Análises
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                    5
                  </p>
                </div>
                <div className="p-1.5 sm:p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-dark shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                    Atualização
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                    Hoje
                  </p>
                </div>
                <div className="p-1.5 sm:p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cards de Ferramentas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredFerramentas.map((ferramenta, index) => {
            const Icon = ferramenta.icon;
            
            return (
              <Card key={index} className="card-dark shadow-lg hover:shadow-xl transition-all duration-300 group">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 ${ferramenta.iconBgColor} rounded-lg group-hover:scale-110 transition-transform`}>
                        <Icon className={`w-5 h-5 ${ferramenta.iconTextColor}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                          {ferramenta.title}
                        </CardTitle>
                        <Badge variant="outline" className={`text-xs mt-1 ${ferramenta.badgeColor}`}>
                          {ferramenta.badge}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {ferramenta.description}
                  </CardDescription>
                  {ferramenta.features && (
                    <div className="space-y-2 mb-4">
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        {ferramenta.features}
                      </div>
                    </div>
                  )}
                  {ferramenta.status === 'dev' ? (
                    <Button disabled className={`w-full ${ferramenta.buttonBgColor} border ${ferramenta.buttonBorderColor} ${ferramenta.buttonTextColor} cursor-not-allowed`}>
                      Em Desenvolvimento
                    </Button>
                  ) : (
                    <Link href={ferramenta.href}>
                      <Button className={`w-full ${ferramenta.buttonBgColor} border ${ferramenta.buttonBorderColor} ${ferramenta.buttonTextColor} hover:opacity-80`}>
                        Acessar
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredFerramentas.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Nenhuma ferramenta encontrada para "{searchTerm}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
