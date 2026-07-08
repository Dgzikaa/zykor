'use client'

import { useEffect, useState } from 'react'
import { usePageTitle } from '@/contexts/PageTitleContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Brain, TrendingUp, AlertTriangle, Clock, Eye, Archive, PlayCircle, Settings as SettingsIcon, Activity, DollarSign, Users, Star, ThumbsUp, ThumbsDown, MessageCircle } from 'lucide-react'
import { useBarContext } from '@/contexts/BarContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface Insight {
  id: string
  tipo: 'oportunidade' | 'alerta' | 'tendencia' | 'anomalia'
  categoria: 'operacional' | 'financeiro' | 'experiencia' | 'equipe'
  titulo: string
  descricao: string
  impacto: 'baixo' | 'medio' | 'alto' | 'critico'
  acao_sugerida: string
  prioridade: number
  visualizado: boolean
  created_at: string
}

interface Alerta {
  id: string
  tipo_alerta: string
  severidade: 'info' | 'warning' | 'error' | 'critical'
  mensagem: string
  lido: boolean
  created_at: string
}

interface Scan {
  id: string
  tipo_scan: string
  status: string
  insights_encontrados: number
  alertas_gerados: number
  tempo_execucao_ms: number
  created_at: string
}

export default function AgenteInteligentePage() {
  const { selectedBar } = useBarContext()
  const { setPageTitle } = usePageTitle()
  const barId = selectedBar?.id
  const [insights, setInsights] = useState<Insight[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')

  useEffect(() => {
    setPageTitle('🤖 Agente Inteligente')
    return () => setPageTitle('')
  }, [setPageTitle])

  useEffect(() => {
    if (barId) {
      carregarDados()
    }
  }, [barId])

  const carregarDados = async () => {
    setLoading(true)
    try {
      await Promise.all([
        carregarInsights(),
        carregarAlertas(),
        carregarScans()
      ])
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const carregarInsights = async () => {
    try {
      const response = await fetch(`/api/agente/insights?bar_id=${barId}`)
      const data = await response.json()
      setInsights(data.insights || [])
    } catch (error) {
      console.error('Erro ao carregar insights:', error)
    }
  }

  const carregarAlertas = async () => {
    try {
      const response = await fetch(`/api/agente/alertas?bar_id=${barId}&lido=false`)
      const data = await response.json()
      setAlertas(data.alertas || [])
    } catch (error) {
      console.error('Erro ao carregar alertas:', error)
    }
  }

  const carregarScans = async () => {
    try {
      const response = await fetch(`/api/agente/scan?bar_id=${barId}&limit=5`)
      const data = await response.json()
      setScans(data.scans || [])
    } catch (error) {
      console.error('Erro ao carregar scans:', error)
    }
  }

  const iniciarScan = async () => {
    setScanning(true)
    try {
      const response = await fetch('/api/agente/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: barId, tipo_scan: 'completo' })
      })

      if (response.ok) {
        setTimeout(() => {
          carregarDados()
        }, 2000)
      }
    } catch (error) {
      console.error('Erro ao iniciar scan:', error)
    } finally {
      setScanning(false)
    }
  }

  const marcarComoVisualizado = async (insightId: string) => {
    try {
      await fetch('/api/agente/insights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insight_id: insightId, visualizado: true })
      })
      carregarInsights()
    } catch (error) {
      console.error('Erro ao marcar como visualizado:', error)
    }
  }

  const arquivarInsight = async (insightId: string) => {
    try {
      await fetch('/api/agente/insights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insight_id: insightId, arquivado: true })
      })
      carregarInsights()
    } catch (error) {
      console.error('Erro ao arquivar insight:', error)
    }
  }

  const marcarAlertaComoLido = async (alertaId: string) => {
    try {
      await fetch('/api/agente/alertas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alerta_id: alertaId, lido: true })
      })
      carregarAlertas()
    } catch (error) {
      console.error('Erro ao marcar alerta como lido:', error)
    }
  }

  const darFeedback = async (tipo: 'insight' | 'alerta', referenciaId: string, feedback: 'util' | 'neutro' | 'inutil') => {
    try {
      const response = await fetch('/api/agente/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: barId,
          tipo,
          referencia_id: parseInt(referenciaId),
          feedback
        })
      })

      if (!response.ok) {
        throw new Error('Erro ao enviar feedback')
      }

      toast.success('✅ Feedback registrado!', {
        description: feedback === 'util' 
          ? '🧠 Agente vai priorizar mais conteúdo assim'
          : '🔄 Agente vai evitar alertas similares'
      })

      // Remover o item da lista após feedback
      if (tipo === 'insight') {
        await arquivarInsight(referenciaId)
      } else {
        await marcarAlertaComoLido(referenciaId)
      }

    } catch (error: any) {
      console.error('Erro ao dar feedback:', error)
      toast.error('Erro ao registrar feedback', {
        description: error.message
      })
    }
  }

  const getImpactoBadge = (impacto: string) => {
    const classes = {
      baixo: 'badge-info',
      medio: 'badge-warning',
      alto: 'badge-error',
      critico: 'badge-error'
    }
    return classes[impacto as keyof typeof classes] || 'badge-info'
  }

  const getTipoBadge = (tipo: string) => {
    const classes = {
      oportunidade: 'badge-success',
      alerta: 'badge-warning',
      tendencia: 'badge-info',
      anomalia: 'badge-error'
    }
    return classes[tipo as keyof typeof classes] || 'badge-info'
  }

  const getCategoriaIcon = (categoria: string) => {
    const icons = {
      operacional: Activity,
      financeiro: DollarSign,
      experiencia: Star,
      equipe: Users
    }
    const Icon = icons[categoria as keyof typeof icons] || Activity
    return <Icon className="w-4 h-4" />
  }

  const insightsFiltrados = insights.filter(insight => {
    if (filtroCategoria !== 'todas' && insight.categoria !== filtroCategoria) return false
    if (filtroTipo !== 'todos' && insight.tipo !== filtroTipo) return false
    return true
  })

  const insightsNaoVisualizados = insights.filter(i => !i.visualizado).length
  const alertasNaoLidos = alertas.filter(a => !a.lido).length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Brain className="w-12 h-12 mx-auto mb-4 text-blue-600 dark:text-blue-400 animate-pulse" />
              <p className="text-gray-600 dark:text-gray-400">Carregando insights...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="card-dark p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Brain className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="card-description-dark">
                  Insights automáticos sobre o seu negócio
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={iniciarScan}
                disabled={scanning}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
              >
                {scanning ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Executar Análise
                  </>
                )}
              </Button>
              <Button
                onClick={() => window.location.href = '/visao-geral/agente-chat'}
                variant="outline"
                className="border-gray-300 dark:border-gray-600"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat com Agente
              </Button>
              <Button
                onClick={() => window.location.href = '/configuracoes/agente-inteligente'}
                variant="outline"
                className="border-gray-300 dark:border-gray-600"
              >
                <SettingsIcon className="w-4 h-4 mr-2" />
                Configurações
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Insights Novos</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {insightsNaoVisualizados}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Alertas Ativos</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {alertasNaoLidos}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Insights</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {insights.length}
                  </p>
                </div>
                <Brain className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Última Análise</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {scans[0] ? new Date(scans[0].created_at).toLocaleString('pt-BR') : 'Nunca'}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="insights" className="space-y-4">
          <TabsList className="bg-gray-100 dark:bg-gray-700">
            <TabsTrigger value="insights" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white dark:text-gray-300">
              <TrendingUp className="w-4 h-4 mr-2" />
              Insights ({insights.length})
            </TabsTrigger>
            <TabsTrigger value="alertas" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white dark:text-gray-300">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Alertas ({alertasNaoLidos})
            </TabsTrigger>
            <TabsTrigger value="historico" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white dark:text-gray-300">
              <Clock className="w-4 h-4 mr-2" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-4">
            {/* Filtros */}
            <div className="card-dark p-4">
              <div className="flex gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Categoria
                  </label>
                  <select
                    value={filtroCategoria}
                    onChange={(e) => setFiltroCategoria(e.target.value)}
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg px-3 py-2"
                  >
                    <option value="todas">Todas</option>
                    <option value="operacional">Operacional</option>
                    <option value="financeiro">Financeiro</option>
                    <option value="experiencia">Experiência</option>
                    <option value="equipe">Equipe</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Tipo
                  </label>
                  <select
                    value={filtroTipo}
                    onChange={(e) => setFiltroTipo(e.target.value)}
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg px-3 py-2"
                  >
                    <option value="todos">Todos</option>
                    <option value="oportunidade">Oportunidade</option>
                    <option value="alerta">Alerta</option>
                    <option value="tendencia">Tendência</option>
                    <option value="anomalia">Anomalia</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Lista de Insights */}
            {insightsFiltrados.length === 0 ? (
              <div className="card-dark p-12 text-center">
                <Brain className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
                <p className="text-gray-600 dark:text-gray-400">
                  Nenhum insight encontrado. Execute uma análise para gerar insights.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {insightsFiltrados.map((insight) => (
                  <div
                    key={insight.id}
                    className={`card-dark p-6 ${!insight.visualizado ? 'border-l-4 border-blue-500' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getCategoriaIcon(insight.categoria)}
                        <div>
                          <h3 className="card-title-dark text-base mb-1">{insight.titulo}</h3>
                          <div className="flex gap-2">
                            <Badge className={getTipoBadge(insight.tipo)}>
                              {insight.tipo}
                            </Badge>
                            <Badge className={getImpactoBadge(insight.impacto)}>
                              Impacto: {insight.impacto}
                            </Badge>
                            <Badge variant="outline" className="text-gray-600 dark:text-gray-400">
                              {insight.categoria}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => darFeedback('insight', insight.id, 'util')}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                          title="Útil - Agente vai priorizar mais conteúdo assim"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => darFeedback('insight', insight.id, 'inutil')}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Não útil - Agente vai evitar alertas similares"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </Button>
                        {!insight.visualizado && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => marcarComoVisualizado(insight.id)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => arquivarInsight(insight.id)}
                        >
                          <Archive className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-3">{insight.descricao}</p>
                    {insight.acao_sugerida && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-3 rounded">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                          💡 Ação sugerida:
                        </p>
                        <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">
                          {insight.acao_sugerida}
                        </p>
                      </div>
                    )}
                    <div className="mt-3 text-xs text-gray-500 dark:text-gray-500">
                      {new Date(insight.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Alertas Tab */}
          <TabsContent value="alertas" className="space-y-4">
            {alertas.length === 0 ? (
              <div className="card-dark p-12 text-center">
                <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
                <p className="text-gray-600 dark:text-gray-400">
                  Nenhum alerta ativo no momento.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {alertas.map((alerta) => (
                  <div
                    key={alerta.id}
                    className={`card-dark p-4 ${!alerta.lido ? 'border-l-4 border-red-500' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className={`w-5 h-5 ${
                          alerta.severidade === 'critical' ? 'text-red-600' :
                          alerta.severidade === 'error' ? 'text-red-500' :
                          alerta.severidade === 'warning' ? 'text-yellow-500' :
                          'text-blue-500'
                        }`} />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {alerta.mensagem}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(alerta.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => darFeedback('alerta', alerta.id, 'util')}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                          title="Útil"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => darFeedback('alerta', alerta.id, 'inutil')}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Não útil"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </Button>
                        {!alerta.lido && (
                          <Button
                            size="sm"
                            onClick={() => marcarAlertaComoLido(alerta.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            Marcar como lido
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Histórico Tab */}
          <TabsContent value="historico" className="space-y-4">
            {scans.length === 0 ? (
              <div className="card-dark p-12 text-center">
                <Clock className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
                <p className="text-gray-600 dark:text-gray-400">
                  Nenhuma análise realizada ainda.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {scans.map((scan) => (
                  <div key={scan.id} className="card-dark p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          Análise {scan.tipo_scan}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(scan.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <div className="text-center">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {scan.insights_encontrados}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400">Insights</p>
                        </div>
                        <div className="text-center">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {scan.alertas_gerados}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400">Alertas</p>
                        </div>
                        <div className="text-center">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {(scan.tempo_execucao_ms / 1000).toFixed(1)}s
                          </p>
                          <p className="text-gray-600 dark:text-gray-400">Tempo</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
