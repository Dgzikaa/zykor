'use client'

import { useEffect, useState } from 'react'
import { usePageTitle } from '@/contexts/PageTitleContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Brain, Save, Activity, DollarSign, Star, Users } from 'lucide-react'
import { useBarContext } from '@/contexts/BarContext'

interface Configuracao {
  id: string
  tipo_agente: string
  ativo: boolean
  frequencia_scan: number
  notificacoes_ativas: boolean
}

export default function ConfiguracoesAgentePage() {
  const { selectedBar } = useBarContext()
  const barId = selectedBar?.id
  const [configuracoes, setConfiguracoes] = useState<Configuracao[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const { setPageTitle } = usePageTitle()
  useEffect(() => {
    setPageTitle('🧠 Agente Inteligente')
    return () => setPageTitle('')
  }, [setPageTitle])

  const tiposAgente = [
    { id: 'operacional', nome: 'Operacional', icon: Activity, descricao: 'Monitora checklists, tarefas e processos' },
    { id: 'financeiro', nome: 'Financeiro', icon: DollarSign, descricao: 'Analisa vendas, faturamento e métricas financeiras' },
    { id: 'experiencia', nome: 'Experiência', icon: Star, descricao: 'Acompanha NPS, satisfação e feedback dos clientes' },
    { id: 'equipe', nome: 'Equipe', icon: Users, descricao: 'Avalia desempenho e produtividade da equipe' }
  ]

  useEffect(() => {
    if (barId) {
      carregarConfiguracoes()
    }
  }, [barId])

  const carregarConfiguracoes = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/agente/configuracoes?bar_id=${barId}`)
      const data = await response.json()
      setConfiguracoes(data.configuracoes || [])
    } catch (error) {
      console.error('Erro ao carregar configurações:', error)
    } finally {
      setLoading(false)
    }
  }

  const atualizarConfiguracao = async (tipo: string, campo: string, valor: any) => {
    const config = configuracoes.find(c => c.tipo_agente === tipo)
    
    if (config) {
      // Atualizar existente
      try {
        const response = await fetch('/api/agente/configuracoes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: config.id,
            [campo]: valor
          })
        })

        if (response.ok) {
          carregarConfiguracoes()
        }
      } catch (error) {
        console.error('Erro ao atualizar configuração:', error)
      }
    } else {
      // Criar nova
      try {
        const response = await fetch('/api/agente/configuracoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bar_id: barId,
            tipo_agente: tipo,
            [campo]: valor
          })
        })

        if (response.ok) {
          carregarConfiguracoes()
        }
      } catch (error) {
        console.error('Erro ao criar configuração:', error)
      }
    }
  }

  const salvarTodasConfiguracoes = async () => {
    setSalvando(true)
    try {
      // Salvar todas as configurações pendentes
      await carregarConfiguracoes()
      alert('Configurações salvas com sucesso!')
    } catch (error) {
      console.error('Erro ao salvar configurações:', error)
      alert('Erro ao salvar configurações')
    } finally {
      setSalvando(false)
    }
  }

  const getConfiguracao = (tipo: string): Configuracao | undefined => {
    return configuracoes.find(c => c.tipo_agente === tipo)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-600 dark:text-gray-400">Carregando...</p>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="card-description-dark">
                  Configure como o agente inteligente monitora seu negócio
                </p>
              </div>
            </div>
            <Button
              onClick={salvarTodasConfiguracoes}
              disabled={salvando}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {salvando ? 'Salvando...' : 'Salvar Tudo'}
            </Button>
          </div>
        </div>

        {/* Configurações por Tipo de Agente */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tiposAgente.map((tipo) => {
            const config = getConfiguracao(tipo.id)
            const Icon = tipo.icon

            return (
              <div key={tipo.id} className="card-dark p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <div>
                    <h3 className="card-title-dark text-base mb-1">{tipo.nome}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {tipo.descricao}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Ativo/Inativo */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Agente Ativo
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Habilitar monitoramento deste tipo
                      </p>
                    </div>
                    <Switch
                      checked={config?.ativo ?? false}
                      onCheckedChange={(checked) => atualizarConfiguracao(tipo.id, 'ativo', checked)}
                    />
                  </div>

                  {/* Frequência de Scan */}
                  {config?.ativo && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                          Frequência de Análise
                        </label>
                        <select
                          value={config.frequencia_scan || 300}
                          onChange={(e) => atualizarConfiguracao(tipo.id, 'frequencia_scan', parseInt(e.target.value))}
                          className="w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg px-3 py-2"
                        >
                          <option value={300}>A cada 5 minutos</option>
                          <option value={900}>A cada 15 minutos</option>
                          <option value={1800}>A cada 30 minutos</option>
                          <option value={3600}>A cada hora</option>
                          <option value={21600}>A cada 6 horas</option>
                          <option value={86400}>Uma vez por dia</option>
                        </select>
                      </div>

                      {/* Notificações */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Notificações
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Receber alertas e insights
                          </p>
                        </div>
                        <Switch
                          checked={config.notificacoes_ativas ?? true}
                          onCheckedChange={(checked) => atualizarConfiguracao(tipo.id, 'notificacoes_ativas', checked)}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Informações Adicionais */}
        <div className="card-dark p-6 mt-6">
          <h3 className="card-title-dark text-base mb-4">Como funciona o Agente Inteligente</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                🔍 Análise Automática
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                O agente vasculha automaticamente seu banco de dados na frequência configurada,
                coletando dados sobre operação, finanças, clientes e equipe.
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                💡 Insights Inteligentes
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Identifica padrões, tendências e anomalias, gerando insights acionáveis
                com sugestões de ações para melhorar seu negócio.
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                ⚠️ Alertas Proativos
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Detecta problemas críticos e oportunidades importantes, enviando alertas
                em tempo real para que você possa agir rapidamente.
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                📊 Aprendizado Contínuo
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                O agente aprende com seus dados históricos e feedbacks, melhorando
                continuamente a qualidade dos insights gerados.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
