'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Search, Download, Users, TrendingUp, Calendar, Cake } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Checkbox } from '@/components/ui/checkbox'

interface FiltrosAvancadosProps {
  barId: number
}

interface Cliente {
  telefone: string
  nome: string
  email: string | null
  dtnasc: string | null
  idadeMedia: number | null
  visitas: number
  ticketMedio: number
  totalGasto: number
  totalEntrada: number
  totalConsumo: number
  ultimaVisita: string
}

interface Estatisticas {
  totalClientes: number
  totalVisitas: number
  totalGasto: number
  ticketMedio: number
  clientesComIdade: number
  percentualComIdade: number
  idadeMedia: number | null
  medianaIdade: number | null
  faixasEtarias: Record<string, number>
}

const diasSemanaNomes = [
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Segunda' },
  { value: '2', label: 'Terça' },
  { value: '3', label: 'Quarta' },
  { value: '4', label: 'Quinta' },
  { value: '5', label: 'Sexta' },
  { value: '6', label: 'Sábado' }
]

export function FiltrosAvancados({ barId }: FiltrosAvancadosProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null)

  // Filtros
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [diasSemana, setDiasSemana] = useState<string[]>([])
  const [idadeMin, setIdadeMin] = useState('')
  const [idadeMax, setIdadeMax] = useState('')
  const [visitasMin, setVisitasMin] = useState('')
  const [visitasMax, setVisitasMax] = useState('')
  const [ticketMedioMin, setTicketMedioMin] = useState('')
  const [ticketMedioMax, setTicketMedioMax] = useState('')

  const toggleDiaSemana = (dia: string) => {
    setDiasSemana(prev => 
      prev.includes(dia) 
        ? prev.filter(d => d !== dia)
        : [...prev, dia]
    )
  }

  const aplicarFiltros = async () => {
    if (!dataInicio || !dataFim) {
      toast({
        title: 'Datas obrigatórias',
        description: 'Selecione data de início e fim',
        variant: 'destructive'
      })
      return
    }

    try {
      setLoading(true)

      const filtros: any = {
        dataInicio,
        dataFim
      }

      if (diasSemana.length > 0) {
        filtros.diasSemana = diasSemana
      }
      if (idadeMin) filtros.idadeMin = parseInt(idadeMin)
      if (idadeMax) filtros.idadeMax = parseInt(idadeMax)
      if (visitasMin) filtros.visitasMin = parseInt(visitasMin)
      if (visitasMax) filtros.visitasMax = parseInt(visitasMax)
      if (ticketMedioMin) filtros.ticketMedioMin = parseFloat(ticketMedioMin)
      if (ticketMedioMax) filtros.ticketMedioMax = parseFloat(ticketMedioMax)

      console.log('🔍 Enviando filtros:', filtros)
      console.log('📍 Bar ID:', barId)

      const response = await fetch('/api/analitico/clientes/filtros-avancados', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-selected-bar-id': barId.toString()
        },
        body: JSON.stringify({ filtros })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ Erro na resposta:', errorData)
        throw new Error(errorData.error || 'Erro ao buscar dados')
      }

      const data = await response.json()
      console.log('✅ Dados recebidos:', data)
      
      setClientes(data.clientes)
      setEstatisticas(data.estatisticas)

      toast({
        title: 'Filtros aplicados!',
        description: `${data.clientes.length} clientes encontrados`
      })

    } catch (error) {
      console.error('Erro ao aplicar filtros:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível aplicar os filtros',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const limparFiltros = () => {
    setDataInicio('')
    setDataFim('')
    setDiasSemana([])
    setIdadeMin('')
    setIdadeMax('')
    setVisitasMin('')
    setVisitasMax('')
    setTicketMedioMin('')
    setTicketMedioMax('')
    setClientes([])
    setEstatisticas(null)
  }

  const exportarCSV = () => {
    if (clientes.length === 0) {
      toast({
        title: 'Nenhum dado',
        description: 'Aplique filtros primeiro',
        variant: 'destructive'
      })
      return
    }

    const csvContent = [
      ['Nome', 'Telefone', 'Email', 'Idade Média', 'Visitas', 'Ticket Médio', 'Total Gasto', 'Última Visita'].join(','),
      ...clientes.map(c => [
        c.nome,
        c.telefone,
        c.email || '',
        c.idadeMedia || '',
        c.visitas,
        c.ticketMedio.toFixed(2),
        c.totalGasto.toFixed(2),
        c.ultimaVisita
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `filtros-avancados-${new Date().toISOString().split('T')[0]}.csv`
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Exportação concluída',
      description: `${clientes.length} clientes exportados`
    })
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T12:00:00Z')
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  }

  // Função para preencher últimos 3 domingos
  const preencherUltimos3Domingos = () => {
    const hoje = new Date()
    const domingos: Date[] = []
    
    // Encontrar domingos
    for (let i = 0; i < 90; i++) {
      const data = new Date(hoje)
      data.setDate(hoje.getDate() - i)
      if (data.getDay() === 0) {
        domingos.push(data)
      }
      if (domingos.length === 3) break
    }

    if (domingos.length >= 3) {
      const dataFimCalc = domingos[0].toISOString().split('T')[0]
      const dataInicioCalc = domingos[2].toISOString().split('T')[0]
      setDataInicio(dataInicioCalc)
      setDataFim(dataFimCalc)
      setDiasSemana(['0']) // Domingo
      
      toast({
        title: 'Filtro aplicado',
        description: 'Últimos 3 domingos selecionados'
      })
    }
  }

  // Função para preencher últimos 30 dias
  const preencherUltimos30Dias = () => {
    const hoje = new Date()
    const dataFimCalc = hoje.toISOString().split('T')[0]
    const data30DiasAtras = new Date(hoje)
    data30DiasAtras.setDate(hoje.getDate() - 30)
    const dataInicioCalc = data30DiasAtras.toISOString().split('T')[0]
    
    setDataInicio(dataInicioCalc)
    setDataFim(dataFimCalc)
    setDiasSemana([])
    
    toast({
      title: 'Filtro aplicado',
      description: 'Últimos 30 dias selecionados'
    })
  }

  // Função para preencher fim de semana do mês
  const preencherFimDeSemana = () => {
    const hoje = new Date()
    const dataFimCalc = hoje.toISOString().split('T')[0]
    const data30DiasAtras = new Date(hoje)
    data30DiasAtras.setDate(hoje.getDate() - 30)
    const dataInicioCalc = data30DiasAtras.toISOString().split('T')[0]
    
    setDataInicio(dataInicioCalc)
    setDataFim(dataFimCalc)
    setDiasSemana(['5', '6', '0']) // Sexta, Sábado, Domingo
    
    toast({
      title: 'Filtro aplicado',
      description: 'Fins de semana dos últimos 30 dias'
    })
  }

  return (
    <div className="space-y-6">
      {/* Card de Filtros */}
      <Card className="card-dark">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-500" />
            Filtros Dinâmicos
          </CardTitle>
          <CardDescription>
            Configure os filtros e analise seu público com precisão
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Período */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Período
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="dataInicio">Data Início *</Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="dataFim">Data Fim *</Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={preencherUltimos3Domingos}
                  className="w-full"
                >
                  Últimos 3 Domingos
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={preencherUltimos30Dias}
                  >
                    30 dias
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={preencherFimDeSemana}
                  >
                    Fins de semana
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Dias da Semana */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">
              Dias da Semana (opcional)
            </h4>
            <div className="flex flex-wrap gap-2">
              {diasSemanaNomes.map(dia => (
                <div key={dia.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`dia-${dia.value}`}
                    checked={diasSemana.includes(dia.value)}
                    onCheckedChange={() => toggleDiaSemana(dia.value)}
                  />
                  <Label
                    htmlFor={`dia-${dia.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {dia.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Faixa Etária */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Cake className="h-4 w-4" />
              Faixa Etária (opcional)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="idadeMin">Idade Mínima</Label>
                <Input
                  id="idadeMin"
                  type="number"
                  placeholder="Ex: 18"
                  value={idadeMin}
                  onChange={(e) => setIdadeMin(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="idadeMax">Idade Máxima</Label>
                <Input
                  id="idadeMax"
                  type="number"
                  placeholder="Ex: 35"
                  value={idadeMax}
                  onChange={(e) => setIdadeMax(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Visitas e Ticket Médio */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Comportamento (opcional)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="visitasMin">Visitas Mínimas</Label>
                <Input
                  id="visitasMin"
                  type="number"
                  placeholder="Ex: 2"
                  value={visitasMin}
                  onChange={(e) => setVisitasMin(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="visitasMax">Visitas Máximas</Label>
                <Input
                  id="visitasMax"
                  type="number"
                  placeholder="Ex: 10"
                  value={visitasMax}
                  onChange={(e) => setVisitasMax(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="ticketMedioMin">Ticket Médio Min (R$)</Label>
                <Input
                  id="ticketMedioMin"
                  type="number"
                  placeholder="Ex: 50"
                  value={ticketMedioMin}
                  onChange={(e) => setTicketMedioMin(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="ticketMedioMax">Ticket Médio Max (R$)</Label>
                <Input
                  id="ticketMedioMax"
                  type="number"
                  placeholder="Ex: 200"
                  value={ticketMedioMax}
                  onChange={(e) => setTicketMedioMax(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
            <Button onClick={aplicarFiltros} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Aplicar Filtros
                </>
              )}
            </Button>
            <Button variant="outline" onClick={limparFiltros}>
              Limpar
            </Button>
            <Button
              variant="outline"
              onClick={exportarCSV}
              disabled={clientes.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      {estatisticas && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="card-dark hover:shadow-lg transition-shadow">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-blue-500">
                  {estatisticas.totalClientes.toLocaleString('pt-BR')}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Clientes Únicos
                </div>
              </CardContent>
            </Card>

            <Card className="card-dark hover:shadow-lg transition-shadow">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-green-500">
                  {estatisticas.totalVisitas.toLocaleString('pt-BR')}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Total de Visitas
                </div>
                <div className="text-xs text-muted-foreground">
                  {(estatisticas.totalVisitas / estatisticas.totalClientes).toFixed(1)} visitas/cliente
                </div>
              </CardContent>
            </Card>

            <Card className="card-dark hover:shadow-lg transition-shadow">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-purple-500">
                  {estatisticas.idadeMedia?.toFixed(1) || 'N/A'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Idade Média
                </div>
                <div className="text-xs text-muted-foreground">
                  ({estatisticas.percentualComIdade}% com dados)
                </div>
              </CardContent>
            </Card>

            <Card className="card-dark hover:shadow-lg transition-shadow">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-orange-500">
                  {formatCurrency(estatisticas.ticketMedio)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Ticket Médio
                </div>
                <div className="text-xs text-muted-foreground">
                  Total: {formatCurrency(estatisticas.totalGasto)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Insights Automáticos */}
          {estatisticas.idadeMedia && (
            <Card className="card-dark border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  Insights do Público
                </h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {estatisticas.idadeMedia < 25 && (
                    <p>• Público predominantemente <strong className="text-foreground">jovem</strong> (média {estatisticas.idadeMedia.toFixed(1)} anos) - ideal para promoções de bebidas e eventos com música atual</p>
                  )}
                  {estatisticas.idadeMedia >= 25 && estatisticas.idadeMedia < 35 && (
                    <p>• Público <strong className="text-foreground">jovem adulto</strong> (média {estatisticas.idadeMedia.toFixed(1)} anos) - perfil equilibrado entre diversão e consumo premium</p>
                  )}
                  {estatisticas.idadeMedia >= 35 && (
                    <p>• Público <strong className="text-foreground">maduro</strong> (média {estatisticas.idadeMedia.toFixed(1)} anos) - valoriza experiência, qualidade e atendimento diferenciado</p>
                  )}
                  
                  {estatisticas.ticketMedio > 100 && (
                    <p>• Alto poder de consumo (ticket médio {formatCurrency(estatisticas.ticketMedio)}) - público premium</p>
                  )}
                  
                  {estatisticas.totalVisitas / estatisticas.totalClientes > 2 && (
                    <p>• Boa fidelização: média de <strong className="text-foreground">{(estatisticas.totalVisitas / estatisticas.totalClientes).toFixed(1)} visitas por cliente</strong></p>
                  )}

                  {estatisticas.percentualComIdade < 50 && (
                    <p className="text-yellow-600 dark:text-yellow-500">⚠️ Apenas {estatisticas.percentualComIdade}% dos clientes têm data de nascimento cadastrada - considere coletar mais dados</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Distribuição por Faixa Etária com Gráfico Visual */}
      {estatisticas && estatisticas.faixasEtarias && (
        <Card className="card-dark">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Cake className="h-4 w-4" />
              Distribuição por Faixa Etária
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Gráfico de Barras Visual */}
            <div className="space-y-2">
              {Object.entries(estatisticas.faixasEtarias).map(([faixa, total]) => {
                const percentual = estatisticas.totalVisitas > 0
                  ? ((total / estatisticas.totalVisitas) * 100)
                  : 0
                const larguraBarra = Math.max(percentual, 2) // Mínimo 2% para visibilidade
                
                return (
                  <div key={faixa} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-muted-foreground w-16">{faixa} anos</span>
                      <span className="text-muted-foreground">{total} visitas</span>
                      <Badge variant="secondary" className="text-xs">
                        {percentual.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${larguraBarra}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Cards com Resumo */}
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3 pt-4 border-t border-border">
              {Object.entries(estatisticas.faixasEtarias).map(([faixa, total]) => {
                const percentual = estatisticas.totalVisitas > 0
                  ? ((total / estatisticas.totalVisitas) * 100).toFixed(1)
                  : '0'
                return (
                  <div key={faixa} className="text-center p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
                    <div className="text-lg font-bold">{total}</div>
                    <div className="text-xs text-muted-foreground">{faixa}</div>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {percentual}%
                    </Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de Clientes */}
      {clientes.length > 0 && (
        <Card className="card-dark">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Clientes Filtrados ({clientes.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Idade</TableHead>
                    <TableHead className="text-center">Visitas</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                    <TableHead className="text-right">Total Gasto</TableHead>
                    <TableHead className="text-center">Última Visita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((cliente, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{cliente.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{cliente.telefone}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {cliente.email || '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {cliente.idadeMedia ? (
                          <Badge variant="outline">{cliente.idadeMedia} anos</Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{cliente.visitas}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(cliente.ticketMedio)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(cliente.totalGasto)}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground text-sm">
                        {formatDate(cliente.ultimaVisita)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mensagem quando não há resultados */}
      {!loading && clientes.length === 0 && estatisticas === null && (
        <Card className="card-dark">
          <CardContent className="text-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Configure os filtros</h3>
            <p className="text-muted-foreground">
              Selecione o período e outros filtros desejados para analisar seus clientes
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
