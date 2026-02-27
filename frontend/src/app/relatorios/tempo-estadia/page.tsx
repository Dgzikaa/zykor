'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PageHeader from '@/components/layouts/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/ui/loading-state'
import { Clock, Calendar, TrendingUp, Users, BarChart3, Timer } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useBar } from '@/contexts/BarContext'
import { motion } from 'framer-motion'

interface DadosMes {
  periodo: string
  total_vendas: number
  tempo_medio_minutos: number
}

interface DadosDiaSemana {
  dia_semana: number
  dia_nome: string
  total_vendas: number
  tempo_medio_minutos: number
}

interface DistribuicaoFaixa {
  faixa: string
  total: number
  percentual: number
}

interface TopCliente {
  telefone: string
  nome: string
  visitas: number
  tempo_medio_minutos: number
}

interface RelatorioData {
  estatisticas: {
    total_vendas: number
    tempo_medio_geral_minutos: number
    tempo_medio_formatado: string
  }
  por_mes: DadosMes[]
  por_dia_semana: DadosDiaSemana[]
  por_semana: DadosMes[]
  distribuicao_faixas: DistribuicaoFaixa[]
  top_clientes_maior_tempo: TopCliente[]
}

function formatarTempo(minutos: number): string {
  const horas = Math.floor(minutos / 60)
  const mins = Math.round(minutos % 60)
  return `${horas}h ${mins}min`
}

function formatarMes(periodo: string): string {
  const [ano, mes] = periodo.split('-')
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${meses[parseInt(mes) - 1]}/${ano.substring(2)}`
}

export default function TempoEstadiaPage() {
  const [data, setData] = useState<RelatorioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const { selectedBar } = useBar()
  const hasFetchedRef = useRef(false)
  const lastBarIdRef = useRef<number | null>(null)

  useEffect(() => {
    // Evitar loop: só buscar se bar mudou ou ainda não buscou
    if (!selectedBar?.id) return
    if (hasFetchedRef.current && lastBarIdRef.current === selectedBar.id) return
    
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch('/api/relatorios/tempo-estadia', {
          headers: {
            'x-user-data': JSON.stringify({ bar_id: selectedBar.id })
          }
        })
        
        if (!response.ok) {
          throw new Error('Erro ao buscar dados')
        }
        
        const result = await response.json()
        setData(result)
        hasFetchedRef.current = true
        lastBarIdRef.current = selectedBar.id
      } catch (err) {
        setError('Erro ao carregar relatório')
        hasFetchedRef.current = true
        lastBarIdRef.current = selectedBar.id
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [selectedBar?.id])

  if (!selectedBar?.id) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <PageHeader
          title="Tempo de Estadia"
          description="Análise de permanência dos clientes"
        />
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">Selecione um bar para ver o relatório</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        <PageHeader
          title="Tempo de Estadia"
          description="Análise detalhada de permanência dos clientes"
        />

      {loading ? (
        <LoadingState 
          title="Carregando análise..."
          subtitle="Processando dados de tempo de estadia"
          icon={<Timer className="w-4 h-4" />}
        />
      ) : error ? (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-6 text-center">
              <p className="text-red-500">{error}</p>
            </CardContent>
          </Card>
        ) : data && (
          <>
            {/* Cards de Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg">
                  <CardContent className="p-4 text-center">
                    <Timer className="w-8 h-8 text-white mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">
                      {data.estatisticas.tempo_medio_formatado}
                    </div>
                    <div className="text-blue-100 text-sm">Tempo Médio Geral</div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <Card className="bg-gradient-to-br from-green-500 to-green-600 border-0 shadow-lg">
                  <CardContent className="p-4 text-center">
                    <Users className="w-8 h-8 text-white mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">
                      {data.estatisticas.total_vendas.toLocaleString('pt-BR')}
                    </div>
                    <div className="text-green-100 text-sm">Total de Visitas</div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <Card className="bg-gradient-to-br from-purple-500 to-purple-600 border-0 shadow-lg">
                  <CardContent className="p-4 text-center">
                    <Calendar className="w-8 h-8 text-white mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">
                      {data.por_mes.length}
                    </div>
                    <div className="text-purple-100 text-sm">Meses Analisados</div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              >
                <Card className="bg-gradient-to-br from-orange-500 to-orange-600 border-0 shadow-lg">
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="w-8 h-8 text-white mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">
                      {data.distribuicao_faixas[0]?.faixa || '-'}
                    </div>
                    <div className="text-orange-100 text-sm">Faixa Mais Comum</div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Tabs com análises */}
            <Tabs defaultValue="mes" className="space-y-4">
              <TabsList className="bg-gray-100 dark:bg-gray-700 w-full justify-center">
                <TabsTrigger value="mes" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600 dark:text-gray-300 dark:data-[state=active]:text-white">
                  <Calendar className="w-4 h-4 mr-2" />
                  Por Mês
                </TabsTrigger>
                <TabsTrigger value="dia" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600 dark:text-gray-300 dark:data-[state=active]:text-white">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Por Dia da Semana
                </TabsTrigger>
                <TabsTrigger value="faixas" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600 dark:text-gray-300 dark:data-[state=active]:text-white">
                  <Timer className="w-4 h-4 mr-2" />
                  Distribuição
                </TabsTrigger>
                <TabsTrigger value="clientes" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600 dark:text-gray-300 dark:data-[state=active]:text-white">
                  <Users className="w-4 h-4 mr-2" />
                  Top Clientes
                </TabsTrigger>
              </TabsList>

              {/* Por Mês */}
              <TabsContent value="mes">
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardHeader className="text-center">
                    <CardTitle className="text-gray-900 dark:text-white flex items-center justify-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Tempo Médio por Mês
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table className="w-full table-fixed">
                        <TableHeader>
                          <TableRow className="border-gray-200 dark:border-gray-700">
                            <TableHead className="text-gray-700 dark:text-gray-300 !text-center w-1/4 [&>div]:justify-center">Mês</TableHead>
                            <TableHead className="text-gray-700 dark:text-gray-300 !text-center w-1/4 [&>div]:justify-center">Visitas</TableHead>
                            <TableHead className="text-gray-700 dark:text-gray-300 !text-center w-1/4 [&>div]:justify-center">Tempo Médio</TableHead>
                            <TableHead className="text-gray-700 dark:text-gray-300 !text-center w-1/4 [&>div]:justify-center">Variação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.por_mes.map((item, index) => {
                            const tempoAnterior = index > 0 ? data.por_mes[index - 1].tempo_medio_minutos : item.tempo_medio_minutos
                            const variacao = ((item.tempo_medio_minutos - tempoAnterior) / tempoAnterior * 100).toFixed(1)
                            const variacaoNum = parseFloat(variacao)
                            
                            return (
                              <TableRow key={item.periodo} className="border-gray-200 dark:border-gray-700">
                                <TableCell className="text-gray-900 dark:text-white font-medium text-center">
                                  {formatarMes(item.periodo)}
                                </TableCell>
                                <TableCell className="text-gray-600 dark:text-gray-400 text-center">
                                  {item.total_vendas.toLocaleString('pt-BR')}
                                </TableCell>
                                <TableCell className="text-gray-900 dark:text-white text-center font-medium">
                                  {formatarTempo(item.tempo_medio_minutos)}
                                </TableCell>
                                <TableCell className="text-center">
                                  {index > 0 && (
                                    <Badge className={variacaoNum > 0 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : variacaoNum < 0 ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}>
                                      {variacaoNum > 0 ? '+' : ''}{variacao}%
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Por Dia da Semana */}
              <TabsContent value="dia">
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardHeader className="text-center">
                    <CardTitle className="text-gray-900 dark:text-white flex items-center justify-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Tempo Médio por Dia da Semana
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                      {data.por_dia_semana.map((item) => {
                        const maxTempo = Math.max(...data.por_dia_semana.map(d => d.tempo_medio_minutos))
                        const altura = (item.tempo_medio_minutos / maxTempo * 100)
                        
                        return (
                          <motion.div
                            key={item.dia_semana}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3, delay: item.dia_semana * 0.05 }}
                            className="text-center"
                          >
                            <div className="h-40 flex flex-col justify-end items-center mb-2">
                              <div
                                className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all duration-500"
                                style={{ height: `${altura}%`, minHeight: '20px' }}
                              />
                            </div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {item.dia_nome}
                            </div>
                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                              {formatarTempo(item.tempo_medio_minutos)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {item.total_vendas.toLocaleString('pt-BR')} visitas
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Distribuição por Faixas */}
              <TabsContent value="faixas">
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardHeader className="text-center">
                    <CardTitle className="text-gray-900 dark:text-white flex items-center justify-center gap-2">
                      <Timer className="w-5 h-5" />
                      Distribuição por Faixa de Tempo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {data.distribuicao_faixas.map((item, index) => {
                        const cores = [
                          'from-green-500 to-green-400',
                          'from-blue-500 to-blue-400',
                          'from-purple-500 to-purple-400',
                          'from-orange-500 to-orange-400',
                          'from-red-500 to-red-400',
                          'from-pink-500 to-pink-400',
                          'from-gray-500 to-gray-400'
                        ]
                        
                        return (
                          <motion.div
                            key={item.faixa}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {item.faixa}
                              </span>
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {item.total.toLocaleString('pt-BR')} ({item.percentual}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${cores[index]} rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                                style={{ width: `${Math.max(item.percentual, 5)}%` }}
                              >
                                <span className="text-xs font-bold text-white">
                                  {item.percentual}%
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Top Clientes */}
              <TabsContent value="clientes">
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardHeader className="text-center">
                    <CardTitle className="text-gray-900 dark:text-white flex items-center justify-center gap-2">
                      <Users className="w-5 h-5" />
                      Top 20 Clientes com Maior Tempo Médio (min. 3 visitas)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table className="w-full table-fixed">
                        <TableHeader>
                          <TableRow className="border-gray-200 dark:border-gray-700">
                            <TableHead className="text-gray-700 dark:text-gray-300 !text-center w-[8%] [&>div]:justify-center">#</TableHead>
                            <TableHead className="text-gray-700 dark:text-gray-300 !text-center w-[30%] [&>div]:justify-center">Cliente</TableHead>
                            <TableHead className="text-gray-700 dark:text-gray-300 !text-center w-[25%] [&>div]:justify-center">Telefone</TableHead>
                            <TableHead className="text-gray-700 dark:text-gray-300 !text-center w-[12%] [&>div]:justify-center">Visitas</TableHead>
                            <TableHead className="text-gray-700 dark:text-gray-300 !text-center w-[25%] [&>div]:justify-center">Tempo Médio</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.top_clientes_maior_tempo.map((cliente, index) => (
                            <TableRow key={cliente.telefone} className="border-gray-200 dark:border-gray-700">
                              <TableCell className="text-gray-500 dark:text-gray-400 text-center">
                                {index + 1}
                              </TableCell>
                              <TableCell className="text-gray-900 dark:text-white font-medium text-center truncate">
                                {cliente.nome}
                              </TableCell>
                              <TableCell className="text-gray-600 dark:text-gray-400 text-center">
                                {cliente.telefone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                              </TableCell>
                              <TableCell className="text-gray-600 dark:text-gray-400 text-center">
                                {cliente.visitas}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                  {formatarTempo(cliente.tempo_medio_minutos)}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  )
}

