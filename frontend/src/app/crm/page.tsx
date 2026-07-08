'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Sparkles,
  AlertTriangle,
  Send,
  Target,
  DollarSign,
  Lightbulb,
  TrendingUp,
  ArrowRight,
  Users,
  Activity,
  BarChart3
} from 'lucide-react';

const modulosCRM = [
  {
    id: 'umbler',
    icon: Send,
    titulo: 'Umbler Talk',
    descricao: 'Histórico de conversas e cruzamento com reservas',
    url: '/crm/umbler',
    cor: 'from-green-500 to-emerald-500',
    bgCard: 'bg-green-50 dark:bg-green-900/20',
    borderCard: 'border-green-200 dark:border-green-800',
    features: ['10.263 Conversas', '9.397 Contatos', 'Cruzamento Getin', 'Funil de Conversão']
  },
  {
    id: 'segmentacao',
    icon: Sparkles,
    titulo: 'Segmentação RFM',
    descricao: 'Análise RFM com 7 segmentos estratégicos',
    url: '/crm/inteligente',
    cor: 'from-purple-500 to-pink-500',
    bgCard: 'bg-purple-50 dark:bg-purple-900/20',
    borderCard: 'border-purple-200 dark:border-purple-800',
    features: ['VIP Champions', 'Clientes Fiéis', 'Grande Potencial', 'Ações Estratégicas']
  },
  {
    id: 'churn',
    icon: AlertTriangle,
    titulo: 'Predição de Churn',
    descricao: 'IA que identifica clientes em risco de abandono',
    url: '/crm/churn-prediction',
    cor: 'from-red-500 to-orange-500',
    bgCard: 'bg-red-50 dark:bg-red-900/20',
    borderCard: 'border-red-200 dark:border-red-800',
    features: ['Score 0-100%', 'Alertas Automáticos', 'Ações Sugeridas', 'Níveis de Risco']
  },
  {
    id: 'campanhas',
    icon: Send,
    titulo: 'Campanhas Automáticas',
    descricao: 'WhatsApp, Email e Cupons personalizados',
    url: '/crm/campanhas',
    cor: 'from-blue-500 to-cyan-500',
    bgCard: 'bg-blue-50 dark:bg-blue-900/20',
    borderCard: 'border-blue-200 dark:border-blue-800',
    features: ['Templates WhatsApp', 'Email Marketing', 'Cupons com Desconto', 'Métricas']
  },
  {
    id: 'padroes',
    icon: Target,
    titulo: 'Padrões de Comportamento',
    descricao: 'Análise de hábitos e preferências dos clientes',
    url: '/crm/padroes-comportamento',
    cor: 'from-green-500 to-emerald-500',
    bgCard: 'bg-green-50 dark:bg-green-900/20',
    borderCard: 'border-green-200 dark:border-green-800',
    features: ['Dia Preferido', 'Horário Favorito', 'Tipo de Evento', 'Gráficos']
  },
  {
    id: 'ltv',
    icon: DollarSign,
    titulo: 'LTV e Engajamento',
    descricao: 'Lifetime Value e score de engajamento',
    url: '/crm/ltv-engajamento',
    cor: 'from-yellow-500 to-orange-500',
    bgCard: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderCard: 'border-yellow-200 dark:border-yellow-800',
    features: ['LTV Atual', 'Projeção 12/24m', 'Score 0-100', 'ROI Marketing']
  },
  {
    id: 'recomendacoes',
    icon: Lightbulb,
    titulo: 'Recomendações IA',
    descricao: 'Sugestões personalizadas de eventos e produtos',
    url: '/crm/recomendacoes',
    cor: 'from-indigo-500 to-purple-500',
    bgCard: 'bg-indigo-50 dark:bg-indigo-900/20',
    borderCard: 'border-indigo-200 dark:border-indigo-800',
    features: ['Eventos Ideais', 'Produtos Upsell', 'Melhor Horário', 'Cupons']
  },
  {
    id: 'retencao',
    icon: TrendingUp,
    titulo: 'Dashboard de Retenção',
    descricao: 'Cohort analysis e funil de jornada do cliente',
    url: '/crm/retencao',
    cor: 'from-pink-500 to-rose-500',
    bgCard: 'bg-pink-50 dark:bg-pink-900/20',
    borderCard: 'border-pink-200 dark:border-pink-800',
    features: ['Cohort Analysis', 'Funil de Jornada', 'Taxa Retenção', '5 Etapas']
  }
];

export default function CRMHubPage() {
  const router = useRouter();
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle('🤖 CRM Inteligente');
  }, [setPageTitle]);

  const handleNavigate = (url: string) => {
    router.push(url);
  };

  return (
    <>
      {/* Header */}
      <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Sistema completo de gestão e relacionamento com clientes
              </p>
            </div>
          </div>
        </div>

        {/* Stats Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Módulos Ativos</div>
                  <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">8</div>
                </div>
                <Activity className="w-12 h-12 text-blue-600 dark:text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-purple-600 dark:text-purple-400 mb-1">Inteligência Artificial</div>
                  <div className="text-3xl font-bold text-purple-700 dark:text-purple-300">100%</div>
                </div>
                <Sparkles className="w-12 h-12 text-purple-600 dark:text-purple-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-green-600 dark:text-green-400 mb-1">Automação</div>
                  <div className="text-3xl font-bold text-green-700 dark:text-green-300">ON</div>
                </div>
                <BarChart3 className="w-12 h-12 text-green-600 dark:text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Módulos CRM */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Módulos Disponíveis
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Escolha um módulo para acessar funcionalidades avançadas de CRM
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modulosCRM.map((modulo) => {
            const Icon = modulo.icon;
            
            return (
              <Card
                key={modulo.id}
                className={`${modulo.bgCard} ${modulo.borderCard} border-2 hover:shadow-xl transition-all duration-300 cursor-pointer group`}
                onClick={() => handleNavigate(modulo.url)}
              >
                <CardContent className="p-6">
                  {/* Ícone e Título */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 bg-gradient-to-br ${modulo.cor} rounded-xl group-hover:scale-110 transition-transform`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:translate-x-1 transition-transform" />
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {modulo.titulo}
                  </h3>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {modulo.descricao}
                  </p>

                  {/* Features */}
                  <div className="space-y-2">
                    {modulo.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${modulo.cor}`} />
                        <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Botão */}
                  <Button
                    className={`w-full mt-6 bg-gradient-to-r ${modulo.cor} text-white hover:opacity-90 transition-opacity`}
                    onClick={() => handleNavigate(modulo.url)}
                  >
                    Acessar Módulo
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info Box */}
        <Card className="mt-8 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-pink-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  🎯 Sobre o CRM Inteligente
                </h3>
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                  O CRM Inteligente do Zykor utiliza <strong>Inteligência Artificial</strong> e <strong>Machine Learning</strong> para 
                  analisar comportamentos, prever churn, segmentar clientes e automatizar campanhas de marketing. 
                  Com <strong>7 módulos integrados</strong>, você tem uma visão 360° dos seus clientes e pode tomar 
                  decisões baseadas em dados para <strong>maximizar retenção, LTV e engajamento</strong>.
                </p>
                
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">RFM</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Segmentação Inteligente</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400 mb-1">AI</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Predição de Churn</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">Auto</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Campanhas Automáticas</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </>
  );
}

