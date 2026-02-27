'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingState } from '@/components/ui/loading-state'
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  UserMinus, 
  UserPlus, 
  Ticket, 
  DollarSign,
  Calendar,
  ArrowRight,
  BarChart3,
  RefreshCcw,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Legend,
  Cell
} from 'recharts'

interface TicketData {
  periodo: 'antes' | 'depois'
  total_comandas: number
  total_dias: number
  comandas_por_dia: number
  clientes_unicos_total: number
  clientes_unicos_por_dia: number
  ticket_medio: number
  desconto_medio: number
  ticket_liquido: number
  faturamento_bruto_total: number
  faturamento_bruto_por_dia: number
  faturamento_liquido_total: number
  faturamento_liquido_por_dia: number
}

interface RecorrenciaData {
  clientes_antes: number
  clientes_depois: number
  dias_antes: number
  dias_depois: number
  retornaram: number
  deixaram_de_ir: number
  novos_clientes: number
  // Análise 2: Recorrência interna do período depois
  clientes_recorrentes_depois: number
  clientes_uma_vez_depois: number
  taxa_recorrencia_depois: number
}

interface EvolucaoData {
  data: string
  periodo: 'antes' | 'depois'
  comandas: number
  clientes: number
  ticket_medio: number
  faturamento: number
}

interface BaselineData {
  clientes_setembro: number
  retornaram_outubro: number
}

interface DiaData {
  ticket: TicketData[]
  recorrencia: RecorrenciaData
  evolucao: EvolucaoData[]
  baseline: BaselineData
}

interface ApiResponse {
  success: boolean
  datasEntrada: {
    quarta: string
    sexta: string
  }
  quartas: DiaData
  sextas: DiaData
}

export default function AnaliseCouvertPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [diaSelecionado, setDiaSelecionado] = useState<'quarta' | 'sexta'>('quarta')

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/relatorios/analise-couvert')
      const result = await response.json()
      if (result.success) {
        setData(result)
      } else {
        setError(result.error || 'Erro ao carregar dados')
      }
    } catch (err) {
      setError('Erro de conexão com o servidor')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  const getDadosDia = () => {
    if (!data) return null
    return diaSelecionado === 'quarta' ? data.quartas : data.sextas
  }

  const getTicketAntes = () => {
    const dados = getDadosDia()
    return dados?.ticket?.find(t => t.periodo === 'antes')
  }

  const getTicketDepois = () => {
    const dados = getDadosDia()
    return dados?.ticket?.find(t => t.periodo === 'depois')
  }

  const calcularVariacao = (antes: number, depois: number) => {
    if (!antes || antes === 0) return 0
    return ((depois - antes) / antes) * 100
  }

  const dadosDia = getDadosDia()
  const ticketAntes = getTicketAntes()
  const ticketDepois = getTicketDepois()
  const dataEntrada = diaSelecionado === 'quarta' ? data?.datasEntrada.quarta : data?.datasEntrada.sexta

  // Preparar dados para o gráfico de evolução
  const dadosGraficoEvolucao = dadosDia?.evolucao?.map(e => ({
    ...e,
    data: formatDate(e.data),
    dataOriginal: e.data,
    cor: e.periodo === 'antes' ? '#3b82f6' : '#10b981'
  })) || []

  // Calcular métricas de recorrência
  const recorrencia = dadosDia?.recorrencia
  const baseline = dadosDia?.baseline
  const taxaRetornoAtual = recorrencia?.clientes_antes 
    ? (recorrencia.retornaram / recorrencia.clientes_antes) * 100 
    : 0
  const taxaRetornoBaseline = baseline?.clientes_setembro 
    ? (baseline.retornaram_outubro / baseline.clientes_setembro) * 100 
    : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <LoadingState 
          title="Carregando análise..."
          subtitle="Processando dados de entrada obrigatória"
          icon={<Ticket className="w-4 h-4" />}
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <Button onClick={fetchData}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Ticket className="w-7 h-7 text-blue-500" />
              Análise do Couvert/Entrada
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Impacto da entrada obrigatória no ticket médio e recorrência
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={fetchData} variant="outline" className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Seletor de dia */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={diaSelecionado === 'quarta' ? 'default' : 'outline'}
            onClick={() => setDiaSelecionado('quarta')}
            className={diaSelecionado === 'quarta' 
              ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
            }
          >
            <Calendar className="w-4 h-4 mr-2" />
            Quarta-feira
          </Button>
          <Button
            variant={diaSelecionado === 'sexta' ? 'default' : 'outline'}
            onClick={() => setDiaSelecionado('sexta')}
            className={diaSelecionado === 'sexta' 
              ? 'bg-blue-500 hover:bg-blue-600 text-white' 
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
            }
          >
            <Calendar className="w-4 h-4 mr-2" />
            Sexta-feira
          </Button>
        </div>

        {/* Info da data de entrada */}
        <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white mb-6 border-0">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5" />
              <span className="font-medium">
                Entrada obrigatória a partir de: {dataEntrada && formatDate(dataEntrada + 'T00:00:00')}
              </span>
              <span className="text-blue-100 text-sm">
                ({diaSelecionado === 'quarta' ? 'Quarta de Bamba' : 'Sexta'})
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Ticket Médio */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Antes */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                ANTES da Entrada Obrigatória
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Set/Out até {dataEntrada && formatDate(dataEntrada + 'T00:00:00')} ({ticketAntes?.total_dias || 0} dias)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Ticket Médio</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(ticketAntes?.ticket_medio || 0)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Clientes/Dia</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Math.round(ticketAntes?.clientes_unicos_por_dia || 0)}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {ticketAntes?.clientes_unicos_total?.toLocaleString() || 0} total
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Comandas/Dia</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Math.round(ticketAntes?.comandas_por_dia || 0)}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {ticketAntes?.total_comandas?.toLocaleString() || 0} total
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Faturamento/Dia</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(ticketAntes?.faturamento_bruto_por_dia || 0)}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {formatCurrency(ticketAntes?.faturamento_bruto_total || 0)} total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Depois */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                DEPOIS da Entrada Obrigatória
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                A partir de {dataEntrada && formatDate(dataEntrada + 'T00:00:00')} ({ticketDepois?.total_dias || 0} dias)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Ticket Médio</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(ticketDepois?.ticket_medio || 0)}
                  </p>
                  {ticketAntes && ticketDepois && (
                    <div className={`flex items-center gap-1 mt-1 text-sm ${
                      calcularVariacao(ticketAntes.ticket_medio, ticketDepois.ticket_medio) >= 0 
                        ? 'text-green-500' 
                        : 'text-red-500'
                    }`}>
                      {calcularVariacao(ticketAntes.ticket_medio, ticketDepois.ticket_medio) >= 0 
                        ? <TrendingUp className="w-4 h-4" /> 
                        : <TrendingDown className="w-4 h-4" />
                      }
                      {Math.abs(calcularVariacao(ticketAntes.ticket_medio, ticketDepois.ticket_medio)).toFixed(1)}%
                    </div>
                  )}
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Clientes/Dia</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Math.round(ticketDepois?.clientes_unicos_por_dia || 0)}
                  </p>
                  {ticketAntes && ticketDepois && (
                    <div className={`flex items-center gap-1 mt-1 text-sm ${
                      calcularVariacao(ticketAntes.clientes_unicos_por_dia, ticketDepois.clientes_unicos_por_dia) >= 0 
                        ? 'text-green-500' 
                        : 'text-red-500'
                    }`}>
                      {calcularVariacao(ticketAntes.clientes_unicos_por_dia, ticketDepois.clientes_unicos_por_dia) >= 0 
                        ? <TrendingUp className="w-4 h-4" /> 
                        : <TrendingDown className="w-4 h-4" />
                      }
                      {Math.abs(calcularVariacao(ticketAntes.clientes_unicos_por_dia, ticketDepois.clientes_unicos_por_dia)).toFixed(1)}%
                    </div>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {ticketDepois?.clientes_unicos_total?.toLocaleString() || 0} total
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Comandas/Dia</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Math.round(ticketDepois?.comandas_por_dia || 0)}
                  </p>
                  {ticketAntes && ticketDepois && (
                    <div className={`flex items-center gap-1 mt-1 text-sm ${
                      calcularVariacao(ticketAntes.comandas_por_dia, ticketDepois.comandas_por_dia) >= 0 
                        ? 'text-green-500' 
                        : 'text-red-500'
                    }`}>
                      {calcularVariacao(ticketAntes.comandas_por_dia, ticketDepois.comandas_por_dia) >= 0 
                        ? <TrendingUp className="w-4 h-4" /> 
                        : <TrendingDown className="w-4 h-4" />
                      }
                      {Math.abs(calcularVariacao(ticketAntes.comandas_por_dia, ticketDepois.comandas_por_dia)).toFixed(1)}%
                    </div>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {ticketDepois?.total_comandas?.toLocaleString() || 0} total
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Faturamento/Dia</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(ticketDepois?.faturamento_bruto_por_dia || 0)}
                  </p>
                  {ticketAntes && ticketDepois && (
                    <div className={`flex items-center gap-1 mt-1 text-sm ${
                      calcularVariacao(ticketAntes.faturamento_bruto_por_dia, ticketDepois.faturamento_bruto_por_dia) >= 0 
                        ? 'text-green-500' 
                        : 'text-red-500'
                    }`}>
                      {calcularVariacao(ticketAntes.faturamento_bruto_por_dia, ticketDepois.faturamento_bruto_por_dia) >= 0 
                        ? <TrendingUp className="w-4 h-4" /> 
                        : <TrendingDown className="w-4 h-4" />
                      }
                      {Math.abs(calcularVariacao(ticketAntes.faturamento_bruto_por_dia, ticketDepois.faturamento_bruto_por_dia)).toFixed(1)}%
                    </div>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {formatCurrency(ticketDepois?.faturamento_bruto_total || 0)} total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Card de Comparativo de Variação (médias por dia) */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              Variação com a Entrada Obrigatória (médias por dia)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Ticket Médio */}
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <DollarSign className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Ticket Médio</p>
                {ticketAntes && ticketDepois && (
                  <p className={`text-2xl font-bold ${
                    calcularVariacao(ticketAntes.ticket_medio, ticketDepois.ticket_medio) >= 0 
                      ? 'text-green-500' 
                      : 'text-red-500'
                  }`}>
                    {calcularVariacao(ticketAntes.ticket_medio, ticketDepois.ticket_medio) >= 0 ? '+' : ''}
                    {calcularVariacao(ticketAntes.ticket_medio, ticketDepois.ticket_medio).toFixed(1)}%
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {formatCurrency(ticketAntes?.ticket_medio || 0)} → {formatCurrency(ticketDepois?.ticket_medio || 0)}
                </p>
              </div>

              {/* Comandas por Dia */}
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <Ticket className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Comandas/Dia</p>
                {ticketAntes && ticketDepois && (
                  <p className={`text-2xl font-bold ${
                    calcularVariacao(ticketAntes.comandas_por_dia, ticketDepois.comandas_por_dia) >= 0 
                      ? 'text-green-500' 
                      : 'text-red-500'
                  }`}>
                    {calcularVariacao(ticketAntes.comandas_por_dia, ticketDepois.comandas_por_dia) >= 0 ? '+' : ''}
                    {calcularVariacao(ticketAntes.comandas_por_dia, ticketDepois.comandas_por_dia).toFixed(1)}%
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {Math.round(ticketAntes?.comandas_por_dia || 0)} → {Math.round(ticketDepois?.comandas_por_dia || 0)}
                </p>
              </div>

              {/* Faturamento por Dia */}
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Faturamento/Dia</p>
                {ticketAntes && ticketDepois && (
                  <p className={`text-2xl font-bold ${
                    calcularVariacao(ticketAntes.faturamento_bruto_por_dia, ticketDepois.faturamento_bruto_por_dia) >= 0 
                      ? 'text-green-500' 
                      : 'text-red-500'
                  }`}>
                    {calcularVariacao(ticketAntes.faturamento_bruto_por_dia, ticketDepois.faturamento_bruto_por_dia) >= 0 ? '+' : ''}
                    {calcularVariacao(ticketAntes.faturamento_bruto_por_dia, ticketDepois.faturamento_bruto_por_dia).toFixed(1)}%
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {formatCurrency(ticketAntes?.faturamento_bruto_por_dia || 0)} → {formatCurrency(ticketDepois?.faturamento_bruto_por_dia || 0)}
                </p>
              </div>

              {/* Clientes por Dia */}
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Clientes/Dia</p>
                {ticketAntes && ticketDepois && (
                  <p className={`text-2xl font-bold ${
                    calcularVariacao(ticketAntes.clientes_unicos_por_dia, ticketDepois.clientes_unicos_por_dia) >= 0 
                      ? 'text-green-500' 
                      : 'text-red-500'
                  }`}>
                    {calcularVariacao(ticketAntes.clientes_unicos_por_dia, ticketDepois.clientes_unicos_por_dia) >= 0 ? '+' : ''}
                    {calcularVariacao(ticketAntes.clientes_unicos_por_dia, ticketDepois.clientes_unicos_por_dia).toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ANÁLISE 1: Clientes de Set/Out que voltaram após entrada */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Análise 1: Clientes de Set/Out → Retorno após entrada
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Dos CPFs que vieram em {diaSelecionado === 'quarta' ? 'quartas' : 'sextas'} de Set/Out ({recorrencia?.dias_antes || 0} dias), 
              quantos voltaram após {dataEntrada && formatDate(dataEntrada + 'T00:00:00')} ({recorrencia?.dias_depois || 0} dias)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {/* Clientes Antes */}
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <p className="text-sm text-blue-600 dark:text-blue-400">CPFs em Set/Out</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {recorrencia?.clientes_antes?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-blue-400">{recorrencia?.dias_antes || 0} dias</p>
              </div>

              {/* Retornaram */}
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm text-green-600 dark:text-green-400">Voltaram</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {recorrencia?.retornaram?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-green-500">
                  {recorrencia?.clientes_antes ? ((recorrencia.retornaram / recorrencia.clientes_antes) * 100).toFixed(1) : 0}%
                </p>
              </div>

              {/* Ainda não voltaram */}
              <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <UserMinus className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-sm text-amber-600 dark:text-amber-400">Ainda não voltaram</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {recorrencia?.deixaram_de_ir?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-amber-500">
                  {recorrencia?.clientes_antes ? ((recorrencia.deixaram_de_ir / recorrencia.clientes_antes) * 100).toFixed(1) : 0}%
                </p>
              </div>

              {/* Novos clientes */}
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <UserPlus className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <p className="text-sm text-purple-600 dark:text-purple-400">Novos (pós entrada)</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {recorrencia?.novos_clientes?.toLocaleString() || 0}
                </p>
              </div>

              {/* Clientes Depois */}
              <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <Users className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                <p className="text-sm text-emerald-600 dark:text-emerald-400">Total pós entrada</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {recorrencia?.clientes_depois?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-emerald-400">{recorrencia?.dias_depois || 0} dias</p>
              </div>
            </div>

            {/* Nota explicativa */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                ℹ️ <strong>Nota:</strong> "Ainda não voltaram" significa que não vieram em nenhuma {diaSelecionado === 'quarta' ? 'quarta' : 'sexta'} após a entrada obrigatória.
                Como temos apenas {recorrencia?.dias_depois || 0} dias de dados após a mudança, alguns podem voltar nas próximas semanas.
              </p>
            </div>

            {/* Comparativo de Taxa de Retorno */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Comparativo de Taxa de Retorno
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="w-2 h-full bg-blue-500 rounded"></div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Baseline (Set → Out, sem entrada)</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {taxaRetornoBaseline.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-400">
                      {baseline?.retornaram_outubro || 0} de {baseline?.clientes_setembro || 0} voltaram
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="w-2 h-full bg-green-500 rounded"></div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Atual (Set/Out → Nov/Dez, com entrada)</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {taxaRetornoAtual.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-400">
                      {recorrencia?.retornaram || 0} de {recorrencia?.clientes_antes || 0} voltaram
                    </p>
                  </div>
                </div>
              </div>
              <div className={`mt-3 p-3 rounded-lg ${taxaRetornoAtual < taxaRetornoBaseline ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                <p className={`text-sm font-medium ${taxaRetornoAtual < taxaRetornoBaseline ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {taxaRetornoAtual < taxaRetornoBaseline 
                    ? `⚠️ Queda de ${(taxaRetornoBaseline - taxaRetornoAtual).toFixed(1)} pontos percentuais na taxa de retorno`
                    : `✅ Aumento de ${(taxaRetornoAtual - taxaRetornoBaseline).toFixed(1)} pontos percentuais na taxa de retorno`
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ANÁLISE 2: Recorrência dos clientes pós-entrada */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
              <RefreshCcw className="w-5 h-5 text-purple-500" />
              Análise 2: Recorrência pós-entrada (a partir de {dataEntrada && formatDate(dataEntrada + 'T00:00:00')})
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Dos {recorrencia?.clientes_depois || 0} CPFs que vieram após a entrada obrigatória, quantos voltaram mais de 1 vez?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total de clientes */}
              <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <Users className="w-8 h-8 mx-auto mb-2 text-indigo-500" />
                <p className="text-sm text-indigo-600 dark:text-indigo-400">Total de CPFs após entrada</p>
                <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                  {recorrencia?.clientes_depois?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-indigo-400">em {recorrencia?.dias_depois || 0} dias</p>
              </div>

              {/* Voltaram mais de 1 vez */}
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm text-green-600 dark:text-green-400">Voltaram +1 vez</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {recorrencia?.clientes_recorrentes_depois?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-green-500">
                  {recorrencia?.taxa_recorrencia_depois?.toFixed(1) || 0}% de recorrência
                </p>
              </div>

              {/* Foram apenas 1 vez */}
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Vieram apenas 1 vez</p>
                <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                  {recorrencia?.clientes_uma_vez_depois?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-gray-500">
                  {recorrencia?.clientes_depois ? ((recorrencia.clientes_uma_vez_depois / recorrencia.clientes_depois) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de Evolução */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-500" />
              Evolução Semanal - Ticket Médio
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              <span className="inline-flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span> Antes da entrada
                <span className="w-3 h-3 rounded-full bg-green-500 ml-4"></span> Com entrada obrigatória
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGraficoEvolucao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis 
                    dataKey="data" 
                    stroke="#9ca3af"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="#9ca3af"
                    fontSize={12}
                    tickFormatter={(value) => `R$${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    labelStyle={{ color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: number) => [formatCurrency(value), 'Ticket Médio']}
                  />
                  <Bar dataKey="ticket_medio" radius={[4, 4, 0, 0]}>
                    {dadosGraficoEvolucao.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de Clientes */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              Evolução Semanal - Clientes Únicos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGraficoEvolucao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis 
                    dataKey="data" 
                    stroke="#9ca3af"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="#9ca3af"
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    labelStyle={{ color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: number) => [value.toLocaleString(), 'Clientes']}
                  />
                  <Bar dataKey="clientes" radius={[4, 4, 0, 0]}>
                    {dadosGraficoEvolucao.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.periodo === 'antes' ? '#8b5cf6' : '#a855f7'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

