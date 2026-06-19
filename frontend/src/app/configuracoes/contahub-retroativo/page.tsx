'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useBar } from '@/contexts/BarContext'
import { 
  Calendar, 
  Database, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  BarChart3
} from 'lucide-react'

interface CollectionResult {
  success: boolean
  data_type: string
  date: string
  records_collected: number
  already_exists: boolean
  error?: string
}

interface RetroactiveResult {
  success: boolean
  message: string
  total_dates: number
  total_collections: number
  success_count: number
  error_count: number
  results: CollectionResult[]
}

export default function ContaHubRetroativoPage() {
  const { selectedBar } = useBar()
  const [startDate, setStartDate] = useState('2024-10-03')
  const [endDate, setEndDate] = useState('2025-12-08')
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['analitico', 'pagamentos', 'tempo', 'periodo', 'fatporhora'])
  const [forceRecollect, setForceRecollect] = useState(false)
  const [isCollecting, setIsCollecting] = useState(false)
  const [result, setResult] = useState<RetroactiveResult | null>(null)
  const [progress, setProgress] = useState(0)

  const dataTypes = [
    { id: 'analitico', label: 'Analítico', description: 'Dados de vendas detalhados' },
    { id: 'pagamentos', label: 'Pagamentos', description: 'Formas de pagamento' },
    { id: 'tempo', label: 'Tempo', description: 'Controle de ponto' },
    { id: 'periodo', label: 'Período', description: 'Vendas por período' },
    { id: 'fatporhora', label: 'Faturamento/Hora', description: 'Faturamento por hora' }
  ]

  const handleTypeChange = (typeId: string, checked: boolean) => {
    if (checked) {
      setSelectedTypes([...selectedTypes, typeId])
    } else {
      setSelectedTypes(selectedTypes.filter(t => t !== typeId))
    }
  }

  const calculateDateRange = () => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    return diffDays
  }

  const handleCollectRetroactive = async () => {
    if (selectedTypes.length === 0) {
      alert('Selecione pelo menos um tipo de dados')
      return
    }

    setIsCollecting(true)
    setResult(null)
    setProgress(0)

    try {
      const totalOperations = calculateDateRange() * selectedTypes.length
      let completedOperations = 0

      // Simular progresso (em produção, seria via WebSocket ou polling)
      const progressInterval = setInterval(() => {
        completedOperations += Math.random() * 5
        const newProgress = Math.min((completedOperations / totalOperations) * 100, 95)
        setProgress(newProgress)
      }, 200)

      const response = await fetch('/api/contahub/coletar-retroativo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          data_types: selectedTypes,
          bar_id: selectedBar?.id,
          force_recollect: forceRecollect
        })
      })

      clearInterval(progressInterval)
      setProgress(100)

      const data: RetroactiveResult = await response.json()
      setResult(data)

    } catch (error) {
      console.error('Erro na coleta retroativa:', error)
      setResult({
        success: false,
        message: 'Erro na coleta retroativa',
        total_dates: 0,
        total_collections: 0,
        success_count: 0,
        error_count: 1,
        results: []
      })
    } finally {
      setIsCollecting(false)
    }
  }

  const getResultsByType = (type: string) => {
    if (!result) return []
    return result.results.filter(r => r.data_type === type)
  }

  const getTypeStats = (type: string) => {
    const typeResults = getResultsByType(type)
    const success = typeResults.filter(r => r.success).length
    const errors = typeResults.filter(r => !r.success).length
    const existing = typeResults.filter(r => r.already_exists).length
    const collected = typeResults.reduce((sum, r) => sum + r.records_collected, 0)
    
    return { success, errors, existing, collected, total: typeResults.length }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        <div className="card-dark p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h1 className="card-title-dark">Coleta Retroativa - ContaHub</h1>
          </div>
          <p className="card-description-dark">
            Colete dados históricos do ContaHub para preencher lacunas no período especificado
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configurações */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Configurações da Coleta
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Configure o período e tipos de dados para coleta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Período */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-date" className="text-gray-700 dark:text-gray-300">Data Início</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="end-date" className="text-gray-700 dark:text-gray-300">Data Fim</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Resumo do período */}
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Período:</strong> {calculateDateRange()} dias
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Total de operações:</strong> {calculateDateRange() * selectedTypes.length}
                </p>
              </div>

              {/* Tipos de dados */}
              <div>
                <Label className="text-gray-700 dark:text-gray-300 mb-3 block">Tipos de Dados</Label>
                <div className="space-y-3">
                  {dataTypes.map((type) => (
                    <div key={type.id} className="flex items-start space-x-3">
                      <Checkbox
                        checked={selectedTypes.includes(type.id)}
                        onCheckedChange={(checked) => handleTypeChange(type.id, !!checked)}
                      />
                      <div className="flex-1">
                        <Label htmlFor={type.id} className="text-gray-900 dark:text-white font-medium">
                          {type.label}
                        </Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {type.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Opções avançadas */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={forceRecollect}
                    onCheckedChange={setForceRecollect}
                  />
                  <Label htmlFor="force-recollect" className="text-gray-700 dark:text-gray-300">
                    Forçar recoleta (sobrescrever dados existentes)
                  </Label>
                </div>
              </div>

              {/* Botão de ação */}
              <Button
                onClick={handleCollectRetroactive}
                disabled={isCollecting || selectedTypes.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
              >
                {isCollecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Coletando Dados...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Iniciar Coleta Retroativa
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Progresso e Resultados */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Progresso e Resultados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isCollecting && (
                <div>
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <span>Progresso da coleta</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              )}

              {result && (
                <div className="space-y-4">
                  {/* Resumo geral */}
                  <Alert className={result.success ? "border-green-200 bg-green-50 dark:bg-green-900/20" : "border-red-200 bg-red-50 dark:bg-red-900/20"}>
                    <CheckCircle className={`h-4 w-4 ${result.success ? 'text-green-600' : 'text-red-600'}`} />
                    <AlertDescription className={result.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}>
                      {result.message}
                    </AlertDescription>
                  </Alert>

                  {/* Estatísticas por tipo */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900 dark:text-white">Resultados por Tipo:</h4>
                    {selectedTypes.map((type) => {
                      const stats = getTypeStats(type)
                      const typeInfo = dataTypes.find(t => t.id === type)
                      
                      return (
                        <div key={type} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {typeInfo?.label}
                            </span>
                            <div className="flex gap-2">
                              {stats.success > 0 && (
                                <Badge className="badge-success">
                                  {stats.success} sucessos
                                </Badge>
                              )}
                              {stats.errors > 0 && (
                                <Badge className="badge-error">
                                  {stats.errors} erros
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            <p>📊 {stats.collected.toLocaleString()} registros coletados</p>
                            <p>✅ {stats.existing} datas já existiam</p>
                            <p>📅 {stats.total} datas processadas</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Próximos passos */}
                  {result.success && result.success_count > 0 && (
                    <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800 dark:text-blue-200">
                        <strong>Próximo passo:</strong> Execute o processamento dos dados coletados na página de 
                        <a href="/configuracoes/contahub-raw" className="underline ml-1">
                          Processamento de Dados Brutos
                        </a>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
