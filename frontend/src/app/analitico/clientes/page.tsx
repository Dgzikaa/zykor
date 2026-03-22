'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/ui/loading-state'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Phone, Users, TrendingUp, MessageCircle, Download, CalendarDays, Calendar, User, Activity, Search, Flame, Settings2, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useBar } from '@/contexts/BarContext'
import { usePageTitle } from '@/contexts/PageTitleContext'

import type { Cliente, Estatisticas, Reservante } from './types'
import { ClientesStatistics } from './components/ClientesStatistics'
import { ClientesList } from './components/ClientesList'
import { ClienteDetalhesModal } from './components/ClienteDetalhesModal'
import {
  fetchClientes as fetchClientesService,
  fetchReservantes as fetchReservantesService,
  fetchSegmentacao as fetchSegmentacaoService,
  fetchSegmentosSalvos as fetchSegmentosSalvosService,
  salvarSegmento as salvarSegmentoService,
  exportCSV,
  type SegmentacaoCriteriosForm,
} from './services/clientes-service'

const ITEMS_PER_PAGE = 50

const diasSemana = [
  { value: 'todos', label: 'Todos os dias' },
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Segunda-feira' },
  { value: '2', label: 'Terça-feira (até 15/04/25)' },
  { value: '3', label: 'Quarta-feira' },
  { value: '4', label: 'Quinta-feira' },
  { value: '5', label: 'Sexta-feira' },
  { value: '6', label: 'Sábado' },
]

function formatDate(dateString: string) {
  const date = new Date(dateString + 'T12:00:00Z')
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [reservantes, setReservantes] = useState<Reservante[]>([])
  const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [diaSemanaFiltro, setDiaSemanaFiltro] = useState<string>('todos')
  const [buscaCliente, setBuscaCliente] = useState<string>('')
  const [buscaAplicada, setBuscaAplicada] = useState<string>('')
  const [activeTab, setActiveTab] = useState<string>('clientes')
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [modalAberto, setModalAberto] = useState(false)

  const [segmentoDia, setSegmentoDia] = useState<string>('')
  const [segmentoResumo, setSegmentoResumo] = useState<Record<string, unknown> | null>(null)
  const [segmentoClientes, setSegmentoClientes] = useState<Record<string, unknown>[]>([])
  const [loadingSegmento, setLoadingSegmento] = useState(false)
  const [segmentosSalvos, setSegmentosSalvos] = useState<Record<string, unknown>[]>([])
  const [nomeSegmento, setNomeSegmento] = useState<string>('')
  const [salvandoSegmento, setSalvandoSegmento] = useState(false)

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  const [criterios, setCriterios] = useState<SegmentacaoCriteriosForm>({
    diasJanela: 90,
    minVisitasTotal: 2,
    maxVisitasTotal: '',
    minVisitasDia: 1,
    diasDiferentes: '',
    ticketMedioMin: '',
    ticketMedioMax: '',
    ticketEntradaMin: '',
    ticketEntradaMax: '',
    ticketConsumoMin: '',
    ticketConsumoMax: '',
    gastoTotalMin: '',
    gastoTotalMax: '',
    ultimaVisitaMinDias: '',
    ultimaVisitaMaxDias: '',
    primeiraVisitaMaxDias: '',
    tamanhoGrupoMin: '',
    tamanhoGrupoMax: '',
    temEmail: '',
    temTelefone: '',
    mesAniversario: '',
  })

  const { toast } = useToast()
  const { selectedBar } = useBar()
  const { setPageTitle } = usePageTitle()
  const isApiCallingRef = useRef(false)

  useEffect(() => {
    setPageTitle('👥 Clientes')
    return () => setPageTitle('')
  }, [setPageTitle])

  const fetchClientes = useCallback(async () => {
    if (!selectedBar) {
      setLoading(false)
      return
    }
    if (isApiCallingRef.current) return

    try {
      isApiCallingRef.current = true
      setLoading(true)
      const data = await fetchClientesService(selectedBar.id, page, buscaAplicada, diaSemanaFiltro, {
        limit: ITEMS_PER_PAGE,
      })
      setClientes(data.clientes)
      setEstatisticas(data.estatisticas)
      if (data.meta) {
        setTotalPages(data.meta.totalPages)
        setTotalItems(data.meta.total)
      } else {
        setTotalPages(1)
        setTotalItems(data.clientes.length)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
      isApiCallingRef.current = false
    }
  }, [selectedBar, diaSemanaFiltro, buscaAplicada, page])

  useEffect(() => {
    setPage(1)
  }, [diaSemanaFiltro, buscaAplicada])

  const fetchReservantes = useCallback(async () => {
    if (!selectedBar) return
    try {
      setLoading(true)
      const data = await fetchReservantesService(selectedBar.id, diaSemanaFiltro)
      setReservantes(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [selectedBar, diaSemanaFiltro])

  const fetchSegmentacao = useCallback(
    async (diaSemana?: string) => {
      if (!selectedBar) return
      try {
        setLoadingSegmento(true)
        const data = await fetchSegmentacaoService(selectedBar.id, criterios, diaSemana)
        if (diaSemana) {
          setSegmentoClientes((data.data?.clientes as Record<string, unknown>[]) || [])
        } else {
          setSegmentoResumo(data.data ?? null)
          setSegmentoClientes([])
        }
      } catch (err) {
        toast({
          title: 'Erro ao buscar segmentação',
          description: err instanceof Error ? err.message : 'Erro desconhecido',
          variant: 'destructive',
        })
      } finally {
        setLoadingSegmento(false)
      }
    },
    [selectedBar, criterios, toast]
  )

  const fetchSegmentosSalvos = useCallback(async () => {
    if (!selectedBar) return
    try {
      const data = await fetchSegmentosSalvosService(selectedBar.id)
      setSegmentosSalvos(data)
    } catch (err) {
      console.error('Erro ao buscar segmentos salvos:', err)
    }
  }, [selectedBar])

  const downloadCSVSegmento = useCallback(
    async (completo: boolean = false) => {
      if (!selectedBar || !segmentoDia) {
        toast({
          title: 'Selecione um dia',
          description: 'Escolha um dia da semana para baixar o CSV',
          variant: 'destructive',
        })
        return
      }
      try {
        const blob = await exportCSV(selectedBar.id, { ...criterios, diaSemana: segmentoDia, completo })
        const downloadUrl = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = `segmento-${segmentoDia}-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(downloadUrl)
        document.body.removeChild(a)
        toast({ title: 'CSV exportado!', description: `${segmentoClientes.length} clientes exportados` })
      } catch (err) {
        toast({
          title: 'Erro ao exportar',
          description: err instanceof Error ? err.message : 'Erro desconhecido',
          variant: 'destructive',
        })
      }
    },
    [selectedBar, segmentoDia, segmentoClientes.length, criterios, toast]
  )

  const downloadCSVTodos = useCallback(
    async (completo: boolean = false) => {
      if (!selectedBar) {
        toast({ title: 'Selecione um bar', description: 'Escolha um bar para baixar o CSV', variant: 'destructive' })
        return
      }
      try {
        toast({ title: 'Gerando exportação...', description: 'Isso pode levar alguns segundos' })
        const blob = await exportCSV(selectedBar.id, { ...criterios, completo })
        const downloadUrl = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = `lista-clientes-completa-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(downloadUrl)
        document.body.removeChild(a)
        toast({ title: 'CSV exportado!', description: 'Lista completa de clientes exportada com sucesso' })
      } catch (err) {
        toast({
          title: 'Erro ao exportar',
          description: err instanceof Error ? err.message : 'Erro desconhecido',
          variant: 'destructive',
        })
      }
    },
    [selectedBar, criterios, toast]
  )

  const salvarSegmento = useCallback(async () => {
    if (!selectedBar || !nomeSegmento.trim()) {
      toast({ title: 'Nome obrigatório', description: 'Digite um nome para o segmento', variant: 'destructive' })
      return
    }
    try {
      setSalvandoSegmento(true)
      await salvarSegmentoService(selectedBar.id, nomeSegmento, criterios)
      toast({ title: 'Segmento salvo!', description: `"${nomeSegmento}" salvo com sucesso` })
      setNomeSegmento('')
      fetchSegmentosSalvos()
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setSalvandoSegmento(false)
    }
  }, [selectedBar, nomeSegmento, criterios, toast, fetchSegmentosSalvos])

  const carregarSegmentoSalvo = useCallback(
    (segmento: Record<string, unknown>) => {
      const crit = segmento.criterios as Partial<SegmentacaoCriteriosForm> | undefined
      if (crit) {
        setCriterios({
          diasJanela: crit.diasJanela ?? 90,
          minVisitasTotal: crit.minVisitasTotal ?? 2,
          maxVisitasTotal: crit.maxVisitasTotal ?? '',
          minVisitasDia: crit.minVisitasDia ?? 1,
          diasDiferentes: crit.diasDiferentes ?? '',
          ticketMedioMin: crit.ticketMedioMin ?? '',
          ticketMedioMax: crit.ticketMedioMax ?? '',
          ticketEntradaMin: crit.ticketEntradaMin ?? '',
          ticketEntradaMax: crit.ticketEntradaMax ?? '',
          ticketConsumoMin: crit.ticketConsumoMin ?? '',
          ticketConsumoMax: crit.ticketConsumoMax ?? '',
          gastoTotalMin: crit.gastoTotalMin ?? '',
          gastoTotalMax: crit.gastoTotalMax ?? '',
          ultimaVisitaMinDias: crit.ultimaVisitaMinDias ?? '',
          ultimaVisitaMaxDias: crit.ultimaVisitaMaxDias ?? '',
          primeiraVisitaMaxDias: crit.primeiraVisitaMaxDias ?? '',
          tamanhoGrupoMin: crit.tamanhoGrupoMin ?? '',
          tamanhoGrupoMax: crit.tamanhoGrupoMax ?? '',
          temEmail: crit.temEmail ?? '',
          temTelefone: crit.temTelefone ?? '',
          mesAniversario: crit.mesAniversario ?? '',
        })
        toast({ title: 'Segmento carregado', description: `Critérios de "${segmento.nome}" aplicados` })
      }
    },
    [toast]
  )

  const abrirModalCliente = useCallback((cliente: Cliente) => {
    setClienteSelecionado(cliente)
    setModalAberto(true)
  }, [])

  useEffect(() => {
    fetchClientes()
  }, [fetchClientes])

  useEffect(() => {
    if (activeTab === 'reservantes' && reservantes.length === 0) {
      fetchReservantes()
    }
    if (activeTab === 'lista-quente' && !segmentoResumo) {
      fetchSegmentacao()
      fetchSegmentosSalvos()
    }
  }, [activeTab, fetchReservantes, reservantes.length, fetchSegmentacao, fetchSegmentosSalvos, segmentoResumo])

  const executarBusca = useCallback(() => {
    setBuscaAplicada(buscaCliente.trim())
  }, [buscaCliente])

  useEffect(() => {
    fetchClientes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaAplicada])

  const handleWhatsAppClick = (nome: string, telefone: string | null) => {
    if (!telefone) {
      toast({ title: 'Telefone não disponível', description: 'Este cliente não possui telefone cadastrado', variant: 'destructive' })
      return
    }
    const telefoneNumeros = telefone.replace(/\D/g, '')
    const mensagem = `Olá ${nome}! 🎉\n\nObrigado por ser um cliente especial do nosso estabelecimento!\n\nEsperamos vê-lo em breve! 😊`
    window.open(`https://wa.me/55${telefoneNumeros}?text=${encodeURIComponent(mensagem)}`, '_blank')
    toast({ title: 'WhatsApp aberto', description: `Conversa iniciada com ${nome}` })
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const exportarCSV = () => {
    try {
      let dadosCSV: Record<string, unknown>[] = []
      let nomeArquivo = ''
      let totalItens = 0

      if (activeTab === 'clientes') {
        dadosCSV = clientes.map((cliente, index) => ({
          Posição: index + 1,
          Nome: cliente.nome_principal,
          Telefone: cliente.telefone || '',
          'Total Visitas': cliente.total_visitas,
          'Valor Total Entrada': cliente.valor_total_entrada,
          'Valor Total Consumo': cliente.valor_total_consumo,
          'Ticket Médio Geral': cliente.ticket_medio_geral,
          'Ticket Médio Entrada': cliente.ticket_medio_entrada,
          'Ticket Médio Consumo': cliente.ticket_medio_consumo,
          'Última Visita': formatDate(cliente.ultima_visita),
        }))
        nomeArquivo =
          diaSemanaFiltro === 'todos'
            ? 'clientes_todos_os_dias.csv'
            : `clientes_${diasSemana.find((d) => d.value === diaSemanaFiltro)?.label.toLowerCase().replace('-feira', '').replace(' ', '_')}.csv`
        totalItens = clientes.length
      } else {
        dadosCSV = reservantes.map((reservante, index) => ({
          Posição: index + 1,
          Nome: reservante.nome_principal,
          Telefone: reservante.telefone || '',
          'Total Reservas': reservante.total_reservas,
          'Total Visitas': reservante.total_visitas,
          '% Reservas': reservante.percentual_reservas.toFixed(1) + '%',
          'Reservas Seated': reservante.reservas_seated,
          'Reservas Confirmed': reservante.reservas_confirmed,
          'Reservas Pending': reservante.reservas_pending,
          'Reservas Cancelled': reservante.reservas_cancelled,
          'Reservas No-Show': reservante.reservas_noshow,
          '% Presença': reservante.percentual_presenca.toFixed(1) + '%',
          'Última Reserva': formatDate(reservante.ultima_reserva),
        }))
        nomeArquivo =
          diaSemanaFiltro === 'todos'
            ? 'reservantes_todos_os_dias.csv'
            : `reservantes_${diasSemana.find((d) => d.value === diaSemanaFiltro)?.label.toLowerCase().replace('-feira', '').replace(' ', '_')}.csv`
        totalItens = reservantes.length
      }

      const csvContent = [Object.keys(dadosCSV[0]).join(','), ...dadosCSV.map((row) => Object.values(row).join(','))].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = nomeArquivo
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast({ title: 'Exportação concluída', description: `${totalItens} ${activeTab} exportados para CSV` })
    } catch {
      toast({ title: 'Erro na exportação', description: 'Não foi possível exportar os dados', variant: 'destructive' })
    }
  }

  if (!selectedBar) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-2 py-4 max-w-[98vw]">
          <Card className="card-dark max-w-md mx-auto mt-20">
            <CardContent className="text-center py-16">
              <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="h-10 w-10 text-amber-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Selecione um Bar</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Para visualizar os dados de clientes, selecione um bar no seletor do topo da página.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (loading && clientes.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-2 py-4 max-w-[98vw]">
          <LoadingState title="Carregando análise..." subtitle="Processando dados dos clientes" icon={<Users className="w-4 h-4" />} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-2 py-4 max-w-[98vw]">
          <Card className="card-dark max-w-md mx-auto mt-20">
            <CardContent className="text-center py-16">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="h-10 w-10 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Erro ao carregar clientes</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
              <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700 text-white">
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-2 py-4 max-w-[98vw]">
        {estatisticas && <ClientesStatistics estatisticas={estatisticas} />}

        <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 delay-300">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <Card className="card-dark shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/40 border-b border-border">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-foreground" />
                      <div>
                        <CardTitle className="text-foreground">
                          {activeTab === 'clientes' ? 'Top 100 Clientes ContaHub' : activeTab === 'reservantes' ? 'Top 100 Reservantes Getin' : 'Segmentação Avançada'}
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">
                          {activeTab === 'clientes'
                            ? diaSemanaFiltro !== 'todos'
                              ? `Clientes ordenados por visitas em ${diasSemana.find((d) => d.value === diaSemanaFiltro)?.label}s`
                              : 'Dados do ContaHub ordenados por visitas totais'
                            : activeTab === 'reservantes'
                              ? diaSemanaFiltro !== 'todos'
                                ? `Reservantes com reservas em ${diasSemana.find((d) => d.value === diaSemanaFiltro)?.label}s`
                                : 'Dados de reservas ordenados por reservas efetivadas (seated)'
                              : 'Filtre e exporte clientes por critérios avançados'}
                        </CardDescription>
                      </div>
                    </div>

                    {activeTab !== 'lista-quente' && (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex gap-1">
                          <Input
                            type="text"
                            placeholder="Buscar cliente..."
                            value={buscaCliente}
                            onChange={(e) => setBuscaCliente(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && executarBusca()}
                            className="w-full sm:w-[180px]"
                          />
                          <Button onClick={executarBusca} variant="outline" className="rounded-lg" size="icon" title="Buscar">
                            <Search className="h-4 w-4" />
                          </Button>
                        </div>

                        <Select value={diaSemanaFiltro} onValueChange={setDiaSemanaFiltro}>
                          <SelectTrigger className="w-full sm:w-[200px]">
                            <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                            {diasSemana.map((dia) => (
                              <SelectItem key={dia.value} value={dia.value} className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">
                                {dia.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button onClick={exportarCSV} disabled={(activeTab === 'clientes' ? clientes.length : reservantes.length) === 0} variant="outline" className="rounded-lg" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <TabsList className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-1.5 rounded-xl shadow-sm">
                    <TabsTrigger
                      value="clientes"
                      className="px-4 py-2.5 text-sm font-medium transition-all duration-300 hover:bg-gray-50 dark:hover:bg-gray-700 data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:border data-[state=active]:border-border/70 data-[state=active]:shadow-none !rounded-xl"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Clientes
                    </TabsTrigger>
                    <TabsTrigger
                      value="reservantes"
                      className="px-4 py-2.5 text-sm font-medium transition-all duration-300 hover:bg-gray-50 dark:hover:bg-gray-700 data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:border data-[state=active]:border-border/70 data-[state=active]:shadow-none !rounded-xl"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Reservantes
                    </TabsTrigger>
                    <TabsTrigger
                      value="lista-quente"
                      className="px-4 py-2.5 text-sm font-medium transition-all duration-300 hover:bg-gray-50 dark:hover:bg-gray-700 data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:border data-[state=active]:border-border/70 data-[state=active]:shadow-none !rounded-xl"
                    >
                      <Flame className="h-4 w-4 mr-2" />
                      Lista Quente
                    </TabsTrigger>
                    <Link href="/relatorios/clientes-ativos">
                      <div className="px-4 py-2.5 text-sm font-medium transition-all duration-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl flex items-center cursor-pointer text-muted-foreground hover:text-foreground">
                        <Activity className="h-4 w-4 mr-2" />
                        Clientes Ativos
                      </div>
                    </Link>
                  </TabsList>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <TabsContent value="clientes" className="mt-0 p-4">
                  <ClientesList
                    clientes={clientes}
                    busca={buscaCliente}
                    onBuscaChange={setBuscaCliente}
                    onClienteSelect={abrirModalCliente}
                    loading={loading}
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                </TabsContent>

                <TabsContent value="reservantes" className="mt-0">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                      <TableRow className="border-b border-slate-200 dark:border-slate-700">
                        <TableHead className="text-slate-900 dark:text-white font-semibold py-4">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="w-7 h-7 rounded-full p-0 flex items-center justify-center bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold">
                              #
                            </Badge>
                            Posição
                          </div>
                        </TableHead>
                        <TableHead className="text-slate-900 dark:text-white font-semibold">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Nome do Reservante
                          </div>
                        </TableHead>
                        <TableHead className="text-slate-900 dark:text-white font-semibold">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            Contato
                          </div>
                        </TableHead>
                        <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <Calendar className="h-4 w-4" />
                            Total Reservas
                          </div>
                        </TableHead>
                        <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <Users className="h-4 w-4" />
                            Visitas
                          </div>
                        </TableHead>
                        <TableHead className="text-slate-900 dark:text-white font-semibold text-center">% Reservas</TableHead>
                        <TableHead className="text-slate-900 dark:text-white font-semibold text-center">Seated</TableHead>
                        <TableHead className="text-slate-900 dark:text-white font-semibold text-center">Status Reservas</TableHead>
                        <TableHead className="text-slate-900 dark:text-white font-semibold text-center">% Presença</TableHead>
                        <TableHead className="text-slate-900 dark:text-white font-semibold text-center">Última Reserva</TableHead>
                        <TableHead className="text-slate-900 dark:text-white font-semibold text-center">Contato</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reservantes.map((reservante, index) => (
                        <TableRow key={`${reservante.identificador_principal}-${index}`} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200">
                          <TableCell className="font-medium text-gray-900 dark:text-white">
                            <Badge
                              variant="outline"
                              className={`min-w-[2.5rem] h-8 flex items-center justify-center font-bold text-sm rounded-full ${
                                index === 0 ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : index === 1 ? 'bg-slate-700 text-white border-slate-700 shadow-sm' : index === 2 ? 'bg-slate-600 text-white border-slate-600 shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              #{index + 1}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-900 dark:text-white font-medium">{reservante.nome_principal}</TableCell>
                          <TableCell className="text-gray-600 dark:text-gray-300">{reservante.telefone || '—'}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                              {reservante.total_reservas}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                              {reservante.total_visitas}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-gray-600 dark:text-gray-400">{reservante.percentual_reservas.toFixed(1)}%</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                              {reservante.reservas_seated}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-wrap gap-1 justify-center">
                              <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800">
                                C: {reservante.reservas_confirmed}
                              </Badge>
                              <Badge variant="outline" className="text-xs bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800">
                                P: {reservante.reservas_pending}
                              </Badge>
                              <Badge variant="outline" className="text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">
                                X: {reservante.reservas_cancelled}
                              </Badge>
                              <Badge variant="outline" className="text-xs bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800">
                                NS: {reservante.reservas_noshow}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`${
                                reservante.percentual_presenca >= 80
                                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                                  : reservante.percentual_presenca >= 50
                                    ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
                                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                              }`}
                            >
                              {reservante.percentual_presenca.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-gray-600 dark:text-gray-400">{formatDate(reservante.ultima_reserva)}</TableCell>
                          <TableCell className="text-center">
                            {reservante.telefone ? (
                              <Button onClick={() => handleWhatsAppClick(reservante.nome_principal, reservante.telefone)} size="sm" variant="outline" className="rounded-full w-8 h-8 p-0">
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="lista-quente" className="mt-0 p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-4">
                      <Card className="card-dark">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Settings2 className="h-4 w-4" />
                            Critérios de Segmentação
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-muted-foreground">Dias janela</label>
                              <Input
                                type="number"
                                value={criterios.diasJanela}
                                onChange={(e) => setCriterios((c) => ({ ...c, diasJanela: Number(e.target.value) }))}
                                className="h-8"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Min visitas</label>
                              <Input
                                type="number"
                                value={criterios.minVisitasTotal}
                                onChange={(e) => setCriterios((c) => ({ ...c, minVisitasTotal: Number(e.target.value) }))}
                                className="h-8"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-muted-foreground">Max visitas</label>
                              <Input
                                type="text"
                                value={criterios.maxVisitasTotal}
                                onChange={(e) => setCriterios((c) => ({ ...c, maxVisitasTotal: e.target.value }))}
                                placeholder="∞"
                                className="h-8"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Min/dia</label>
                              <Input
                                type="number"
                                value={criterios.minVisitasDia}
                                onChange={(e) => setCriterios((c) => ({ ...c, minVisitasDia: Number(e.target.value) }))}
                                className="h-8"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-muted-foreground">Ticket min</label>
                              <Input
                                type="text"
                                value={criterios.ticketMedioMin}
                                onChange={(e) => setCriterios((c) => ({ ...c, ticketMedioMin: e.target.value }))}
                                placeholder="R$"
                                className="h-8"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Ticket max</label>
                              <Input
                                type="text"
                                value={criterios.ticketMedioMax}
                                onChange={(e) => setCriterios((c) => ({ ...c, ticketMedioMax: e.target.value }))}
                                placeholder="R$"
                                className="h-8"
                              />
                            </div>
                          </div>
                          <Button onClick={() => fetchSegmentacao()} disabled={loadingSegmento} className="w-full">
                            {loadingSegmento ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TrendingUp className="h-4 w-4 mr-2" />}
                            Buscar Segmento
                          </Button>
                        </CardContent>
                      </Card>

                      {segmentosSalvos.length > 0 && (
                        <Card className="card-dark">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Segmentos Salvos</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {segmentosSalvos.map((seg) => (
                                <Button key={String(seg.id)} variant="ghost" className="w-full justify-start text-sm h-8" onClick={() => carregarSegmentoSalvo(seg)}>
                                  {String(seg.nome)}
                                </Button>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    <div className="lg:col-span-2 space-y-4">
                      {segmentoResumo && (
                        <Card className="card-dark">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Flame className="h-4 w-4 text-orange-500" />
                              Resumo do Segmento
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="text-center p-3 bg-muted rounded-lg">
                                <div className="text-2xl font-bold text-foreground">{Number(segmentoResumo.total_clientes ?? 0)}</div>
                                <div className="text-xs text-muted-foreground">Clientes</div>
                              </div>
                              <div className="text-center p-3 bg-muted rounded-lg">
                                <div className="text-2xl font-bold text-foreground">{Number(segmentoResumo.total_visitas ?? 0)}</div>
                                <div className="text-xs text-muted-foreground">Visitas</div>
                              </div>
                              <div className="text-center p-3 bg-muted rounded-lg">
                                <div className="text-2xl font-bold text-foreground">{formatCurrency(Number(segmentoResumo.ticket_medio ?? 0))}</div>
                                <div className="text-xs text-muted-foreground">Ticket Médio</div>
                              </div>
                              <div className="text-center p-3 bg-muted rounded-lg">
                                <div className="text-2xl font-bold text-foreground">{formatCurrency(Number(segmentoResumo.valor_total ?? 0))}</div>
                                <div className="text-xs text-muted-foreground">Valor Total</div>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <Select value={segmentoDia} onValueChange={(val) => { setSegmentoDia(val); fetchSegmentacao(val); }}>
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue placeholder="Selecione um dia" />
                                </SelectTrigger>
                                <SelectContent>
                                  {diasSemana.filter((d) => d.value !== 'todos').map((dia) => (
                                    <SelectItem key={dia.value} value={dia.value}>
                                      {dia.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button variant="outline" onClick={() => downloadCSVSegmento(false)} disabled={!segmentoDia || segmentoClientes.length === 0}>
                                <FileSpreadsheet className="h-4 w-4 mr-2" />
                                CSV Simples
                              </Button>
                              <Button variant="outline" onClick={() => downloadCSVSegmento(true)} disabled={!segmentoDia || segmentoClientes.length === 0}>
                                <FileSpreadsheet className="h-4 w-4 mr-2" />
                                CSV Completo
                              </Button>
                              <Button variant="outline" onClick={() => downloadCSVTodos(false)}>
                                <Download className="h-4 w-4 mr-2" />
                                Exportar Todos
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {segmentoClientes.length > 0 && (
                        <Card className="card-dark">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">
                              Clientes do Segmento ({segmentoClientes.length})
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-0">
                            <div className="max-h-96 overflow-y-auto">
                              <Table>
                                <TableHeader className="bg-muted/50 sticky top-0">
                                  <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Telefone</TableHead>
                                    <TableHead className="text-center">Visitas</TableHead>
                                    <TableHead className="text-right">Ticket</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {segmentoClientes.slice(0, 50).map((cliente, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell className="font-medium">{String(cliente.nome ?? '')}</TableCell>
                                      <TableCell className="text-muted-foreground">{String(cliente.telefone ?? '—')}</TableCell>
                                      <TableCell className="text-center">{Number(cliente.total_visitas ?? 0)}</TableCell>
                                      <TableCell className="text-right">{formatCurrency(Number(cliente.ticket_medio ?? 0))}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      <Card className="card-dark">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Salvar Segmento</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Nome do segmento"
                              value={nomeSegmento}
                              onChange={(e) => setNomeSegmento(e.target.value)}
                              className="flex-1"
                            />
                            <Button onClick={salvarSegmento} disabled={!nomeSegmento.trim() || salvandoSegmento}>
                              {salvandoSegmento ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>
              </CardContent>
            </Card>
          </Tabs>
        </div>

        <ClienteDetalhesModal
          cliente={clienteSelecionado}
          isOpen={modalAberto}
          onClose={() => setModalAberto(false)}
          barId={selectedBar?.id ?? null}
        />
      </div>
    </div>
  )
}
