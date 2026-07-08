'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import PageHeader from '@/components/layouts/PageHeader'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { Package, ShoppingCart, TrendingUp, DollarSign, Target, Download, CalendarDays, Calendar, Star, Percent } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useBar } from '@/contexts/BarContext'
import { usePageTitle } from '@/contexts/PageTitleContext'
import { AnimatedCounter, AnimatedCurrency } from '@/components/ui/animated-counter'
import { motion } from 'framer-motion'

// Singleton no escopo do modulo (Intl.NumberFormat e' caro).
const FMT_PRD_BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface Produto {
  produto: string
  grupo: string
  quantidade: number
  valorTotal: number
  custoTotal: number
  visitas: number
  ultimaVenda: string
  primeiraVenda: string
  diaDestaque: string
}

interface EstatisticasProdutos {
  totalProdutos: number
  totalVendas: number
  totalQuantidade: number
  totalCusto: number
  margemLucro: number
  totalRegistros: number
}

interface ApiResponse {
  produtos: Produto[]
  estatisticas: EstatisticasProdutos
}



export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [estatisticas, setEstatisticas] = useState<EstatisticasProdutos | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [diaSemanaFiltro, setDiaSemanaFiltro] = useState<string>('todos')
  const [grupoFiltro, setGrupoFiltro] = useState<string>('todos')
  const [activeTab, setActiveTab] = useState<string>('produtos')
  

  
  const { selectedBar } = useBar()
  const { toast } = useToast()
  const { setPageTitle } = usePageTitle()
  const isApiCallingRef = useRef(false)

  useEffect(() => {
    setPageTitle('📦 Produtos')
    return () => setPageTitle('')
  }, [setPageTitle])

  const fetchProdutos = useCallback(async () => {
    if (isApiCallingRef.current) return
    
    try {
      isApiCallingRef.current = true
      setLoading(true)
      setError(null)
            const params = new URLSearchParams()
      if (selectedBar?.id) {
        params.append('bar_id', selectedBar.id.toString())
      }
      if (diaSemanaFiltro !== 'todos') {
        params.append('dia_semana', diaSemanaFiltro)
      }
      if (grupoFiltro !== 'todos') {
        params.append('grupo', grupoFiltro)
      }

      const response = await fetch(`/api/analitico/produtos-final?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`)
      }

      const data: ApiResponse = await response.json()
      setProdutos(data.produtos)
      setEstatisticas(data.estatisticas)

    } catch (err) {
      console.error('Erro ao buscar produtos:', err)
      setError('Erro ao carregar dados dos produtos')
      toast({
        title: "Erro ao carregar produtos",
        description: "Não foi possível carregar os dados dos produtos. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      isApiCallingRef.current = false
    }
  }, [selectedBar, diaSemanaFiltro, grupoFiltro])

  useEffect(() => {
    fetchProdutos()
  }, [fetchProdutos])

  const formatCurrency = (value: number) => FMT_PRD_BRL.format(value)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T12:00:00Z')
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const exportarCSV = async () => {
    if (produtos.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há produtos para exportar.",
        variant: "destructive",
      })
      return
    }

    try {
      let nomeArquivo = ''
      const dadosCSV = produtos.map(produto => ({
        'Produto': produto.produto,
        'Grupo': produto.grupo,
        'Quantidade': produto.quantidade,
        'Visitas': produto.visitas,
        'Valor Total': produto.valorTotal,
        'Custo Total': produto.custoTotal,
        'Margem (%)': produto.valorTotal > 0 ? (((produto.valorTotal - produto.custoTotal) / produto.valorTotal) * 100).toFixed(1) : '0',
        'Vendas': produto.visitas,
        'Última Venda': formatDate(produto.ultimaVenda),
        'Primeira Venda': formatDate(produto.primeiraVenda)
      }))
      const diaLabel = diasSemana.find(d => d.value === diaSemanaFiltro)?.label.replace(/[^a-zA-Z0-9]/g, '_') || 'todos'
      const grupoLabel = gruposProdutos.find(g => g.value === grupoFiltro)?.label.replace(/[^a-zA-Z0-9]/g, '_') || 'todos'
      
      let filtros: string[] = []
      if (diaSemanaFiltro !== 'todos') filtros.push(diaLabel)
      if (grupoFiltro !== 'todos') filtros.push(grupoLabel)
      
      nomeArquivo = `produtos_${filtros.length > 0 ? `${filtros.join('_')}_` : ''}${new Date().toISOString().split('T')[0]}.csv`

      const headers = Object.keys(dadosCSV[0])
      const csvContent = [
        headers.join(','),
        ...dadosCSV.map(row => headers.map(header => `"${row[header]}"`).join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', nomeArquivo)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Exportação concluída",
        description: `Arquivo ${nomeArquivo} baixado com sucesso!`,
      })
    } catch (err) {
      console.error('Erro ao exportar CSV:', err)
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os dados.",
        variant: "destructive",
      })
    }
  }

  const getBadgeVariant = (posicao: number): "default" | "secondary" | "destructive" | "outline" => {
    if (posicao === 1) return "default"
    if (posicao <= 3) return "secondary" 
    if (posicao <= 10) return "outline"
    return "outline"
  }

  const diasSemana = [
    { value: 'todos', label: 'Todos os dias' },
    { value: '0', label: 'Domingo' },
    { value: '1', label: 'Segunda-feira' },
    { value: '2', label: 'Terça-feira (até 15/04/25)' }, // Dados históricos apenas
    { value: '3', label: 'Quarta-feira' },
    { value: '4', label: 'Quinta-feira' },
    { value: '5', label: 'Sexta-feira' },
    { value: '6', label: 'Sábado' },
  ]

  const gruposProdutos = [
    { value: 'todos', label: 'Todos os grupos' },
    { value: 'Baldes', label: 'Baldes' },
    { value: 'Bebidas Não Alcoólicas', label: 'Bebidas Não Alcoólicas' },
    { value: 'Bebidas Prontas', label: 'Bebidas Prontas' },
    { value: 'Cervejas', label: 'Cervejas' },
    { value: 'Combos', label: 'Combos' },
    { value: 'Doses', label: 'Doses' },
    { value: 'Drinks Autorais', label: 'Drinks Autorais' },
    { value: 'Drinks Classicos', label: 'Drinks Clássicos' },
    { value: 'Drinks sem Álcool', label: 'Drinks sem Álcool' },
    { value: 'Happy Hour', label: 'Happy Hour' },
    { value: 'Pratos Individuais', label: 'Pratos Individuais' },
    { value: 'Pratos Para Compartilhar - P/ 4 Pessoas', label: 'Pratos Para Compartilhar' },
    { value: 'Sanduíches', label: 'Sanduíches' },
    { value: 'Vinhos', label: 'Vinhos' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-6">
          <div className="card-dark p-6">
            <div className="flex items-center gap-3 mb-6">
              <Package className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="card-dark">
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="card-dark">
              <CardContent className="p-6">
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-6">
          <div className="card-dark p-6">
            <div className="text-center">
              <Package className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Erro ao carregar produtos
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {error}
              </p>
              <Button onClick={fetchProdutos} variant="outline">
                Tentar novamente
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          <PageHeader
            title="Produtos"
            description="Análise detalhada dos produtos mais vendidos"
          />

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={diaSemanaFiltro} onValueChange={setDiaSemanaFiltro}>
              <SelectTrigger className="w-full sm:w-[280px] bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                <SelectValue placeholder="Filtrar por dia da semana" className="text-gray-900 dark:text-gray-100" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                {diasSemana.map((dia) => (
                  <SelectItem 
                    key={dia.value} 
                    value={dia.value} 
                    className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700"
                  >
                    {dia.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={grupoFiltro} onValueChange={setGrupoFiltro}>
              <SelectTrigger className="w-full sm:w-[280px] bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                <SelectValue placeholder="Filtrar por grupo" className="text-gray-900 dark:text-gray-100" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                {gruposProdutos.map((grupo) => (
                  <SelectItem 
                    key={grupo.value} 
                    value={grupo.value} 
                    className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700"
                  >
                    {grupo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              onClick={exportarCSV} 
              variant="outline" 
              className="flex items-center gap-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
              disabled={produtos.length === 0}
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>

          {/* Cards de Estatísticas */}
          {estatisticas && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="card-dark">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Produtos Únicos
                        </p>
                        <AnimatedCounter 
                          value={estatisticas.totalProdutos} 
                          className="text-2xl font-bold text-gray-900 dark:text-white"
                        />
                      </div>
                      <Package className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="card-dark">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Vendas Totais
                        </p>
                        <AnimatedCurrency 
                          value={estatisticas.totalVendas} 
                          className="text-2xl font-bold text-green-600 dark:text-green-400"
                        />
                      </div>
                      <DollarSign className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="card-dark">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Quantidade Total
                        </p>
                        <AnimatedCounter 
                          value={estatisticas.totalQuantidade} 
                          className="text-2xl font-bold text-orange-600 dark:text-orange-400"
                        />
                      </div>
                      <ShoppingCart className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="card-dark">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Margem de Lucro
                        </p>
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {formatPercent(estatisticas.margemLucro)}
                        </div>
                      </div>
                      <Percent className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          )}

          {/* Tabela de Produtos */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <Card className="card-dark">
              <CardHeader className="border-b border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    <div>
                      <CardTitle className="card-title-dark">Top 100 Produtos por Vendas</CardTitle>
                      <CardDescription className="card-description-dark">
                        Produtos ordenados por faturamento total
                      </CardDescription>
                    </div>
                  </div>


                </div>
              </CardHeader>
              <CardContent className="p-0">
                <TabsContent value="produtos" className="mt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <TableHead className="text-gray-900 dark:text-gray-100 font-semibold w-12">#</TableHead>
                      <TableHead className="text-gray-900 dark:text-gray-100 font-semibold min-w-[200px]">Produto</TableHead>
                      <TableHead className="text-gray-900 dark:text-gray-100 font-semibold">Grupo</TableHead>
                      <TableHead className="text-gray-900 dark:text-gray-100 font-semibold text-center">Qtd</TableHead>
                      <TableHead className="text-gray-900 dark:text-gray-100 font-semibold text-center">Vendas</TableHead>
                      <TableHead className="text-gray-900 dark:text-gray-100 font-semibold text-right">Valor Total</TableHead>
                      <TableHead className="text-gray-900 dark:text-gray-100 font-semibold text-center">Margem</TableHead>
                      <TableHead className="text-gray-900 dark:text-gray-100 font-semibold text-center">Dia Destaque</TableHead>
                      <TableHead className="text-gray-900 dark:text-gray-100 font-semibold text-center">Última Venda</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtos.map((produto, index) => {
                      const posicao = index + 1
                      const margem = produto.valorTotal > 0 ? ((produto.valorTotal - produto.custoTotal) / produto.valorTotal) * 100 : 0
                      
                      return (
                        <TableRow 
                          key={`${produto.produto}-${index}`}
                          className="border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                        >
                          <TableCell className="font-medium">
                            <Badge variant={getBadgeVariant(posicao)} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold">
                              {posicao}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Package className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-gray-900 dark:text-white truncate">
                                  {produto.produto}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {produto.grupo}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {produto.quantidade.toLocaleString('pt-BR')}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {produto.visitas.toLocaleString('pt-BR')}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-bold text-green-600 dark:text-green-400">
                              {formatCurrency(produto.valorTotal)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant={margem >= 50 ? "default" : margem >= 30 ? "secondary" : "destructive"}
                              className="font-medium"
                            >
                              {formatPercent(margem)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Star className="h-3 w-3 text-yellow-500" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {produto.diaDestaque}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {formatDate(produto.ultimaVenda)}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
                </TabsContent>
              </CardContent>
            </Card>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
