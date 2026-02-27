'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, 
  RefreshCcw, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Database,
  Shield,
  Clock,
  TrendingUp,
  Bell,
  Lock
} from 'lucide-react'
import { LoadingState } from '@/components/ui/loading-state'
import { format, parseISO, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Validacao {
  id: number
  data_referencia: string
  contahub_periodo_total: number
  contahub_pagamentos_total: number
  contahub_diferenca: number
  contahub_valido: boolean
  eventos_base_real_r: number
  eventos_base_sympla: number
  eventos_base_yuzer: number
  validacao_passou: boolean
  problemas_detectados: string[]
  criado_em: string
}

interface Alerta {
  id: number
  tipo: string
  severidade: string
  titulo: string
  descricao: string
  resolvido: boolean
  criado_em: string
}

interface DadoBloqueado {
  id: number
  tabela: string
  data_referencia: string
  bloqueado_em: string
  motivo: string
}

interface StatusSync {
  sistema: string
  ultima_sync: string
  status: string
  registros: number
}

export default function SaudeDadosPage() {
  const router = useRouter()
  const [validacoes, setValidacoes] = useState<Validacao[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [bloqueados, setBloqueados] = useState<DadoBloqueado[]>([])
  const [statusSyncs, setStatusSyncs] = useState<StatusSync[]>([])
  const [loading, setLoading] = useState(true)
  const [executandoValidacao, setExecutandoValidacao] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/saude-dados')
      const data = await response.json()
      
      if (data.success) {
        setValidacoes(data.validacoes || [])
        setAlertas(data.alertas || [])
        setBloqueados(data.bloqueados || [])
        setStatusSyncs(data.statusSyncs || [])
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const executarValidacaoManual = async () => {
    try {
      setExecutandoValidacao(true)
      const response = await fetch('/api/saude-dados/validar', { method: 'POST' })
      const data = await response.json()
      
      if (data.success) {
        fetchData()
      }
    } catch (error) {
      console.error('Erro ao executar validação:', error)
    } finally {
      setExecutandoValidacao(false)
    }
  }

  const resolverAlerta = async (alertaId: number) => {
    try {
      await fetch(`/api/saude-dados/alertas/${alertaId}/resolver`, { method: 'POST' })
      fetchData()
    } catch (error) {
      console.error('Erro ao resolver alerta:', error)
    }
  }

  const alertasPendentes = alertas.filter(a => !a.resolvido)
  const validacoesUltimos7Dias = validacoes.filter(v => {
    const data = new Date(v.data_referencia)
    return data >= subDays(new Date(), 7)
  })
  const taxaSucesso = validacoesUltimos7Dias.length > 0 
    ? (validacoesUltimos7Dias.filter(v => v.validacao_passou).length / validacoesUltimos7Dias.length * 100).toFixed(0)
    : 0

  // Função segura para formatar datas
  const formatarData = (data: string | null | undefined, formatStr: string = 'dd/MM/yyyy'): string => {
    if (!data) return '-'
    try {
      const parsed = parseISO(data)
      if (isNaN(parsed.getTime())) return '-'
      return format(parsed, formatStr, { locale: ptBR })
    } catch {
      return '-'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => router.back()}
              className="text-gray-600 dark:text-gray-400"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Activity className="w-6 h-6 text-green-500" />
                Saúde dos Dados
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Monitoramento e validação da integridade dos dados
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={executarValidacaoManual}
              disabled={executandoValidacao}
              className="bg-green-600 hover:bg-green-700"
            >
              {executandoValidacao ? (
                <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Shield className="w-4 h-4 mr-2" />
              )}
              Validar Agora
            </Button>
            <Button onClick={fetchData} disabled={loading} variant="outline">
              <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Cards de Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Taxa de Sucesso (7d)</p>
                  <p className={`text-2xl font-bold ${Number(taxaSucesso) >= 90 ? 'text-green-600' : Number(taxaSucesso) >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {taxaSucesso}%
                  </p>
                </div>
                <TrendingUp className={`w-8 h-8 ${Number(taxaSucesso) >= 90 ? 'text-green-500' : 'text-yellow-500'}`} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Alertas Pendentes</p>
                  <p className={`text-2xl font-bold ${alertasPendentes.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {alertasPendentes.length}
                  </p>
                </div>
                <Bell className={`w-8 h-8 ${alertasPendentes.length > 0 ? 'text-red-500' : 'text-green-500'}`} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Dias Bloqueados</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{bloqueados.length}</p>
                </div>
                <Lock className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Validações (7d)</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{validacoesUltimos7Dias.length}</p>
                </div>
                <Database className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="validacoes" className="space-y-4">
          <TabsList className="bg-gray-100 dark:bg-gray-700">
            <TabsTrigger value="validacoes">Validações</TabsTrigger>
            <TabsTrigger value="alertas">
              Alertas
              {alertasPendentes.length > 0 && (
                <Badge variant="destructive" className="ml-2">{alertasPendentes.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="syncs">Status Syncs</TabsTrigger>
            <TabsTrigger value="bloqueados">Dados Bloqueados</TabsTrigger>
          </TabsList>

          {/* Tab: Validações */}
          <TabsContent value="validacoes">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Histórico de Validações</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Validações cruzadas diárias dos dados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <LoadingState
                    title="Carregando validações..."
                    subtitle="Verificando integridade dos dados"
                    icon={<Shield className="w-4 h-4" />}
                  />
                ) : validacoes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Nenhuma validação encontrada
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Data</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Status</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">ContaHub</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Eventos Base</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Diferença</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Problemas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validacoes.map((v) => (
                          <tr key={v.id} className="border-b border-gray-100 dark:border-gray-700/50">
                            <td className="py-3 px-4 text-gray-900 dark:text-white">
                              {formatarData(v.data_referencia, 'dd/MM/yyyy')}
                            </td>
                            <td className="py-3 px-4">
                              {v.validacao_passou ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  OK
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Falhou
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right text-gray-900 dark:text-white">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.contahub_periodo_total || 0)}
                            </td>
                            <td className="py-3 px-4 text-right text-gray-900 dark:text-white">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.eventos_base_real_r || 0)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className={v.contahub_diferenca > 1 ? 'text-red-600' : 'text-green-600'}>
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.contahub_diferenca || 0)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                              {v.problemas_detectados?.length > 0 
                                ? v.problemas_detectados.join(', ') 
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Alertas */}
          <TabsContent value="alertas">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Alertas do Sistema</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Problemas detectados automaticamente
                </CardDescription>
              </CardHeader>
              <CardContent>
                {alertas.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-gray-500">
                    <CheckCircle className="w-12 h-12 text-green-500 mb-2" />
                    <p>Nenhum alerta encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {alertas.map((alerta) => (
                      <div 
                        key={alerta.id}
                        className={`p-4 rounded-lg border ${
                          alerta.resolvido 
                            ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600' 
                            : alerta.severidade === 'critical'
                              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                              : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            {alerta.severidade === 'critical' ? (
                              <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                            ) : (
                              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                            )}
                            <div>
                              <h4 className={`font-medium ${alerta.resolvido ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                                {alerta.titulo}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {alerta.descricao}
                              </p>
                              <p className="text-xs text-gray-500 mt-2">
                                {formatarData(alerta.criado_em, "dd/MM/yyyy 'às' HH:mm")}
                              </p>
                            </div>
                          </div>
                          {!alerta.resolvido && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => resolverAlerta(alerta.id)}
                            >
                              Resolver
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Syncs */}
          <TabsContent value="syncs">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Status das Sincronizações</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Última sincronização de cada sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {statusSyncs.map((sync, index) => (
                    <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white capitalize">{sync.sistema}</h4>
                        <Badge className={sync.status === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {sync.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {sync.ultima_sync ? formatarData(sync.ultima_sync, "dd/MM HH:mm") : 'Nunca'}
                      </p>
                      {sync.registros > 0 && (
                        <p className="text-sm text-gray-500 mt-1">
                          {sync.registros} registros
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Bloqueados */}
          <TabsContent value="bloqueados">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Dados Bloqueados</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Dias com dados congelados (não podem ser alterados automaticamente)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {bloqueados.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Nenhum dado bloqueado
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Data</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Tabela</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Bloqueado em</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bloqueados.slice(0, 20).map((b) => (
                          <tr key={b.id} className="border-b border-gray-100 dark:border-gray-700/50">
                            <td className="py-3 px-4 text-gray-900 dark:text-white">
                              {formatarData(b.data_referencia, 'dd/MM/yyyy')}
                            </td>
                            <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{b.tabela}</td>
                            <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                              {formatarData(b.bloqueado_em, "dd/MM HH:mm")}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500">{b.motivo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
