'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Search,
  Clock,
  Sparkles,
  Ticket,
  Megaphone,
  ArrowRight,
  Star
} from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/layouts/PageHeader';

interface ExtraItem {
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
}

export default function ExtrasPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const extras: ExtraItem[] = [
    // Tempo de Estadia
    {
      title: 'Tempo de Estadia',
      description: 'Análise do tempo médio de permanência dos clientes',
      icon: Clock,
      href: '/relatorios/tempo-estadia',
      badge: 'Analítico',
      badgeColor: 'border-purple-200 text-purple-700 dark:border-purple-700 dark:text-purple-300',
      iconBgColor: 'bg-purple-100 dark:bg-purple-900/30',
      iconTextColor: 'text-purple-600 dark:text-purple-400',
      buttonBgColor: 'bg-purple-500/10 dark:bg-purple-900/20',
      buttonBorderColor: 'border-purple-500 dark:border-purple-700',
      buttonTextColor: 'text-purple-600 dark:text-purple-400',
      features: 'Tempo Médio • Análise de Permanência • Insights',
    },
    // Retrospectiva 2025
    {
      title: 'Retrospectiva 2025',
      description: 'Análise completa do ano com métricas e conquistas',
      icon: Sparkles,
      href: '/retrospectiva-2025',
      badge: 'Especial',
      badgeColor: 'border-blue-200 text-blue-700 dark:border-blue-700 dark:text-blue-300',
      iconBgColor: 'bg-blue-100 dark:bg-blue-900/30',
      iconTextColor: 'text-blue-600 dark:text-blue-400',
      buttonBgColor: 'bg-blue-500/10 dark:bg-blue-900/20',
      buttonBorderColor: 'border-blue-500 dark:border-blue-700',
      buttonTextColor: 'text-blue-600 dark:text-blue-400',
      features: 'Métricas Anuais • Conquistas • Destaques • Insights',
    },
    // Impacto Entrada
    {
      title: 'Impacto Entrada',
      description: 'Análise do impacto da entrada/couvert nas vendas',
      icon: Ticket,
      href: '/ferramentas/analise-couvert',
      badge: 'Analítico',
      badgeColor: 'border-purple-200 text-purple-700 dark:border-purple-700 dark:text-purple-300',
      iconBgColor: 'bg-purple-100 dark:bg-purple-900/30',
      iconTextColor: 'text-purple-600 dark:text-purple-400',
      buttonBgColor: 'bg-purple-500/10 dark:bg-purple-900/20',
      buttonBorderColor: 'border-purple-500 dark:border-purple-700',
      buttonTextColor: 'text-purple-600 dark:text-purple-400',
      features: 'Análise de Couvert • Impacto nas Vendas • Comparativos',
    },
    // Central Comercial 2026
    {
      title: 'Central Comercial 2026',
      description: 'Planejamento estratégico: feriados, Copa do Mundo, eventos e oportunidades',
      icon: Megaphone,
      href: '/ferramentas/comercial',
      badge: 'Novo',
      badgeColor: 'border-emerald-200 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300',
      iconBgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconTextColor: 'text-emerald-600 dark:text-emerald-400',
      buttonBgColor: 'bg-emerald-500/10 dark:bg-emerald-900/20',
      buttonBorderColor: 'border-emerald-500 dark:border-emerald-700',
      buttonTextColor: 'text-emerald-600 dark:text-emerald-400',
      features: 'Feriados 2026 • Copa do Mundo • Oportunidades • Ações',
    },
  ];

  const filteredExtras = extras.filter(extra =>
    extra.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    extra.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    extra.features?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        <PageHeader 
          title="⭐ Extras" 
          description="Análises especiais e ferramentas complementares" 
        />

        {/* Barra de Pesquisa */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Pesquisar extras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            />
          </div>
        </div>

        {/* Grid de Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExtras.map((extra) => {
            const IconComponent = extra.icon;
            
            return (
              <Card 
                key={extra.title} 
                className="card-dark hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 overflow-hidden group"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-3 rounded-xl ${extra.iconBgColor} group-hover:scale-110 transition-transform duration-200`}>
                      <IconComponent className={`w-6 h-6 ${extra.iconTextColor}`} />
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`${extra.badgeColor} border font-medium`}
                    >
                      {extra.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {extra.title}
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    {extra.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {extra.features && (
                    <div className="flex flex-wrap gap-2">
                      {extra.features.split(' • ').map((feature, idx) => (
                        <span 
                          key={idx}
                          className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  )}
                  <Link href={extra.href}>
                    <Button 
                      className={`w-full ${extra.buttonBgColor} border-2 ${extra.buttonBorderColor} ${extra.buttonTextColor} hover:opacity-80 transition-all duration-200 group/btn`}
                      variant="outline"
                    >
                      Acessar
                      <ArrowRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredExtras.length === 0 && (
          <div className="text-center py-12">
            <Star className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Nenhum extra encontrado com "{searchTerm}"
            </p>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2 flex items-center gap-2">
            <Star className="w-5 h-5" />
            Sobre os Extras
          </h3>
          <p className="text-yellow-700 dark:text-yellow-300 text-sm">
            Esta seção contém análises especiais, ferramentas complementares e recursos adicionais 
            que agregam valor ao seu negócio. Explore cada item para descobrir insights únicos 
            e oportunidades de crescimento.
          </p>
        </div>
      </div>
    </div>
  );
}
