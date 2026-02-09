import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { BarChart3, Calendar, DollarSign, LayoutDashboard, Target } from 'lucide-react';
import { BarSyncCheck } from '@/components/BarSyncCheck';
import PageHeader from '@/components/layouts/PageHeader';

export default function EstrategicoPage() {
  const estrategicoItems = [
    {
      title: 'Tabela de Desempenho',
      description: 'Análise semanal de performance e indicadores',
      href: '/estrategico/desempenho',
      icon: BarChart3,
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Planejamento Comercial',
      description: 'Estratégia comercial e definição de metas',
      href: '/estrategico/planejamento-comercial',
      icon: Calendar,
      color: 'text-green-600 dark:text-green-400',
    },
    {
      title: 'Orçamentação',
      description: 'Gestão orçamentária e controle de custos',
      href: '/estrategico/orcamentacao',
      icon: DollarSign,
      color: 'text-purple-600 dark:text-purple-400',
    },
    {
      title: 'Visão Mensal',
      description: 'Comparativo mensal consolidado',
      href: '/estrategico/visao-mensal',
      icon: LayoutDashboard,
      color: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      title: 'Organizador de Visão',
      description: 'Planejamento estratégico trimestral e OKRs',
      href: '/estrategico/organizador',
      icon: Target,
      color: 'text-orange-600 dark:text-orange-400',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <BarSyncCheck />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <PageHeader 
            title="🎯 Estratégico" 
            description="Ferramentas de análise estratégica, planejamento e gestão financeira"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {estrategicoItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 h-full cursor-pointer group">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 group-hover:scale-110 transition-transform duration-200">
                      <item.icon className={`h-6 w-6 ${item.color}`} />
                    </div>
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {item.title}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
