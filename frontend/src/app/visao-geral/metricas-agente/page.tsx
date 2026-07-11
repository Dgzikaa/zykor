'use client'

import { useEffect, useState } from 'react'
import { usePageTitle } from '@/contexts/PageTitleContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Activity, DollarSign, Star, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useBarContext } from '@/contexts/BarContext'
import { GraficoLinha } from '@/components/graficos/Charts'

interface Metrica {
  id: string
  categoria: string
  metrica: string
  valor: number
  valor_anterior: number
  variacao_percentual: number
  periodo_referencia: string
  created_at: string
  metadata?: any
}

export default function MetricasAgentePage() {
  const { selectedBar } = useBarContext()
  const { setPageTitle } = usePageTitle()
  const barId = selectedBar?.id
  const [metricas, setMetricas] = useState<{ [categoria: string]: Metrica[] }>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setPageTitle('📊 Métricas do Agente Inteligente')
    return () => setPageTitle('')
  }, [setPageTitle])

  useEffect(() => {
    if (barId) {
      carregarMetricas()
    }
  }, [barId])

  const carregarMetricas = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/agente/metricas?bar_id=${barId}`)
      const data = await response.json()
      setMetricas(data.metricas || {})
    } catch (error) {
      console.error('Erro ao carregar métricas:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCategoriaIcon = (categoria: string) => {
    const icons = {
      operacional: Activity,
      financeiro: DollarSign,
      experiencia: Star,
      equipe: Users
    }
    return icons[categoria as keyof typeof icons] || Activity
  }

  const getTendenciaIcon = (variacao: number) => {
    if (variacao > 0) return <TrendingUp className="w-4 h-4 text-green-600" />
    if (variacao < 0) return <TrendingDown className="w-4 h-4 text-red-600" />
    return <Minus className="w-4 h-4 text-gray-400" />
  }

  const formatarMetrica = (metrica: string, valor: number) => {
    if (metrica.includes('percentual') || metrica.includes('taxa') || metrica.includes('nps')) {
      return `${valor.toFixed(1)}%`
    }
    if (metrica.includes('vendas') || metrica.includes('faturamento') || metrica.includes('ticket')) {
      return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    }
    return valor.toFixed(0)
  }

  const prepararDadosGrafico = (metricasCategoria: Metrica[]) => {
    return metricasCategoria
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(-10)
      .map(m => ({
        data: new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        valor: m.valor,
        nome: m.metrica
      }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-600 dark:text-gray-400">Carregando métricas...</p>
          </div>
        </div>
      </div>
    )
  }

  const categorias = Object.keys(metricas)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="card-dark p-6 mb-6">
          <p className="card-description-dark">
            Acompanhe as principais métricas coletadas e analisadas pelo agente
          </p>
        </div>

        {categorias.length === 0 ? (
          <div className="card-dark p-12 text-center">
            <Activity className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
            <p className="text-gray-600 dark:text-gray-400">
              Nenhuma métrica coletada ainda. Execute uma análise do agente para gerar métricas.
            </p>
          </div>
        ) : (
          <Tabs defaultValue={categorias[0]} className="space-y-4">
            <TabsList className="bg-gray-100 dark:bg-gray-700">
              {categorias.map(categoria => {
                const Icon = getCategoriaIcon(categoria)
                return (
                  <TabsTrigger 
                    key={categoria} 
                    value={categoria}
                    className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white dark:text-gray-300"
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {categoria.charAt(0).toUpperCase() + categoria.slice(1)}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {categorias.map(categoria => {
              const metricasCategoria = metricas[categoria] || []
              const metricasUnicas = Array.from(new Set(metricasCategoria.map(m => m.metrica)))

              return (
                <TabsContent key={categoria} value={categoria} className="space-y-6">
                  {/* Cards de Métricas Resumidas */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {metricasUnicas.slice(0, 6).map(nomeMetrica => {
                      const metricasEspecificas = metricasCategoria
                        .filter(m => m.metrica === nomeMetrica)
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      
                      const metricaAtual = metricasEspecificas[0]
                      if (!metricaAtual) return null

                      return (
                        <div key={nomeMetrica} className="card-dark p-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {nomeMetrica.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </p>
                            {metricaAtual.variacao_percentual && getTendenciaIcon(metricaAtual.variacao_percentual)}
                          </div>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                            {formatarMetrica(nomeMetrica, metricaAtual.valor)}
                          </p>
                          {metricaAtual.variacao_percentual && (
                            <p className={`text-xs ${
                              metricaAtual.variacao_percentual > 0 ? 'text-green-600' :
                              metricaAtual.variacao_percentual < 0 ? 'text-red-600' :
                              'text-gray-400'
                            }`}>
                              {metricaAtual.variacao_percentual > 0 ? '+' : ''}
                              {metricaAtual.variacao_percentual.toFixed(1)}% vs anterior
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Gráficos de Evolução */}
                  {metricasUnicas.map(nomeMetrica => {
                    const metricasEspecificas = metricasCategoria.filter(m => m.metrica === nomeMetrica)
                    if (metricasEspecificas.length < 2) return null

                    const dadosGrafico = prepararDadosGrafico(metricasEspecificas)

                    return (
                      <div key={nomeMetrica} className="card-dark p-6">
                        <h3 className="card-title-dark text-base mb-4">
                          {nomeMetrica.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </h3>
                        <GraficoLinha
                          data={dadosGrafico}
                          xKey="data"
                          series={[{ key: 'valor', nome: 'Valor', cor: '#3B82F6' }]}
                          height={300}
                        />
                      </div>
                    )
                  })}

                  {/* Tabela de Todas as Métricas */}
                  <div className="card-dark p-6">
                    <h3 className="card-title-dark text-base mb-4">Todas as Métricas</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                              Métrica
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                              Valor
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                              Período
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white">
                              Data
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {metricasCategoria.slice(0, 20).map((metrica) => (
                            <tr key={metrica.id}>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                {metrica.metrica.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                {formatarMetrica(metrica.metrica, metrica.valor)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                {metrica.periodo_referencia}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                {new Date(metrica.created_at).toLocaleString('pt-BR')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>
        )}
      </div>
    </div>
  )
}
