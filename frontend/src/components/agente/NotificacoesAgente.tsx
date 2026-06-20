'use client'

import { useEffect, useState } from 'react'
import { Bell, X, Eye, AlertTriangle, TrendingUp, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Alerta {
  id: string
  tipo_alerta: string
  severidade: 'info' | 'warning' | 'error' | 'critical'
  mensagem: string
  lido: boolean
  created_at: string
  agente_insights?: {
    titulo: string
    acao_sugerida: string
  }
}

export default function NotificacoesAgente({ barId }: { barId: number }) {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [mostrarDropdown, setMostrarDropdown] = useState(false)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (barId) {
      carregarAlertas()
      
      // Atualizar a cada 30 segundos
      const interval = setInterval(carregarAlertas, 30000)
      return () => clearInterval(interval)
    }
  }, [barId])

  const carregarAlertas = async () => {
    try {
      const response = await fetch(`/api/agente/alertas?bar_id=${barId}&lido=false&limit=10`)
      const data = await response.json()
      setAlertas(data.alertas || [])
    } catch (error) {
      console.error('Erro ao carregar alertas:', error)
    }
  }

  const marcarComoLido = async (alertaId: string) => {
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

  const marcarTodosComoLido = async () => {
    setCarregando(true)
    try {
      await Promise.all(
        alertas.map(alerta => 
          fetch('/api/agente/alertas', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alerta_id: alerta.id, lido: true })
          })
        )
      )
      carregarAlertas()
    } catch (error) {
      console.error('Erro ao marcar todos como lido:', error)
    } finally {
      setCarregando(false)
    }
  }

  const getSeveridadeIcon = (severidade: string) => {
    switch (severidade) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-600" />
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      default:
        return <Info className="w-4 h-4 text-blue-500" />
    }
  }

  const alertasNaoLidos = alertas.filter(a => !a.lido).length

  return (
    <div className="relative">
      {/* Botão de notificação */}
      <button
        onClick={() => setMostrarDropdown(!mostrarDropdown)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        {alertasNaoLidos > 0 && (
          <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-semibold text-white">
            {alertasNaoLidos > 9 ? '9+' : alertasNaoLidos}
          </span>
        )}
      </button>

      {/* Dropdown de notificações */}
      {mostrarDropdown && (
        <>
          {/* Overlay para fechar ao clicar fora */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMostrarDropdown(false)}
          />

          <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] sm:w-96 max-w-[24rem] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Alertas do Agente
                </h3>
                {alertasNaoLidos > 0 && (
                  <Badge className="bg-red-600 text-white">
                    {alertasNaoLidos} novos
                  </Badge>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMostrarDropdown(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Lista de alertas */}
            <div className="max-h-96 overflow-y-auto">
              {alertas.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Nenhum alerta no momento
                  </p>
                </div>
              ) : (
                <>
                  {alertas.map((alerta) => (
                    <div
                      key={alerta.id}
                      className={`p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        !alerta.lido ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {getSeveridadeIcon(alerta.severidade)}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {alerta.mensagem}
                          </p>
                          {alerta.agente_insights && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              💡 {alerta.agente_insights.acao_sugerida}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {new Date(alerta.created_at).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        {!alerta.lido && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => marcarComoLido(alerta.id)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            {alertas.length > 0 && (
              <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={marcarTodosComoLido}
                  disabled={carregando || alertasNaoLidos === 0}
                  className="flex-1"
                >
                  Marcar todos como lido
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    window.location.href = '/visao-geral/agente-inteligente'
                    setMostrarDropdown(false)
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Ver todos
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
