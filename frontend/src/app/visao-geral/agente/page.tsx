'use client'

import { useState, useEffect, useRef } from 'react'
import { usePageTitle } from '@/contexts/PageTitleContext'
import { useBarContext } from '@/contexts/BarContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Bot, Send, Loader2, ThumbsUp, ThumbsDown, Sparkles, TrendingUp, AlertTriangle, BarChart3, Brain, MessageCircle, Eye, Archive } from 'lucide-react'
import { toast } from 'sonner'

interface Mensagem {
  id: number
  tipo: 'usuario' | 'agente'
  conteudo: string
  timestamp: string
  aprendizado_detectado?: boolean
  metrics?: any
}

interface Insight {
  id: string
  tipo: string
  titulo: string
  descricao: string
  criticidade: string
  acao_sugerida: string
  visualizado: boolean
  created_at: string
}

interface Metricas {
  total_regras: number
  regras_ativas: number
  regras_por_origem: { conversa: number; feedback: number; observacao: number }
  total_memorias: number
  total_feedbacks: number
  feedbacks_uteis: number
  taxa_sucesso: string
  total_insights: number
  total_alertas: number
  total_conversas: number
  conversas_com_aprendizado: number
  custo_total_usd: string
  custo_total_brl: string
  tokens_total: number
  evolucao_7_dias: Record<string, number>
}

export default function AgentePage() {
  const { selectedBar } = useBarContext()
  const { setPageTitle } = usePageTitle()
  const [activeTab, setActiveTab] = useState('insights')
  
  // Chat state
  const [mensagem, setMensagem] = useState('')
  const [conversas, setConversas] = useState<Mensagem[]>([])
  const [loadingChat, setLoadingChat] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Insights state
  const [insights, setInsights] = useState<Insight[]>([])
  const [loadingInsights, setLoadingInsights] = useState(true)
  
  // Métricas state
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [loadingMetricas, setLoadingMetricas] = useState(true)

  useEffect(() => {
    setPageTitle('🤖 Agente')
    return () => setPageTitle('')
  }, [setPageTitle])

  useEffect(() => {
    if (selectedBar) {
      carregarInsights()
      carregarMetricas()
    }
  }, [selectedBar])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [conversas])

  const carregarInsights = async () => {
    if (!selectedBar) return
    try {
      setLoadingInsights(true)
      const response = await fetch(`/api/agente/insights?bar_id=${selectedBar}`)
      const data = await response.json()
      setInsights(data.insights || [])
    } catch (error) {
      console.error('Erro ao carregar insights:', error)
    } finally {
      setLoadingInsights(false)
    }
  }

  const carregarMetricas = async () => {
    if (!selectedBar) return
    try {
      setLoadingMetricas(true)
      const response = await fetch(`/api/agente/evolucao?bar_id=${selectedBar}`)
      const data = await response.json()
      setMetricas(data.metricas)
    } catch (error) {
      console.error('Erro ao carregar métricas:', error)
    } finally {
      setLoadingMetricas(false)
    }
  }

  const enviarMensagem = async () => {
    if (!mensagem.trim() || !selectedBar || loadingChat) return

    const mensagemUsuario: Mensagem = {
      id: Date.now(),
      tipo: 'usuario',
      conteudo: mensagem,
      timestamp: new Date().toISOString()
    }

    setConversas(prev => [...prev, mensagemUsuario])
    setMensagem('')
    setLoadingChat(true)

    try {
      const response = await fetch('/api/agente/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: selectedBar, mensagem })
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error)

      const respostaAgente: Mensagem = {
        id: Date.now() + 1,
        tipo: 'agente',
        conteudo: data.resposta,
        timestamp: new Date().toISOString(),
        aprendizado_detectado: data.aprendizado_detectado,
        metrics: data.metrics
      }

      setConversas(prev => [...prev, respostaAgente])

      if (data.aprendizado_detectado) {
        toast.success('🧠 Agente aprendeu algo novo!', {
          description: 'Essa informação foi salva na memória'
        })
        carregarMetricas() // Atualizar métricas
      }
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error)
      toast.error('Erro ao enviar mensagem', { description: error.message })
      setConversas(prev => prev.filter(m => m.id !== mensagemUsuario.id))
    } finally {
      setLoadingChat(false)
    }
  }

  const darFeedback = async (insightId: string, feedback: 'util' | 'inutil') => {
    try {
      const response = await fetch('/api/agente/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: selectedBar,
          tipo: 'insight',
          referencia_id: parseInt(insightId),
          feedback
        })
      })

      if (!response.ok) throw new Error('Erro ao enviar feedback')

      toast.success('✅ Feedback registrado!', {
        description: feedback === 'util' 
          ? '🧠 Agente vai priorizar mais conteúdo assim'
          : '🔄 Agente vai evitar alertas similares'
      })

      // Remover insight da lista
      setInsights(prev => prev.filter(i => i.id !== insightId))
      carregarMetricas() // Atualizar métricas
    } catch (error: any) {
      toast.error('Erro ao registrar feedback', { description: error.message })
    }
  }

  if (!selectedBar) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
            <p className="text-gray-600 dark:text-gray-400">
              Selecione um bar para usar o agente
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Agente Zykor IA
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Inteligência artificial com aprendizado autônomo
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Badge className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
              <Sparkles className="w-3 h-3 mr-1" />
              Aprendizado Ativo
            </Badge>
            <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
              Gemini 1.5 Pro
            </Badge>
            {metricas && (
              <Badge className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700">
                {metricas.total_regras} regras ativas
              </Badge>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-gray-100 dark:bg-gray-700 grid w-full grid-cols-3">
            <TabsTrigger value="insights" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white dark:text-gray-300">
              <TrendingUp className="w-4 h-4 mr-2" />
              Insights ({insights.length})
            </TabsTrigger>
            <TabsTrigger value="chat" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white dark:text-gray-300">
              <MessageCircle className="w-4 h-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="metricas" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white dark:text-gray-300">
              <BarChart3 className="w-4 h-4 mr-2" />
              Evolução
            </TabsTrigger>
          </TabsList>

          {/* Tab: Insights com Feedback */}
          <TabsContent value="insights" className="space-y-4">
            {loadingInsights ? (
              <div className="flex justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : insights.length === 0 ? (
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-12 text-center">
                <Brain className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
                <p className="text-gray-600 dark:text-gray-400">
                  Nenhum insight ainda. O agente está aprendendo...
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {insights.map((insight) => (
                  <Card key={insight.id} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                          {insight.titulo}
                        </h3>
                        <Badge className={
                          insight.criticidade === 'critica' ? 'badge-error' :
                          insight.criticidade === 'alta' ? 'badge-warning' :
                          'badge-info'
                        }>
                          {insight.criticidade}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => darFeedback(insight.id, 'util')}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => darFeedback(insight.id, 'inutil')}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <ThumbsDown className="w-4 h-4" />
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
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab: Chat */}
          <TabsContent value="chat">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-[600px] flex flex-col">
              <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
                {conversas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Bot className="w-16 h-16 text-gray-400 dark:text-gray-600 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Converse com o Agente
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-md">
                      Ensine regras, peça insights ou tire dúvidas. O agente aprende com cada conversa!
                    </p>
                  </div>
                ) : (
                  <>
                    {conversas.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.tipo === 'usuario' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%]`}>
                          <div
                            className={`rounded-2xl px-4 py-3 ${
                              msg.tipo === 'usuario'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.conteudo}</p>
                            {msg.aprendizado_detectado && (
                              <Badge className="mt-2 bg-green-500/20 text-green-100 border-green-400">
                                <Sparkles className="w-3 h-3 mr-1" />
                                Aprendizado salvo
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 px-2">
                            {new Date(msg.timestamp).toLocaleTimeString('pt-BR')}
                          </div>
                        </div>
                      </div>
                    ))}
                    {loadingChat && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-3">
                          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </CardContent>

              <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                <div className="flex gap-2">
                  <Textarea
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        enviarMensagem()
                      }
                    }}
                    placeholder="Digite sua mensagem... (Enter para enviar)"
                    className="min-h-[60px] max-h-[120px] resize-none bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    disabled={loadingChat}
                  />
                  <Button
                    onClick={enviarMensagem}
                    disabled={!mensagem.trim() || loadingChat}
                    className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-6"
                  >
                    {loadingChat ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Tab: Métricas */}
          <TabsContent value="metricas">
            {loadingMetricas ? (
              <div className="flex justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : metricas ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Card: Aprendizado */}
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    🧠 Aprendizado
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Regras Ativas</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {metricas.regras_ativas}/{metricas.total_regras}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Memórias</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {metricas.total_memorias}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-500">Origem das Regras:</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          💬 {metricas.regras_por_origem.conversa}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          👍 {metricas.regras_por_origem.feedback}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          👁️ {metricas.regras_por_origem.observacao}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Card: Performance */}
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    📊 Performance
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Taxa de Sucesso</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {metricas.taxa_sucesso}%
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {metricas.feedbacks_uteis}/{metricas.total_feedbacks} feedbacks positivos
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Insights Gerados</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {metricas.total_insights}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Alertas Enviados</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {metricas.total_alertas}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Card: Custo */}
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    💰 Custo Total
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Em Reais</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        R$ {metricas.custo_total_brl}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Em Dólar</p>
                      <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                        ${metricas.custo_total_usd}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Tokens Usados</p>
                      <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                        {metricas.tokens_total.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Card: Conversas */}
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    💬 Interações
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total de Conversas</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {metricas.total_conversas}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Com Aprendizado</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {metricas.conversas_com_aprendizado}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {metricas.total_conversas > 0 
                          ? ((metricas.conversas_com_aprendizado / metricas.total_conversas) * 100).toFixed(0)
                          : 0}% geraram aprendizado
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            ) : (
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-12 text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  Erro ao carregar métricas
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>

      </div>
    </div>
  )
}
