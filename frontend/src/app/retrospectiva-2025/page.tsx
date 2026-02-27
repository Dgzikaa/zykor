'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingState } from '@/components/ui/loading-state'
import {
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  Award,
  Smile,
  Target,
  BarChart3,
  Wine,
  Utensils,
  Instagram,
  Ticket,
  Star,
  Sparkles,
  Beer,
  Martini,
  Droplet,
  UtensilsCrossed,
  TrendingDown,
  Trophy,
  CheckCircle2,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import StatCard from '@/components/retrospectiva/StatCard'
import ChartCard from '@/components/retrospectiva/ChartCard'

export default function Retrospectiva2025Page() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Buscar dados da retrospectiva
    fetch('/api/retrospectiva-2025')
      .then(res => res.json())
      .then(response => {
        if (response.success) {
          setData(response.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <LoadingState 
          title="Carregando retrospectiva..."
          subtitle="Preparando sua análise de 2025"
          icon={<Sparkles className="w-4 h-4" />}
        />
      </div>
    )
  }

  const COLORS = {
    primary: ['#8B5CF6', '#7C3AED', '#6D28D9'],
    success: ['#10B981', '#059669', '#047857'],
    warning: ['#F59E0B', '#D97706', '#B45309'],
    danger: ['#EF4444', '#DC2626', '#B91C1C'],
    info: ['#3B82F6', '#2563EB', '#1D4ED8'],
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0)
  }

  // Formatar data para dd/mm/yyyy
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="card-dark p-8 mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.history.back()}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Voltar</span>
              </button>
              <div className="border-l border-gray-300 dark:border-gray-600 h-8" />
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Trophy className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                    Retrospectiva 2025
                  </h1>
                </div>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Conquistas, crescimento e evolução do ano
                </p>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-6 py-3 rounded-xl border border-blue-200 dark:border-blue-800">
              <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {data?.metas?.okrsConcluidos || 0}/{data?.metas?.okrsTotal || 0}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">OKRs Concluídos</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Indicadores Principais */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {/* Card: Faturamento Total */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <DollarSign className="w-8 h-8 text-green-600 dark:text-green-400" />
                <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                  Financeiro
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {formatCurrency(data?.financeiro?.faturamentoTotal || 0)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Faturamento Total 2025
              </div>
            </div>

            {/* Card: Total de Clientes */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                  Total
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {new Intl.NumberFormat('pt-BR').format(data?.financeiro?.totalClientes || 0)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total de Clientes 2025
              </div>
              {data?.financeiro?.recorrenciaMedia > 0 && (
                <div className="text-xs text-green-600 dark:text-green-400 mt-2">
                  {(data.financeiro.recorrenciaMedia * 100).toFixed(1)}% de recorrência
                </div>
              )}
            </div>

            {/* Card: Clientes Ativos Médio */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <Users className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded">
                  Base Ativa
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {new Intl.NumberFormat('pt-BR').format(data?.financeiro?.clientesAtivos || 0)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Clientes Ativos Médio
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Base de 90 dias
              </div>
            </div>

            {/* Card: Ticket Médio */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded">
                  Médias
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {formatCurrency(data?.financeiro?.ticketMedio || 0)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Ticket Médio
              </div>
            </div>

            {/* Card: Total Eventos */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <Calendar className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                <span className="text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded">
                  Eventos
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {data?.operacional?.totalEventos || 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Eventos Realizados
              </div>
            </div>
          </div>
        </motion.div>

        {/* Indicadores Operacionais */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Card: CMV Limpo */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 border border-green-200 dark:border-green-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                  CMV Limpo
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {(data?.financeiro?.cmvLimpoMedio || 0).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Média Anual
              </div>
              {data?.metas?.visaoGeral?.meta_cmv_limpo && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Meta: {data.metas.visaoGeral.meta_cmv_limpo}%
                </div>
              )}
            </div>

            {/* Card: CMO */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/10 dark:to-cyan-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                  CMO
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {(data?.financeiro?.cmoMedio || 0).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Custo Mão de Obra
              </div>
              {data?.metas?.visaoGeral?.meta_cmo && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Meta: {data.metas.visaoGeral.meta_cmo}%
                </div>
              )}
            </div>

            {/* Card: % Artística */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <Star className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded">
                  Artística
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {(data?.financeiro?.percentualArtisticaMedio || 0).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Custo Artístico
              </div>
              {data?.metas?.visaoGeral?.meta_artistica && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Meta: {data.metas.visaoGeral.meta_artistica}%
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Tabs com Conteúdo Detalhado */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="card-dark p-6"
        >
          <Tabs defaultValue="vendas" className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-9 mb-6">
              <TabsTrigger value="vendas">Vendas</TabsTrigger>
              <TabsTrigger value="evolucao">Evolução</TabsTrigger>
              <TabsTrigger value="cultura">Cultura</TabsTrigger>
              <TabsTrigger value="problemas">Desafios</TabsTrigger>
              <TabsTrigger value="conquistas">Insights</TabsTrigger>
              {/* Temporariamente desabilitadas - dados em desenvolvimento */}
              {/* <TabsTrigger value="mega">360°</TabsTrigger>
              <TabsTrigger value="ultra">Ultra</TabsTrigger>
              <TabsTrigger value="extras">Extras</TabsTrigger> */}
              <TabsTrigger value="2026">2026</TabsTrigger>
            </TabsList>

            {/* TAB: VENDAS */}
            <TabsContent value="vendas" className="space-y-6">
              <div>
                <h3 className="card-title-dark mb-4">Produtos Vendidos em 2025</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                        <Beer className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Cervejas</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {new Intl.NumberFormat('pt-BR').format(data?.vendas?.cervejas || 0)}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Faturamento: <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(data?.vendas?.faturamentoCervejas || 0)}</span>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <Martini className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Drinks</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {new Intl.NumberFormat('pt-BR').format(data?.vendas?.drinks || 0)}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Faturamento: <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(data?.vendas?.faturamentoDrinks || 0)}</span>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/10 dark:to-blue-900/10 border border-cyan-200 dark:border-cyan-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg flex items-center justify-center">
                        <Droplet className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Não Alcoólicos</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {new Intl.NumberFormat('pt-BR').format(data?.vendas?.naoAlcoolicos || 0)}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Faturamento: <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(data?.vendas?.faturamentoNaoAlcoolicos || 0)}</span>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 border border-green-200 dark:border-green-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                        <UtensilsCrossed className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Comidas</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {new Intl.NumberFormat('pt-BR').format(data?.vendas?.comidas || 0)}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Faturamento: <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(data?.vendas?.faturamentoComidas || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gráfico de Vendas por Categoria */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Distribuição de Vendas</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data?.vendasPorCategoria || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="categoria"
                      stroke="#9CA3AF"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="#9CA3AF"
                      style={{ fontSize: '12px' }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      formatter={(value: any) => new Intl.NumberFormat('pt-BR').format(value)}
                    />
                    <Bar
                      dataKey="quantidade_total"
                      fill="#3B82F6"
                      radius={[8, 8, 0, 0]}
                      name="Quantidade"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Top 10 Produtos */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top 10 Produtos</h4>
                <div className="space-y-3">
                  {data?.topProdutos?.slice(0, 10).map((produto: any, index: number) => (
                    <div key={index} className="flex items-center gap-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">#{index + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{produto.produto}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{new Intl.NumberFormat('pt-BR').format(produto.quantidade)} unidades</div>
                      </div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(produto.faturamento)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* TAB: EVOLUÇÃO */}
            <TabsContent value="evolucao" className="space-y-6">
              <div>
                <h3 className="card-title-dark mb-4">Evolução ao Longo do Ano</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Faturamento Mensal */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Faturamento Mensal</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={data?.evolucaoMensal || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis 
                          dataKey="mesNome" 
                          stroke="#9CA3AF"
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis 
                          stroke="#9CA3AF"
                          style={{ fontSize: '12px' }}
                          tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1F2937',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                            color: '#fff',
                          }}
                          formatter={(value: any) => formatCurrency(value)}
                        />
                        <Line
                          type="monotone"
                          dataKey="faturamento"
                          stroke="#10B981"
                          strokeWidth={3}
                          dot={{ fill: '#10B981', r: 6 }}
                          activeDot={{ r: 8 }}
                          name="Faturamento"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Clientes por Mês */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Clientes por Mês</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={data?.evolucaoMensal || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis 
                          dataKey="mesNome" 
                          stroke="#9CA3AF"
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis 
                          stroke="#9CA3AF"
                          style={{ fontSize: '12px' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1F2937',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                            color: '#fff',
                          }}
                        />
                        <Bar
                          dataKey="clientes"
                          fill="#3B82F6"
                          radius={[8, 8, 0, 0]}
                          name="Clientes"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Distribuição Bar / Drinks / Comida */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Distribuição de Faturamento</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Bar (Cervejas)', value: data?.vendas?.faturamentoCervejas || 0 },
                          { name: 'Drinks', value: data?.vendas?.faturamentoDrinks || 0 },
                          { name: 'Comida', value: data?.vendas?.faturamentoComidas || 0 },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(1)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#F59E0B" />
                        <Cell fill="#8B5CF6" />
                        <Cell fill="#10B981" />
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#fff',
                        }}
                        formatter={(value: any) => formatCurrency(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="flex flex-col justify-center space-y-3">
                    <div className="flex items-center gap-4 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <Beer className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                      <div className="flex-1">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Bar (Cervejas)</div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency(data?.vendas?.faturamentoCervejas || 0)}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        {data?.vendas?.faturamentoCervejas && data?.vendas?.faturamentoCervejas + data?.vendas?.faturamentoDrinks + data?.vendas?.faturamentoComidas > 0
                          ? ((data.vendas.faturamentoCervejas / (data.vendas.faturamentoCervejas + data.vendas.faturamentoDrinks + data.vendas.faturamentoComidas)) * 100).toFixed(1)
                          : 0}%
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg">
                      <Martini className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                      <div className="flex-1">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Drinks</div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency(data?.vendas?.faturamentoDrinks || 0)}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                        {data?.vendas?.faturamentoDrinks && data?.vendas?.faturamentoCervejas + data?.vendas?.faturamentoDrinks + data?.vendas?.faturamentoComidas > 0
                          ? ((data.vendas.faturamentoDrinks / (data.vendas.faturamentoCervejas + data.vendas.faturamentoDrinks + data.vendas.faturamentoComidas)) * 100).toFixed(1)
                          : 0}%
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                      <Utensils className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                      <div className="flex-1">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Comida</div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency(data?.vendas?.faturamentoComidas || 0)}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {data?.vendas?.faturamentoComidas && data?.vendas?.faturamentoCervejas + data?.vendas?.faturamentoDrinks + data?.vendas?.faturamentoComidas > 0
                          ? ((data.vendas.faturamentoComidas / (data.vendas.faturamentoCervejas + data.vendas.faturamentoDrinks + data.vendas.faturamentoComidas)) * 100).toFixed(1)
                          : 0}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB: CULTURA */}
            <TabsContent value="cultura" className="space-y-6">
              <div>
                <h3 className="card-title-dark mb-4">Pessoas e Cultura</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                        <Star className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">NPS Médio</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {(data?.pessoasCultura?.npsMedia || 0).toFixed(1)}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Satisfação da equipe
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/10 dark:to-rose-900/10 border border-pink-200 dark:border-pink-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 rounded-lg flex items-center justify-center">
                        <Smile className="w-6 h-6 text-pink-600 dark:text-pink-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Felicidade</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {(data?.pessoasCultura?.felicidadeMedia || 0).toFixed(1)}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Clima organizacional
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                        <Instagram className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Instagram</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          +{new Intl.NumberFormat('pt-BR').format(data?.marketing?.crescimentoInstagram || 0)}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Novos seguidores
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/10 dark:to-cyan-900/10 border border-teal-200 dark:border-teal-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex items-center justify-center">
                        <Ticket className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Tickets</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {new Intl.NumberFormat('pt-BR').format(data?.operacional?.ticketsVendidos || 0)}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Ingressos vendidos
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Geral</h4>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart
                    data={[
                      {
                        subject: 'Faturamento',
                        A: Math.min((data?.financeiro?.faturamentoTotal || 0) / 10000, 100),
                        fullMark: 100,
                      },
                      {
                        subject: 'Clientes',
                        A: Math.min((data?.financeiro?.totalClientes || 0) / 100, 100),
                        fullMark: 100,
                      },
                      {
                        subject: 'NPS',
                        A: (data?.pessoasCultura?.npsMedia || 0) * 10,
                        fullMark: 100,
                      },
                      {
                        subject: 'Felicidade',
                        A: (data?.pessoasCultura?.felicidadeMedia || 0) * 10,
                        fullMark: 100,
                      },
                      {
                        subject: 'Eventos',
                        A: Math.min((data?.operacional?.totalEventos || 0) * 5, 100),
                        fullMark: 100,
                      },
                    ]}
                  >
                    <PolarGrid stroke="#374151" />
                    <PolarAngleAxis 
                      dataKey="subject" 
                      stroke="#9CA3AF"
                      style={{ fontSize: '12px' }}
                    />
                    <PolarRadiusAxis stroke="#9CA3AF" />
                    <Radar
                      name="Performance"
                      dataKey="A"
                      stroke="#8B5CF6"
                      fill="#8B5CF6"
                      fillOpacity={0.6}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            {/* TAB: DESAFIOS E METAS */}
            <TabsContent value="problemas" className="space-y-6">
              {/* Visão Anual */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Visão Anual 2025</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {data?.metas?.visaoGeral?.imagem_1_ano || 'Ser um dos Principais Bares da Cidade'}
                    </p>
                  </div>
                </div>

                {/* Problemas Identificados */}
                {data?.metas?.visaoGeral?.principais_problemas && (
                  <div className="mb-6">
                    <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Principais Desafios Identificados:
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {data.metas.visaoGeral.principais_problemas.map((problema: string, pIndex: number) => (
                        <div key={pIndex} className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <span className="text-orange-500">⚠️</span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{problema}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metas do Ano */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Meta Faturamento</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">R$ 10M</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Meta Clientes</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">4.000</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Meta CMV</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">34%</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Meta CMO</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">20%</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Meta Artística</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">20%</div>
                  </div>
                </div>
              </div>

              {/* Análise de OKRs com Status Automático */}
              <div>
                <h3 className="card-title-dark mb-4">Análise de Metas vs Resultados</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Faturamento */}
                  <div className={`rounded-xl p-5 border ${
                    (data?.financeiro?.faturamentoTotal || 0) >= 10000000 
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' 
                      : 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">💰 Faturamento</div>
                      {(data?.financeiro?.faturamentoTotal || 0) >= 10000000 ? (
                        <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">✓ Atingido</span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full">Em progresso</span>
                      )}
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency(data?.financeiro?.faturamentoTotal || 0)}
                        </div>
                        <div className="text-xs text-gray-500">Real</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-600 dark:text-gray-400">R$ 10M</div>
                        <div className="text-xs text-gray-500">Meta</div>
                      </div>
                    </div>
                    <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${(data?.financeiro?.faturamentoTotal || 0) >= 10000000 ? 'bg-green-500' : 'bg-yellow-500'}`}
                        style={{ width: `${Math.min(((data?.financeiro?.faturamentoTotal || 0) / 10000000) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-center mt-1 text-gray-500">
                      {(((data?.financeiro?.faturamentoTotal || 0) / 10000000) * 100).toFixed(0)}%
                    </div>
                  </div>

                  {/* Clientes Ativos */}
                  <div className={`rounded-xl p-5 border ${
                    (data?.financeiro?.clientesAtivos || 0) >= 4000 
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' 
                      : 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">👥 Clientes Ativos</div>
                      {(data?.financeiro?.clientesAtivos || 0) >= 4000 ? (
                        <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">✓ Atingido</span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full">Em progresso</span>
                      )}
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {new Intl.NumberFormat('pt-BR').format(data?.financeiro?.clientesAtivos || 0)}
                        </div>
                        <div className="text-xs text-gray-500">Real</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-600 dark:text-gray-400">4.000</div>
                        <div className="text-xs text-gray-500">Meta</div>
                      </div>
                    </div>
                    <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${(data?.financeiro?.clientesAtivos || 0) >= 4000 ? 'bg-green-500' : 'bg-yellow-500'}`}
                        style={{ width: `${Math.min(((data?.financeiro?.clientesAtivos || 0) / 4000) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-center mt-1 text-gray-500">
                      {(((data?.financeiro?.clientesAtivos || 0) / 4000) * 100).toFixed(0)}%
                    </div>
                  </div>

                  {/* CMV Limpo */}
                  <div className={`rounded-xl p-5 border ${
                    ((data?.financeiro?.cmvMedio || 0) * 100) <= 34 
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' 
                      : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">📊 CMV Limpo</div>
                      {((data?.financeiro?.cmvMedio || 0) * 100) <= 34 ? (
                        <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">✓ Atingido</span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">Acima</span>
                      )}
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {((data?.financeiro?.cmvMedio || 0) * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">Real</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-600 dark:text-gray-400">34%</div>
                        <div className="text-xs text-gray-500">Meta</div>
                      </div>
                    </div>
                  </div>

                  {/* CMO */}
                  <div className={`rounded-xl p-5 border ${
                    ((data?.financeiro?.cmoMedio || 0) * 100) <= 20 
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' 
                      : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">👷 CMO</div>
                      {((data?.financeiro?.cmoMedio || 0) * 100) <= 20 ? (
                        <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">✓ Atingido</span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">Acima</span>
                      )}
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {((data?.financeiro?.cmoMedio || 0) * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">Real</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-600 dark:text-gray-400">20%</div>
                        <div className="text-xs text-gray-500">Meta</div>
                      </div>
                    </div>
                  </div>

                  {/* Instagram */}
                  <div className={`rounded-xl p-5 border ${
                    (data?.marketing?.seguidoresFinal || 0) >= 50000 
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' 
                      : 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">📱 Instagram</div>
                      {(data?.marketing?.seguidoresFinal || 0) >= 50000 ? (
                        <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">✓ Atingido</span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full">Em progresso</span>
                      )}
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {new Intl.NumberFormat('pt-BR').format(data?.marketing?.seguidoresFinal || 0)}
                        </div>
                        <div className="text-xs text-gray-500">Seguidores</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-600 dark:text-gray-400">50k</div>
                        <div className="text-xs text-gray-500">Meta</div>
                      </div>
                    </div>
                    <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${(data?.marketing?.seguidoresFinal || 0) >= 50000 ? 'bg-green-500' : 'bg-yellow-500'}`}
                        style={{ width: `${Math.min(((data?.marketing?.seguidoresFinal || 0) / 50000) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-center mt-1 text-gray-500">
                      {(((data?.marketing?.seguidoresFinal || 0) / 50000) * 100).toFixed(0)}%
                    </div>
                  </div>

                  {/* Eventos */}
                  <div className={`rounded-xl p-5 border ${
                    (data?.operacional?.totalEventos || 0) >= 50 
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' 
                      : 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">🎉 Eventos Premium</div>
                      {(data?.operacional?.totalEventos || 0) >= 50 ? (
                        <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">✓ Atingido</span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full">Em progresso</span>
                      )}
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {data?.operacional?.totalEventos || 0}
                        </div>
                        <div className="text-xs text-gray-500">Realizados</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-600 dark:text-gray-400">50</div>
                        <div className="text-xs text-gray-500">Meta</div>
                      </div>
                    </div>
                    <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${(data?.operacional?.totalEventos || 0) >= 50 ? 'bg-green-500' : 'bg-yellow-500'}`}
                        style={{ width: `${Math.min(((data?.operacional?.totalEventos || 0) / 50) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-center mt-1 text-gray-500">
                      {(((data?.operacional?.totalEventos || 0) / 50) * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumo de Metas */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 border border-green-200 dark:border-green-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-green-600" />
                  Resumo das Metas 2025
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {[
                        (data?.financeiro?.faturamentoTotal || 0) >= 10000000,
                        (data?.financeiro?.clientesAtivos || 0) >= 4000,
                        ((data?.financeiro?.cmvMedio || 0) * 100) <= 34,
                        (data?.marketing?.seguidoresFinal || 0) >= 50000,
                        (data?.operacional?.totalEventos || 0) >= 50,
                      ].filter(Boolean).length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Metas Atingidas</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                      {[
                        ((data?.financeiro?.cmoMedio || 0) * 100) > 20,
                      ].filter(Boolean).length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Acima da Meta</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">6</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total de Metas</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {Math.round(([
                        (data?.financeiro?.faturamentoTotal || 0) >= 10000000,
                        (data?.financeiro?.clientesAtivos || 0) >= 4000,
                        ((data?.financeiro?.cmvMedio || 0) * 100) <= 34,
                        (data?.marketing?.seguidoresFinal || 0) >= 50000,
                        (data?.operacional?.totalEventos || 0) >= 50,
                      ].filter(Boolean).length / 6) * 100)}%
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Taxa de Sucesso</div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB: INSIGHTS ESTRATÉGICOS 360° */}
            <TabsContent value="conquistas" className="space-y-6">
              {/* Header */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  🎯 Insights Estratégicos 2025
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Análise 360° do seu ano — dados para planejar 2026
                </p>
              </div>

              {/* RECORDES DO ANO */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🏆 Recordes do Ano
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Maior Faturamento */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-amber-100 dark:border-amber-900">
                    <div className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">💰 Maior Faturamento</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(data?.insights?.recordes?.maiorFaturamentoDia?.valor || 0)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {data?.insights?.recordes?.maiorFaturamentoDia?.evento}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      📅 {data?.insights?.recordes?.maiorFaturamentoDia?.data}
                    </div>
                  </div>
                  
                  {/* Maior Público */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-amber-100 dark:border-amber-900">
                    <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">👥 Maior Público</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {new Intl.NumberFormat('pt-BR').format(data?.insights?.recordes?.maiorPublico?.clientes || 0)} pessoas
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {data?.insights?.recordes?.maiorPublico?.evento}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      📅 {data?.insights?.recordes?.maiorPublico?.data}
                    </div>
                  </div>

                  {/* Melhor Ticket */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-amber-100 dark:border-amber-900">
                    <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">🎫 Melhor Ticket Médio</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(data?.insights?.recordes?.melhorTicketMedio?.ticket || 0)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {data?.insights?.recordes?.melhorTicketMedio?.evento}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      👥 {data?.insights?.recordes?.melhorTicketMedio?.clientes} clientes
                    </div>
                  </div>

                  {/* Horário Pico */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-amber-100 dark:border-amber-900">
                    <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">⏰ Horário Pico</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {data?.insights?.recordes?.horarioPico?.hora || 0}h
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {formatCurrency(data?.insights?.recordes?.horarioPico?.faturamento || 0)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Total no ano neste horário
                    </div>
                  </div>
                </div>
              </div>

              {/* TOP CLIENTES */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Clientes que Mais Gastaram */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    💎 Top Clientes VIP
                  </h4>
                  <div className="space-y-3">
                    {(data?.insights?.topClientesGasto || []).slice(0, 5).map((cliente: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                            idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-700' : 'bg-gray-500'
                          }`}>
                            {idx + 1}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white text-sm">{cliente.nome}</div>
                            <div className="text-xs text-gray-500">{cliente.visitas} visitas • {cliente.horasmedia?.toFixed(1) || 0}h média</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600 dark:text-green-400">{formatCurrency(cliente.totalgasto)}</div>
                          <div className="text-xs text-gray-500">TM: {formatCurrency(cliente.ticketmedio)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Clientes Mais Fiéis */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    ❤️ Clientes Mais Fiéis
                  </h4>
                  <div className="space-y-3">
                    {(data?.insights?.clientesMaisFieis || []).slice(0, 5).map((cliente: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                            idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-pink-500' : idx === 2 ? 'bg-rose-500' : 'bg-gray-500'
                          }`}>
                            {idx + 1}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white text-sm">{cliente.nome}</div>
                            <div className="text-xs text-gray-500">{cliente.horasmedia?.toFixed(1) || 0}h média por visita</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-purple-600 dark:text-purple-400">{cliente.visitas} visitas</div>
                          <div className="text-xs text-gray-500">{formatCurrency(cliente.totalgasto)} total</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* TOP ARTISTAS */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🎤 Artistas com Melhor Performance
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(data?.insights?.topArtistas || []).slice(0, 6).map((artista: any, idx: number) => (
                    <div key={idx} className="bg-white dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium text-gray-900 dark:text-white text-sm truncate pr-2">
                          {artista.artista}
                        </div>
                        <div className={`text-xs px-2 py-0.5 rounded-full ${
                          idx === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                        }`}>
                          #{idx + 1}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Shows:</span>
                          <span className="font-medium text-gray-900 dark:text-white ml-1">{artista.shows}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Público:</span>
                          <span className="font-medium text-gray-900 dark:text-white ml-1">{artista.mediapublico}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">Média Fat.:</span>
                          <span className="font-medium text-green-600 dark:text-green-400 ml-1">{formatCurrency(artista.mediafaturamento)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PERFORMANCE POR DIA DA SEMANA */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  📅 Performance por Dia da Semana
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {(data?.insights?.performanceDiaSemana || []).map((dia: any, idx: number) => (
                    <div key={idx} className={`rounded-lg p-3 text-center ${
                      idx === 0 ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500' : 'bg-white dark:bg-gray-700/50'
                    }`}>
                      <div className={`font-semibold text-sm ${idx === 0 ? 'text-green-700 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                        {dia.dia}
                      </div>
                      <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                        {((dia.mediafaturamento || 0) / 1000).toFixed(0)}k
                      </div>
                      <div className="text-xs text-gray-500">
                        {dia.mediaclientes || 0} pessoas
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {dia.totaleventos || 0} eventos
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* TOP PRODUTOS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Drinks */}
                <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    🍹 Top Drinks
                  </h4>
                  <div className="space-y-2">
                    {(data?.insights?.topDrinks || []).slice(0, 5).map((drink: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0 ? 'bg-purple-500 text-white' : 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                          }`}>{idx + 1}</span>
                          <span className="text-gray-700 dark:text-gray-300 truncate">{drink.drink}</span>
                        </div>
                        <span className="font-medium text-purple-600 dark:text-purple-400">{drink.quantidade}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comidas */}
                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    🍔 Top Comidas
                  </h4>
                  <div className="space-y-2">
                    {(data?.insights?.topComidas || []).slice(0, 5).map((comida: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0 ? 'bg-emerald-500 text-white' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                          }`}>{idx + 1}</span>
                          <span className="text-gray-700 dark:text-gray-300 truncate">{comida.prato}</span>
                        </div>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">{comida.quantidade}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Horários Pico */}
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    ⏰ Horários de Pico
                  </h4>
                  <div className="space-y-2">
                    {(data?.insights?.horariosPico || []).slice(0, 5).map((horario: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0 ? 'bg-blue-500 text-white' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                          }`}>{idx + 1}</span>
                          <span className="text-gray-700 dark:text-gray-300">{horario.hora}h</span>
                        </div>
                        <span className="font-medium text-blue-600 dark:text-blue-400">{formatCurrency(horario.faturamento)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* DATAS-CHAVE PARA 2026 */}
              <div className="bg-gradient-to-br from-indigo-50 to-cyan-50 dark:from-indigo-900/10 dark:to-cyan-900/10 border border-indigo-200 dark:border-indigo-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🗓️ Datas-Chave para 2026
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Performance em feriados e datas especiais — use para planejar 2026!
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(data?.insights?.datasChave || []).slice(0, 6).map((data_chave: any, idx: number) => (
                    <div key={idx} className="bg-white dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full">
                          {data_chave.tipodata}
                        </span>
                        <span className="text-xs text-gray-500">{data_chave.diasemana}</span>
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        {data_chave.evento}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">📅 {formatDate(data_chave.data)}</span>
                        <span className="font-bold text-green-600 dark:text-green-400">{formatCurrency(data_chave.faturamento)}</span>
                      </div>
                      {data_chave.clientes > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          👥 {data_chave.clientes} pessoas • TM: {formatCurrency(data_chave.faturamento / data_chave.clientes)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* TOP 10 EVENTOS */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🎉 Top 10 Eventos do Ano
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-2 font-medium">#</th>
                        <th className="pb-2 font-medium">Data</th>
                        <th className="pb-2 font-medium">Evento</th>
                        <th className="pb-2 font-medium text-right">Clientes</th>
                        <th className="pb-2 font-medium text-right">Faturamento</th>
                        <th className="pb-2 font-medium text-right">Ticket</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.insights?.topEventos || []).map((evento: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="py-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx === 0 ? 'bg-amber-500 text-white' : idx === 1 ? 'bg-gray-400 text-white' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                            }`}>{idx + 1}</span>
                          </td>
                          <td className="py-2 text-gray-600 dark:text-gray-400">{formatDate(evento.data)} ({evento.diasemana})</td>
                          <td className="py-2 font-medium text-gray-900 dark:text-white">{evento.evento}</td>
                          <td className="py-2 text-right text-purple-600 dark:text-purple-400">{evento.clientes}</td>
                          <td className="py-2 text-right font-bold text-green-600 dark:text-green-400">{formatCurrency(evento.faturamento)}</td>
                          <td className="py-2 text-right text-gray-600 dark:text-gray-400">{formatCurrency(evento.ticketmedio)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </TabsContent>

            {/* TAB: MEGA INSIGHTS 360° - DESABILITADO */}
            <TabsContent value="mega" className="space-y-6">
              <div className="text-center p-8">
                <p className="text-gray-500">Esta seção está em desenvolvimento.</p>
              </div>
            </TabsContent>

            {/* TAB: MEGA INSIGHTS 360° - CONTEÚDO ORIGINAL COMENTADO */}
            {false && <div>
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  🔥 Mega Insights 360°
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  25 categorias de análise profunda do seu ano
                </p>
              </div>

              {/* RETENÇÃO DE CLIENTES */}
              <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10 border border-red-200 dark:border-red-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  ⚠️ Funil de Retenção - OPORTUNIDADE!
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-red-600">{data?.megaInsights?.retencaoClientes?.veio1Vez?.toLocaleString() || 0}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">1 vez ({data?.megaInsights?.retencaoClientes?.percentual1Vez}%)</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-orange-600">{data?.megaInsights?.retencaoClientes?.veio2Vezes?.toLocaleString() || 0}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">2 vezes</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-yellow-600">{data?.megaInsights?.retencaoClientes?.veio3a5Vezes?.toLocaleString() || 0}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">3-5 vezes</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">{data?.megaInsights?.retencaoClientes?.veio6a10Vezes?.toLocaleString() || 0}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">6-10 vezes</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-emerald-600">{data?.megaInsights?.retencaoClientes?.maisQue10Vezes?.toLocaleString() || 0}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">10+ vezes 💎</div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    💡 <strong>Insight:</strong> {data?.megaInsights?.retencaoClientes?.percentual1Vez}% dos clientes vieram só 1 vez. 
                    Taxa de retenção: <strong>{data?.megaInsights?.retencaoClientes?.taxaRetencao}%</strong>
                  </p>
                </div>
              </div>

              {/* CRESCIMENTO POR DIA DA SEMANA */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  📈 Crescimento por Dia (1º Trim → 4º Trim)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {(data?.megaInsights?.crescimentoDiaSemana || []).map((dia: any, idx: number) => (
                    <div key={idx} className={`rounded-lg p-3 text-center ${
                      dia.crescimentopercent > 100 ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500' :
                      dia.crescimentopercent > 0 ? 'bg-blue-50 dark:bg-blue-900/20' :
                      'bg-red-50 dark:bg-red-900/20'
                    }`}>
                      <div className="font-semibold text-sm text-gray-900 dark:text-white">{dia.dia}</div>
                      <div className={`text-2xl font-bold ${
                        dia.crescimentopercent > 100 ? 'text-green-600' :
                        dia.crescimentopercent > 0 ? 'text-blue-600' :
                        'text-red-600'
                      }`}>
                        {dia.crescimentopercent > 0 ? '+' : ''}{dia.crescimentopercent}%
                      </div>
                      <div className="text-xs text-gray-500">
                        R$ {Math.round(dia.media1trim/1000)}k → R$ {Math.round(dia.media4trim/1000)}k
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* EVOLUÇÃO TRIMESTRAL */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {(data?.megaInsights?.evolucaoTrimestral || []).map((tri: any, idx: number) => (
                  <div key={idx} className={`rounded-xl p-5 ${
                    idx === 3 ? 'bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-500' :
                    'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                  }`}>
                    <div className="text-lg font-bold text-gray-900 dark:text-white mb-2">{tri.trimestre}</div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      R$ {(tri.faturamento / 1000000).toFixed(2)}M
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      {tri.eventos} eventos • {tri.clientestotal?.toLocaleString()} clientes
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Média: R$ {Math.round(tri.mediaevento / 1000)}k/evento
                    </div>
                  </div>
                ))}
              </div>

              {/* GÊNEROS MUSICAIS */}
              <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🎵 Gêneros Musicais Mais Rentáveis
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(data?.megaInsights?.generosMusicais || []).map((genero: any, idx: number) => (
                    <div key={idx} className={`bg-white dark:bg-gray-800 rounded-lg p-4 ${idx === 0 ? 'ring-2 ring-purple-500' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900 dark:text-white">{genero.genero}</span>
                        {idx === 0 && <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded">TOP</span>}
                      </div>
                      <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                        R$ {Math.round(genero.mediafaturamento / 1000)}k
                      </div>
                      <div className="text-xs text-gray-500">
                        {genero.totaleventos} eventos • {genero.mediapublico} pessoas/show
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* HAPPY HOUR EVOLUÇÃO */}
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  ⏰ Evolução do Happy Hour
                </h4>
                <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-11 gap-2">
                  {(data?.megaInsights?.evolucaoHappyHour || []).map((mes: any, idx: number) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">Mês {mes.mes}</div>
                      <div className={`text-lg font-bold ${mes.percentualhh >= 15 ? 'text-green-600' : 'text-amber-600'}`}>
                        {mes.percentualhh}%
                      </div>
                      <div className="text-xs text-gray-500">R${Math.round(mes.fathappyhour/1000)}k</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    💡 Happy Hour cresceu de <strong>9.4%</strong> para <strong>15%</strong> do faturamento!
                  </p>
                </div>
              </div>

              {/* GOOGLE REVIEWS */}
              {data?.insightsAdicionais?.googleReviews && (
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    ⭐ Google Reviews 2025
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
                      <div className="text-sm text-gray-500 mb-2">Média de Avaliações</div>
                      <div className="text-4xl font-bold text-green-600">
                        {(data?.insightsAdicionais?.googleReviews?.mediaAvaliacoes || 0).toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500 mt-2">⭐⭐⭐⭐⭐</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
                      <div className="text-sm text-gray-500 mb-2">Total de Avaliações</div>
                      <div className="text-4xl font-bold text-green-600">
                        {data?.insightsAdicionais?.googleReviews?.totalAvaliacoes || 0}
                      </div>
                      <div className="text-xs text-gray-500 mt-2">reviews em 2025</div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                      <div className="text-2xl font-bold text-green-600">
                        {(data?.insightsAdicionais?.googleReviews?.mediaAvaliacoes || 0).toFixed(1)}
                      </div>
                      <div className="text-sm text-gray-500">Nota Média</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                      <div className="text-2xl font-bold text-yellow-600">{data?.insightsAdicionais?.totaisGerais?.totalAvaliacoes5}</div>
                      <div className="text-sm text-gray-500">Avaliações 5⭐</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                      <div className="text-2xl font-bold text-blue-600">{data?.insightsAdicionais?.totaisGerais?.totalReservas?.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">Reservas</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                      <div className="text-2xl font-bold text-purple-600">{data?.insightsAdicionais?.totaisGerais?.totalPessoasReservadas?.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">Pessoas Reservadas</div>
                    </div>
                  </div>
                </div>
              )}

              {/* COMBOS GROWTH - Temporariamente desabilitado */}
              {Array.isArray(data?.insightsAdicionais?.combosGrowth) && data?.insightsAdicionais?.combosGrowth.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    📦 Crescimento de Combos/Baldinhos
                  </h4>
                  <div className="grid grid-cols-4 gap-4">
                    {data.insightsAdicionais.combosGrowth.map((tri: any, idx: number) => (
                      <div key={idx} className={`rounded-lg p-4 text-center ${
                        idx === 3 ? 'bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500' : 'bg-white dark:bg-gray-800'
                      }`}>
                        <div className="font-bold text-gray-900 dark:text-white">{tri.trimestre}</div>
                        <div className={`text-3xl font-bold ${idx === 3 ? 'text-green-600' : 'text-blue-600'}`}>
                          {tri.percentualcombos}%
                        </div>
                        <div className="text-sm text-gray-500">R$ {Math.round(tri.vendascombos/1000)}k</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      💡 Combos cresceram de <strong>5.6%</strong> para <strong>33.5%</strong> das vendas! Estratégia funcionando!
                    </p>
                  </div>
                </div>
              )}

              {/* TOP CERVEJAS */}
              {Array.isArray(data?.insightsAdicionais?.topCervejas) && data?.insightsAdicionais?.topCervejas.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      🍺 Top Cervejas
                    </h4>
                    <div className="space-y-2">
                      {data.insightsAdicionais.topCervejas.slice(0, 8).map((cerveja: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-gray-700/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx === 0 ? 'bg-amber-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                            }`}>{idx + 1}</span>
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{cerveja.cerveja}</span>
                          </div>
                          <span className="font-bold text-amber-600">{formatCurrency(cerveja.faturamento)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      🍹 Drinks Mais Eficientes
                    </h4>
                    <div className="space-y-2">
                      {(data?.megaInsights?.drinksEficientes || []).slice(0, 8).map((drink: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-gray-700/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx === 0 ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                            }`}>{idx + 1}</span>
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{drink.drink}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-purple-600">{formatCurrency(drink.faturamento)}</span>
                            <div className="text-xs text-gray-500">{drink.tempomin}min</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* RESUMO FINAL 360° */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-8 text-white">
                <h4 className="text-2xl font-bold mb-6 text-center">📊 Resumo 360° do Ano</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="bg-white/20 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold">{data?.insightsAdicionais?.totaisGerais?.produtosDistintos}</div>
                    <div className="text-sm opacity-80">Produtos</div>
                  </div>
                  <div className="bg-white/20 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold">{(data?.insightsAdicionais?.totaisGerais?.totalProdutosVendidos / 1000).toFixed(0)}k</div>
                    <div className="text-sm opacity-80">Itens Vendidos</div>
                  </div>
                  <div className="bg-white/20 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold">{data?.megaInsights?.retencaoClientes?.total?.toLocaleString()}</div>
                    <div className="text-sm opacity-80">Clientes</div>
                  </div>
                  <div className="bg-white/20 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold">{data?.insightsAdicionais?.totaisGerais?.totalReservas?.toLocaleString()}</div>
                    <div className="text-sm opacity-80">Reservas</div>
                  </div>
                  <div className="bg-white/20 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold">{data?.insightsAdicionais?.totaisGerais?.mediaNotaGoogle}</div>
                    <div className="text-sm opacity-80">Nota Google</div>
                  </div>
                  <div className="bg-white/20 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold">{data?.insightsAdicionais?.totaisGerais?.mediaFelicidadeEquipe}%</div>
                    <div className="text-sm opacity-80">Felicidade Equipe</div>
                  </div>
                </div>
              </div>
            </div>}

            {/* TAB: ULTRA INSIGHTS - DESABILITADO */}
            <TabsContent value="ultra" className="space-y-6">
              <div className="text-center p-8">
                <p className="text-gray-500">Esta seção está em desenvolvimento.</p>
              </div>
            </TabsContent>

            {/* TAB: ULTRA INSIGHTS - CONTEÚDO ORIGINAL COMENTADO */}
            {false && <div>
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  💎 Ultra Insights - Análise Avançada
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  24 categorias de indicadores estratégicos profundos
                </p>
              </div>

              {/* LTV ANALYSIS */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  💰 LTV - Lifetime Value dos Clientes
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-sm text-gray-500 mb-1">Total Clientes</div>
                    <div className="text-2xl font-bold text-emerald-600">{data?.ultraInsights?.ltvAnalysis?.totalClientes?.toLocaleString()}</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-sm text-gray-500 mb-1">LTV Médio</div>
                    <div className="text-2xl font-bold text-emerald-600">R$ {data?.ultraInsights?.ltvAnalysis?.ltvMedio}</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-sm text-gray-500 mb-1">LTV Máximo</div>
                    <div className="text-2xl font-bold text-green-600">R$ {data?.ultraInsights?.ltvAnalysis?.ltvMaximo?.toLocaleString()}</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-sm text-gray-500 mb-1">LTV Mediano</div>
                    <div className="text-2xl font-bold text-teal-600">R$ {data?.ultraInsights?.ltvAnalysis?.ltvMediano}</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-sm text-gray-500 mb-1">Top 10%</div>
                    <div className="text-2xl font-bold text-cyan-600">R$ {data?.ultraInsights?.ltvAnalysis?.ltvTop10Percent}</div>
                  </div>
                </div>
              </div>

              {/* CHURN ANALYSIS */}
              <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10 border border-red-200 dark:border-red-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  ⚠️ Análise de Churn - Risco de Perda
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {(data?.ultraInsights?.churnAnalysis || []).map((item: any, idx: number) => (
                    <div key={idx} className={`bg-white dark:bg-gray-800 rounded-lg p-4 text-center ${
                      item.status?.includes('Ativo') ? 'ring-2 ring-green-500' :
                      item.status?.includes('risco') ? 'ring-2 ring-yellow-500' :
                      item.status?.includes('Inativo') ? 'ring-2 ring-orange-500' :
                      'ring-2 ring-red-500'
                    }`}>
                      <div className="text-xs text-gray-500 mb-1">{item.status}</div>
                      <div className={`text-2xl font-bold ${
                        item.status?.includes('Ativo') ? 'text-green-600' :
                        item.status?.includes('risco') ? 'text-yellow-600' :
                        item.status?.includes('Inativo') ? 'text-orange-600' :
                        'text-red-600'
                      }`}>{item.quantidade?.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">Gasto: R$ {item.gastomedio}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ABC ANALYSIS */}
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  📊 Análise ABC de Produtos
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  {(data?.ultraInsights?.abcAnalysis || []).map((item: any, idx: number) => (
                    <div key={idx} className={`bg-white dark:bg-gray-800 rounded-lg p-5 ${
                      item.classe?.includes('A') ? 'ring-2 ring-green-500' :
                      item.classe?.includes('B') ? 'ring-2 ring-yellow-500' :
                      'ring-2 ring-gray-300'
                    }`}>
                      <div className="text-lg font-bold text-gray-900 dark:text-white mb-2">{item.classe}</div>
                      <div className="text-3xl font-bold text-blue-600">R$ {(item.faturamentototal / 1000000).toFixed(2)}M</div>
                      <div className="text-sm text-gray-500 mt-2">{item.qtdprodutos} produtos</div>
                      <div className="text-sm text-gray-500">{item.quantidadetotal?.toLocaleString()} unidades</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* TOP VIPS */}
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  👑 Top 10 Clientes VIP
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-2 font-semibold text-gray-900 dark:text-white">#</th>
                        <th className="pb-2 font-semibold text-gray-900 dark:text-white">Nome</th>
                        <th className="pb-2 font-semibold text-gray-900 dark:text-white">Visitas</th>
                        <th className="pb-2 font-semibold text-gray-900 dark:text-white">Total Gasto</th>
                        <th className="pb-2 font-semibold text-gray-900 dark:text-white">Ticket Médio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.ultraInsights?.topVips || []).slice(0, 10).map((vip: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`}
                          </td>
                          <td className="py-2 font-medium text-gray-900 dark:text-white">{vip.nome}</td>
                          <td className="py-2 text-gray-600 dark:text-gray-400">{vip.visitas}x</td>
                          <td className="py-2 font-bold text-green-600">R$ {vip.totalgasto?.toLocaleString()}</td>
                          <td className="py-2 text-gray-600 dark:text-gray-400">R$ {vip.ticketmedio}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TICKET POR FREQUÊNCIA */}
              <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🎟️ Ticket Médio por Frequência de Visitas
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {(data?.ultraInsights?.ticketPorFrequencia || []).map((item: any, idx: number) => (
                    <div key={idx} className={`bg-white dark:bg-gray-800 rounded-lg p-4 text-center ${
                      idx >= 3 ? 'ring-2 ring-indigo-500' : ''
                    }`}>
                      <div className="text-xs font-semibold text-gray-500 mb-1">{item.faixavisitas}</div>
                      <div className="text-lg font-bold text-indigo-600">R$ {item.ticketmedio}</div>
                      <div className="text-xs text-gray-500">{item.clientes?.toLocaleString()} clientes</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    💡 <strong>Insight:</strong> Clientes que vêm 6-10 vezes gastam <strong>R$ 110+</strong> por visita vs R$ 96 de quem vem 1x
                  </p>
                </div>
              </div>

              {/* PERMANÊNCIA VS GASTO */}
              <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  ⏱️ Tempo de Permanência vs Gasto
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {(data?.ultraInsights?.permanenciaVsGasto || []).map((item: any, idx: number) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{item.faixagasto}</div>
                      <div className="text-2xl font-bold text-purple-600">{item.tempomediomin} min</div>
                      <div className="text-xs text-gray-500">{item.clientes?.toLocaleString()} clientes</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    💡 Quem gasta <strong>R$1000+</strong> fica em média <strong>238 minutos</strong> (~4 horas)
                  </p>
                </div>
              </div>

              {/* ROI ARTISTAS */}
              <div className="bg-pink-50 dark:bg-pink-900/10 border border-pink-200 dark:border-pink-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🎤 ROI por Artista
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-2 font-semibold text-gray-900 dark:text-white">Artista</th>
                        <th className="pb-2 font-semibold text-gray-900 dark:text-white">Eventos</th>
                        <th className="pb-2 font-semibold text-gray-900 dark:text-white">Custo Médio</th>
                        <th className="pb-2 font-semibold text-gray-900 dark:text-white">Faturamento Médio</th>
                        <th className="pb-2 font-semibold text-gray-900 dark:text-white">ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.ultraInsights?.roiArtistas || []).filter((a: any) => a.roi > 1).slice(0, 7).map((artista: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 font-medium text-gray-900 dark:text-white">{artista.artista || 'Sem artista'}</td>
                          <td className="py-2 text-gray-600 dark:text-gray-400">{artista.eventos}</td>
                          <td className="py-2 text-red-600">R$ {Math.round(artista.custoartisticomedio)?.toLocaleString()}</td>
                          <td className="py-2 text-green-600">R$ {Math.round(artista.faturamentomedio)?.toLocaleString()}</td>
                          <td className="py-2">
                            <span className={`font-bold ${artista.roi > 5 ? 'text-green-600' : 'text-yellow-600'}`}>
                              {artista.roi}x
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TOP SEMANAS */}
              <div className="bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-200 dark:border-cyan-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  📅 Top 10 Semanas de Faturamento
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {(data?.ultraInsights?.topSemanas || []).slice(0, 10).map((semana: any, idx: number) => (
                    <div key={idx} className={`bg-white dark:bg-gray-800 rounded-lg p-4 ${
                      idx < 3 ? 'ring-2 ring-cyan-500' : ''
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">Sem {semana.semana}</span>
                        {idx < 3 && <span className="text-lg">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>}
                      </div>
                      <div className="text-xl font-bold text-cyan-600">R$ {(semana.faturamentototal / 1000).toFixed(0)}k</div>
                      <div className="text-xs text-gray-500">{semana.totalclientes?.toLocaleString()} clientes</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* TOP DIAS */}
              <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🏆 Top 10 Dias de Faturamento
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-2 font-semibold text-gray-900 dark:text-white">#</th>
                        <th className="pb-2 font-semibold text-gray-900 dark:text-white">Data</th>
                        <th className="pb-2 font-semibold text-gray-900 dark:text-white">Dia</th>
                        <th className="pb-2 font-semibold text-gray-900 dark:text-white">Artista</th>
                        <th className="pb-2 font-semibold text-gray-900 dark:text-white">Faturamento</th>
                        <th className="pb-2 font-semibold text-gray-900 dark:text-white">Clientes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.ultraInsights?.topDias || []).slice(0, 10).map((dia: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`}
                          </td>
                          <td className="py-2 font-medium text-gray-900 dark:text-white">{dia.data?.split('T')[0]}</td>
                          <td className="py-2 text-gray-600 dark:text-gray-400">{dia.diasemana}</td>
                          <td className="py-2 text-gray-600 dark:text-gray-400 truncate max-w-32">{dia.artista || '-'}</td>
                          <td className="py-2 font-bold text-green-600">R$ {Math.round(dia.faturamento)?.toLocaleString()}</td>
                          <td className="py-2 text-gray-600 dark:text-gray-400">{dia.clientes?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* RECORDES */}
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/10 dark:to-amber-900/10 border-2 border-yellow-400 dark:border-yellow-600 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🏅 Recordes Absolutos 2025
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-5 text-center ring-2 ring-yellow-400">
                    <div className="text-4xl mb-2">💰</div>
                    <div className="text-sm text-gray-500 mb-1">Maior Faturamento</div>
                    <div className="text-3xl font-bold text-green-600">R$ {Math.round(data?.ultraInsights?.recordes?.maiorFaturamento?.valor || 0)?.toLocaleString()}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">{data?.ultraInsights?.recordes?.maiorFaturamento?.data?.split('T')[0]}</div>
                    <div className="text-xs text-gray-500 truncate">{data?.ultraInsights?.recordes?.maiorFaturamento?.artista}</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-5 text-center ring-2 ring-blue-400">
                    <div className="text-4xl mb-2">👥</div>
                    <div className="text-sm text-gray-500 mb-1">Mais Clientes</div>
                    <div className="text-3xl font-bold text-blue-600">{data?.ultraInsights?.recordes?.maisClientes?.valor?.toLocaleString()}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">{data?.ultraInsights?.recordes?.maisClientes?.data?.split('T')[0]}</div>
                    <div className="text-xs text-gray-500 truncate">{data?.ultraInsights?.recordes?.maisClientes?.artista}</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-5 text-center ring-2 ring-purple-400">
                    <div className="text-4xl mb-2">🎟️</div>
                    <div className="text-sm text-gray-500 mb-1">Maior Ticket Médio</div>
                    <div className="text-3xl font-bold text-purple-600">R$ {data?.ultraInsights?.recordes?.maiorTicket?.valor?.toFixed(2)}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">{data?.ultraInsights?.recordes?.maiorTicket?.data?.split('T')[0]}</div>
                    <div className="text-xs text-gray-500 truncate">{data?.ultraInsights?.recordes?.maiorTicket?.artista}</div>
                  </div>
                </div>
              </div>

              {/* DRINKS MAIS RENTÁVEIS */}
              <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🍸 Top 10 Drinks Mais Rentáveis
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {(data?.ultraInsights?.drinksRentaveis || []).slice(0, 10).map((drink: any, idx: number) => (
                    <div key={idx} className={`bg-white dark:bg-gray-800 rounded-lg p-4 ${
                      idx < 3 ? 'ring-2 ring-rose-500' : ''
                    }`}>
                      <div className="text-xs font-semibold text-gray-900 dark:text-white mb-1 truncate">{drink.drink}</div>
                      <div className="text-lg font-bold text-rose-600">R$ {Math.round(drink.lucro / 1000)}k</div>
                      <div className="text-xs text-gray-500">{drink.quantidade?.toLocaleString()} vendidos</div>
                      <div className="text-xs text-green-600">{drink.margempercent}% margem</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PERFORMANCE POR DIA DA SEMANA */}
              <div className="bg-slate-50 dark:bg-slate-900/10 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  📆 Performance por Dia da Semana
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {(data?.ultraInsights?.performanceDiaSemana || []).slice(0, 7).map((dia: any, idx: number) => (
                    <div key={idx} className={`bg-white dark:bg-gray-800 rounded-lg p-4 text-center ${
                      idx === 0 ? 'ring-2 ring-green-500' : ''
                    }`}>
                      <div className="text-sm font-bold text-gray-900 dark:text-white mb-2">{dia.diasemana}</div>
                      <div className="text-xl font-bold text-green-600">R$ {(dia.faturamentototal / 1000000).toFixed(2)}M</div>
                      <div className="text-xs text-gray-500">{dia.eventos} eventos</div>
                      <div className="text-xs text-gray-500">{dia.totalclientes?.toLocaleString()} clientes</div>
                      <div className="text-xs text-blue-600">TM: R$ {dia.ticketmedio}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>}

            {/* TAB: INSIGHTS EXTRAS - DESABILITADO */}
            <TabsContent value="extras" className="space-y-6">
              <div className="text-center p-8">
                <p className="text-gray-500">Esta seção está em desenvolvimento.</p>
              </div>
            </TabsContent>

            {/* TAB: INSIGHTS EXTRAS - CONTEÚDO ORIGINAL COMENTADO */}
            {false && <div>
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  ⚡ Insights Extras - Análise Operacional
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  17 categorias de indicadores operacionais
                </p>
              </div>

              {/* TOP VENDEDORES/GARÇONS */}
              <div className="card-dark p-6">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🏆 Top Vendedores por Faturamento/Dia
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400">Funcionário</th>
                        <th className="text-center py-2 px-3 text-gray-600 dark:text-gray-400">Dias</th>
                        <th className="text-right py-2 px-3 text-gray-600 dark:text-gray-400">Fat. Total</th>
                        <th className="text-right py-2 px-3 text-gray-600 dark:text-gray-400">Fat./Dia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.insightsExtras?.topVendedores?.slice(0, 10).map((v: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            {idx === 0 && <span className="text-yellow-500">🥇</span>}
                            {idx === 1 && <span className="text-gray-400">🥈</span>}
                            {idx === 2 && <span className="text-amber-700">🥉</span>}
                            {v.funcionario}
                          </td>
                          <td className="py-2 px-3 text-center text-gray-700 dark:text-gray-300">{v.diastrabalhados}</td>
                          <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(v.faturamentototal)}</td>
                          <td className="py-2 px-3 text-right font-semibold text-green-600 dark:text-green-400">{formatCurrency(v.faturamentopordia)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CLIENTES FIÉIS E DORMENTES */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Clientes Fiéis */}
                <div className="card-dark p-6">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    ❤️ Clientes Mais Fiéis (20+ visitas)
                  </h4>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {data?.insightsExtras?.clientesFieis?.slice(0, 10).map((c: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{c.nome}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{c.visitas} visitas • {formatCurrency(c.gastoporvisita)}/visita</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-green-600 dark:text-green-400">{formatCurrency(c.totalgasto)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Clientes Dormentes */}
                <div className="card-dark p-6">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    😴 Clientes Dormentes (Oportunidade de Reativação)
                  </h4>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {data?.insightsExtras?.clientesDormentes?.slice(0, 10).map((c: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/10 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{c.nome}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{c.visitas} visitas • Gastou {formatCurrency(c.totalgasto)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-red-600 dark:text-red-400">{c.diassemvir} dias sem vir</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* HORÁRIO DE PICO */}
              <div className="card-dark p-6">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  ⏰ Horário de Pico por Hora
                </h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data?.insightsExtras?.horarioPico || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="hora" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#F9FAFB' }}
                    />
                    <Bar dataKey="mediaitenspordia" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Média Itens/Dia" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* SAZONALIDADE SEMANAL */}
              <div className="card-dark p-6">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  📅 Sazonalidade Semanal (Semana do Mês)
                </h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {data?.insightsExtras?.sazonalidadeSemana?.map((s: any, idx: number) => (
                    <div key={idx} className={`p-4 rounded-xl border ${idx === 2 ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'}`}>
                      <div className="text-center">
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">{s.semanames}</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(s.faturamentomedio)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.eventos} eventos • {Math.round(s.clientesmedio)} clientes/evento</div>
                        {idx === 2 && <div className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">🏆 Melhor Semana</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ANÁLISE DE CATEGORIAS */}
              <div className="card-dark p-6">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🏷️ Análise por Categoria
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400">Categoria</th>
                        <th className="text-center py-2 px-3 text-gray-600 dark:text-gray-400">Produtos</th>
                        <th className="text-right py-2 px-3 text-gray-600 dark:text-gray-400">Quantidade</th>
                        <th className="text-right py-2 px-3 text-gray-600 dark:text-gray-400">Faturamento</th>
                        <th className="text-right py-2 px-3 text-gray-600 dark:text-gray-400">Preço Médio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.insightsExtras?.analiseCategorias?.slice(0, 15).map((c: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">{c.categoria}</td>
                          <td className="py-2 px-3 text-center text-gray-700 dark:text-gray-300">{c.produtosdiferentes}</td>
                          <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{new Intl.NumberFormat('pt-BR').format(c.quantidadetotal)}</td>
                          <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">{formatCurrency(c.faturamentototal)}</td>
                          <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(c.precomediounitario)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* VENDAS POR LOCALIZAÇÃO */}
              <div className="card-dark p-6">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  📍 Vendas por Localização/Setor
                </h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {data?.insightsExtras?.vendasLocalizacao?.slice(0, 8).map((l: any, idx: number) => (
                    <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">{l.localizacao}</div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(l.faturamento)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{new Intl.NumberFormat('pt-BR').format(l.quantidadeitens)} itens</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ANÁLISE DE DESCONTOS */}
              <div className="card-dark p-6">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  💸 Evolução de Descontos por Mês
                </h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data?.insightsExtras?.analiseDescontos || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="mes" stroke="#9CA3AF" tickFormatter={(v) => ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][v] || v} />
                    <YAxis yAxisId="left" stroke="#9CA3AF" />
                    <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#F9FAFB' }}
                    />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="percentdesconto" stroke="#EF4444" strokeWidth={2} name="% com Desconto" />
                    <Line yAxisId="right" type="monotone" dataKey="totaldescontodado" stroke="#F59E0B" strokeWidth={2} name="Total R$ Desconto" />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-700 dark:text-green-400">
                    📉 <strong>Redução de 80% nos descontos!</strong> De 20.2% (Fev) para 4.3% (Dez). Excelente gestão!
                  </p>
                </div>
              </div>

              {/* NPS COMPLETO */}
              <div className="card-dark p-6">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  ⭐ NPS Consolidado 2025 ({data?.insightsExtras?.npsCompleto?.totalRespostas || 0} respostas)
                </h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'NPS Geral', value: data?.insightsExtras?.npsCompleto?.npsGeral, color: 'blue' },
                    { label: 'Ambiente', value: data?.insightsExtras?.npsCompleto?.ambiente, color: 'purple' },
                    { label: 'Atendimento', value: data?.insightsExtras?.npsCompleto?.atendimento, color: 'green' },
                    { label: 'Música', value: data?.insightsExtras?.npsCompleto?.musica, color: 'pink' },
                    { label: 'Drink', value: data?.insightsExtras?.npsCompleto?.drink, color: 'amber' },
                    { label: 'Comida', value: data?.insightsExtras?.npsCompleto?.comida, color: 'orange' },
                    { label: 'Preço', value: data?.insightsExtras?.npsCompleto?.preco, color: 'cyan' },
                    { label: 'Limpeza', value: data?.insightsExtras?.npsCompleto?.limpeza, color: 'emerald' },
                  ].map((nps, idx) => (
                    <div key={idx} className={`p-4 rounded-xl border bg-${nps.color}-50 dark:bg-${nps.color}-900/10 border-${nps.color}-200 dark:border-${nps.color}-800`}>
                      <div className="text-center">
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">{nps.label}</div>
                        <div className={`text-3xl font-bold mt-1 ${nps.value >= 9 ? 'text-green-600 dark:text-green-400' : nps.value >= 7 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                          {nps.value?.toFixed(1) || '-'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    ⚠️ <strong>Oportunidade de melhoria:</strong> Drink (7.32) e Comida (7.62) estão abaixo de 8.0. Priorizar essas áreas em 2026.
                  </p>
                </div>
              </div>

              {/* HH VS NORMAL */}
              <div className="card-dark p-6">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🍺 Happy Hour vs Preço Normal
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-200 dark:border-orange-800">
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">🌅 Happy Hour</div>
                      <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-2">
                        {formatCurrency(data?.insightsExtras?.hhVsNormal?.happyHour?.precoMedio || 0)}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Preço Médio por Item</div>
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {new Intl.NumberFormat('pt-BR').format(data?.insightsExtras?.hhVsNormal?.happyHour?.quantidade || 0)} itens • {formatCurrency(data?.insightsExtras?.hhVsNormal?.happyHour?.faturamento || 0)}
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">🌙 Preço Normal</div>
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                        {formatCurrency(data?.insightsExtras?.hhVsNormal?.precoNormal?.precoMedio || 0)}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Preço Médio por Item</div>
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {new Intl.NumberFormat('pt-BR').format(data?.insightsExtras?.hhVsNormal?.precoNormal?.quantidade || 0)} itens • {formatCurrency(data?.insightsExtras?.hhVsNormal?.precoNormal?.faturamento || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CRESCIMENTO MÊS A MÊS */}
              <div className="card-dark p-6">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  📈 Crescimento Mês a Mês (MoM)
                </h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data?.insightsExtras?.crescimentoMoM || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="mes" stroke="#9CA3AF" tickFormatter={(v) => ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][v] || v} />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#F9FAFB' }}
                      formatter={(value: any) => [`${value?.toFixed(1) || 0}%`, 'Crescimento']}
                    />
                    <Bar 
                      dataKey="crescimentopercent" 
                      radius={[4, 4, 0, 0]} 
                      name="Crescimento %" 
                    >
                      {(data?.insightsExtras?.crescimentoMoM || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry?.crescimentopercent >= 0 ? '#10B981' : '#EF4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Melhor Mês</div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">Julho +47.5%</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400">2º Melhor</div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">Abril +47.2%</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400">3º Melhor</div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">Outubro +29.2%</div>
                  </div>
                </div>
              </div>

              {/* TEMPO DE PRODUÇÃO */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tempo por Local */}
                <div className="card-dark p-6">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    ⏱️ Tempo Médio por Setor
                  </h4>
                  <div className="space-y-3">
                    {data?.insightsExtras?.tempoPorLocal?.map((t: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <span className="font-medium text-gray-900 dark:text-white">{t.localizacao}</span>
                        <span className={`font-semibold ${t.tempomediomin <= 5 ? 'text-green-600 dark:text-green-400' : t.tempomediomin <= 10 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                          {t.tempomediomin} min
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Produtos Lentos */}
                <div className="card-dark p-6">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    🐢 Produtos Mais Lentos
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {data?.insightsExtras?.produtosLentos?.slice(0, 8).map((p: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/10 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white text-sm">{p.produto}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{p.categoria}</div>
                        </div>
                        <span className="text-sm font-semibold text-red-600 dark:text-red-400">{p.tempomediomin} min</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* PRODUTOS RÁPIDOS */}
              <div className="card-dark p-6">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🚀 Produtos Mais Rápidos
                </h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {data?.insightsExtras?.produtosRapidos?.slice(0, 8).map((p: any, idx: number) => (
                    <div key={idx} className="p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="font-medium text-gray-900 dark:text-white text-sm truncate">{p.produto}</div>
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">{p.tempomediomin} min</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ARTISTAS COM MAIOR TICKET */}
              <div className="card-dark p-6">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🎵 Artistas com Maior Ticket Médio
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400">Artista</th>
                        <th className="text-center py-2 px-3 text-gray-600 dark:text-gray-400">Eventos</th>
                        <th className="text-right py-2 px-3 text-gray-600 dark:text-gray-400">Ticket Médio</th>
                        <th className="text-right py-2 px-3 text-gray-600 dark:text-gray-400">Média Clientes</th>
                        <th className="text-right py-2 px-3 text-gray-600 dark:text-gray-400">Fat. Médio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.insightsExtras?.artistasMaiorTicket?.map((a: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">{a.artista}</td>
                          <td className="py-2 px-3 text-center text-gray-700 dark:text-gray-300">{a.eventos}</td>
                          <td className="py-2 px-3 text-right font-semibold text-green-600 dark:text-green-400">{formatCurrency(a.ticketmedio)}</td>
                          <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{Math.round(a.mediaclientes)}</td>
                          <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(a.faturamentomedio)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* EVOLUÇÃO PREÇO DRINK */}
              <div className="card-dark p-6">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🍸 Evolução do Preço Médio do Drink
                </h4>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={data?.insightsExtras?.evolucaoPrecoDrink || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="mes" stroke="#9CA3AF" tickFormatter={(v) => ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][v] || v} />
                    <YAxis stroke="#9CA3AF" domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#F9FAFB' }}
                      formatter={(value: any) => [formatCurrency(value), 'Preço Médio']}
                    />
                    <Line type="monotone" dataKey="precomediodrink" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-sm text-purple-700 dark:text-purple-400">
                    📈 <strong>Aumento de +5.2%</strong> no preço médio do drink: de R$ 27,28 (Fev) para R$ 28,71 (Dez)
                  </p>
                </div>
              </div>

              {/* ITENS POR MESA */}
              <div className="card-dark p-6">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🍽️ Evolução de Itens por Mesa
                </h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data?.insightsExtras?.itensPorMesa || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="mes" stroke="#9CA3AF" tickFormatter={(v) => ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][v] || v} />
                    <YAxis yAxisId="left" stroke="#9CA3AF" />
                    <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#F9FAFB' }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="mediaitenspormesa" fill="#10B981" radius={[4, 4, 0, 0]} name="Média Itens/Mesa" />
                    <Bar yAxisId="right" dataKey="valormediomesa" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Valor Médio Mesa (R$)" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Crescimento Itens/Mesa</div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">+152%</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">De 3.6 (Fev) para 9.1 (Ago)</div>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Crescimento Valor/Mesa</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">+47%</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">De R$ 64,30 (Fev) para R$ 94,52 (Dez)</div>
                  </div>
                </div>
              </div>
            </div>}

            {/* TAB: PLANEJAMENTO 2026 */}
            <TabsContent value="2026" className="space-y-6">
              {/* Header */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  🚀 Planejamento Estratégico 2026
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Oportunidades identificadas e metas sugeridas
                </p>
              </div>

              {/* OPORTUNIDADE RETENÇÃO */}
              <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10 border-2 border-red-300 dark:border-red-700 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    🎯 OPORTUNIDADE #1: Retenção de Clientes
                  </h4>
                  <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">PRIORIDADE</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                    <div className="text-sm text-gray-500 mb-1">Clientes perdidos</div>
                    <div className="text-3xl font-bold text-red-600">{data?.oportunidades?.oportunidadeRetencao?.clientesSoUmaVez?.toLocaleString()}</div>
                    <div className="text-sm text-gray-500">{data?.oportunidades?.oportunidadeRetencao?.percentualPerdido}% do total</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                    <div className="text-sm text-gray-500 mb-1">Potencial de Recuperação</div>
                    <div className="text-3xl font-bold text-green-600">{formatCurrency(data?.oportunidades?.oportunidadeRetencao?.potencialRecuperacao || 0)}</div>
                    <div className="text-sm text-gray-500">Se cada cliente voltar</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                    <div className="text-sm text-gray-500 mb-1">Ação Sugerida</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{data?.oportunidades?.oportunidadeRetencao?.acaoSugerida}</div>
                  </div>
                </div>
              </div>

              {/* METAS 2026 */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🎯 Metas Sugeridas 2026
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">Faturamento</span>
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-green-600">R$ 15M</div>
                    <div className="text-xs text-gray-500 mt-1">{data?.oportunidades?.metasSugeridas2026?.faturamento?.baseado}</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">Clientes Ativos</span>
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-blue-600">6.000</div>
                    <div className="text-xs text-gray-500 mt-1">{data?.oportunidades?.metasSugeridas2026?.clientesAtivos?.baseado}</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">Ticket Médio</span>
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="text-2xl font-bold text-purple-600">R$ 110</div>
                    <div className="text-xs text-gray-500 mt-1">{data?.oportunidades?.metasSugeridas2026?.ticketMedio?.baseado}</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">Happy Hour</span>
                      <Calendar className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="text-2xl font-bold text-amber-600">20%</div>
                    <div className="text-xs text-gray-500 mt-1">{data?.oportunidades?.metasSugeridas2026?.happyHour?.baseado}</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">NPS</span>
                      <Star className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div className="text-2xl font-bold text-yellow-600">9.5</div>
                    <div className="text-xs text-gray-500 mt-1">{data?.oportunidades?.metasSugeridas2026?.nps?.baseado}</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">Instagram</span>
                      <Instagram className="w-5 h-5 text-pink-600" />
                    </div>
                    <div className="text-2xl font-bold text-pink-600">80k</div>
                    <div className="text-xs text-gray-500 mt-1">{data?.oportunidades?.metasSugeridas2026?.instagram?.baseado}</div>
                  </div>
                </div>
              </div>

              {/* ARTISTAS QUE AUMENTAM TICKET */}
              <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🎤 Artistas que Aumentam o Ticket
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(data?.oportunidades?.artistasQueAumentamTicket || []).slice(0, 6).map((artista: any, idx: number) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-4">
                      <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">{artista.artista}</div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-gray-500">{artista.shows} shows</span>
                        <span className={`font-bold ${artista.diferencaticketgeral > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {artista.diferencaticketgeral > 0 ? '+' : ''}R$ {artista.diferencaticketgeral}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Ticket: {formatCurrency(artista.ticketmedio)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* FERIADOS 2026 */}
              <div className="bg-gradient-to-br from-indigo-50 to-cyan-50 dark:from-indigo-900/10 dark:to-cyan-900/10 border border-indigo-200 dark:border-indigo-800 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  📅 Feriados 2026 - Planejamento
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(data?.oportunidades?.feriados2026 || []).slice(0, 9).map((feriado: any, idx: number) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full">
                          {feriado.data}
                        </span>
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-white text-sm">{feriado.feriado}</div>
                      <div className="text-xs text-green-600 dark:text-green-400 mt-2">💡 {feriado.acao}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PERFORMANCE FERIADOS 2025 */}
              {data?.oportunidades?.performanceFeriados && (
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    📊 Performance Feriados 2025 (Referência)
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          <th className="pb-2 font-medium">Data</th>
                          <th className="pb-2 font-medium">Feriado</th>
                          <th className="pb-2 font-medium">Evento</th>
                          <th className="pb-2 font-medium text-right">Clientes</th>
                          <th className="pb-2 font-medium text-right">Faturamento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data?.oportunidades?.performanceFeriados || []).slice(0, 8).map((fer: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-100 dark:border-gray-700/50">
                            <td className="py-2 text-gray-600 dark:text-gray-400">{fer.data} ({fer.diasemana})</td>
                            <td className="py-2">
                              <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                                {fer.tipoferiado}
                              </span>
                            </td>
                            <td className="py-2 font-medium text-gray-900 dark:text-white">{fer.evento}</td>
                            <td className="py-2 text-right text-purple-600 dark:text-purple-400">{fer.clientes}</td>
                            <td className="py-2 text-right font-bold text-green-600 dark:text-green-400">{formatCurrency(fer.faturamento)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* MENSAGEM FINAL */}
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-8 text-center text-white">
                <Trophy className="w-16 h-16 mx-auto mb-4" />
                <h3 className="text-3xl font-bold mb-2">
                  2026 será ainda melhor! 🚀
                </h3>
                <p className="text-lg opacity-90 mb-4">
                  Com essas estratégias, vocês vão dominar o mercado!
                </p>
                <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto text-sm">
                  <div className="bg-white/20 rounded-lg p-3">
                    <div className="font-bold text-xl">+35%</div>
                    <div className="opacity-80">Meta Faturamento</div>
                  </div>
                  <div className="bg-white/20 rounded-lg p-3">
                    <div className="font-bold text-xl">6k</div>
                    <div className="opacity-80">Clientes Ativos</div>
                  </div>
                  <div className="bg-white/20 rounded-lg p-3">
                    <div className="font-bold text-xl">R$15M</div>
                    <div className="opacity-80">Faturamento</div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  )
}
