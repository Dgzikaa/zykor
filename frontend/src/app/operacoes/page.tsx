'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePageTitle } from '@/contexts/PageTitleContext';
import {
  ChefHat,
  Package, 
  ClipboardList, 
  Timer,
  TrendingUp,
  FileText,
  Settings,
  ChevronRight,
  Zap
} from 'lucide-react';

interface OperacaoCard {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
  color: string;
  bgGradient: string;
}

export default function OperacoesPage() {
  const router = useRouter();
  const { setPageTitle } = usePageTitle();
  useEffect(() => { setPageTitle('⚙️ Operações'); return () => setPageTitle(''); }, [setPageTitle]);

  const operacoes: OperacaoCard[] = [
    {
      icon: ChefHat,
      title: 'Produções',
      description: 'Execução com cronômetro, aderência à ficha e controle de custo',
      href: '/operacional/producoes',
      color: 'text-orange-600 dark:text-orange-400',
      bgGradient: 'from-orange-500 to-red-600',
    },
    {
      icon: Package,
      title: 'Gestão de Insumos',
      description: 'Controle de insumos e receitas',
      href: '/ferramentas/producao-insumos',
      color: 'text-blue-600 dark:text-blue-400',
      bgGradient: 'from-blue-500 to-cyan-600',
    },
    {
      icon: Timer,
      title: 'Planejamento de Tempo',
      description: 'Gestão de horários e escalas',
      href: '/operacoes/planejamento-tempo',
      color: 'text-purple-600 dark:text-purple-400',
      bgGradient: 'from-purple-500 to-pink-600',
    },
    {
      icon: TrendingUp,
      title: 'Desempenho',
      description: 'Análise de performance operacional',
      href: '/relatorios/desempenho',
      color: 'text-indigo-600 dark:text-indigo-400',
      bgGradient: 'from-indigo-500 to-blue-600',
    },
    {
      icon: FileText,
      title: 'Relatórios',
      description: 'Relatórios operacionais',
      href: '/relatorios',
      color: 'text-gray-600 dark:text-gray-400',
      bgGradient: 'from-gray-500 to-slate-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Operações
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Central de operações e gestão
              </p>
            </div>
          </div>
        </div>

        {/* Grid de Operações */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {operacoes.map((op) => (
            <button
              key={op.href}
              onClick={() => router.push(op.href)}
              className="group bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-200 text-left border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            >
              {/* Ícone */}
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${op.bgGradient} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                  <op.icon className="w-6 h-6 text-white" />
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
              </div>

              {/* Conteúdo */}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {op.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {op.description}
              </p>
            </button>
          ))}
        </div>

        {/* Atalhos Rápidos */}
        <div className="mt-8 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Atalhos Rápidos
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => router.push('/operacoes/checklists/checklists-funcionario')}
              className="p-3 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
            >
              <ClipboardList className="w-5 h-5 text-gray-600 dark:text-gray-400 mx-auto mb-1" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Checklists</span>
            </button>
            <button
              onClick={() => router.push('/ferramentas/producao-insumos?tab=receitas')}
              className="p-3 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
            >
              <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400 mx-auto mb-1" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Receitas</span>
            </button>
            <button
              onClick={() => router.push('/ferramentas/producao-insumos?tab=insumos')}
              className="p-3 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
            >
              <Package className="w-5 h-5 text-gray-600 dark:text-gray-400 mx-auto mb-1" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Insumos</span>
            </button>
            <button
              onClick={() => router.push('/configuracoes')}
              className="p-3 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
            >
              <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400 mx-auto mb-1" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Config</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

