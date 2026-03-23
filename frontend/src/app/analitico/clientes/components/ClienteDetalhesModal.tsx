'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CalendarDays,
  DollarSign,
  MessageCircle,
  Phone,
  Users,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type {
  Cliente,
  DetalhesResponse,
  PerfilConsumo,
  VisitaDetalhada,
} from '../types'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(dateString: string) {
  const date = new Date(dateString + 'T12:00:00Z')
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export interface ClienteDetalhesModalProps {
  cliente: Cliente | null
  isOpen: boolean
  onClose: () => void
  barId: number | null
}

export function ClienteDetalhesModal({
  cliente,
  isOpen,
  onClose,
  barId,
}: ClienteDetalhesModalProps) {
  const { toast } = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  
  const [visitasDetalhadas, setVisitasDetalhadas] = useState<VisitaDetalhada[]>([])
  const [diaDestaque, setDiaDestaque] = useState('')
  const [loadingVisitas, setLoadingVisitas] = useState(false)
  const [perfilConsumo, setPerfilConsumo] = useState<PerfilConsumo | null>(null)
  const [loadingPerfil, setLoadingPerfil] = useState(false)
  const [paginaTempos, setPaginaTempos] = useState(1)

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  const handleWhatsAppClick = useCallback(
    (nome: string, telefone: string | null) => {
      try {
        if (!telefone) {
          toast({
            title: 'Telefone não disponível',
            description: 'Este cliente não possui telefone cadastrado',
            variant: 'destructive',
          })
          return
        }
        const telefoneNumeros = telefone.replace(/\D/g, '')
        const mensagem = `Olá ${nome}! 🎉\n\nObrigado por ser um cliente especial do nosso estabelecimento! Sua fidelidade é muito importante para nós.\n\nEstamos aqui para qualquer dúvida ou para lhe oferecer nossas novidades e promoções exclusivas.\n\nEsperamos vê-lo em breve! 😊`
        const whatsappUrl = `https://wa.me/55${telefoneNumeros}?text=${encodeURIComponent(mensagem)}`
        window.open(whatsappUrl, '_blank')
        toast({
          title: 'WhatsApp aberto',
          description: `Conversa iniciada com ${nome}`,
        })
      } catch {
        toast({
          title: 'Erro',
          description: 'Não foi possível abrir o WhatsApp',
          variant: 'destructive',
        })
      }
    },
    [toast]
  )

  useEffect(() => {
    if (!isOpen || !cliente) {
      setVisitasDetalhadas([])
      setDiaDestaque('')
      setPerfilConsumo(null)
      setPaginaTempos(1)
      return
    }

    if (!barId) {
      toastRef.current({
        title: 'Bar não selecionado',
        description: 'Selecione um bar para carregar visitas e perfil de consumo.',
        variant: 'destructive',
      })
      return
    }

    const telefone = cliente.telefone
    if (!telefone) {
      setVisitasDetalhadas([])
      setDiaDestaque('')
      setPerfilConsumo(null)
      return
    }

    const headers = { 'x-selected-bar-id': String(barId) }
    let cancelled = false

    const fetchVisitas = async () => {
      setLoadingVisitas(true)
      try {
        const q = encodeURIComponent(telefone)
        const response = await fetch(`/api/analitico/clientes/detalhes?telefone=${q}`, {
          headers,
        })
        if (!response.ok) {
          throw new Error('Erro ao carregar detalhes das visitas')
        }
        const data: DetalhesResponse = await response.json()
        if (!cancelled) {
          setVisitasDetalhadas(data.visitas || [])
          setDiaDestaque(data.dia_destaque || 'Não definido')
        }
      } catch (err) {
        if (!cancelled) {
          toastRef.current({
            title: 'Erro ao carregar detalhes',
            description: err instanceof Error ? err.message : 'Erro desconhecido',
            variant: 'destructive',
          })
          setVisitasDetalhadas([])
        }
      } finally {
        if (!cancelled) setLoadingVisitas(false)
      }
    }

    const fetchPerfil = async () => {
      setLoadingPerfil(true)
      setPerfilConsumo(null)
      try {
        const q = encodeURIComponent(telefone)
        const response = await fetch(`/api/analitico/clientes/perfil-consumo?telefone=${q}`, {
          headers,
        })
        if (!response.ok) {
          return
        }
        const data = await response.json()
        if (!cancelled && data.perfil) {
          setPerfilConsumo(data.perfil as PerfilConsumo)
        }
      } catch {
        // perfil é opcional
      } finally {
        if (!cancelled) setLoadingPerfil(false)
      }
    }

    setPaginaTempos(1)
    void Promise.all([fetchVisitas(), fetchPerfil()])

    return () => {
      cancelled = true
    }
  }, [isOpen, cliente, barId])

  const produtosFavoritos = perfilConsumo?.produtos_favoritos ?? []
  const categoriasFavoritas = perfilConsumo?.categorias_favoritas ?? []
  const tags = perfilConsumo?.tags ?? []
  const diasPreferidos = perfilConsumo?.dias_preferidos ?? []

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 overflow-hidden p-0">
        {!cliente ? (
          <div className="p-6 text-center text-muted-foreground">Nenhum cliente selecionado.</div>
        ) : (
          <>
            <DialogHeader className="bg-muted/40 p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-muted rounded-xl">
                  <Users className="h-7 w-7 text-foreground" />
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-2xl font-bold text-foreground mb-1">
                    {cliente.nome_principal}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground flex items-center gap-2 text-base">
                    <Phone className="h-4 w-4" />
                    {cliente.telefone || 'Sem telefone cadastrado'}
                  </DialogDescription>
                  {cliente.email ? (
                    <p className="text-sm text-muted-foreground mt-1">{cliente.email}</p>
                  ) : null}
                </div>
              </div>
            </DialogHeader>

            <div className="p-6 overflow-y-auto max-h-[calc(95vh-180px)]">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                <Card className="card-dark border-border shadow-sm">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-foreground mb-1">
                      {cliente.total_visitas}
                    </div>
                    <div className="text-muted-foreground text-sm font-medium">Total de Visitas</div>
                  </CardContent>
                </Card>
                <Card className="card-dark border-border shadow-sm">
                  <CardContent className="p-4 text-center">
                    <div className="text-xl font-bold text-foreground mb-1">
                      {formatCurrency(cliente.valor_total_gasto || 0)}
                    </div>
                    <div className="text-muted-foreground text-sm font-medium">Total Gasto</div>
                  </CardContent>
                </Card>
                <Card className="card-dark border-border shadow-sm">
                  <CardContent className="p-4 text-center">
                    <div className="text-xl font-bold text-foreground mb-1">
                      {formatCurrency(cliente.ticket_medio_geral || 0)}
                    </div>
                    <div className="text-muted-foreground text-sm font-medium">Ticket Médio</div>
                  </CardContent>
                </Card>
                <Card className="card-dark border-border shadow-sm">
                  <CardContent className="p-4 text-center">
                    <div className="text-xl font-bold text-foreground mb-1">
                      {cliente.tempo_medio_estadia_formatado &&
                      cliente.tempo_medio_estadia_formatado !== 'N/A'
                        ? cliente.tempo_medio_estadia_formatado
                        : 'Sem dados'}
                    </div>
                    <div className="text-muted-foreground text-sm font-medium">
                      Tempo Médio de Estadia
                    </div>
                    {cliente.total_visitas_com_tempo != null &&
                      cliente.total_visitas_com_tempo > 0 && (
                        <div className="text-muted-foreground text-xs mt-1">
                          {cliente.total_visitas_com_tempo}/{cliente.total_visitas} visitas com tempo
                        </div>
                      )}
                  </CardContent>
                </Card>
                <Card className="card-dark border-border shadow-sm">
                  <CardContent className="p-4 text-center">
                    <div className="text-xl font-bold text-foreground mb-1">
                      {cliente.ultima_visita ? formatDate(cliente.ultima_visita) : 'N/A'}
                    </div>
                    <div className="text-muted-foreground text-sm font-medium">Última Visita</div>
                  </CardContent>
                </Card>
                <Card className="card-dark border-border shadow-sm">
                  <CardContent className="p-4 text-center">
                    <div className="text-xl font-bold text-foreground mb-1">{diaDestaque}</div>
                    <div className="text-muted-foreground text-sm font-medium">Dia Destaque</div>
                  </CardContent>
                </Card>
              </div>

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
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mr-3" />
                        <span className="text-gray-600 dark:text-gray-400">
                          Carregando perfil de consumo...
                        </span>
                      </div>
                    ) : perfilConsumo ? (
                      <div className="space-y-6">
                        {tags.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                              <span>🏷️</span> Tags do Cliente
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {tags.map((tag, idx) => (
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
                                  {tag
                                    .replace(/_/g, ' ')
                                    .replace(/prefere /g, '❤️ ')
                                    .replace(/frequenta /g, '📅 ')}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                              <span>⭐</span> Top 5 Produtos Favoritos
                            </h4>
                            <div className="space-y-2">
                              {produtosFavoritos.slice(0, 5).map((produto, idx) => (
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
                                    <Badge
                                      variant="outline"
                                      className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                    >
                                      {produto.quantidade}x
                                    </Badge>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {produto.vezes_pediu} pedido{produto.vezes_pediu !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                </div>
                              ))}
                              {produtosFavoritos.length === 0 && (
                                <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                                  Nenhum produto identificado
                                </p>
                              )}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                              <span>📊</span> Categorias Favoritas
                            </h4>
                            <div className="space-y-2">
                              {categoriasFavoritas.slice(0, 5).map((categoria, idx) => (
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
                                    <Badge
                                      variant="outline"
                                      className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                                    >
                                      {categoria.quantidade} itens
                                    </Badge>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {formatCurrency(categoria.valor_total)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                              {categoriasFavoritas.length === 0 && (
                                <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                                  Nenhuma categoria identificada
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {diasPreferidos.length > 0 && (
                          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                              <span>📅</span> Dias Preferidos
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {diasPreferidos.map((dia, idx) => (
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
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
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
                          {visitasDetalhadas.map((visita, index) => {
                            const tempo = cliente.tempos_estadia_detalhados?.[index]
                            const tempoFormatado =
                              tempo != null
                                ? `${Math.floor(tempo / 60)}h ${Math.round(tempo % 60)}min`
                                : null
                            return (
                              <TableRow
                                key={index}
                                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200"
                              >
                                <TableCell className="font-medium text-gray-900 dark:text-white">
                                  {formatDate(visita.data)}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800"
                                  >
                                    {formatCurrency(visita.couvert)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                                  >
                                    {formatCurrency(visita.consumo)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 font-semibold"
                                  >
                                    {formatCurrency(visita.total)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  {tempoFormatado ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                                    >
                                      {tempoFormatado}
                                    </Badge>
                                  ) : (
                                    <span className="text-gray-400 dark:text-gray-500 text-sm">N/A</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CalendarDays className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-gray-600 dark:text-gray-400">
                        {!cliente.telefone
                          ? 'Cadastre um telefone para ver o histórico de visitas.'
                          : 'Nenhuma visita detalhada encontrada'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {cliente.tempos_estadia_detalhados && cliente.tempos_estadia_detalhados.length > 0 && (
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mt-6">
                  <CardHeader className="bg-muted/40 border-b border-border">
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <span className="text-lg">⏱️</span>
                      Tempos de Estadia
                      <Badge
                        variant="secondary"
                        className="bg-muted text-foreground border-border"
                      >
                        {cliente.tempos_estadia_detalhados.length} visitas
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Tempo de permanência em cada visita (entrada → saída)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    {(() => {
                      const tempos = cliente.tempos_estadia_detalhados
                      const temposPorPagina = 20
                      const totalPaginas = Math.ceil(tempos.length / temposPorPagina)
                      const inicioIndex = (paginaTempos - 1) * temposPorPagina
                      const fimIndex = inicioIndex + temposPorPagina
                      const temposPaginados = tempos.slice(inicioIndex, fimIndex)
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
                          {totalPaginas > 1 && (
                            <div className="flex justify-center items-center gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPaginaTempos((p) => Math.max(1, p - 1))}
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
                                onClick={() =>
                                  setPaginaTempos((p) => Math.min(totalPaginas, p + 1))
                                }
                                disabled={paginaTempos === totalPaginas}
                                className="h-8 px-3"
                              >
                                →
                              </Button>
                            </div>
                          )}
                          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="grid grid-cols-3 gap-4 text-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {Math.floor(Math.min(...tempos) / 60)}h{' '}
                                  {Math.round(Math.min(...tempos) % 60)}min
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Menor tempo
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-purple-600 dark:text-purple-400">
                                  {cliente.tempo_medio_estadia_formatado ?? '—'}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Tempo médio
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {Math.floor(Math.max(...tempos) / 60)}h{' '}
                                  {Math.round(Math.max(...tempos) % 60)}min
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Maior tempo
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6 flex justify-between items-center">
              <div className="flex gap-3">
                {cliente.telefone ? (
                  <Button
                    onClick={() => handleWhatsAppClick(cliente.nome_principal, cliente.telefone)}
                    variant="outline"
                    className="px-6 py-3 rounded-xl font-medium"
                    size="lg"
                  >
                    <div className="flex items-center gap-3">
                      <MessageCircle className="h-5 w-5" />
                      <span>Enviar WhatsApp</span>
                    </div>
                  </Button>
                ) : null}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                {visitasDetalhadas.length} visita{visitasDetalhadas.length !== 1 ? 's' : ''}{' '}
                encontrada{visitasDetalhadas.length !== 1 ? 's' : ''}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
