'use client'

import { useState, useEffect } from 'react'
import { usePageTitle } from '@/contexts/PageTitleContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBar } from '@/contexts/BarContext'
import { 
  Play, 
  RefreshCw, 
  Database, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  BarChart3,
  FileText
} from 'lucide-react'

interface RawDataStats {
  success: boolean
  bar_id: string
  summary: {
    total_records: number
    processed: number
    pending: number
    by_type: Record<string, {
      total: number
      processed: number
      pending: number
      total_records: number
    }>
  }
}

interface ProcessingResult {
  success: boolean
  data_type: string
  raw_data_id: number
  total_records: number
  inserted_records: number
  processing_time_seconds: number
  error?: string
}

interface ProcessingResponse {
  success: boolean
  message?: string
  processed_count?: number
  success_count?: number
  error_count?: number
  results?: ProcessingResult[]
  error?: string
}

export default function ContaHubRawPage() {
  const { selectedBar } = useBar()
  const { setPageTitle } = usePageTitle()
  const [stats, setStats] = useState<RawDataStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [lastProcessingResult, setLastProcessingResult] = useState<ProcessingResponse | null>(null)

  // Carregar estatísticas
  const loadStats = async () => {
    if (!selectedBar) return
    try {
      setLoading(true)
      const response = await fetch(`/api/contahub/processar-raw?bar_id=${selectedBar.id}`)
      const data = await response.json()
      
      if (data.success) {
        setStats(data)
      } else {
        console.error('Erro ao carregar estatísticas:', data.error)
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error)
    } finally {
      setLoading(false)
    }
  }

  // Processar todos os dados brutos
  const processAllRawData = async () => {
    try {
      setProcessing(true)
      setProcessingProgress(0)
      setLastProcessingResult(null)

      const response = await fetch('/api/contahub/processar-raw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          process_all: true,
          bar_id: selectedBar?.id
        })
      })

      const result = await response.json()
      setLastProcessingResult(result)
      
      if (result.success) {
        setProcessingProgress(100)
        // Recarregar estatísticas após processamento
        setTimeout(() => {
          loadStats()
        }, 1000)
      }
    } catch (error) {
      console.error('Erro no processamento:', error)
      setLastProcessingResult({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setProcessing(false)
    }
  }

  // Processar um tipo específico
  const processSpecificType = async (rawDataId: number) => {
    try {
      setProcessing(true)
      
      const response = await fetch('/api/contahub/processar-raw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw_data_id: rawDataId
        })
      })

      const result = await response.json()
      setLastProcessingResult(result)
      
      if (result.success) {
        // Recarregar estatísticas após processamento
        loadStats()
      }
    } catch (error) {
      console.error('Erro no processamento:', error)
    } finally {
      setProcessing(false)
    }
  }

  useEffect(() => {
    setPageTitle('🗄️ ContaHub Raw')
    return () => setPageTitle('')
  }, [setPageTitle])

  useEffect(() => {
    loadStats()
  }, [])

  const getStatusBadge = (processed: number, total: number) => {
    if (processed === total) {
      return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Completo</Badge>
    } else if (processed > 0) {
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Parcial</Badge>
    } else {
      return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Pendente</Badge>
    }
  }

  const getProgressPercentage = (processed: number, total: number) => {
    return total > 0 ? Math.round((processed / total) * 100) : 0
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-6">
          <div className="card-dark p-6">
            <div className="flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              <span>Carregando estatísticas...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        <div className="card-dark p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="card-title-dark mb-2">
                <Database className="w-6 h-6 mr-2 inline" />
              </h1>
              <p className="card-description-dark">
                Gerencie e processe os dados brutos coletados do ContaHub
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={loadStats}
                variant="outline"
                disabled={loading || processing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                onClick={processAllRawData}
                disabled={processing || !stats?.summary.pending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Processar Todos
              </Button>
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="tabs-list-dark">
              <TabsTrigger value="overview" className="tabs-trigger-dark">
                <BarChart3 className="w-4 h-4 mr-2" />
                Visão Geral
              </TabsTrigger>
              <TabsTrigger value="details" className="tabs-trigger-dark">
                <FileText className="w-4 h-4 mr-2" />
                Detalhes por Tipo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Resumo Geral */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="card-dark">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Total de Registros
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats?.summary.total_records || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-dark">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Processados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {stats?.summary.processed || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-dark">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Pendentes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {stats?.summary.pending || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-dark">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Progresso Geral
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {getProgressPercentage(stats?.summary.processed || 0, stats?.summary.total_records || 0)}%
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Progresso de Processamento */}
              {processing && (
                <Card className="card-dark">
                  <CardHeader>
                    <CardTitle className="card-title-dark">
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Processamento em Andamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress value={processingProgress} className="w-full" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      Processando dados brutos...
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Resultado do Último Processamento */}
              {lastProcessingResult && (
                <Alert className={lastProcessingResult.success ? 'border-green-500' : 'border-red-500'}>
                  <AlertDescription>
                    {lastProcessingResult.success ? (
                      <div>
                        <strong>✅ Processamento concluído com sucesso!</strong>
                        <br />
                        {lastProcessingResult.message}
                        {lastProcessingResult.success_count !== undefined && (
                          <div className="mt-2">
                            <span className="text-green-600">Sucessos: {lastProcessingResult.success_count}</span>
                            {lastProcessingResult.error_count !== undefined && lastProcessingResult.error_count > 0 && (
                              <span className="text-red-600 ml-4">Erros: {lastProcessingResult.error_count}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <strong>❌ Erro no processamento:</strong>
                        <br />
                        {lastProcessingResult.error}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              {/* Detalhes por Tipo de Dados */}
              <div className="grid grid-cols-1 gap-4">
                {stats?.summary.by_type && Object.entries(stats.summary.by_type).map(([dataType, typeStats]) => (
                  <Card key={dataType} className="card-dark">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="card-title-dark capitalize">
                            {dataType}
                          </CardTitle>
                          <CardDescription className="card-description-dark">
                            {typeStats.total_records.toLocaleString()} registros de dados
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(typeStats.processed, typeStats.total)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>Progresso</span>
                          <span>{getProgressPercentage(typeStats.processed, typeStats.total)}%</span>
                        </div>
                        <Progress 
                          value={getProgressPercentage(typeStats.processed, typeStats.total)} 
                          className="w-full" 
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Total:</span>
                            <div className="font-semibold">{typeStats.total}</div>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Processados:</span>
                            <div className="font-semibold text-green-600">{typeStats.processed}</div>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Pendentes:</span>
                            <div className="font-semibold text-orange-600">{typeStats.pending}</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
