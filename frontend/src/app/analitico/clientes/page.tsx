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

// Função para obter número da semana ISO
function getISOWeekNumber(date: Date): { semana: number; ano: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { semana, ano: d.getUTCFullYear() };
}

// Função para calcular datas de início e fim de uma semana ISO
function getWeekDatesFromISO(ano: number, semana: number): { inicio: string; fim: string } {
  const jan4 = new Date(Date.UTC(ano, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
  const weekStart = new Date(firstMonday);
  weekStart.setUTCDate(firstMonday.getUTCDate() + (semana - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  
  const formatDateForWeek = (d: Date) => {
    const day = d.getUTCDate().toString().padStart(2, '0');
    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  };
  
  return {
    inicio: formatDateForWeek(weekStart),
    fim: formatDateForWeek(weekEnd),
  };
}

// Gerar lista de semanas (últimas 12 semanas + semana atual)
function gerarOpcoesSemanasDisponiveis(): Array<{ value: string; label: string; ano: number; semana: number }> {
  const hoje = new Date();
  const semanas: Array<{ value: string; label: string; ano: number; semana: number }> = [];
  
  // Adicionar últimas 12 semanas + atual
  for (let i = 0; i <= 12; i++) {
    const data = new Date(hoje);
    data.setDate(data.getDate() - (i * 7));
    const { semana, ano } = getISOWeekNumber(data);
    const { inicio, fim } = getWeekDatesFromISO(ano, semana);
    
    // Evitar duplicatas
    const key = `${ano}-${semana}`;
    if (!semanas.some(s => s.value === key)) {
      semanas.push({
        value: key,
        label: `Semana ${semana} (${inicio} - ${fim})`,
        ano,
        semana,
      });
    }
  }
  
  return semanas;
}

const semanasDisponiveis = gerarOpcoesSemanasDisponiveis();

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
    semanaAno: '',
    semanaNumero: '',
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
          semanaAno: crit.semanaAno ?? '',
          semanaNumero: crit.semanaNumero ?? '',
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

  const listaQuenteCarregadaRef = useRef(false)
  
  useEffect(() => {
    if (activeTab === 'reservantes' && reservantes.length === 0) {
      fetchReservantes()
    }
    if (activeTab === 'lista-quente' && !listaQuenteCarregadaRef.current) {
      listaQuenteCarregadaRef.current = true
      fetchSegmentacao()
      fetchSegmentosSalvos()
    }
  }, [activeTab, fetchReservantes, reservantes.length, fetchSegmentacao, fetchSegmentosSalvos])

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
                  <div className="space-y-6">
                    {/* Segmentos Salvos */}
                    {segmentosSalvos.length > 0 && !segmentoDia && (
                      <Card className="card-dark">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">Segmentos Salvos</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex flex-wrap gap-2">
                            {segmentosSalvos.map((seg) => (
                              <Button key={String(seg.id)} variant="outline" size="sm" onClick={() => carregarSegmentoSalvo(seg)} className="text-xs">
                                {String(seg.nome)}
                              </Button>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Construtor de Segmentos - TODOS os filtros */}
                    <Card className="card-dark">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Settings2 className="h-5 w-5 text-orange-500" />
                          Construtor de Segmentos
                        </CardTitle>
                        <CardDescription>Combine multiplos criterios para criar segmentos personalizados de clientes</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Janela e Frequencia */}
                        <div>
                          <h4 className="text-sm font-semibold text-muted-foreground mb-3">Janela e Frequencia</h4>
                          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Semana Específica</label>
                              <Select 
                                value={criterios.semanaAno && criterios.semanaNumero ? `${criterios.semanaAno}-${criterios.semanaNumero}` : 'nenhuma'} 
                                onValueChange={(v) => {
                                  if (v === 'nenhuma') {
                                    setCriterios((c) => ({ ...c, semanaAno: '', semanaNumero: '' }))
                                  } else {
                                    const [ano, semana] = v.split('-').map(Number)
                                    setCriterios((c) => ({ ...c, semanaAno: ano, semanaNumero: semana }))
                                  }
                                }}
                              >
                                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="nenhuma">Usar janela de dias</SelectItem>
                                  {semanasDisponiveis.map((s) => (
                                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Janela (dias)</label>
                              <Select 
                                value={String(criterios.diasJanela)} 
                                onValueChange={(v) => setCriterios((c) => ({ ...c, diasJanela: parseInt(v) }))}
                                disabled={!!(criterios.semanaAno && criterios.semanaNumero)}
                              >
                                <SelectTrigger className={`h-9 text-sm ${criterios.semanaAno && criterios.semanaNumero ? 'opacity-50' : ''}`}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="30">30 dias</SelectItem>
                                  <SelectItem value="60">60 dias</SelectItem>
                                  <SelectItem value="90">90 dias</SelectItem>
                                  <SelectItem value="120">120 dias</SelectItem>
                                  <SelectItem value="180">180 dias</SelectItem>
                                  <SelectItem value="365">1 ano</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Min. Visitas Total</label>
                              <Select value={String(criterios.minVisitasTotal)} onValueChange={(v) => setCriterios((c) => ({ ...c, minVisitasTotal: parseInt(v) }))}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                                    <SelectItem key={n} value={String(n)}>{n}+ visitas</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Max. Visitas Total</label>
                              <Input type="number" placeholder="Sem limite" value={criterios.maxVisitasTotal ?? ''} onChange={(e) => setCriterios((c) => ({ ...c, maxVisitasTotal: e.target.value }))} className="h-9 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Min. no Dia</label>
                              <Select value={String(criterios.minVisitasDia)} onValueChange={(v) => setCriterios((c) => ({ ...c, minVisitasDia: parseInt(v) }))}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {[1,2,3,4,5].map(n => (
                                    <SelectItem key={n} value={String(n)}>{n}+ vezes</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Dias Diferentes</label>
                              <Input type="number" placeholder="Ex: 3+" value={criterios.diasDiferentes ?? ''} onChange={(e) => setCriterios((c) => ({ ...c, diasDiferentes: e.target.value }))} className="h-9 text-sm" />
                            </div>
                          </div>
                        </div>

                        {/* Criterios Financeiros */}
                        <div>
                          <h4 className="text-sm font-semibold text-muted-foreground mb-3">Criterios Financeiros</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Ticket Medio Min (R$)</label>
                              <Input type="number" placeholder="Ex: 100" value={criterios.ticketMedioMin ?? ''} onChange={(e) => setCriterios((c) => ({ ...c, ticketMedioMin: e.target.value }))} className="h-9 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Ticket Medio Max (R$)</label>
                              <Input type="number" placeholder="Sem limite" value={criterios.ticketMedioMax ?? ''} onChange={(e) => setCriterios((c) => ({ ...c, ticketMedioMax: e.target.value }))} className="h-9 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Gasto Total Min (R$)</label>
                              <Input type="number" placeholder="Ex: 500" value={criterios.gastoTotalMin ?? ''} onChange={(e) => setCriterios((c) => ({ ...c, gastoTotalMin: e.target.value }))} className="h-9 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Gasto Total Max (R$)</label>
                              <Input type="number" placeholder="Sem limite" value={criterios.gastoTotalMax ?? ''} onChange={(e) => setCriterios((c) => ({ ...c, gastoTotalMax: e.target.value }))} className="h-9 text-sm" />
                            </div>
                          </div>
                        </div>

                        {/* Recencia e Ciclo de Vida */}
                        <div>
                          <h4 className="text-sm font-semibold text-muted-foreground mb-3">Recencia e Ciclo de Vida</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Ultima visita ha + de (dias)</label>
                              <Input type="number" placeholder="1" value={criterios.ultimaVisitaMinDias ?? ''} onChange={(e) => setCriterios((c) => ({ ...c, ultimaVisitaMinDias: e.target.value }))} className="h-9 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Ultima visita ha - de (dias)</label>
                              <Input type="number" placeholder="7" value={criterios.ultimaVisitaMaxDias ?? ''} onChange={(e) => setCriterios((c) => ({ ...c, ultimaVisitaMaxDias: e.target.value }))} className="h-9 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Cliente Novo (1a visita em)</label>
                              <Input type="number" placeholder="Ex: 30 dias" value={criterios.primeiraVisitaMaxDias ?? ''} onChange={(e) => setCriterios((c) => ({ ...c, primeiraVisitaMaxDias: e.target.value }))} className="h-9 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Tamanho Grupo Min</label>
                              <Input type="number" placeholder="Ex: 3 pessoas" value={criterios.tamanhoGrupoMin ?? ''} onChange={(e) => setCriterios((c) => ({ ...c, tamanhoGrupoMin: e.target.value }))} className="h-9 text-sm" />
                            </div>
                          </div>
                        </div>

                        {/* Filtros de Contato */}
                        <div>
                          <h4 className="text-sm font-semibold text-muted-foreground mb-3">Filtros de Contato</h4>
                          <div className="grid grid-cols-2 md:grid-cols-2 gap-3 max-w-md">
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Tem Email?</label>
                              <Select value={criterios.temEmail ?? 'todos'} onValueChange={(v) => setCriterios((c) => ({ ...c, temEmail: v === 'todos' ? '' : v }))}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="todos">Todos</SelectItem>
                                  <SelectItem value="true">Sim</SelectItem>
                                  <SelectItem value="false">Nao</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Tem Telefone?</label>
                              <Select value={criterios.temTelefone ?? 'todos'} onValueChange={(v) => setCriterios((c) => ({ ...c, temTelefone: v === 'todos' ? '' : v }))}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="todos">Todos</SelectItem>
                                  <SelectItem value="true">Sim</SelectItem>
                                  <SelectItem value="false">Nao</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        {/* Aniversariantes */}
                        <div>
                          <h4 className="text-sm font-semibold text-muted-foreground mb-3">Aniversariantes</h4>
                          <div className="max-w-xs">
                            <label className="block text-xs text-muted-foreground mb-1">Mes de Aniversario</label>
                            <Select value={criterios.mesAniversario ?? 'todos'} onValueChange={(v) => setCriterios((c) => ({ ...c, mesAniversario: v === 'todos' ? '' : v }))}>
                              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="todos">Todos os meses</SelectItem>
                                {['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((mes, i) => (
                                  <SelectItem key={i+1} value={String(i+1)}>{mes}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Botoes de Acao */}
                        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
                          <Button onClick={() => { setSegmentoDia(''); setSegmentoResumo(null); fetchSegmentacao(); }}>
                            {loadingSegmento ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Buscando...</> : <><Search className="h-4 w-4 mr-2" />Aplicar Filtros</>}
                          </Button>
                          <Button variant="outline" onClick={() => downloadCSVTodos(false)}>
                            <Download className="h-4 w-4 mr-2" />Exportar Lista
                          </Button>
                          <Button variant="outline" onClick={() => downloadCSVTodos(true)}>
                            <FileSpreadsheet className="h-4 w-4 mr-2" />CSV Completo
                          </Button>
                          <div className="flex items-center gap-2">
                            <Input placeholder="Nome do segmento..." value={nomeSegmento} onChange={(e) => setNomeSegmento(e.target.value)} className="w-48 h-9 text-sm" />
                            <Button variant="outline" onClick={salvarSegmento} disabled={salvandoSegmento || !nomeSegmento.trim()}>
                              {salvandoSegmento ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                            </Button>
                          </div>
                          <Button variant="ghost" onClick={() => setCriterios({ diasJanela: 90, semanaAno: '', semanaNumero: '', minVisitasTotal: 2, maxVisitasTotal: '', minVisitasDia: 1, diasDiferentes: '', ticketMedioMin: '', ticketMedioMax: '', ticketEntradaMin: '', ticketEntradaMax: '', ticketConsumoMin: '', ticketConsumoMax: '', gastoTotalMin: '', gastoTotalMax: '', ultimaVisitaMinDias: '', ultimaVisitaMaxDias: '', primeiraVisitaMaxDias: '', tamanhoGrupoMin: '', tamanhoGrupoMax: '', temEmail: '', temTelefone: '', mesAniversario: '' })} className="text-muted-foreground">
                            Limpar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Estatisticas do Segmento */}
                    {(segmentoResumo as any)?.estatisticas && !segmentoDia && (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <Card className="card-dark">
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-orange-500">{((segmentoResumo as any).estatisticas.totalClientes ?? 0).toLocaleString('pt-BR')}</div>
                            <div className="text-xs text-muted-foreground">Clientes no Segmento</div>
                          </CardContent>
                        </Card>
                        <Card className="card-dark">
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-green-500">R$ {((segmentoResumo as any).estatisticas.ticketMedioGeral ?? 0).toLocaleString('pt-BR')}</div>
                            <div className="text-xs text-muted-foreground">Ticket Medio</div>
                          </CardContent>
                        </Card>
                        <Card className="card-dark">
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-blue-500">{(segmentoResumo as any).estatisticas.visitasMedias ?? 0}</div>
                            <div className="text-xs text-muted-foreground">Visitas Medias</div>
                          </CardContent>
                        </Card>
                        <Card className="card-dark">
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-purple-500">{((segmentoResumo as any).estatisticas.comEmail ?? 0).toLocaleString('pt-BR')}</div>
                            <div className="text-xs text-muted-foreground">Com Email</div>
                          </CardContent>
                        </Card>
                        <Card className="card-dark">
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-cyan-500">{((segmentoResumo as any).estatisticas.comTelefone ?? 0).toLocaleString('pt-BR')}</div>
                            <div className="text-xs text-muted-foreground">Com Telefone</div>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {/* Resumo por Dia da Semana */}
                    {loadingSegmento ? (
                      <Card className="card-dark"><CardContent className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" /><p className="text-muted-foreground">Processando segmento...</p></CardContent></Card>
                    ) : (segmentoResumo as any)?.resumoPorDia && !segmentoDia ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {Object.entries((segmentoResumo as any).resumoPorDia).map(([dia, dados]: [string, any]) => (
                          <Card key={dia} className="card-dark cursor-pointer hover:border-orange-500 transition-colors" onClick={() => { setSegmentoDia(dia); fetchSegmentacao(dia); }}>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center justify-between">
                                <span>{dados.label}</span>
                                <Badge variant="secondary">{dados.totalClientes} clientes</Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Ticket: R$ {dados.ticketMedioSegmento?.toLocaleString('pt-BR')}</span>
                                <span>Total: R$ {dados.gastoTotalSegmento?.toLocaleString('pt-BR')}</span>
                              </div>
                              {dados.exemplos?.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {dados.exemplos.map((ex: any, i: number) => (
                                    <div key={i} className="text-xs text-muted-foreground truncate">{ex.nome} ({ex.visitas}x - R${ex.ticketMedio})</div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : null}

                    {/* Lista de Clientes do Dia Selecionado */}
                    {segmentoDia && !loadingSegmento && (
                      <Card className="card-dark">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center justify-between">
                            <span>Clientes - {segmentoDia.charAt(0).toUpperCase() + segmentoDia.slice(1)} ({segmentoClientes.length})</span>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => downloadCSVSegmento(false)} disabled={segmentoClientes.length === 0}>
                                <FileSpreadsheet className="h-3 w-3 mr-1" />CSV
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => downloadCSVSegmento(true)} disabled={segmentoClientes.length === 0}>
                                <FileSpreadsheet className="h-3 w-3 mr-1" />Completo
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setSegmentoDia(''); setSegmentoClientes([]); }}>Voltar</Button>
                            </div>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="max-h-[500px] overflow-y-auto">
                            <Table>
                              <TableHeader className="bg-muted/50 sticky top-0">
                                <TableRow>
                                  <TableHead>Nome</TableHead>
                                  <TableHead>Telefone</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead className="text-center">Visitas Dia</TableHead>
                                  <TableHead className="text-center">Total Visitas</TableHead>
                                  <TableHead className="text-right">Ticket Medio</TableHead>
                                  <TableHead className="text-right">Gasto Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {segmentoClientes.map((cliente: any, idx: number) => (
                                  <TableRow key={idx}>
                                    <TableCell className="font-medium">{cliente.Nome ?? ''}</TableCell>
                                    <TableCell className="text-muted-foreground">{cliente.Telefone ?? '-'}</TableCell>
                                    <TableCell className="text-muted-foreground text-xs">{cliente.Email ?? '-'}</TableCell>
                                    <TableCell className="text-center">{cliente.VisitasNoDia ?? '-'}</TableCell>
                                    <TableCell className="text-center">{cliente.TotalVisitas ?? 0}</TableCell>
                                    <TableCell className="text-right">R$ {(cliente.TicketMedio ?? 0).toLocaleString('pt-BR')}</TableCell>
                                    <TableCell className="text-right">R$ {(cliente.GastoTotal ?? 0).toLocaleString('pt-BR')}</TableCell>
                                  </TableRow>
                                ))}
                                {segmentoClientes.length === 0 && (
                                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum cliente encontrado para este dia</TableCell></TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
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
