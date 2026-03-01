'use client'

import { useState, useEffect, useRef } from 'react'
import { useBarContext } from '@/contexts/BarContext'
import { useUser } from '@/contexts/UserContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Bot, Send, Loader2, ThumbsUp, ThumbsDown, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface Mensagem {
  id: number
  tipo: 'usuario' | 'agente'
  conteudo: string
  timestamp: string
  aprendizado_detectado?: boolean
  acao_sugerida?: string
  metrics?: {
    tempo_resposta_ms: number
    tokens_usados: number
    custo_estimado_usd: number
  }
}

export default function AgenteChatPage() {
  const { selectedBar } = useBarContext()
  const { user } = useUser()
  const [mensagem, setMensagem] = useState('')
  const [conversas, setConversas] = useState<Mensagem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingHistorico, setLoadingHistorico] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Criar header de autenticação
  const getAuthHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (user) {
      const userData = {
        ...user,
        bar_id: selectedBar,
        user_id: (user as any).user_id || user.id?.toString()
      }
      headers['x-user-data'] = encodeURIComponent(JSON.stringify(userData))
    }
    
    return headers
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [conversas])

  useEffect(() => {
    if (selectedBar) {
      carregarHistorico()
    }
  }, [selectedBar])

  const carregarHistorico = async () => {
    if (!selectedBar) return

    try {
      setLoadingHistorico(true)
      const response = await fetch(`/api/agente/chat?bar_id=${selectedBar}&limit=30`, {
        headers: getAuthHeaders()
      })
      const data = await response.json()

      if (data.success && data.conversas) {
        const conversasFormatadas: Mensagem[] = []
        data.conversas.forEach((conv: any, index: number) => {
          conversasFormatadas.push({
            id: index * 2,
            tipo: 'usuario',
            conteudo: conv.mensagem,
            timestamp: conv.created_at
          })
          conversasFormatadas.push({
            id: index * 2 + 1,
            tipo: 'agente',
            conteudo: conv.resposta,
            timestamp: conv.created_at,
            aprendizado_detectado: conv.gerou_aprendizado
          })
        })
        setConversas(conversasFormatadas)
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error)
    } finally {
      setLoadingHistorico(false)
    }
  }

  const enviarMensagem = async () => {
    if (!mensagem.trim() || !selectedBar || loading) return

    // Armazenar mensagem antes de limpar o input
    const mensagemEnviar = mensagem.trim()
    
    const mensagemUsuario: Mensagem = {
      id: Date.now(),
      tipo: 'usuario',
      conteudo: mensagemEnviar,
      timestamp: new Date().toISOString()
    }

    setConversas(prev => [...prev, mensagemUsuario])
    setMensagem('')
    setLoading(true)

    try {
      const response = await fetch('/api/agente/chat', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          bar_id: selectedBar,
          mensagem: mensagemEnviar
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar mensagem')
      }

      // Garantir que temos uma resposta válida
      const respostaTexto = data.resposta || data.message || 'Desculpe, não consegui processar sua pergunta. Tente novamente.'

      const respostaAgente: Mensagem = {
        id: Date.now() + 1,
        tipo: 'agente',
        conteudo: respostaTexto,
        timestamp: new Date().toISOString(),
        aprendizado_detectado: data.aprendizado_detectado,
        acao_sugerida: data.acao_sugerida,
        metrics: data.metrics
      }

      setConversas(prev => [...prev, respostaAgente])

      if (data.aprendizado_detectado) {
        toast.success('🧠 Agente aprendeu algo novo!', {
          description: 'Essa informação foi salva na memória'
        })
      }

    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error)
      toast.error('Erro ao enviar mensagem', {
        description: error.message
      })
      // Remover mensagem do usuário em caso de erro
      setConversas(prev => prev.filter(m => m.id !== mensagemUsuario.id))
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviarMensagem()
    }
  }

  if (!selectedBar) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
            <p className="text-gray-600 dark:text-gray-400">
              Selecione um bar para conversar com o agente
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        
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
                Converse, ensine e aprenda com seu assistente inteligente
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
          </div>
        </div>

        {/* Chat Container */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-[calc(100vh-280px)] flex flex-col">
          
          {/* Messages Area */}
          <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
            {loadingHistorico ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : conversas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Bot className="w-16 h-16 text-gray-400 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Primeira conversa com o Agente
                </h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">
                  Faça perguntas, ensine regras de negócio ou peça insights sobre seus dados.
                  O agente aprende com cada conversa!
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                  <Button
                    variant="outline"
                    className="text-left justify-start h-auto p-4 bg-gray-50 dark:bg-gray-700/50"
                    onClick={() => setMensagem('Quais são os principais insights do meu bar hoje?')}
                  >
                    <TrendingUp className="w-5 h-5 mr-3 flex-shrink-0 text-blue-500" />
                    <span className="text-sm">Insights do dia</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="text-left justify-start h-auto p-4 bg-gray-50 dark:bg-gray-700/50"
                    onClick={() => setMensagem('Me avise quando o CMV ultrapassar 32%')}
                  >
                    <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0 text-yellow-500" />
                    <span className="text-sm">Criar alerta personalizado</span>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {conversas.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.tipo === 'usuario' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] ${msg.tipo === 'usuario' ? 'order-2' : 'order-1'}`}>
                      <div
                        className={`rounded-2xl px-4 py-3 ${
                          msg.tipo === 'usuario'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.conteudo}</p>
                        
                        {msg.aprendizado_detectado && (
                          <div className="mt-2 pt-2 border-t border-white/20 dark:border-gray-600">
                            <Badge className="bg-green-500/20 text-green-100 border-green-400">
                              <Sparkles className="w-3 h-3 mr-1" />
                              Aprendizado salvo
                            </Badge>
                          </div>
                        )}

                        {msg.acao_sugerida && (
                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                            <p className="text-sm opacity-90">
                              💡 <strong>Ação sugerida:</strong> {msg.acao_sugerida}
                            </p>
                          </div>
                        )}

                        {msg.metrics && (
                          <div className="mt-2 text-xs opacity-70">
                            ⚡ {msg.metrics.tempo_resposta_ms}ms • 
                            📊 {msg.metrics.tokens_usados} tokens •
                            💰 ${msg.metrics.custo_estimado_usd.toFixed(4)}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 px-2">
                        {new Date(msg.timestamp).toLocaleTimeString('pt-BR')}
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
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

          {/* Input Area */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex gap-2">
              <Textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
                className="min-h-[60px] max-h-[120px] resize-none bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                disabled={loading}
              />
              <Button
                onClick={enviarMensagem}
                disabled={!mensagem.trim() || loading}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-6"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              💡 Dica: Ensine o agente sobre suas regras de negócio. Ex: &quot;Me avise quando o CMV passar de 30%&quot;
            </p>
          </div>
        </Card>

      </div>
    </div>
  )
}
