'use client'

import { useState, useEffect } from 'react'
import { usePageTitle } from '@/contexts/PageTitleContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  TrendingUp, 
  RefreshCw,
  Calendar,
  DollarSign,
  BarChart3
} from 'lucide-react'

interface QualityData {
  estatisticas: {
    totalDias: number
    diasPerfeitos: number
    diasComProblemas: number
    precisaoMedia: number
    percentualPrecisao: number
  }
  tendencia: Array<{
    data: string
    precisao: number
    diferenca: number
    status: string
  }>
  alertasAtivos: Array<{
    id: number
    data_evento: string
    tipo_alerta: string
    severidade: string
    titulo: string
    descricao: string
    valor_esperado: number
    valor_atual: number
    diferenca: number
    created_at: string
  }>
  alertasPorSeveridade: Record<string, number>
  ultimasValidacoes: Array<{
    data_evento: string
    status_qualidade: string
    valor_esperado: number
    valor_atual: number
    diferenca: number
    percentual_precisao: number
  }>
}

export default function QualidadeContaHubPage() {
  const [data, setData] = useState<QualityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [validating, setValidating] = useState(false)
  const [dataEvento, setDataEvento] = useState('')
  const [valorEsperado, setValorEsperado] = useState('')

  const { setPageTitle } = usePageTitle()
  useEffect(() => {
    setPageTitle('📊 Qualidade ContaHub')
    return () => setPageTitle('')
  }, [setPageTitle])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/contahub/qualidade')
      const result = await response.json()
      
      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const executarValidacao = async () => {
    if (!dataEvento || !valorEsperado) {
      alert('Preencha data e valor esperado')
      return
    }

    try {
      setValidating(true)
      const response = await fetch('/api/contahub/qualidade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_evento: dataEvento,
          valor_esperado: parseFloat(valorEsperado)
        })
      })

      const result = await response.json()
      
      if (result.success) {
        alert('Validação executada com sucesso!')
        setDataEvento('')
        setValorEsperado('')
        fetchData() // Recarregar dados
      } else {
        alert('Erro: ' + result.error)
      }
    } catch (error) {
      console.error('Erro ao executar validação:', error)
      alert('Erro ao executar validação')
    } finally {
      setValidating(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const getSeverityColor = (severidade: string) => {
    switch (severidade) {
      case 'CRITICA': return 'bg-red-500 text-white'
      case 'ALTA': return 'bg-orange-500 text-white'
      case 'MEDIA': return 'bg-yellow-500 text-black'
      case 'BAIXA': return 'bg-blue-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PERFEITO': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'ATENCAO': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'CRITICO': return <XCircle className="h-4 w-4 text-red-500" />
      default: return <AlertTriangle className="h-4 w-4 text-gray-500" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600 dark:text-gray-400">Carregando dados de qualidade...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Qualidade dos Dados ContaHub
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitoramento e validação da integridade dos dados sincronizados
          </p>
        </div>

        {/* Estatísticas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Precisão Geral
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {data?.estatisticas.percentualPrecisao || 0}%
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                {data?.estatisticas.diasPerfeitos || 0} de {data?.estatisticas.totalDias || 0} dias perfeitos
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Dias com Problemas
              </CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {data?.estatisticas.diasComProblemas || 0}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Requerem atenção
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Alertas Ativos
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {data?.alertasAtivos.length || 0}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Necessitam resolução
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Precisão Média
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {data?.estatisticas.precisaoMedia.toFixed(1) || 0}%
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Últimos 30 dias
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="validacoes" className="space-y-6">
          <TabsList className="bg-gray-100 dark:bg-gray-700">
            <TabsTrigger value="validacoes" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white dark:text-gray-300">
              Últimas Validações
            </TabsTrigger>
            <TabsTrigger value="alertas" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white dark:text-gray-300">
              Alertas Ativos
            </TabsTrigger>
            <TabsTrigger value="manual" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white dark:text-gray-300">
              Validação Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="validacoes">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Últimas Validações</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Histórico das validações mais recentes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data?.ultimasValidacoes.map((validacao, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(validacao.status_qualidade)}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {new Date(validacao.data_evento).toLocaleDateString('pt-BR')}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-500">
                            Precisão: {validacao.percentual_precisao?.toFixed(1) || 0}%
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900 dark:text-white">
                          R$ {validacao.valor_atual?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                        </p>
                        {validacao.diferenca !== 0 && (
                          <p className="text-sm text-red-500">
                            Diferença: R$ {Math.abs(validacao.diferenca || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alertas">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Alertas Ativos</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Problemas que requerem atenção imediata
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data?.alertasAtivos.length === 0 ? (
                    <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        Nenhum alerta ativo! Todos os dados estão íntegros.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    data?.alertasAtivos.map((alerta) => (
                      <Alert key={alerta.id} className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <AlertDescription>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-red-800 dark:text-red-200">{alerta.titulo}</p>
                              <p className="text-sm text-red-600 dark:text-red-300">{alerta.descricao}</p>
                              <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                                {new Date(alerta.created_at).toLocaleString('pt-BR')}
                              </p>
                            </div>
                            <Badge className={getSeverityColor(alerta.severidade)}>
                              {alerta.severidade}
                            </Badge>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manual">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Validação Manual</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Execute validação para uma data específica
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Data do Evento
                      </label>
                      <Input
                        type="date"
                        value={dataEvento}
                        onChange={(e) => setDataEvento(e.target.value)}
                        className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Valor Esperado (R$)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={valorEsperado}
                        onChange={(e) => setValorEsperado(e.target.value)}
                        placeholder="0.00"
                        className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={executarValidacao}
                    disabled={validating || !dataEvento || !valorEsperado}
                    className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
                  >
                    {validating ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Validando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Executar Validação
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-between items-center">
          <Button
            onClick={fetchData}
            variant="outline"
            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar Dados
          </Button>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Última atualização: {new Date().toLocaleString('pt-BR')}
          </p>
        </div>
      </div>
    </div>
  )
}
