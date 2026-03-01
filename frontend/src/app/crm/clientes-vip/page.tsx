'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Users, Crown, Star, Heart, TrendingUp, MessageCircle, 
  Search, Phone, RefreshCcw, Eye, Award, Sparkles 
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useBar } from '@/contexts/BarContext'
import { AnimatedCounter, AnimatedCurrency } from '@/components/ui/animated-counter'
import { motion } from 'framer-motion'

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

interface ClienteVIP {
  telefone: string
  nome: string
  total_visitas: number
  total_gasto: number
  ticket_medio: number
  ultima_visita: string
  produtos_favoritos: ProdutoFavorito[]
  categorias_favoritas: CategoriaFavorita[]
  tags: string[]
  dias_preferidos: string[]
  is_vip: boolean
  is_frequente: boolean
  is_regular: boolean
}

interface Estatisticas {
  total_clientes: number
  clientes_vip: number
  clientes_frequentes: number
  clientes_regulares: number
  top_produtos: { produto: string; clientes: number; quantidade_total: number }[]
  top_tags: { tag: string; count: number }[]
}

export default function ClientesVIPPage() {
  const [clientes, setClientes] = useState<ClienteVIP[]>([])
  const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [busca, setBusca] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteVIP | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const { toast } = useToast()
  const { selectedBar } = useBar()

  const fetchClientes = useCallback(async () => {
    if (!selectedBar) return

    try {
      setLoading(true)
      const response = await fetch('/api/crm/clientes-vip', {
        headers: {
          'x-user-data': JSON.stringify({ bar_id: selectedBar.id })
        }
      })

      if (!response.ok) throw new Error('Erro ao buscar clientes')

      const data = await response.json()
      setClientes(data.clientes || [])
      setEstatisticas(data.estatisticas || null)
    } catch (error) {
      console.error('Erro:', error)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível buscar os clientes VIP',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [selectedBar, toast])

  const syncPerfis = async () => {
    if (!selectedBar) return

    try {
      setSyncing(true)
      toast({
        title: 'Sincronizando perfis...',
        description: 'Isso pode levar alguns minutos'
      })

      const response = await fetch('/api/analitico/clientes/perfil-consumo/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-data': JSON.stringify({ bar_id: selectedBar.id })
        },
        body: JSON.stringify({ bar_id: selectedBar.id })
      })

      if (!response.ok) throw new Error('Erro no sync')

      const data = await response.json()
      
      toast({
        title: 'Sync concluído!',
        description: `${data.clientes_processados} perfis processados`
      })

      // Recarregar dados
      await fetchClientes()
    } catch (error) {
      console.error('Erro no sync:', error)
      toast({
        title: 'Erro no sync',
        description: 'Não foi possível sincronizar os perfis',
        variant: 'destructive'
      })
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchClientes()
  }, [fetchClientes])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString + 'T12:00:00Z')
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  }

  const handleWhatsAppClick = (nome: string, telefone: string) => {
    const telefoneNumeros = telefone.replace(/\D/g, '')
    const mensagem = `Olá ${nome}! 🎉\n\nObrigado por ser um cliente especial! Temos uma oferta exclusiva para você...\n\nEsperamos vê-lo em breve! 😊`
    const whatsappUrl = `https://wa.me/55${telefoneNumeros}?text=${encodeURIComponent(mensagem)}`
    window.open(whatsappUrl, '_blank')
  }

  const clientesFiltrados = clientes.filter(c => 
    c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone?.includes(busca)
  )

  if (!selectedBar) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg max-w-md mx-auto mt-20">
            <CardContent className="text-center py-16">
              <Crown className="h-16 w-16 text-amber-500 mx-auto mb-6" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Selecione um Bar
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Para visualizar os clientes VIP, selecione um bar no seletor do topo.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg">
                <Crown className="h-6 w-6 text-white" />
              </div>
              Clientes VIP
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm ml-11">
              Perfil de consumo e preferências dos seus melhores clientes
            </p>
          </div>

          <Button
            onClick={syncPerfis}
            disabled={syncing}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
          >
            {syncing ? (
              <>
                <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCcw className="w-4 h-4 mr-2" />
                Atualizar Perfis
              </>
            )}
          </Button>
        </div>

        {/* Cards de Estatísticas */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="bg-white dark:bg-gray-800">
                <CardContent className="p-6">
                  <Skeleton className="h-8 w-24 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <CardHeader className="pb-2 bg-gradient-to-r from-amber-500 to-amber-600 rounded-t-lg">
                  <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                    <Crown className="h-4 w-4" />
                    Clientes VIP
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    <AnimatedCounter value={estatisticas.clientes_vip} duration={1.5} />
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    20+ visitas
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <CardHeader className="pb-2 bg-gradient-to-r from-purple-500 to-purple-600 rounded-t-lg">
                  <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Frequentes
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    <AnimatedCounter value={estatisticas.clientes_frequentes} duration={1.5} />
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                    10-19 visitas
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <CardHeader className="pb-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-lg">
                  <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Regulares
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    <AnimatedCounter value={estatisticas.clientes_regulares} duration={1.5} />
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    5-9 visitas
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <CardHeader className="pb-2 bg-gradient-to-r from-green-500 to-green-600 rounded-t-lg">
                  <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Total Identificados
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    <AnimatedCounter value={estatisticas.total_clientes} duration={1.5} />
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Com perfil de consumo
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Grid: Produtos Populares + Tags */}
        {!loading && estatisticas && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Produtos Mais Populares */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg h-full">
                <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-t-lg">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Produtos Mais Pedidos
                  </CardTitle>
                  <CardDescription className="text-amber-100">
                    Baseado nos clientes VIP
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {estatisticas.top_produtos.slice(0, 5).map((produto, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold text-amber-500">#{idx + 1}</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {produto.produto}
                          </span>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                            {produto.clientes} clientes
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Tags Mais Comuns */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.6 }}
            >
              <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg h-full">
                <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-t-lg">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Perfis Mais Comuns
                  </CardTitle>
                  <CardDescription className="text-purple-100">
                    Tags identificadas automaticamente
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {estatisticas.top_tags.map((item, idx) => (
                      <Badge 
                        key={idx}
                        className={`
                          text-sm py-2 px-3
                          ${item.tag.includes('vip') ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' : ''}
                          ${item.tag.includes('frequente') ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : ''}
                          ${item.tag.includes('prefere_') ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : ''}
                          ${item.tag.includes('cervejeiro') ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : ''}
                          ${item.tag.includes('frequenta_') ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : ''}
                          ${!item.tag.includes('vip') && !item.tag.includes('frequente') && !item.tag.includes('prefere_') && !item.tag.includes('cervejeiro') && !item.tag.includes('frequenta_') ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' : ''}
                        `}
                      >
                        {item.tag.replace(/_/g, ' ')} ({item.count})
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Tabela de Clientes */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-700 dark:to-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Lista de Clientes com Perfil
                  </CardTitle>
                  <CardDescription className="text-slate-200">
                    Clientes identificados com histórico de consumo
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Buscar cliente..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="w-64 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                  />
                  <Button size="icon" variant="ghost" className="text-white">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Carregando clientes...</p>
                </div>
              ) : clientesFiltrados.length > 0 ? (
                <Table>
                  <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                    <TableRow>
                      <TableHead className="font-semibold">#</TableHead>
                      <TableHead className="font-semibold">Cliente</TableHead>
                      <TableHead className="font-semibold text-center">Status</TableHead>
                      <TableHead className="font-semibold text-center">Visitas</TableHead>
                      <TableHead className="font-semibold text-center">Ticket Médio</TableHead>
                      <TableHead className="font-semibold">Produto Favorito</TableHead>
                      <TableHead className="font-semibold">Tags</TableHead>
                      <TableHead className="font-semibold text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientesFiltrados.map((cliente, index) => (
                      <TableRow 
                        key={cliente.telefone}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={`
                              font-bold
                              ${index < 3 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white border-yellow-500' : ''}
                            `}
                          >
                            #{index + 1}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{cliente.nome}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {cliente.telefone}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {cliente.is_vip ? (
                            <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                              <Crown className="h-3 w-3 mr-1" /> VIP
                            </Badge>
                          ) : cliente.is_frequente ? (
                            <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                              <Star className="h-3 w-3 mr-1" /> Frequente
                            </Badge>
                          ) : cliente.is_regular ? (
                            <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                              <Heart className="h-3 w-3 mr-1" /> Regular
                            </Badge>
                          ) : (
                            <Badge variant="outline">Novo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                            {cliente.total_visitas}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(cliente.ticket_medio)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {cliente.produtos_favoritos?.[0] ? (
                            <div className="text-sm">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {cliente.produtos_favoritos[0].produto}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {cliente.produtos_favoritos[0].quantidade}x pedido
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {cliente.tags?.slice(0, 2).map((tag, idx) => (
                              <Badge 
                                key={idx}
                                variant="outline"
                                className="text-xs"
                              >
                                {tag.replace(/_/g, ' ').slice(0, 15)}
                              </Badge>
                            ))}
                            {(cliente.tags?.length || 0) > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{cliente.tags.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                              onClick={() => {
                                setClienteSelecionado(cliente)
                                setModalAberto(true)
                              }}
                            >
                              <Eye className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900/30"
                              onClick={() => handleWhatsAppClick(cliente.nome, cliente.telefone)}
                            >
                              <MessageCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-12 text-center">
                  <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Nenhum cliente encontrado
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Clique em &quot;Atualizar Perfis&quot; para sincronizar os dados de consumo
                  </p>
                  <Button onClick={syncPerfis} disabled={syncing}>
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Sincronizar Agora
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Modal de Detalhes */}
        <Dialog open={modalAberto} onOpenChange={setModalAberto}>
          <DialogContent className="max-w-2xl bg-white dark:bg-gray-900">
            <DialogHeader className="bg-gradient-to-r from-amber-500 to-orange-600 -m-6 mb-4 p-6 rounded-t-lg">
              <DialogTitle className="text-white text-xl flex items-center gap-2">
                <Crown className="h-5 w-5" />
                {clienteSelecionado?.nome}
              </DialogTitle>
              <DialogDescription className="text-amber-100">
                <Phone className="h-3 w-3 inline mr-1" />
                {clienteSelecionado?.telefone}
              </DialogDescription>
            </DialogHeader>

            {clienteSelecionado && (
              <div className="space-y-6 mt-4">
                {/* Cards de resumo */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-purple-50 dark:bg-purple-900/20 border-0">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                        {clienteSelecionado.total_visitas}
                      </div>
                      <div className="text-xs text-purple-600 dark:text-purple-400">Visitas</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 dark:bg-green-900/20 border-0">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                        {formatCurrency(clienteSelecionado.total_gasto)}
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400">Total Gasto</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50 dark:bg-blue-900/20 border-0">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                        {formatDate(clienteSelecionado.ultima_visita)}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">Última Visita</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Tags */}
                {clienteSelecionado.tags?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">🏷️ Perfil</h4>
                    <div className="flex flex-wrap gap-2">
                      {clienteSelecionado.tags.map((tag, idx) => (
                        <Badge key={idx} variant="outline">
                          {tag.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Produtos Favoritos */}
                {clienteSelecionado.produtos_favoritos?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">⭐ Produtos Favoritos</h4>
                    <div className="space-y-2">
                      {clienteSelecionado.produtos_favoritos.slice(0, 5).map((produto, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <span className="text-gray-900 dark:text-white">{produto.produto}</span>
                          <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                            {produto.quantidade}x
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Botão WhatsApp */}
                <Button
                  onClick={() => handleWhatsAppClick(clienteSelecionado.nome, clienteSelecionado.telefone)}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Enviar Mensagem no WhatsApp
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

