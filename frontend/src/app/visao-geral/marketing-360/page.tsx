'use client';

import { useEffect, useState } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import {
  TrendingUp,
  DollarSign, 
  Users, 
  Target,
  Instagram,
  Facebook,
  Mail,
  AlertCircle
} from 'lucide-react';
import { useBar } from '@/contexts/BarContext';

interface MetricCard {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export default function Marketing360Page() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPageTitle('📊 Marketing 360');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    // Simular carregamento
    setTimeout(() => setLoading(false), 1000);
  }, []);

  const metrics: MetricCard[] = [
    {
      title: 'Investimento Total',
      value: 'R$ 0,00',
      change: 0,
      icon: DollarSign,
      color: 'text-green-600 dark:text-green-400',
    },
    {
      title: 'Alcance',
      value: '0',
      change: 0,
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Conversões',
      value: '0',
      change: 0,
      icon: Target,
      color: 'text-purple-600 dark:text-purple-400',
    },
    {
      title: 'ROI',
      value: '0%',
      change: 0,
      icon: TrendingUp,
      color: 'text-orange-600 dark:text-orange-400',
    },
  ];

  const channels = [
    {
      name: 'Instagram',
      icon: Instagram,
      value: 'R$ 0,00',
      color: 'from-purple-500 to-pink-600',
    },
    {
      name: 'Facebook',
      icon: Facebook,
      value: 'R$ 0,00',
      color: 'from-blue-500 to-indigo-600',
    },
    {
      name: 'Email Marketing',
      icon: Mail,
      value: 'R$ 0,00',
      color: 'from-green-500 to-emerald-600',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Marketing 360°
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {selectedBar?.nome || 'Carregando...'}
              </p>
            </div>
          </div>
        </div>

        {/* Aviso de configuração pendente */}
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                Módulo em Configuração
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Configure suas integrações de marketing para visualizar métricas completas.
                Acesse <strong>Configurações → Integrações</strong> para conectar suas plataformas.
              </p>
            </div>
          </div>
        </div>

        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {metrics.map((metric) => (
            <div
              key={metric.title}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${metric.color === 'text-green-600 dark:text-green-400' ? 'from-green-500 to-emerald-600' : metric.color === 'text-blue-600 dark:text-blue-400' ? 'from-blue-500 to-cyan-600' : metric.color === 'text-purple-600 dark:text-purple-400' ? 'from-purple-500 to-pink-600' : 'from-orange-500 to-red-600'} flex items-center justify-center`}>
                  <metric.icon className="w-5 h-5 text-white" />
                </div>
                {metric.change !== undefined && (
                  <span className={`text-sm font-medium ${metric.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {metric.change >= 0 ? '+' : ''}{metric.change}%
                  </span>
                )}
              </div>
              <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {metric.title}
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {metric.value}
              </p>
            </div>
          ))}
        </div>

        {/* Canais de Marketing */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Investimento por Canal
          </h2>
          <div className="space-y-4">
            {channels.map((channel) => (
              <div key={channel.name} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${channel.color} flex items-center justify-center shadow-sm`}>
                    <channel.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {channel.name}
                  </span>
                </div>
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {channel.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Próximos Passos */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Próximos Passos
          </h2>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <div className="w-2 h-2 rounded-full bg-purple-600"></div>
              Conectar Facebook Ads Manager
            </li>
            <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <div className="w-2 h-2 rounded-full bg-purple-600"></div>
              Integrar Instagram Business
            </li>
            <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <div className="w-2 h-2 rounded-full bg-purple-600"></div>
              Configurar Google Analytics
            </li>
            <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <div className="w-2 h-2 rounded-full bg-purple-600"></div>
              Ativar rastreamento de conversões
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

