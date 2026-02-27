'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import PageHeader from '@/components/layouts/PageHeader'
import { 
  Users, 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  Clock, 
  Calendar,
  CalendarDays,
  UserCheck,
  GitCompare,
  Sparkles
} from 'lucide-react'
import Link from 'next/link'

interface AnalyticCard {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  implemented: boolean;
}

export default function AnaliticoPage() {
  const cards: AnalyticCard[] = [
    {
      title: 'Clientes',
      description: 'Análise de clientes mais recorrentes',
      icon: Users,
      href: '/analitico/clientes',
      implemented: true
    },
    {
      title: 'Eventos',
      description: 'Análise de horários de pico, produtos e resumos semanais',
      icon: Clock,
      href: '/analitico/eventos',
      implemented: true
    },
    {
      title: 'Comparativo de Eventos',
      description: 'Compare performance entre diferentes eventos',
      icon: GitCompare,
      href: '/analitico/eventos/comparativo',
      implemented: true
    },
  ]

  const implementedCount = cards.filter(c => c.implemented).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        <PageHeader 
          title="📊 Analítico" 
          description="Análises detalhadas do seu negócio com insights baseados em dados" 
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="card-dark">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{cards.length}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total de Análises</div>
            </CardContent>
          </Card>
          <Card className="card-dark">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{implementedCount}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Implementadas</div>
            </CardContent>
          </Card>
          <Card className="card-dark">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{cards.length - implementedCount}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Em Desenvolvimento</div>
            </CardContent>
          </Card>
          <Card className="card-dark">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {Math.round((implementedCount / cards.length) * 100)}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Progresso</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {cards.map((card) => {
            const IconComponent = card.icon
            
            if (card.implemented) {
              return (
                <Link key={card.title} href={card.href}>
                  <Card className="card-dark shadow-lg hover:shadow-xl transition-all duration-300 h-full cursor-pointer group">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-700 group-hover:scale-110 transition-transform duration-200`}>
                          <IconComponent className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                        </div>
                        <div className="w-2 h-2 bg-green-500 rounded-full" title="Implementado" />
                      </div>
                      <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {card.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                        {card.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              )
            }

            return (
              <Card key={card.title} className="card-dark opacity-60">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-700`}>
                      <IconComponent className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="w-2 h-2 bg-yellow-500 rounded-full" title="Em desenvolvimento" />
                  </div>
                  <CardTitle className="text-gray-500 dark:text-gray-400">
                    {card.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-400 dark:text-gray-500">
                    {card.description}
                  </CardDescription>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                    Em desenvolvimento
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 Sobre o Analítico</h3>
          <p className="text-blue-700 dark:text-blue-300 text-sm">
            Este módulo fornece insights detalhados sobre o comportamento dos seus clientes,
            padrões de vendas e performance dos produtos. Use essas análises para tomar decisões
            estratégicas baseadas em dados reais do seu negócio.
          </p>
        </div>
      </div>
    </div>
  )
}
