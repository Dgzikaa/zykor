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
  Calendar, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  FileSearch,
  Play
} from 'lucide-react'
import { LoadingState } from '@/components/ui/loading-state'
import { format, parseISO, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface AuditoriaRegistro {
  id: number
  evento_id: number
  data_evento: string
  bar_id?: number
  nome?: string
  campo_alterado: string
  valor_anterior: string
  valor_novo: string
  funcao_origem: string
  motivo?: string
  data_alteracao: string
  diferenca?: number
  percentual_mudanca?: number
  metadata?: Record<string, any>
}

interface ResumoAuditoria {
  totalRegistros: number
  registrosHoje: number
  registrosSemana: number
  registrosMes: number
  campoMaisAlterado: string
  valorTotalDiferenca: number
}

export default function AuditoriaPage() {
  const router = useRouter()
  const [registros, setRegistros] = useState<AuditoriaRegistro[]>([])
  const [resumo, setResumo] = useState<ResumoAuditoria | null>(null)
  const [loading, setLoading] = useState(true)
  const [executandoAuditoria, setExecutandoAuditoria] = useState(false)
  const [resultadoAuditoria, setResultadoAuditoria] = useState<string | null>(null)
  const [filtroData, setFiltroData] = useState<string>('')
  const [filtroCampo, setFiltroCampo] = useState<string>('')

  const fetchAuditoria = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filtroData) params.append('data_evento', filtroData)
      if (filtroCampo) params.append('campo', filtroCampo)
      params.append('limit', '100')

      const response = await fetch(`/api/auditoria/eventos?${params.toString()}`)
      const data = await response.json()
      
      if (data.success) {
        // A API retorna data.data.mudancas quando não há filtro por evento_id ou data_evento
        const mudancas = data.data?.mudancas || data.data || []
        setRegistros(mudancas)
        
        // Calcular resumo
        const hoje = new Date().toISOString().split('T')[0]
        const semanaAtras = subDays(new Date(), 7).toISOString().split('T')[0]
        const mesAtras = subDays(new Date(), 30).toISOString().split('T')[0]
        
        const registrosHoje = mudancas.filter((r: AuditoriaRegistro) => 
          r.data_alteracao?.startsWith(hoje)
        ).length
        
        const registrosSemana = mudancas.filter((r: AuditoriaRegistro) => 
          r.data_alteracao >= semanaAtras
        ).length
        
        const registrosMes = mudancas.filter((r: AuditoriaRegistro) => 
          r.data_alteracao >= mesAtras
        ).length

        // Campo mais alterado
        const camposCount: Record<string, number> = {}
        mudancas.forEach((r: AuditoriaRegistro) => {
          camposCount[r.campo_alterado] = (camposCount[r.campo_alterado] || 0) + 1
        })
        const campoMaisAlterado = Object.entries(camposCount)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || '-'

        // Valor total de diferença (usar 'diferenca' ao invés de 'diferenca_numerica')
        const valorTotalDiferenca = mudancas
          .filter((r: AuditoriaRegistro) => r.diferenca !== undefined)
          .reduce((acc: number, r: AuditoriaRegistro) => acc + (r.diferenca || 0), 0)

        setResumo({
          totalRegistros: mudancas.length,
          registrosHoje,
          registrosSemana,
          registrosMes,
          campoMaisAlterado,
          valorTotalDiferenca
        })
      } else {
        // Se a API retornou erro, exibir array vazio
        setRegistros([])
        setResumo(null)
      }
    } catch (error) {
      console.error('Erro ao buscar auditoria:', error)
      setRegistros([])
      setResumo(null)
    } finally {
      setLoading(false)
    }
  }, [filtroData, filtroCampo])

  useEffect(() => {
    fetchAuditoria()
  }, [fetchAuditoria])

  const executarAuditoriaManual = async (tipo: 'semanal' | 'mensal') => {
    try {
      setExecutandoAuditoria(true)
      setResultadoAuditoria(null)
      
      const response = await fetch('/api/auditoria/executar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setResultadoAuditoria(data.resultado || 'Auditoria executada com sucesso!')
        fetchAuditoria() // Recarregar dados
      } else {
        setResultadoAuditoria(`Erro: ${data.error}`)
      }
    } catch (error) {
      setResultadoAuditoria(`Erro ao executar auditoria: ${error}`)
    } finally {
      setExecutandoAuditoria(false)
    }
  }

  const formatarValor = (valor: string | null, campo: string): string => {
    if (!valor || valor === 'null') return '-'
    
    if (['real_r', 'sympla_liquido', 'yuzer_liquido'].includes(campo)) {
      const num = parseFloat(valor)
      return new Intl.NumberFormat('pt-BR', { 
        style: 'currency', 
        currency: 'BRL' 
      }).format(num)
    }
    
    return valor
  }

  const getBadgeVariant = (campo: string): 'default' | 'secondary' | 'outline' => {
    switch (campo) {
      case 'real_r': return 'default'
      case 'cl_real': return 'secondary'
      case 'sympla_liquido': return 'outline'
      case 'yuzer_liquido': return 'outline'
      default: return 'default'
    }
  }

  const formatarData = (data: string | null | undefined, formatStr: string = 'dd/MM/yyyy'): string => {
    if (!data) return '-'
    try {
      // Tenta parseISO primeiro (para formatos ISO como "2025-01-17" ou "2025-01-17T10:00:00Z")
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
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileSearch className="w-6 h-6 text-blue-500" />
                Auditoria de Eventos
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Rastreamento de alterações em eventos_base
              </p>
            </div>
          </div>
          <Button 
            onClick={fetchAuditoria} 
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Cards de Resumo */}
        {resumo && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Registros Hoje</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{resumo.registrosHoje}</p>
                  </div>
                  <Clock className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Últimos 7 dias</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{resumo.registrosSemana}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Campo + Alterado</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{resumo.campoMaisAlterado}</p>
                  </div>
                  <Database className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Diferença Total</p>
                    <p className={`text-lg font-bold ${resumo.valorTotalDiferenca >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resumo.valorTotalDiferenca)}
                    </p>
                  </div>
                  {resumo.valorTotalDiferenca >= 0 ? (
                    <TrendingUp className="w-8 h-8 text-green-500" />
                  ) : (
                    <TrendingDown className="w-8 h-8 text-red-500" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="registros" className="space-y-4">
          <TabsList className="bg-gray-100 dark:bg-gray-700">
            <TabsTrigger value="registros" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600">
              Registros
            </TabsTrigger>
            <TabsTrigger value="executar" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600">
              Executar Auditoria
            </TabsTrigger>
          </TabsList>

          {/* Tab: Registros */}
          <TabsContent value="registros">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Histórico de Alterações</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Últimas {registros.length} alterações detectadas
                </CardDescription>
                
                {/* Filtros */}
                <div className="flex gap-4 mt-4">
                  <div className="flex-1">
                    <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">Data do Evento</label>
                    <input
                      type="date"
                      value={filtroData}
                      onChange={(e) => setFiltroData(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">Campo</label>
                    <select
                      value={filtroCampo}
                      onChange={(e) => setFiltroCampo(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                    >
                      <option value="">Todos</option>
                      <option value="real_r">real_r (Faturamento)</option>
                      <option value="cl_real">cl_real (Clientes)</option>
                      <option value="sympla_liquido">sympla_liquido</option>
                      <option value="yuzer_liquido">yuzer_liquido</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      variant="outline" 
                      onClick={() => { setFiltroData(''); setFiltroCampo(''); }}
                      className="border-gray-300 dark:border-gray-600"
                    >
                      Limpar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <LoadingState
                    title="Carregando auditoria..."
                    subtitle="Buscando registros de alterações"
                    icon={<FileSearch className="w-4 h-4" />}
                  />
                ) : registros.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                    <CheckCircle className="w-12 h-12 mb-2 text-green-500" />
                    <p>Nenhuma alteração encontrada</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Data Evento</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Campo</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Anterior</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Novo</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Diferença</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Alterado em</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registros.map((registro) => (
                          <tr 
                            key={registro.id} 
                            className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          >
                            <td className="py-3 px-4">
                              <span className="text-gray-900 dark:text-white font-medium">
                                {formatarData(registro.data_evento, 'dd/MM/yyyy')}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant={getBadgeVariant(registro.campo_alterado)}>
                                {registro.campo_alterado}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                              {formatarValor(registro.valor_anterior, registro.campo_alterado)}
                            </td>
                            <td className="py-3 px-4 text-right text-gray-900 dark:text-white font-medium">
                              {formatarValor(registro.valor_novo, registro.campo_alterado)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {registro.diferenca !== undefined && (
                                <span className={`font-medium ${registro.diferenca >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {registro.diferenca >= 0 ? '+' : ''}
                                  {['real_r', 'sympla_liquido', 'yuzer_liquido'].includes(registro.campo_alterado) 
                                    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(registro.diferenca)
                                    : registro.diferenca
                                  }
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-500">
                              {formatarData(registro.data_alteracao, "dd/MM HH:mm")}
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

          {/* Tab: Executar Auditoria */}
          <TabsContent value="executar">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Executar Auditoria Manual</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Recalcula eventos e detecta discrepâncias
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Auditoria Semanal */}
                  <Card className="bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                          <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">Auditoria Semanal</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Últimos 7 dias</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Recalcula todos os eventos dos últimos 7 dias e registra quaisquer alterações detectadas.
                      </p>
                      <Button 
                        onClick={() => executarAuditoriaManual('semanal')}
                        disabled={executandoAuditoria}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        {executandoAuditoria ? (
                          <>
                            <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                            Executando...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Executar Semanal
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Auditoria Mensal */}
                  <Card className="bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                          <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">Auditoria Mensal</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Mês atual completo</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Recalcula todos os eventos do mês atual e registra quaisquer alterações detectadas.
                      </p>
                      <Button 
                        onClick={() => executarAuditoriaManual('mensal')}
                        disabled={executandoAuditoria}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                      >
                        {executandoAuditoria ? (
                          <>
                            <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                            Executando...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Executar Mensal
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Resultado */}
                {resultadoAuditoria && (
                  <Card className={`${resultadoAuditoria.includes('Erro') ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {resultadoAuditoria.includes('Erro') ? (
                          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                        )}
                        <pre className="text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                          {resultadoAuditoria}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Info sobre automação */}
                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900 dark:text-blue-100">Auditoria Automática</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      O sistema executa automaticamente:
                    </p>
                    <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 list-disc list-inside">
                      <li><strong>Semanal:</strong> Todo domingo às 20h (Brasília)</li>
                      <li><strong>Mensal:</strong> Último dia do mês às 20h (Brasília)</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
