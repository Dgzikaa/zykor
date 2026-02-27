'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles,
  AlertTriangle,
  Send,
  Target,
  DollarSign,
  Lightbulb,
  TrendingUp,
  ChefHat,
  Package,
  Calendar,
  MessageSquare,
  Settings,
  ArrowRight,
  CheckCircle
} from 'lucide-react';

const funcionalidadesImplementadas = [
  {
    categoria: 'CRM Inteligente (7 Módulos)',
    cor: 'from-purple-500 to-pink-500',
    icon: Sparkles,
    items: [
      {
        titulo: 'Segmentação RFM',
        descricao: '7 segmentos estratégicos com ações personalizadas',
        url: '/crm/inteligente',
        acesso: 'Sidebar > CRM > Segmentação RFM',
        status: 'completo'
      },
      {
        titulo: 'Predição de Churn com IA',
        descricao: 'Score de risco 0-100% e alertas automáticos',
        url: '/crm/churn-prediction',
        acesso: 'Sidebar > CRM > Predição Churn',
        status: 'completo'
      },
      {
        titulo: 'Campanhas Automáticas',
        descricao: 'WhatsApp, Email e Cupons personalizados',
        url: '/crm/campanhas',
        acesso: 'Sidebar > CRM > Campanhas',
        status: 'completo'
      },
      {
        titulo: 'Padrões de Comportamento',
        descricao: 'Análise de hábitos: dia, horário, eventos',
        url: '/crm/padroes-comportamento',
        acesso: 'Sidebar > CRM > Padrões',
        status: 'completo'
      },
      {
        titulo: 'LTV e Engajamento',
        descricao: 'Lifetime Value e Score de Engajamento',
        url: '/crm/ltv-engajamento',
        acesso: 'Sidebar > CRM > LTV e Engajamento',
        status: 'completo'
      },
      {
        titulo: 'Recomendações IA',
        descricao: 'Sugestões personalizadas por cliente',
        url: '/crm/recomendacoes',
        acesso: 'Sidebar > CRM > Recomendações',
        status: 'completo'
      },
      {
        titulo: 'Dashboard de Retenção',
        descricao: 'Cohort Analysis e Funil de Jornada',
        url: '/crm/retencao',
        acesso: 'Sidebar > CRM > Retenção',
        status: 'completo'
      },
    ]
  },
  {
    categoria: 'NPS e Qualidade',
    cor: 'from-blue-500 to-cyan-500',
    icon: MessageSquare,
    items: [
      {
        titulo: 'NPS Clientes Categorizado',
        descricao: '9 categorias de NPS com drill-down de comentários',
        url: '/ferramentas/nps/categorizado',
        acesso: 'Sidebar > Ferramentas > NPS Clientes',
        status: 'completo'
      },
    ]
  },
  {
    categoria: 'Operações e Produção',
    cor: 'from-green-500 to-emerald-500',
    icon: ChefHat,
    items: [
      {
        titulo: 'Teste de Produção',
        descricao: 'Teste de fichas técnicas com timer e validação',
        url: '/configuracoes/teste-producao',
        acesso: 'Sidebar > Configurações > Teste de Produção',
        status: 'completo'
      },
      {
        titulo: 'Fichas Técnicas',
        descricao: 'Gerenciar e atualizar fichas técnicas',
        url: '/configuracoes/fichas-tecnicas',
        acesso: 'Sidebar > Configurações > Fichas Técnicas',
        status: 'completo'
      },
      {
        titulo: 'Contagem Rápida',
        descricao: 'Contagem otimizada de estoque (mobile)',
        url: '/ferramentas/contagem-rapida',
        acesso: 'Sidebar > Ferramentas > Contagem Rápida',
        status: 'completo'
      },
    ]
  },
  {
    categoria: 'Análise de Eventos',
    cor: 'from-orange-500 to-red-500',
    icon: Calendar,
    items: [
      {
        titulo: 'Eventos - Comparativo',
        descricao: 'Comparar eventos por dia/semana/mês com filtros',
        url: '/analitico/eventos/comparativo',
        acesso: 'Analítico > Eventos > [Botão "Abrir Comparativo"]',
        status: 'completo'
      },
    ]
  },
  {
    categoria: 'Clientes',
    cor: 'from-indigo-500 to-purple-500',
    icon: Target,
    items: [
      {
        titulo: 'Clientes Ativos - Evolução',
        descricao: 'Gráficos mensais de novos/retornantes',
        url: '/relatorios/clientes-ativos',
        acesso: 'Sidebar > Extras > Clientes Ativos',
        status: 'completo'
      },
    ]
  }
];

export default function GuiaFuncionalidadesPage() {
  const router = useRouter();
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle('📚 Guia de Funcionalidades');
  }, [setPageTitle]);

  return (
    <>
      {/* Header */}
      <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                📚 Guia de Funcionalidades
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Todas as funcionalidades implementadas e onde acessá-las
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
            <CardContent className="p-6 text-center">
              <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-1">17</div>
              <div className="text-sm text-purple-700 dark:text-purple-300">Funcionalidades</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-6 text-center">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-1">5</div>
              <div className="text-sm text-blue-700 dark:text-blue-300">Categorias</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
            <CardContent className="p-6 text-center">
              <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-1">100%</div>
              <div className="text-sm text-green-700 dark:text-green-300">Completo</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-orange-200 dark:border-orange-800">
            <CardContent className="p-6 text-center">
              <div className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-1">✨</div>
              <div className="text-sm text-orange-700 dark:text-orange-300">Com IA</div>
            </CardContent>
          </Card>
        </div>

        {/* Funcionalidades por Categoria */}
        <div className="space-y-8">
          {funcionalidadesImplementadas.map((categoria, catIndex) => {
            const IconCategoria = categoria.icon;
            
            return (
              <div key={catIndex}>
                {/* Título da Categoria */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 bg-gradient-to-br ${categoria.cor} rounded-lg`}>
                    <IconCategoria className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {categoria.categoria}
                  </h2>
                  <Badge className={`bg-gradient-to-r ${categoria.cor} text-white`}>
                    {categoria.items.length} {categoria.items.length === 1 ? 'item' : 'itens'}
                  </Badge>
                </div>

                {/* Cards das Funcionalidades */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoria.items.map((item, itemIndex) => (
                    <Card
                      key={itemIndex}
                      className="border-2 border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all cursor-pointer group"
                      onClick={() => router.push(item.url)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {item.titulo}
                          </h3>
                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
                        </div>

                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          {item.descricao}
                        </p>

                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800 mb-3">
                          <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                            📍 ACESSO:
                          </div>
                          <div className="text-xs text-blue-700 dark:text-blue-300">
                            {item.acesso}
                          </div>
                        </div>

                        <Button
                          className={`w-full bg-gradient-to-r ${categoria.cor} text-white hover:opacity-90`}
                          onClick={() => router.push(item.url)}
                        >
                          Acessar
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Info */}
        <Card className="mt-8 bg-gradient-to-r from-gray-50 via-blue-50 to-purple-50 dark:from-gray-800 dark:via-blue-900/20 dark:to-purple-900/20 border-gray-200 dark:border-gray-700">
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                🎉 Todas as Funcionalidades Implementadas!
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Sistema completo com <strong>17 novas funcionalidades</strong> incluindo CRM com IA, 
                NPS categorizado, gestão de produção e análises avançadas.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Badge className="bg-green-600 text-white">✅ 100% Completo</Badge>
                <Badge className="bg-blue-600 text-white">🚀 Em Produção</Badge>
                <Badge className="bg-purple-600 text-white">🤖 Com IA</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </>
  );
}

