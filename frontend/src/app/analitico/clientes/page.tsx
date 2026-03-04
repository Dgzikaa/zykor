'use client'

import { useState, useEffect, useCallback, useRef, memo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import PageHeader from '@/components/layouts/PageHeader'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadingState } from '@/components/ui/loading-state'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Phone, Users, TrendingUp, MessageCircle, DollarSign, Target, Download, CalendarDays, Calendar, User, Eye, X, Activity, Search, Flame, Settings2, FileSpreadsheet, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useBar } from '@/contexts/BarContext'
import { AnimatedCounter, AnimatedCurrency } from '@/components/ui/animated-counter'

interface Cliente {
  identificador_principal: string
  nome_principal: string
  telefone: string | null
  email: string | null
  total_visitas: number
  total_visitas_geral?: number
  visitas_formatadas?: string
  valor_total_gasto: number
  valor_total_entrada: number
  valor_total_consumo: number
  ticket_medio_geral: number
  ticket_medio_entrada: number
  ticket_medio_consumo: number
  ultima_visita: string
  tempo_medio_estadia_minutos?: number
  tempo_medio_estadia_formatado?: string
  tempos_estadia_detalhados?: number[]
  total_visitas_com_tempo?: number
}

interface Estatisticas {
  total_clientes_unicos: number
  total_visitas_geral: number
  ticket_medio_geral: number
  ticket_medio_entrada: number
  ticket_medio_consumo: number
  valor_total_entrada: number
  valor_total_consumo: number
}

interface ApiResponse {
  clientes: Cliente[]
  estatisticas: Estatisticas
}

interface Reservante {
  identificador_principal: string
  nome_principal: string
  telefone: string | null
  total_reservas: number
  total_visitas: number
  percentual_reservas: number
  reservas_seated: number
  reservas_confirmed: number
  reservas_pending: number
  reservas_cancelled: number
  reservas_noshow: number
  ultima_reserva: string
  percentual_presenca: number
}

interface VisitaDetalhada {
  data: string
  couvert: number
  consumo: number
  total: number
}

interface DetalhesResponse {
  visitas: VisitaDetalhada[]
  total_visitas: number
  dia_destaque: string
  cliente: {
    nome: string
    telefone: string
  }
}

interface ProdutoFavorito {
  produto: string
  categoria: string
  quantidade: number
  vezes_pediu: number
}

interface CategoriaFavorita {
  categoria: string
  quantidade: number
  valor_total: number
}

interface PerfilConsumo {
  telefone: string
  nome: string
  total_visitas: number
  total_itens_consumidos: number
  valor_total_consumo: number
  produtos_favoritos: ProdutoFavorito[]
  categorias_favoritas: CategoriaFavorita[]
  tags: string[]
  dias_preferidos: string[]
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [reservantes, setReservantes] = useState<Reservante[]>([])
  const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [diaSemanaFiltro, setDiaSemanaFiltro] = useState<string>('todos')
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([])
  const [buscaCliente, setBuscaCliente] = useState<string>('')
  const [buscaAplicada, setBuscaAplicada] = useState<string>('') // Busca que foi realmente aplicada
  const [activeTab, setActiveTab] = useState<string>('clientes')
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [visitasDetalhadas, setVisitasDetalhadas] = useState<VisitaDetalhada[]>([])
  const [diaDestaque, setDiaDestaque] = useState<string>('')
  const [loadingVisitas, setLoadingVisitas] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [paginaTempos, setPaginaTempos] = useState(1) // ✅ Hook para paginação dos tempos
  const [perfilConsumo, setPerfilConsumo] = useState<PerfilConsumo | null>(null)
  const [loadingPerfil, setLoadingPerfil] = useState(false)
  
  // Estados para Segmentação/Lista Quente
  const [segmentoDia, setSegmentoDia] = useState<string>('')
  const [segmentoResumo, setSegmentoResumo] = useState<any>(null)
  const [segmentoClientes, setSegmentoClientes] = useState<any[]>([])
  const [loadingSegmento, setLoadingSegmento] = useState(false)
  const [segmentosSalvos, setSegmentosSalvos] = useState<any[]>([])
  const [nomeSegmento, setNomeSegmento] = useState<string>('')
  const [salvandoSegmento, setSalvandoSegmento] = useState(false)
  
  // Paginação
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const ITEMS_PER_PAGE = 50
  
  // Critérios de segmentação
  const [criterios, setCriterios] = useState({
    // Janela e frequência
    diasJanela: 90,
    minVisitasTotal: 2,
    maxVisitasTotal: '',
    minVisitasDia: 1,
    diasDiferentes: '',
    
    // Financeiros
    ticketMedioMin: '',
    ticketMedioMax: '',
    ticketEntradaMin: '',
    ticketEntradaMax: '',
    ticketConsumoMin: '',
    ticketConsumoMax: '',
    gastoTotalMin: '',
    gastoTotalMax: '',
    
    // Recência
    ultimaVisitaMinDias: '',
    ultimaVisitaMaxDias: '',
    primeiraVisitaMaxDias: '',
    
    // Perfil Social
    tamanhoGrupoMin: '',
    tamanhoGrupoMax: '',
    
    // Contato
    temEmail: '',
    temTelefone: '',
    
    // Aniversário
    mesAniversario: '',
  })
  
  const { toast } = useToast()
  const { selectedBar } = useBar()
  const isApiCallingRef = useRef(false)

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

  const fetchClientes = useCallback(async () => {
    // Verificar se há bar selecionado (obrigatório para a API)
    if (!selectedBar) {
      console.log('⚠️ Nenhum bar selecionado, aguardando seleção...')
      setLoading(false)
      return
    }
    
    // Evitar múltiplas chamadas simultâneas usando useRef
    if (isApiCallingRef.current) {
      console.log('⚠️ API já está sendo chamada, ignorando chamada duplicada')
      return
    }
    
    try {
      isApiCallingRef.current = true
      setLoading(true)
      
      // Delay mínimo para mostrar loading
      const minLoadingTime = new Promise(resolve => setTimeout(resolve, 800))
      
      const params = new URLSearchParams()
      if (diaSemanaFiltro !== 'todos') {
        params.append('dia_semana', diaSemanaFiltro)
      }
      if (buscaAplicada) {
        params.append('busca', buscaAplicada)
      }
      
      // Adicionar paginação
      params.append('page', page.toString())
      params.append('limit', ITEMS_PER_PAGE.toString())
      
      const url = `/api/analitico/clientes${params.toString() ? `?${params.toString()}` : ''}`
      console.log('🔍 Frontend: Buscando clientes com URL:', url)
      
      // Retry automático para lidar com falhas temporárias do React StrictMode
      let response
      let attempts = 0
      const maxAttempts = 3
      
      while (attempts < maxAttempts) {
        attempts++
        try {
          const [fetchResponse] = await Promise.all([
            fetch(url, {
              headers: {
                'x-user-data': JSON.stringify({ bar_id: selectedBar.id })
              }
            }),
            attempts === 1 ? minLoadingTime : Promise.resolve()
          ])
          
          if (fetchResponse.ok) {
            response = fetchResponse
            console.log(`✅ Sucesso na tentativa ${attempts}`)
            break
          } else {
            console.log(`⚠️ Tentativa ${attempts} falhou: ${fetchResponse.status}`)
            if (attempts === maxAttempts) {
              response = fetchResponse
              break
            }
            await new Promise(resolve => setTimeout(resolve, 1000)) // Aguardar 1s
          }
        } catch (error) {
          console.log(`⚠️ Erro na tentativa ${attempts}:`, error)
          if (attempts === maxAttempts) throw error
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
      if (!response.ok) {
        console.error('❌ Todas as tentativas falharam:', response.status, response.statusText)
        throw new Error('Erro ao carregar dados dos clientes')
      }
      const data: ApiResponse = await response.json()
      console.log('✅ Dados recebidos da API:', data)
      console.log('✅ Clientes recebidos:', data.clientes?.length || 0)
      setClientes(data.clientes)
      setClientesFiltrados(data.clientes) // Agora já vem filtrado da API
      setEstatisticas(data.estatisticas)
      
      // Atualizar paginação se houver meta
      if ((data as any).meta) {
        setTotalPages((data as any).meta.totalPages)
        setTotalItems((data as any).meta.total)
      } else {
        // Fallback se API antiga
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
  
  // Resetar página quando trocar filtros
  useEffect(() => {
    setPage(1)
  }, [diaSemanaFiltro, buscaAplicada])

  const fetchReservantes = useCallback(async () => {
    try {
      setLoading(true)
      
      // Delay mínimo para mostrar loading
      const minLoadingTime = new Promise(resolve => setTimeout(resolve, 800))
      
      // Construir URL com parâmetros
      const params = new URLSearchParams()
      if (diaSemanaFiltro !== 'todos') {
        params.append('dia_semana', diaSemanaFiltro)
      }
      
      const url = `/api/analitico/reservantes${params.toString() ? `?${params.toString()}` : ''}`
      console.log('🔍 Frontend: Buscando reservantes com URL:', url)
      
      // Verificar se há bar selecionado
      if (!selectedBar) {
        console.log('⚠️ Nenhum bar selecionado para reservantes')
        setLoading(false)
        return
      }
      
      const [response] = await Promise.all([
        fetch(url, {
          headers: {
            'x-user-data': JSON.stringify({ bar_id: selectedBar.id })
          }
        }),
        minLoadingTime
      ])
      
      if (!response.ok) {
        throw new Error('Erro ao carregar dados dos reservantes')
      }
      const data = await response.json()
      setReservantes(data.reservantes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [selectedBar, diaSemanaFiltro])

  const fetchVisitasDetalhadas = useCallback(async (cliente: Cliente) => {
    try {
      setLoadingVisitas(true)
      
      const response = await fetch(`/api/analitico/clientes/detalhes?telefone=${cliente.telefone}`, {
        headers: selectedBar ? {
          'x-user-data': JSON.stringify({ bar_id: selectedBar.id })
        } : undefined
      })
      
      if (!response.ok) {
        throw new Error('Erro ao carregar detalhes das visitas')
      }
      
      const data: DetalhesResponse = await response.json()
      setVisitasDetalhadas(data.visitas || [])
      setDiaDestaque(data.dia_destaque || 'Não definido')
    } catch (err) {
      toast({
        title: "Erro ao carregar detalhes",
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: "destructive"
      })
      setVisitasDetalhadas([])
    } finally {
      setLoadingVisitas(false)
    }
  }, [selectedBar, toast])

  const fetchPerfilConsumo = useCallback(async (telefone: string) => {
    try {
      setLoadingPerfil(true)
      setPerfilConsumo(null)
      
      const response = await fetch(`/api/analitico/clientes/perfil-consumo?telefone=${telefone}`, {
        headers: selectedBar ? {
          'x-user-data': JSON.stringify({ bar_id: selectedBar.id })
        } : undefined
      })
      
      if (!response.ok) {
        console.warn('Perfil de consumo não encontrado')
        return
      }
      
      const data = await response.json()
      if (data.perfil) {
        setPerfilConsumo(data.perfil)
      }
    } catch (err) {
      console.warn('Erro ao buscar perfil de consumo:', err)
    } finally {
      setLoadingPerfil(false)
    }
  }, [selectedBar])

  // Construir URL com todos os critérios
  const construirUrlSegmentacao = useCallback((diaSemana?: string, formato?: string) => {
    if (!selectedBar) return ''
    
    const params = new URLSearchParams()
    params.append('bar_id', selectedBar.id.toString())
    
    // Janela e frequência
    params.append('dias_janela', criterios.diasJanela.toString())
    params.append('min_visitas_total', criterios.minVisitasTotal.toString())
    params.append('min_visitas_dia', criterios.minVisitasDia.toString())
    if (criterios.maxVisitasTotal) params.append('max_visitas_total', criterios.maxVisitasTotal)
    if (criterios.diasDiferentes) params.append('dias_diferentes', criterios.diasDiferentes)
    
    // Financeiros
    if (criterios.ticketMedioMin) params.append('ticket_medio_min', criterios.ticketMedioMin)
    if (criterios.ticketMedioMax) params.append('ticket_medio_max', criterios.ticketMedioMax)
    if (criterios.ticketEntradaMin) params.append('ticket_entrada_min', criterios.ticketEntradaMin)
    if (criterios.ticketEntradaMax) params.append('ticket_entrada_max', criterios.ticketEntradaMax)
    if (criterios.ticketConsumoMin) params.append('ticket_consumo_min', criterios.ticketConsumoMin)
    if (criterios.ticketConsumoMax) params.append('ticket_consumo_max', criterios.ticketConsumoMax)
    if (criterios.gastoTotalMin) params.append('gasto_total_min', criterios.gastoTotalMin)
    if (criterios.gastoTotalMax) params.append('gasto_total_max', criterios.gastoTotalMax)
    
    // Recência
    if (criterios.ultimaVisitaMinDias) params.append('ultima_visita_min_dias', criterios.ultimaVisitaMinDias)
    if (criterios.ultimaVisitaMaxDias) params.append('ultima_visita_max_dias', criterios.ultimaVisitaMaxDias)
    if (criterios.primeiraVisitaMaxDias) params.append('primeira_visita_max_dias', criterios.primeiraVisitaMaxDias)
    
    // Perfil Social
    if (criterios.tamanhoGrupoMin) params.append('tamanho_grupo_min', criterios.tamanhoGrupoMin)
    if (criterios.tamanhoGrupoMax) params.append('tamanho_grupo_max', criterios.tamanhoGrupoMax)
    
    // Contato
    if (criterios.temEmail) params.append('tem_email', criterios.temEmail)
    if (criterios.temTelefone) params.append('tem_telefone', criterios.temTelefone)
    
    // Aniversário
    if (criterios.mesAniversario) params.append('mes_aniversario', criterios.mesAniversario)
    
    // Dia da semana
    if (diaSemana) params.append('dia_semana', diaSemana)
    
    // Formato
    if (formato) params.append('formato', formato)
    
    return `/api/crm/lista-quente?${params.toString()}`
  }, [selectedBar, criterios])

  const fetchSegmentacao = useCallback(async (diaSemana?: string) => {
    if (!selectedBar) return
    
    try {
      setLoadingSegmento(true)
      
      const url = construirUrlSegmentacao(diaSemana)
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error('Erro ao buscar segmentação')
      }
      
      const data = await response.json()
      
      if (diaSemana) {
        setSegmentoClientes(data.data?.clientes || [])
      } else {
        setSegmentoResumo(data.data)
        setSegmentoClientes([])
      }
    } catch (err) {
      toast({
        title: "Erro ao buscar segmentação",
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: "destructive"
      })
    } finally {
      setLoadingSegmento(false)
    }
  }, [selectedBar, construirUrlSegmentacao, toast])

  const downloadCSVSegmento = useCallback(async (completo: boolean = false) => {
    if (!selectedBar || !segmentoDia) {
      toast({
        title: "Selecione um dia",
        description: "Escolha um dia da semana para baixar o CSV",
        variant: "destructive"
      })
      return
    }
    
    try {
      const formato = completo ? 'csv_completo' : 'csv'
      const url = construirUrlSegmentacao(segmentoDia, formato)
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error('Erro ao baixar CSV')
      }
      
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `segmento-${segmentoDia}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)
      
      toast({
        title: "CSV exportado!",
        description: `${segmentoClientes.length} clientes exportados`,
      })
    } catch (err) {
      toast({
        title: "Erro ao exportar",
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: "destructive"
      })
    }
  }, [selectedBar, segmentoDia, segmentoClientes.length, construirUrlSegmentacao, toast])

  // Exportar TODOS os clientes do segmento (sem filtro de dia)
  const downloadCSVTodos = useCallback(async (completo: boolean = false) => {
    if (!selectedBar) {
      toast({
        title: "Selecione um bar",
        description: "Escolha um bar para baixar o CSV",
        variant: "destructive"
      })
      return
    }
    
    try {
      const formato = completo ? 'csv_completo' : 'csv'
      // Passa undefined como dia para exportar TODOS os clientes
      const url = construirUrlSegmentacao(undefined, formato)
      
      toast({
        title: "Gerando exportação...",
        description: "Isso pode levar alguns segundos",
      })
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error('Erro ao baixar CSV')
      }
      
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `lista-clientes-completa-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)
      
      toast({
        title: "CSV exportado!",
        description: `Lista completa de clientes exportada com sucesso`,
      })
    } catch (err) {
      toast({
        title: "Erro ao exportar",
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: "destructive"
      })
    }
  }, [selectedBar, construirUrlSegmentacao, toast])

  const salvarSegmento = useCallback(async () => {
    if (!selectedBar || !nomeSegmento.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite um nome para o segmento",
        variant: "destructive"
      })
      return
    }
    
    try {
      setSalvandoSegmento(true)
      
      const response = await fetch('/api/crm/lista-quente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: selectedBar.id,
          nome_segmento: nomeSegmento,
          descricao: `Criado em ${new Date().toLocaleDateString('pt-BR')}`,
          criterios: criterios
        })
      })
      
      if (!response.ok) {
        throw new Error('Erro ao salvar segmento')
      }
      
      toast({
        title: "Segmento salvo!",
        description: `"${nomeSegmento}" salvo com sucesso`,
      })
      
      setNomeSegmento('')
      fetchSegmentosSalvos()
    } catch (err) {
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: "destructive"
      })
    } finally {
      setSalvandoSegmento(false)
    }
  }, [selectedBar, nomeSegmento, criterios, toast])

  const fetchSegmentosSalvos = useCallback(async () => {
    if (!selectedBar) return
    
    try {
      const response = await fetch(`/api/crm/segmentos?bar_id=${selectedBar.id}`)
      const data = await response.json()
      if (data.success) {
        setSegmentosSalvos(data.data?.segmentos || [])
      }
    } catch (err) {
      console.error('Erro ao buscar segmentos salvos:', err)
    }
  }, [selectedBar])

  const carregarSegmentoSalvo = useCallback((segmento: any) => {
    if (segmento.criterios) {
      setCriterios({
        diasJanela: segmento.criterios.diasJanela || 90,
        minVisitasTotal: segmento.criterios.minVisitasTotal || 2,
        maxVisitasTotal: segmento.criterios.maxVisitasTotal || '',
        minVisitasDia: segmento.criterios.minVisitasDia || 1,
        diasDiferentes: segmento.criterios.diasDiferentes || '',
        ticketMedioMin: segmento.criterios.ticketMedioMin || '',
        ticketMedioMax: segmento.criterios.ticketMedioMax || '',
        ticketEntradaMin: segmento.criterios.ticketEntradaMin || '',
        ticketEntradaMax: segmento.criterios.ticketEntradaMax || '',
        ticketConsumoMin: segmento.criterios.ticketConsumoMin || '',
        ticketConsumoMax: segmento.criterios.ticketConsumoMax || '',
        gastoTotalMin: segmento.criterios.gastoTotalMin || '',
        gastoTotalMax: segmento.criterios.gastoTotalMax || '',
        ultimaVisitaMinDias: segmento.criterios.ultimaVisitaMinDias || '',
        ultimaVisitaMaxDias: segmento.criterios.ultimaVisitaMaxDias || '',
        primeiraVisitaMaxDias: segmento.criterios.primeiraVisitaMaxDias || '',
        tamanhoGrupoMin: segmento.criterios.tamanhoGrupoMin || '',
        tamanhoGrupoMax: segmento.criterios.tamanhoGrupoMax || '',
        temEmail: segmento.criterios.temEmail || '',
        temTelefone: segmento.criterios.temTelefone || '',
        mesAniversario: segmento.criterios.mesAniversario || '',
      })
      toast({
        title: "Segmento carregado",
        description: `Critérios de "${segmento.nome}" aplicados`,
      })
    }
  }, [toast])

  const abrirModalCliente = useCallback(async (cliente: Cliente) => {
    setClienteSelecionado(cliente)
    setPaginaTempos(1) // ✅ Resetar paginação ao trocar de cliente
    setPerfilConsumo(null) // Limpar perfil anterior
    setModalAberto(true)
    
    // Buscar visitas e perfil em paralelo
    await Promise.all([
      fetchVisitasDetalhadas(cliente),
      cliente.telefone ? fetchPerfilConsumo(cliente.telefone) : Promise.resolve()
    ])
  }, [fetchVisitasDetalhadas, fetchPerfilConsumo])

  // Carregamento inicial e quando filtros mudam
  useEffect(() => {
    fetchClientes()
  }, [fetchClientes])

  // Mudança de aba
  useEffect(() => {
    if (activeTab === 'reservantes' && reservantes.length === 0) {
      fetchReservantes()
    }
    if (activeTab === 'lista-quente' && !segmentoResumo) {
      fetchSegmentacao()
      fetchSegmentosSalvos()
    }
  }, [activeTab, fetchReservantes, reservantes.length, fetchSegmentacao, fetchSegmentosSalvos, segmentoResumo])

  // Função para executar a busca (chamada pelo botão ou Enter)
  const executarBusca = useCallback(() => {
    setBuscaAplicada(buscaCliente.trim())
  }, [buscaCliente])
  
  // Buscar quando buscaAplicada mudar
  useEffect(() => {
    fetchClientes()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaAplicada])

  const handleWhatsAppClick = (nome: string, telefone: string | null) => {
    try {
      if (!telefone) {
        toast({
          title: "Telefone não disponível",
          description: "Este cliente não possui telefone cadastrado",
          variant: "destructive"
        })
        return
      }

      // Remove caracteres especiais do telefone
      const telefoneNumeros = telefone.replace(/\D/g, '')
      
      // Monta a mensagem personalizada
      const mensagem = `Olá ${nome}! 🎉\n\nObrigado por ser um cliente especial do nosso estabelecimento! Sua fidelidade é muito importante para nós.\n\nEstamos aqui para qualquer dúvida ou para lhe oferecer nossas novidades e promoções exclusivas.\n\nEsperamos vê-lo em breve! 😊`
      
      // URL do WhatsApp com a mensagem
      const whatsappUrl = `https://wa.me/55${telefoneNumeros}?text=${encodeURIComponent(mensagem)}`
      
      // Abre em nova aba
      window.open(whatsappUrl, '_blank')
      
      toast({
        title: "WhatsApp aberto",
        description: `Conversa iniciada com ${nome}`,
      })
    } catch (err) {
      toast({
        title: "Erro",
        description: "Não foi possível abrir o WhatsApp",
        variant: "destructive"
      })
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    // Usar UTC para evitar problemas de timezone
    const date = new Date(dateString + 'T12:00:00Z')
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  }

  const exportarCSV = () => {
    try {
      let dadosCSV: any[] = []
      let nomeArquivo = ''
      let totalItens = 0
      
      if (activeTab === 'clientes') {
        dadosCSV = clientesFiltrados.map((cliente, index) => ({
          'Posição': index + 1,
          'Nome': cliente.nome_principal,
          'Telefone': cliente.telefone || '',
          'Total Visitas': cliente.total_visitas,
          'Valor Total Entrada': cliente.valor_total_entrada,
          'Valor Total Consumo': cliente.valor_total_consumo,
          'Ticket Médio Geral': cliente.ticket_medio_geral,
          'Ticket Médio Entrada': cliente.ticket_medio_entrada,
          'Ticket Médio Consumo': cliente.ticket_medio_consumo,
          'Última Visita': formatDate(cliente.ultima_visita),
        }))
        
        nomeArquivo = diaSemanaFiltro === 'todos' 
          ? 'clientes_todos_os_dias.csv'
          : `clientes_${diasSemana.find(d => d.value === diaSemanaFiltro)?.label.toLowerCase().replace('-feira', '').replace(' ', '_')}.csv`
        
        totalItens = clientesFiltrados.length
      } else {
        dadosCSV = reservantes.map((reservante, index) => ({
          'Posição': index + 1,
          'Nome': reservante.nome_principal,
          'Telefone': reservante.telefone || '',
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
        
        nomeArquivo = diaSemanaFiltro === 'todos' 
          ? 'reservantes_todos_os_dias.csv'
          : `reservantes_${diasSemana.find(d => d.value === diaSemanaFiltro)?.label.toLowerCase().replace('-feira', '').replace(' ', '_')}.csv`
        
        totalItens = reservantes.length
      }

      const csvContent = [
        Object.keys(dadosCSV[0]).join(','),
        ...dadosCSV.map(row => Object.values(row).join(','))
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
        description: `${totalItens} ${activeTab} exportados para CSV`,
      })
    } catch (err) {
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os dados",
        variant: "destructive"
      })
    }
  }

  // Verificar se há bar selecionado
  if (!selectedBar) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-2 py-4 max-w-[98vw]">
          <Card className="card-dark max-w-md mx-auto mt-20">
            <CardContent className="text-center py-16">
              <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="h-10 w-10 text-amber-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Selecione um Bar
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Para visualizar os dados de clientes, selecione um bar no seletor do topo da página.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-2 py-4 max-w-[98vw]">
          <LoadingState 
            title="Carregando análise..."
            subtitle="Processando dados dos clientes"
            icon={<Users className="w-4 h-4" />}
          />
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
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Erro ao carregar clientes
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {error}
              </p>
              <Button 
                onClick={() => window.location.reload()} 
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
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
        {/* Header compacto */}
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Users className="h-6 w-6 text-foreground" />
              </div>
              Análise de Clientes
            </h1>
            <p className="text-muted-foreground text-sm ml-11">
              Insights detalhados dos seus clientes mais valiosos
            </p>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">


          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <Card className="card-dark shadow-sm overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Clientes Únicos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <AnimatedCounter 
                      value={estatisticas?.total_clientes_unicos || 0}
                      duration={2}
                      className="text-gray-900 dark:text-white"
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ContaHub
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 delay-75">
            <Card className="card-dark shadow-sm overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Total de Visitas
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <AnimatedCounter 
                      value={estatisticas?.total_visitas_geral || 0}
                      duration={2.2}
                      className="text-gray-900 dark:text-white"
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Desde a abertura
                </p>
              </CardContent>
            </Card>
          </div>



          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 delay-100">
            <Card className="card-dark shadow-sm overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Ticket Médio Geral
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {loading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <AnimatedCurrency 
                      value={Number(estatisticas?.ticket_medio_geral) || 0}
                      duration={2.4}
                      className="text-gray-900 dark:text-white"
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Por visita paga
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 delay-150">
            <Card className="card-dark shadow-sm overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                  🎫 Ticket Entrada
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {loading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <AnimatedCurrency 
                      value={Number(estatisticas?.ticket_medio_entrada) || 0}
                      duration={2.6}
                      className="text-gray-900 dark:text-white"
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Couvert médio
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 delay-200">
            <Card className="card-dark shadow-sm overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                  🍺 Ticket Consumo
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {loading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <AnimatedCurrency 
                      value={Number(estatisticas?.ticket_medio_consumo) || 0}
                      duration={2.8}
                      className="text-gray-900 dark:text-white"
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Consumação média
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabelas com Abas */}
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
                        {activeTab === 'clientes' ? 'Top 100 Clientes ContaHub' : 'Top 100 Reservantes Getin'}
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        {activeTab === 'clientes' 
                          ? (diaSemanaFiltro !== 'todos' 
                              ? `Clientes ordenados por visitas em ${diasSemana.find(d => d.value === diaSemanaFiltro)?.label}s`
                              : 'Dados do ContaHub ordenados por visitas totais'
                            )
                          : (diaSemanaFiltro !== 'todos'
                              ? `Reservantes com reservas em ${diasSemana.find(d => d.value === diaSemanaFiltro)?.label}s`
                              : 'Dados de reservas ordenados por reservas efetivadas (seated)'
                            )
                        }
                        {diaSemanaFiltro !== 'todos' && (
                          <span className="ml-2 text-amber-600 dark:text-amber-400 font-semibold">
                            • Apenas visitas/reservas deste dia da semana
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Busca de cliente */}
                    <div className="flex gap-1">
                      <Input
                        type="text"
                        placeholder="Buscar cliente..."
                        value={buscaCliente}
                        onChange={(e) => setBuscaCliente(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && executarBusca()}
                        className="w-full sm:w-[180px]"
                      />
                      <Button
                        onClick={executarBusca}
                        variant="outline"
                        className="rounded-lg"
                        size="icon"
                        title="Buscar"
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                      {buscaAplicada && (
                        <Button
                          onClick={() => { setBuscaCliente(''); setBuscaAplicada(''); }}
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground"
                          size="icon"
                          title="Limpar busca"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
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
                    
                    <Button
                      onClick={exportarCSV}
                      disabled={(activeTab === 'clientes' ? clientesFiltrados.length : reservantes.length) === 0}
                      variant="outline"
                      className="rounded-lg"
                      size="icon"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
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
            <TabsContent value="clientes" className="mt-0">
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
                        <Users className="h-4 w-4" />
                        Nome do Cliente
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
                        <span className="text-lg">📊</span>
                        ContaHub
                      </div>
                    </TableHead>
                    <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <TrendingUp className="h-4 w-4" />
                        Visitas
                      </div>
                    </TableHead>
                    <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <span className="text-lg">🎫</span>
                        Entrada
                      </div>
                    </TableHead>
                    <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <span className="text-lg">🍺</span>
                        Consumo
                      </div>
                    </TableHead>
                    <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <Target className="h-4 w-4" />
                        Ticket Médio
                      </div>
                    </TableHead>
                    <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <span className="text-lg">⏱️</span>
                        Tempo Médio
                      </div>
                    </TableHead>
                    <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <span className="text-lg">📅</span>
                        Última Visita
                      </div>
                    </TableHead>
                    <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <Eye className="h-4 w-4" />
                        Detalhes
                      </div>
                    </TableHead>
                    <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <MessageCircle className="h-4 w-4" />
                        Contato
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
            <TableBody>
              {clientesFiltrados.map((cliente, index) => (
                <TableRow 
                  key={`${cliente.identificador_principal}-${index}`}
                  className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200 virtualized-row"
                >
                  <TableCell className="font-medium text-gray-900 dark:text-white">
                    <div className="flex items-center">
                      <Badge 
                        variant="outline"
                        className={`
                          min-w-[2.5rem] h-8 flex items-center justify-center font-bold text-sm rounded-full
                          ${index === 0 ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : ''}
                          ${index === 1 ? 'bg-slate-700 text-white border-slate-700 shadow-sm' : ''}
                          ${index === 2 ? 'bg-slate-600 text-white border-slate-600 shadow-sm' : ''}
                          ${index >= 3 ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600' : ''}
                        `}
                      >
                        #{index + 1}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-900 dark:text-white font-medium">
                    {cliente.nome_principal}
                  </TableCell>
                  <TableCell className="text-gray-600 dark:text-gray-300">
                    <div className="flex flex-col gap-1">
                      {cliente.telefone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {cliente.telefone}
                        </span>
                      )}
                      {cliente.email && (
                        <span className="flex items-center gap-1 text-xs">
                          📧 {cliente.email}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant="outline" 
                      className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                    >
                      ✓ Ativo
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                      {cliente.visitas_formatadas || cliente.total_visitas}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-gray-900 dark:text-white font-medium">
                    <div className="text-sm">
                      {formatCurrency(cliente.valor_total_entrada)}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-gray-900 dark:text-white font-medium">
                    <div className="text-sm">
                      {formatCurrency(cliente.valor_total_consumo)}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col gap-1 items-center">
                      <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 text-xs">
                        Total: {formatCurrency(cliente.ticket_medio_geral)}
                      </Badge>
                      <div className="flex flex-col gap-1 items-center">
                        <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800 text-xs">
                          🎫 {formatCurrency(cliente.ticket_medio_entrada)}
                        </Badge>
                        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-xs">
                          🍺 {formatCurrency(cliente.ticket_medio_consumo)}
                        </Badge>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col gap-1 items-center">
                      {cliente.tempo_medio_estadia_formatado && cliente.tempo_medio_estadia_formatado !== 'N/A' ? (
                        <>
                          <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 text-xs">
                            ⏱️ {cliente.tempo_medio_estadia_formatado}
                          </Badge>
                          {cliente.total_visitas_com_tempo && cliente.total_visitas_com_tempo > 0 && (
                            <Badge variant="outline" className="bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 text-xs">
                              {cliente.total_visitas_com_tempo}/{cliente.total_visitas} com tempo
                            </Badge>
                          )}
                        </>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 dark:bg-gray-900/20 text-gray-500 dark:text-gray-500 border-gray-200 dark:border-gray-800 text-xs">
                          Sem dados
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-gray-600 dark:text-gray-400">
                    {formatDate(cliente.ultima_visita)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <Button
                        onClick={() => abrirModalCliente(cliente)}
                        size="sm"
                        variant="outline"
                        className="rounded-full w-8 h-8 p-0"
                        aria-label={`Ver detalhes de ${cliente.nome_principal}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      {cliente.telefone ? (
                        <Button
                          onClick={() => handleWhatsAppClick(cliente.nome_principal, cliente.telefone)}
                          size="sm"
                          variant="outline"
                          className="rounded-full w-8 h-8 p-0"
                          aria-label={`Enviar WhatsApp para ${cliente.nome_principal}`}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400">
                          Sem telefone
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground text-slate-500 dark:text-slate-400">
                  {totalItems > 0 ? (
                    <>
                      Mostrando <span className="font-medium text-slate-900 dark:text-white">{(page - 1) * ITEMS_PER_PAGE + 1}</span> a <span className="font-medium text-slate-900 dark:text-white">{Math.min(page * ITEMS_PER_PAGE, totalItems)}</span> de <span className="font-medium text-slate-900 dark:text-white">{totalItems}</span> clientes
                    </>
                  ) : (
                    "Nenhum cliente encontrado"
                  )}
                </div>
                <div className="space-x-2 flex items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                        setPage(p => Math.max(1, p - 1))
                    }}
                    disabled={page === 1}
                    className="h-8 w-8 p-0"
                  >
                    <span className="sr-only">Página anterior</span>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex w-[100px] items-center justify-center text-sm font-medium text-slate-700 dark:text-slate-200">
                    Página {page} de {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                        setPage(p => Math.min(totalPages, p + 1))
                    }}
                    disabled={page === totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <span className="sr-only">Próxima página</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
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
                    <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <span className="text-lg">📊</span>
                        % Reservas
                      </div>
                    </TableHead>
                    <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <span className="text-lg">✅</span>
                        Seated
                      </div>
                    </TableHead>
                    <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <span className="text-lg">⏳</span>
                        Status Reservas
                      </div>
                    </TableHead>
                    <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <span className="text-lg">📊</span>
                        % Presença
                      </div>
                    </TableHead>
                    <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <span className="text-lg">📅</span>
                        Última Reserva
                      </div>
                    </TableHead>
                    <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <MessageCircle className="h-4 w-4" />
                        Contato
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservantes.map((reservante, index) => (
                    <TableRow 
                      key={`${reservante.identificador_principal}-${index}`}
                      className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200 virtualized-row"
                    >
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant="secondary" 
                            className={`w-8 h-8 rounded-full p-0 flex items-center justify-center font-bold text-sm ${
                              index < 3 
                                ? 'bg-slate-200 dark:bg-slate-500 text-slate-900 dark:text-slate-100' 
                                : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {index + 1}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {reservante.nome_principal}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col gap-1">
                          {reservante.telefone && (
                            <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                              <Phone className="h-3 w-3" />
                              {reservante.telefone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                          {reservante.total_reservas}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                          {reservante.total_visitas}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col gap-1 items-center">
                          <Badge 
                            variant="outline" 
                            className={`${
                              reservante.percentual_reservas >= 50 
                                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                                : reservante.percentual_reservas >= 25
                                ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
                                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                            }`}
                          >
                            {reservante.percentual_reservas.toFixed(1)}%
                          </Badge>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {reservante.total_reservas}/{reservante.total_visitas}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                          {reservante.reservas_seated}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col gap-1 items-center">
                          {reservante.reservas_confirmed > 0 && (
                            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-xs">
                              ✓ {reservante.reservas_confirmed}
                            </Badge>
                          )}
                          {reservante.reservas_pending > 0 && (
                            <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800 text-xs">
                              ⏳ {reservante.reservas_pending}
                            </Badge>
                          )}
                          {reservante.reservas_cancelled > 0 && (
                            <Badge variant="outline" className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 text-xs">
                              ❌ {reservante.reservas_cancelled}
                            </Badge>
                          )}
                          {reservante.reservas_noshow > 0 && (
                            <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800 text-xs">
                              ⚠️ {reservante.reservas_noshow}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge 
                            variant="outline" 
                            className={`text-xs font-bold ${
                              reservante.percentual_presenca >= 80 
                                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                                : reservante.percentual_presenca >= 60
                                ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
                                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                            }`}
                          >
                            {reservante.percentual_presenca.toFixed(1)}%
                          </Badge>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {reservante.reservas_seated}/{reservante.total_reservas}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-gray-600 dark:text-gray-400">
                        {formatDate(reservante.ultima_reserva)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleWhatsAppClick(reservante.nome_principal, reservante.telefone)}
                            className="rounded-full w-8 h-8 p-0"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            {/* ABA LISTA QUENTE */}
            <TabsContent value="lista-quente" className="mt-0">
              <div className="p-6">
                {/* Segmentos Salvos */}
                {segmentosSalvos.length > 0 && !segmentoDia && (
                  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        💾 Segmentos Salvos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-2">
                        {segmentosSalvos.map((seg: any) => (
                          <Button
                            key={seg.id}
                            variant="outline"
                            size="sm"
                            onClick={() => carregarSegmentoSalvo(seg)}
                            className="text-xs"
                          >
                            {seg.nome}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Configurações de Critérios - Completo */}
                <Card className="bg-card border-border mb-6">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                      <Settings2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      Construtor de Segmentos
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-400">
                      Combine múltiplos critérios para criar segmentos personalizados de clientes
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Linha 1: Janela e Frequência */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        📅 Janela e Frequência
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Janela (dias)</label>
                          <Select value={criterios.diasJanela.toString()} onValueChange={(v) => setCriterios({...criterios, diasJanela: parseInt(v)})}>
                            <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-800">
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
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Mín. Visitas Total</label>
                          <Select value={criterios.minVisitasTotal.toString()} onValueChange={(v) => setCriterios({...criterios, minVisitasTotal: parseInt(v)})}>
                            <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-800">
                              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                                <SelectItem key={n} value={n.toString()}>{n}+ visitas</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Máx. Visitas Total</label>
                          <Input 
                            type="number" 
                            placeholder="Sem limite" 
                            value={criterios.maxVisitasTotal}
                            onChange={(e) => setCriterios({...criterios, maxVisitasTotal: e.target.value})}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-9 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Mín. no Dia</label>
                          <Select value={criterios.minVisitasDia.toString()} onValueChange={(v) => setCriterios({...criterios, minVisitasDia: parseInt(v)})}>
                            <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-800">
                              {[1,2,3,4,5].map(n => (
                                <SelectItem key={n} value={n.toString()}>{n}+ vezes</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Dias Diferentes</label>
                          <Input 
                            type="number" 
                            placeholder="Multi-dia" 
                            value={criterios.diasDiferentes}
                            onChange={(e) => setCriterios({...criterios, diasDiferentes: e.target.value})}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-9 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Linha 2: Financeiros */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        💰 Critérios Financeiros
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Ticket Médio Mín (R$)</label>
                          <Input 
                            type="number" 
                            placeholder="Ex: 100" 
                            value={criterios.ticketMedioMin}
                            onChange={(e) => setCriterios({...criterios, ticketMedioMin: e.target.value})}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-9 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Ticket Médio Máx (R$)</label>
                          <Input 
                            type="number" 
                            placeholder="Sem limite" 
                            value={criterios.ticketMedioMax}
                            onChange={(e) => setCriterios({...criterios, ticketMedioMax: e.target.value})}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-9 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Gasto Total Mín (R$)</label>
                          <Input 
                            type="number" 
                            placeholder="Ex: 500" 
                            value={criterios.gastoTotalMin}
                            onChange={(e) => setCriterios({...criterios, gastoTotalMin: e.target.value})}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-9 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Gasto Total Máx (R$)</label>
                          <Input 
                            type="number" 
                            placeholder="Sem limite" 
                            value={criterios.gastoTotalMax}
                            onChange={(e) => setCriterios({...criterios, gastoTotalMax: e.target.value})}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-9 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Linha 3: Recência */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        🕐 Recência e Ciclo de Vida
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Última visita há + de (dias)</label>
                          <Input 
                            type="number" 
                            placeholder="Ex: 30 (inativos)" 
                            value={criterios.ultimaVisitaMinDias}
                            onChange={(e) => setCriterios({...criterios, ultimaVisitaMinDias: e.target.value})}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-9 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Última visita há - de (dias)</label>
                          <Input 
                            type="number" 
                            placeholder="Ex: 7 (recentes)" 
                            value={criterios.ultimaVisitaMaxDias}
                            onChange={(e) => setCriterios({...criterios, ultimaVisitaMaxDias: e.target.value})}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-9 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Cliente Novo (1ª visita em)</label>
                          <Input 
                            type="number" 
                            placeholder="Ex: 30 dias" 
                            value={criterios.primeiraVisitaMaxDias}
                            onChange={(e) => setCriterios({...criterios, primeiraVisitaMaxDias: e.target.value})}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-9 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Tamanho Grupo Mín</label>
                          <Input 
                            type="number" 
                            placeholder="Ex: 3 pessoas" 
                            value={criterios.tamanhoGrupoMin}
                            onChange={(e) => setCriterios({...criterios, tamanhoGrupoMin: e.target.value})}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-9 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Linha 4: Contato e Ações */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        📱 Filtros de Contato
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Tem Email?</label>
                          <Select value={criterios.temEmail || 'all'} onValueChange={(v) => setCriterios({...criterios, temEmail: v === 'all' ? '' : v})}>
                            <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-9 text-sm">
                              <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-800">
                              <SelectItem value="all">Todos</SelectItem>
                              <SelectItem value="true">Sim, tem email</SelectItem>
                              <SelectItem value="false">Não tem email</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Tem Telefone?</label>
                          <Select value={criterios.temTelefone || 'all'} onValueChange={(v) => setCriterios({...criterios, temTelefone: v === 'all' ? '' : v})}>
                            <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-9 text-sm">
                              <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-800">
                              <SelectItem value="all">Todos</SelectItem>
                              <SelectItem value="true">Sim, tem telefone</SelectItem>
                              <SelectItem value="false">Não tem telefone</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Linha 5: Aniversariantes */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        🎂 Aniversariantes
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Mês de Aniversário</label>
                          <Select value={criterios.mesAniversario || 'all'} onValueChange={(v) => setCriterios({...criterios, mesAniversario: v === 'all' ? '' : v})}>
                            <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-9 text-sm">
                              <SelectValue placeholder="Todos os meses" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-800">
                              <SelectItem value="all">Todos os meses</SelectItem>
                              <SelectItem value="1">Janeiro</SelectItem>
                              <SelectItem value="2">Fevereiro</SelectItem>
                              <SelectItem value="3">Março</SelectItem>
                              <SelectItem value="4">Abril</SelectItem>
                              <SelectItem value="5">Maio</SelectItem>
                              <SelectItem value="6">Junho</SelectItem>
                              <SelectItem value="7">Julho</SelectItem>
                              <SelectItem value="8">Agosto</SelectItem>
                              <SelectItem value="9">Setembro</SelectItem>
                              <SelectItem value="10">Outubro</SelectItem>
                              <SelectItem value="11">Novembro</SelectItem>
                              <SelectItem value="12">Dezembro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-orange-200 dark:border-orange-800">
                      <Button
                        onClick={() => {
                          setSegmentoDia('')
                          setSegmentoResumo(null)
                          fetchSegmentacao()
                        }}
                        className=""
                      >
                        {loadingSegmento ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Buscando...
                          </>
                        ) : (
                          <>
                            <Search className="h-4 w-4 mr-2" />
                            Aplicar Filtros
                          </>
                        )}
                      </Button>
                      
                      {/* Botões de Exportação Direta */}
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => downloadCSVTodos(false)}
                          variant="outline"
                          className="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Exportar Lista
                        </Button>
                        <Button
                          onClick={() => downloadCSVTodos(true)}
                          variant="outline"
                          className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          CSV Completo
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Input 
                          placeholder="Nome do segmento..."
                          value={nomeSegmento}
                          onChange={(e) => setNomeSegmento(e.target.value)}
                          className="w-48 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-9 text-sm"
                        />
                        <Button
                          variant="outline"
                          onClick={salvarSegmento}
                          disabled={salvandoSegmento || !nomeSegmento.trim()}
                          className="border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                        >
                          {salvandoSegmento ? <Loader2 className="h-4 w-4 animate-spin" /> : '💾 Salvar'}
                        </Button>
                      </div>
                      
                      <Button
                        variant="ghost"
                        onClick={() => setCriterios({
                          diasJanela: 90, minVisitasTotal: 2, maxVisitasTotal: '', minVisitasDia: 1, diasDiferentes: '',
                          ticketMedioMin: '', ticketMedioMax: '', ticketEntradaMin: '', ticketEntradaMax: '',
                          ticketConsumoMin: '', ticketConsumoMax: '', gastoTotalMin: '', gastoTotalMax: '',
                          ultimaVisitaMinDias: '', ultimaVisitaMaxDias: '', primeiraVisitaMaxDias: '',
                          tamanhoGrupoMin: '', tamanhoGrupoMax: '', temEmail: '', temTelefone: '',
                          mesAniversario: '',
                        })}
                        className="text-gray-500 dark:text-gray-400"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Limpar
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Estatísticas do Segmento */}
                {segmentoResumo?.estatisticas && !segmentoDia && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                          {segmentoResumo.estatisticas.totalClientes?.toLocaleString('pt-BR')}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Clientes no Segmento</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          R$ {segmentoResumo.estatisticas.ticketMedioGeral?.toLocaleString('pt-BR')}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Ticket Médio</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {segmentoResumo.estatisticas.visitasMedias}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Visitas Médias</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {segmentoResumo.estatisticas.comEmail?.toLocaleString('pt-BR')}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Com Email</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                          {segmentoResumo.estatisticas.comTelefone?.toLocaleString('pt-BR')}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Com Telefone</div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Resumo por Dia da Semana */}
                {loadingSegmento && !segmentoDia ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-600 mr-3" />
                    <span className="text-gray-600 dark:text-gray-400">Aplicando filtros...</span>
                  </div>
                ) : segmentoResumo && !segmentoDia ? (
                  <>
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Flame className="h-5 w-5 text-orange-500" />
                        Distribuição por Dia da Semana
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      {segmentoResumo.resumoPorDia && Object.entries(segmentoResumo.resumoPorDia).map(([dia, dados]: [string, any]) => (
                        <Card 
                          key={dia}
                          className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                            dados.totalClientes > 0 
                              ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' 
                              : 'bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60'
                          }`}
                          onClick={() => {
                            if (dados.totalClientes > 0) {
                              setSegmentoDia(dia)
                              fetchSegmentacao(dia)
                            }
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-gray-900 dark:text-white">{dados.label}</h4>
                              {dados.totalClientes > 0 && <Flame className="h-4 w-4 text-orange-500" />}
                            </div>
                            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-1">
                              {dados.totalClientes}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              TM: R$ {dados.ticketMedioSegmento || 0}
                            </div>
                            {dados.exemplos?.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                {dados.exemplos.slice(0, 2).map((ex: any, idx: number) => (
                                  <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                    {ex.nome} ({ex.visitas}x • R${ex.ticketMedio})
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
                      👆 Clique em um dia para ver a lista completa e baixar o CSV
                    </div>
                  </>
                ) : null}

                {/* Lista de Clientes do Dia Selecionado */}
                {segmentoDia && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" onClick={() => { setSegmentoDia(''); setSegmentoClientes([]); }} className="text-gray-600 dark:text-gray-400">
                          ← Voltar
                        </Button>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <Flame className="h-5 w-5 text-orange-500" />
                          Segmento - {segmentoDia.charAt(0).toUpperCase() + segmentoDia.slice(1)}
                        </h3>
                        <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                          {segmentoClientes.length} clientes
                        </Badge>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button onClick={() => downloadCSVSegmento(false)} variant="outline">
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          CSV Simples
                        </Button>
                        <Button onClick={() => downloadCSVSegmento(true)} variant="outline" className="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20">
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          CSV Completo
                        </Button>
                      </div>
                    </div>
                    
                    {loadingSegmento ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-orange-600 mr-3" />
                        <span className="text-gray-600 dark:text-gray-400">Carregando clientes...</span>
                      </div>
                    ) : (
                      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <Table>
                          <TableHeader className="bg-muted/40">
                            <TableRow className="border-b border-border">
                              <TableHead className="text-foreground font-semibold">#</TableHead>
                              <TableHead className="text-foreground font-semibold">Nome</TableHead>
                              <TableHead className="text-foreground font-semibold">Email</TableHead>
                              <TableHead className="text-foreground font-semibold">Telefone</TableHead>
                              <TableHead className="text-foreground font-semibold text-center">No Dia</TableHead>
                              <TableHead className="text-foreground font-semibold text-center">Total</TableHead>
                              <TableHead className="text-foreground font-semibold text-center">Ticket</TableHead>
                              <TableHead className="text-foreground font-semibold text-center">Gasto</TableHead>
                              <TableHead className="text-foreground font-semibold text-center">Contato</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {segmentoClientes.map((cliente, index) => (
                              <TableRow key={index} className="border-b border-gray-100 dark:border-gray-700 hover:bg-orange-50 dark:hover:bg-orange-900/10">
                                <TableCell className="font-medium text-gray-900 dark:text-white">{index + 1}</TableCell>
                                <TableCell className="font-medium text-gray-900 dark:text-white">{cliente.Nome}</TableCell>
                                <TableCell className="text-gray-600 dark:text-gray-400 text-sm">{cliente.Email || '-'}</TableCell>
                                <TableCell className="text-gray-600 dark:text-gray-400">{cliente.Telefone || '-'}</TableCell>
                                <TableCell className="text-center">
                                  <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">{cliente.VisitasNoDia}x</Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">{cliente.TotalVisitas}</Badge>
                                </TableCell>
                                <TableCell className="text-center text-sm text-gray-600 dark:text-gray-400">
                                  R$ {cliente.TicketMedio?.toLocaleString('pt-BR')}
                                </TableCell>
                                <TableCell className="text-center text-sm text-gray-600 dark:text-gray-400">
                                  R$ {cliente.GastoTotal?.toLocaleString('pt-BR')}
                                </TableCell>
                                <TableCell className="text-center">
                                  {cliente.Telefone ? (
                                    <Button size="sm" variant="outline" onClick={() => handleWhatsAppClick(cliente.Nome, cliente.Telefone)} className="rounded-full w-8 h-8 p-0">
                                      <MessageCircle className="h-4 w-4" />
                                    </Button>
                                  ) : <span className="text-gray-400 text-xs">-</span>}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        
                        {segmentoClientes.length === 0 && (
                          <div className="text-center py-12">
                            <Flame className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-500 dark:text-gray-400">Nenhum cliente encontrado</p>
                          </div>
                        )}
                      </Card>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </CardContent>
        </Card>
        </Tabs>
        </div>

        {((activeTab === 'clientes' && clientesFiltrados.length === 0) || (activeTab === 'reservantes' && reservantes.length === 0)) && !loading && (
          <Card className="card-dark shadow-lg mt-6">
            <CardContent className="text-center py-16">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                {activeTab === 'clientes' ? <Users className="h-10 w-10 text-slate-400" /> : <Calendar className="h-10 w-10 text-slate-400" />}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                {activeTab === 'clientes' 
                  ? (diaSemanaFiltro === 'todos' ? 'Nenhum cliente encontrado' : 'Nenhum cliente neste dia da semana')
                  : (diaSemanaFiltro === 'todos' ? 'Nenhum reservante encontrado' : 'Nenhum reservante neste dia da semana')
                }
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                {activeTab === 'clientes' 
                  ? (diaSemanaFiltro === 'todos' 
                      ? 'Não há dados de clientes disponíveis no momento. Verifique se os dados foram sincronizados corretamente.'
                      : `Não há clientes com última visita em ${diasSemana.find(d => d.value === diaSemanaFiltro)?.label}. Tente outro dia da semana.`
                    )
                  : (diaSemanaFiltro === 'todos' 
                      ? 'Não há dados de reservantes disponíveis no momento. Verifique se os dados foram sincronizados corretamente.'
                      : `Não há reservantes com reservas em ${diasSemana.find(d => d.value === diaSemanaFiltro)?.label}. Tente outro dia da semana.`
                    )
                }
              </p>
            </CardContent>
          </Card>
        )}

        {/* Modal de Detalhes do Cliente */}
        <Dialog open={modalAberto} onOpenChange={setModalAberto}>
          <DialogContent className="max-w-5xl max-h-[95vh] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 overflow-hidden p-0">
            <DialogHeader className="bg-muted/40 p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-muted rounded-xl">
                  <Users className="h-7 w-7 text-foreground" />
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-2xl font-bold text-foreground mb-1">
                    {clienteSelecionado?.nome_principal}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground flex items-center gap-2 text-base">
                    <Phone className="h-4 w-4" />
                    {clienteSelecionado?.telefone || 'Sem telefone cadastrado'}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="p-6 overflow-y-auto max-h-[calc(95vh-180px)]">
              {/* Resumo do Cliente */}
              <div className="grid grid-cols-5 gap-3 mb-6">
                <div className="animate-in zoom-in-95 duration-200">
                  <Card className="card-dark border-border shadow-sm">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-foreground mb-1">
                        {clienteSelecionado?.total_visitas}
                      </div>
                      <div className="text-muted-foreground text-sm font-medium">Total de Visitas</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="animate-in zoom-in-95 duration-200 delay-75">
                  <Card className="card-dark border-border shadow-sm">
                    <CardContent className="p-4 text-center">
                      <div className="text-xl font-bold text-foreground mb-1">
                        {formatCurrency(clienteSelecionado?.valor_total_gasto || 0)}
                      </div>
                      <div className="text-muted-foreground text-sm font-medium">Total Gasto</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="animate-in zoom-in-95 duration-200 delay-100">
                  <Card className="card-dark border-border shadow-sm">
                    <CardContent className="p-4 text-center">
                      <div className="text-xl font-bold text-foreground mb-1">
                        {formatCurrency(clienteSelecionado?.ticket_medio_geral || 0)}
                      </div>
                      <div className="text-muted-foreground text-sm font-medium">Ticket Médio</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="animate-in zoom-in-95 duration-200 delay-150">
                  <Card className="card-dark border-border shadow-sm">
                    <CardContent className="p-4 text-center">
                      <div className="text-xl font-bold text-foreground mb-1">
                        {clienteSelecionado?.tempo_medio_estadia_formatado && clienteSelecionado.tempo_medio_estadia_formatado !== 'N/A' 
                          ? clienteSelecionado.tempo_medio_estadia_formatado 
                          : 'Sem dados'}
                      </div>
                      <div className="text-muted-foreground text-sm font-medium">Tempo Médio de Estadia</div>
                      {clienteSelecionado?.total_visitas_com_tempo && clienteSelecionado.total_visitas_com_tempo > 0 && (
                        <div className="text-muted-foreground text-xs mt-1">
                          {clienteSelecionado.total_visitas_com_tempo}/{clienteSelecionado.total_visitas} visitas com tempo
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="animate-in zoom-in-95 duration-200 delay-200">
                  <Card className="card-dark border-border shadow-sm">
                    <CardContent className="p-4 text-center">
                      <div className="text-xl font-bold text-foreground mb-1">
                        {clienteSelecionado?.ultima_visita ? formatDate(clienteSelecionado.ultima_visita) : 'N/A'}
                      </div>
                      <div className="text-muted-foreground text-sm font-medium">Última Visita</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="animate-in zoom-in-95 duration-200 delay-200">
                  <Card className="card-dark border-border shadow-sm">
                    <CardContent className="p-4 text-center">
                      <div className="text-xl font-bold text-foreground mb-1">
                        {diaDestaque}
                      </div>
                      <div className="text-muted-foreground text-sm font-medium">Dia Destaque</div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Perfil de Consumo - NOVO */}
              {(loadingPerfil || perfilConsumo) && (
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-6">
                  <CardHeader className="bg-muted/40 border-b border-border">
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <span className="text-lg">🎯</span>
                      Perfil de Consumo
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Produtos e categorias favoritas deste cliente
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    {loadingPerfil ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mr-3"></div>
                        <span className="text-gray-600 dark:text-gray-400">Carregando perfil de consumo...</span>
                      </div>
                    ) : perfilConsumo ? (
                      <div className="space-y-6">
                        {/* Tags do cliente */}
                        {perfilConsumo.tags && perfilConsumo.tags.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                              <span>🏷️</span> Tags do Cliente
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {perfilConsumo.tags.map((tag, idx) => (
                                <Badge 
                                  key={idx} 
                                  className={`
                                    ${tag.includes('vip') ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300' : ''}
                                    ${tag.includes('frequente') ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300' : ''}
                                    ${tag.includes('prefere_') ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300' : ''}
                                    ${tag.includes('cervejeiro') ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300' : ''}
                                    ${tag.includes('frequenta_') ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300' : ''}
                                    ${!tag.includes('vip') && !tag.includes('frequente') && !tag.includes('prefere_') && !tag.includes('cervejeiro') && !tag.includes('frequenta_') ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' : ''}
                                  `}
                                >
                                  {tag.replace(/_/g, ' ').replace(/prefere /g, '❤️ ').replace(/frequenta /g, '📅 ')}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Grid de produtos e categorias */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Produtos Favoritos */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                              <span>⭐</span> Top 5 Produtos Favoritos
                            </h4>
                            <div className="space-y-2">
                              {perfilConsumo.produtos_favoritos.slice(0, 5).map((produto, idx) => (
                                <div 
                                  key={idx} 
                                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg font-bold text-amber-500">#{idx + 1}</span>
                                    <div>
                                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                                        {produto.produto}
                                      </p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {produto.categoria}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                                      {produto.quantidade}x
                                    </Badge>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {produto.vezes_pediu} pedido{produto.vezes_pediu !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                </div>
                              ))}
                              {perfilConsumo.produtos_favoritos.length === 0 && (
                                <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                                  Nenhum produto identificado
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Categorias Favoritas */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                              <span>📊</span> Categorias Favoritas
                            </h4>
                            <div className="space-y-2">
                              {perfilConsumo.categorias_favoritas.slice(0, 5).map((categoria, idx) => (
                                <div 
                                  key={idx} 
                                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg font-bold text-blue-500">#{idx + 1}</span>
                                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                                      {categoria.categoria}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                                      {categoria.quantidade} itens
                                    </Badge>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {formatCurrency(categoria.valor_total)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                              {perfilConsumo.categorias_favoritas.length === 0 && (
                                <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                                  Nenhuma categoria identificada
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Dias preferidos */}
                        {perfilConsumo.dias_preferidos && perfilConsumo.dias_preferidos.length > 0 && (
                          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                              <span>📅</span> Dias Preferidos
                            </h4>
                            <div className="flex gap-2">
                              {perfilConsumo.dias_preferidos.map((dia, idx) => (
                                <Badge 
                                  key={idx}
                                  className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300"
                                >
                                  {dia}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <span className="text-4xl mb-4 block">🔍</span>
                        <p className="text-gray-500 dark:text-gray-400">
                          Perfil de consumo não disponível para este cliente
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Histórico de Visitas */}
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader className="bg-muted/40 border-b border-border">
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" />
                    Histórico de Visitas
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Detalhamento de todas as visitas registradas
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingVisitas ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600 dark:text-gray-400">Carregando histórico...</p>
                    </div>
                  ) : visitasDetalhadas.length > 0 ? (
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                          <TableRow className="border-b border-slate-200 dark:border-slate-700">
                            <TableHead className="text-slate-900 dark:text-white font-semibold text-left">
                              <div className="flex items-center gap-2">
                                <CalendarDays className="h-4 w-4" />
                                Data da Visita
                              </div>
                            </TableHead>
                            <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                              <div className="flex items-center gap-2 justify-center">
                                <span className="text-lg">🎫</span>
                                Couvert
                              </div>
                            </TableHead>
                            <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                              <div className="flex items-center gap-2 justify-center">
                                <span className="text-lg">🍺</span>
                                Consumo
                              </div>
                            </TableHead>
                            <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                              <div className="flex items-center gap-2 justify-center">
                                <DollarSign className="h-4 w-4" />
                                Total
                              </div>
                            </TableHead>
                            <TableHead className="text-slate-900 dark:text-white font-semibold text-center">
                              <div className="flex items-center gap-2 justify-center">
                                <span className="text-lg">⏱️</span>
                                Tempo de Estadia
                              </div>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visitasDetalhadas.map((visita, index) => (
                            <TableRow 
                              key={index}
                              className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200"
                            >
                              <TableCell className="font-medium text-gray-900 dark:text-white">
                                {formatDate(visita.data)}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800">
                                  {formatCurrency(visita.couvert)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                                  {formatCurrency(visita.consumo)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 font-semibold">
                                  {formatCurrency(visita.total)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                {(() => {
                                  // Buscar tempo correspondente a esta visita
                                  if (clienteSelecionado?.tempos_estadia_detalhados && clienteSelecionado.tempos_estadia_detalhados[index]) {
                                    const tempo = clienteSelecionado.tempos_estadia_detalhados[index]
                                    const horas = Math.floor(tempo / 60)
                                    const minutos = Math.round(tempo % 60)
                                    const tempoFormatado = `${horas}h ${minutos}min`
                                    
                                    return (
                                      <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                                        {tempoFormatado}
                                      </Badge>
                                    )
                                  }
                                  return (
                                    <span className="text-gray-400 dark:text-gray-500 text-sm">
                                      N/A
                                    </span>
                                  )
                                })()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CalendarDays className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-gray-600 dark:text-gray-400">Nenhuma visita detalhada encontrada</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tempos de Estadia Detalhados */}
              {clienteSelecionado?.tempos_estadia_detalhados && clienteSelecionado.tempos_estadia_detalhados.length > 0 && (
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardHeader className="bg-muted/40 border-b border-border">
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <span className="text-lg">⏱️</span>
                      Tempos de Estadia
                      <Badge variant="secondary" className="bg-muted text-foreground border-border">
                        {clienteSelecionado.tempos_estadia_detalhados.length} visitas
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Tempo de permanência em cada visita (entrada → saída)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    {(() => {
                      const temposPorPagina = 20
                      const totalPaginas = Math.ceil(clienteSelecionado.tempos_estadia_detalhados.length / temposPorPagina)
                      const inicioIndex = (paginaTempos - 1) * temposPorPagina
                      const fimIndex = inicioIndex + temposPorPagina
                      const temposPaginados = clienteSelecionado.tempos_estadia_detalhados.slice(inicioIndex, fimIndex)
                      
                      return (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {temposPaginados.map((tempo, index) => {
                              const horas = Math.floor(tempo / 60)
                              const minutos = Math.round(tempo % 60)
                              const tempoFormatado = `${horas}h ${minutos}min`
                              const visitaNumero = inicioIndex + index + 1
                              
                              return (
                                <div key={inicioIndex + index} className="text-center">
                                  <Badge 
                                    variant="outline" 
                                    className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 px-3 py-2 text-sm font-medium w-full"
                                  >
                                    {tempoFormatado}
                                  </Badge>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Visita #{visitaNumero}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          
                          {/* Paginação */}
                          {totalPaginas > 1 && (
                            <div className="flex justify-center items-center gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPaginaTempos(Math.max(1, paginaTempos - 1))}
                                disabled={paginaTempos === 1}
                                className="h-8 px-3"
                              >
                                ←
                              </Button>
                              <span className="text-sm text-gray-600 dark:text-gray-400 px-3">
                                {paginaTempos} de {totalPaginas}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPaginaTempos(Math.min(totalPaginas, paginaTempos + 1))}
                                disabled={paginaTempos === totalPaginas}
                                className="h-8 px-3"
                              >
                                →
                              </Button>
                            </div>
                          )}
                        </>
                      )
                    })()}
                    
                    {/* Estatísticas dos tempos */}
                    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {Math.floor(Math.min(...clienteSelecionado.tempos_estadia_detalhados) / 60)}h {Math.round(Math.min(...clienteSelecionado.tempos_estadia_detalhados) % 60)}min
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Menor tempo</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-purple-600 dark:text-purple-400">
                            {clienteSelecionado.tempo_medio_estadia_formatado}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Tempo médio</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {Math.floor(Math.max(...clienteSelecionado.tempos_estadia_detalhados) / 60)}h {Math.round(Math.max(...clienteSelecionado.tempos_estadia_detalhados) % 60)}min
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Maior tempo</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6 flex justify-between items-center">
              <div className="flex gap-3">
                {clienteSelecionado?.telefone && (
                  <Button
                    onClick={() => handleWhatsAppClick(clienteSelecionado.nome_principal, clienteSelecionado.telefone)}
                    variant="outline"
                    className="px-6 py-3 rounded-xl font-medium"
                    size="lg"
                  >
                    <div className="flex items-center gap-3">
                      <MessageCircle className="h-5 w-5" />
                      <span>Enviar WhatsApp</span>
                    </div>
                  </Button>
                )}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                {visitasDetalhadas.length} visita{visitasDetalhadas.length !== 1 ? 's' : ''} encontrada{visitasDetalhadas.length !== 1 ? 's' : ''}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}