'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowUpDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import type { Cliente } from '../types'

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

type SortDirection = 'asc' | 'desc' | null
type SortColumn = 'nome_principal' | 'telefone' | 'total_visitas' | 'valor_total_entrada' | 'valor_total_consumo' | 'ticket_medio_geral' | 'tempo_medio_estadia_minutos' | 'ultima_visita' | null

interface ColumnFilter {
  nome: string
  telefone: string
  visitasMin: string
  visitasMax: string
  entradaMin: string
  entradaMax: string
  consumoMin: string
  consumoMax: string
  ticketMin: string
  ticketMax: string
}

export interface ClientesDataTableProps {
  clientes: Cliente[]
  onClienteSelect: (cliente: Cliente) => void
  loading: boolean
  totalClientes?: number
}

export function ClientesDataTable({
  clientes,
  onClienteSelect,
  loading,
  totalClientes,
}: ClientesDataTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [filters, setFilters] = useState<ColumnFilter>({
    nome: '',
    telefone: '',
    visitasMin: '',
    visitasMax: '',
    entradaMin: '',
    entradaMax: '',
    consumoMin: '',
    consumoMax: '',
    ticketMin: '',
    ticketMax: '',
  })
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 20

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortColumn(null)
        setSortDirection(null)
      }
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
    setPage(1)
  }

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="h-3 w-3 ml-1 text-primary" />
    }
    return <ChevronDown className="h-3 w-3 ml-1 text-primary" />
  }

  const filteredAndSortedClientes = useMemo(() => {
    let result = [...clientes]

    // Aplicar filtros
    if (filters.nome) {
      result = result.filter(c => 
        c.nome_principal?.toLowerCase().includes(filters.nome.toLowerCase())
      )
    }
    if (filters.telefone) {
      result = result.filter(c => 
        c.telefone?.includes(filters.telefone)
      )
    }
    if (filters.visitasMin) {
      result = result.filter(c => c.total_visitas >= Number(filters.visitasMin))
    }
    if (filters.visitasMax) {
      result = result.filter(c => c.total_visitas <= Number(filters.visitasMax))
    }
    if (filters.entradaMin) {
      result = result.filter(c => Number(c.valor_total_entrada) >= Number(filters.entradaMin))
    }
    if (filters.entradaMax) {
      result = result.filter(c => Number(c.valor_total_entrada) <= Number(filters.entradaMax))
    }
    if (filters.consumoMin) {
      result = result.filter(c => Number(c.valor_total_consumo) >= Number(filters.consumoMin))
    }
    if (filters.consumoMax) {
      result = result.filter(c => Number(c.valor_total_consumo) <= Number(filters.consumoMax))
    }
    if (filters.ticketMin) {
      result = result.filter(c => Number(c.ticket_medio_geral) >= Number(filters.ticketMin))
    }
    if (filters.ticketMax) {
      result = result.filter(c => Number(c.ticket_medio_geral) <= Number(filters.ticketMax))
    }

    // Aplicar ordenação
    if (sortColumn && sortDirection) {
      result.sort((a, b) => {
        let aVal: number | string = 0
        let bVal: number | string = 0

        switch (sortColumn) {
          case 'nome_principal':
            aVal = a.nome_principal || ''
            bVal = b.nome_principal || ''
            break
          case 'telefone':
            aVal = a.telefone || ''
            bVal = b.telefone || ''
            break
          case 'total_visitas':
            aVal = a.total_visitas || 0
            bVal = b.total_visitas || 0
            break
          case 'valor_total_entrada':
            aVal = Number(a.valor_total_entrada) || 0
            bVal = Number(b.valor_total_entrada) || 0
            break
          case 'valor_total_consumo':
            aVal = Number(a.valor_total_consumo) || 0
            bVal = Number(b.valor_total_consumo) || 0
            break
          case 'ticket_medio_geral':
            aVal = Number(a.ticket_medio_geral) || 0
            bVal = Number(b.ticket_medio_geral) || 0
            break
          case 'tempo_medio_estadia_minutos':
            aVal = Number(a.tempo_medio_estadia_minutos) || 0
            bVal = Number(b.tempo_medio_estadia_minutos) || 0
            break
          case 'ultima_visita':
            aVal = a.ultima_visita || ''
            bVal = b.ultima_visita || ''
            break
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc' 
            ? aVal.localeCompare(bVal) 
            : bVal.localeCompare(aVal)
        }

        return sortDirection === 'asc' 
          ? (aVal as number) - (bVal as number) 
          : (bVal as number) - (aVal as number)
      })
    }

    return result
  }, [clientes, filters, sortColumn, sortDirection])

  const paginatedClientes = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredAndSortedClientes.slice(start, start + pageSize)
  }, [filteredAndSortedClientes, page])

  const totalPages = Math.ceil(filteredAndSortedClientes.length / pageSize)

  const clearFilters = () => {
    setFilters({
      nome: '',
      telefone: '',
      visitasMin: '',
      visitasMax: '',
      entradaMin: '',
      entradaMax: '',
      consumoMin: '',
      consumoMax: '',
      ticketMin: '',
      ticketMax: '',
    })
    setPage(1)
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  const SortableHeader = ({ column, children, className = '' }: { column: SortColumn, children: React.ReactNode, className?: string }) => (
    <TableHead className={`font-semibold ${className}`}>
      <button
        type="button"
        onClick={() => handleSort(column)}
        className="flex items-center gap-0.5 hover:text-primary transition-colors w-full justify-inherit"
      >
        {children}
        {getSortIcon(column)}
      </button>
    </TableHead>
  )

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredAndSortedClientes.length} cliente{filteredAndSortedClientes.length !== 1 ? 's' : ''}
          {totalClientes && filteredAndSortedClientes.length !== totalClientes && (
            <> de {totalClientes}</>
          )}
        </div>
      </div>

      {/* Filtros por coluna */}
      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4 bg-muted/30 rounded-lg border">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
            <Input
              placeholder="Filtrar nome..."
              value={filters.nome}
              onChange={(e) => { setFilters(f => ({ ...f, nome: e.target.value })); setPage(1); }}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Telefone</label>
            <Input
              placeholder="Filtrar telefone..."
              value={filters.telefone}
              onChange={(e) => { setFilters(f => ({ ...f, telefone: e.target.value })); setPage(1); }}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Visitas (min-max)</label>
            <div className="flex gap-1">
              <Input
                placeholder="Min"
                value={filters.visitasMin}
                onChange={(e) => { setFilters(f => ({ ...f, visitasMin: e.target.value })); setPage(1); }}
                className="h-8 text-sm w-1/2"
                type="number"
              />
              <Input
                placeholder="Max"
                value={filters.visitasMax}
                onChange={(e) => { setFilters(f => ({ ...f, visitasMax: e.target.value })); setPage(1); }}
                className="h-8 text-sm w-1/2"
                type="number"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Entrada (R$)</label>
            <div className="flex gap-1">
              <Input
                placeholder="Min"
                value={filters.entradaMin}
                onChange={(e) => { setFilters(f => ({ ...f, entradaMin: e.target.value })); setPage(1); }}
                className="h-8 text-sm w-1/2"
                type="number"
              />
              <Input
                placeholder="Max"
                value={filters.entradaMax}
                onChange={(e) => { setFilters(f => ({ ...f, entradaMax: e.target.value })); setPage(1); }}
                className="h-8 text-sm w-1/2"
                type="number"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Consumo (R$)</label>
            <div className="flex gap-1">
              <Input
                placeholder="Min"
                value={filters.consumoMin}
                onChange={(e) => { setFilters(f => ({ ...f, consumoMin: e.target.value })); setPage(1); }}
                className="h-8 text-sm w-1/2"
                type="number"
              />
              <Input
                placeholder="Max"
                value={filters.consumoMax}
                onChange={(e) => { setFilters(f => ({ ...f, consumoMax: e.target.value })); setPage(1); }}
                className="h-8 text-sm w-1/2"
                type="number"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Ticket médio (R$)</label>
            <div className="flex gap-1">
              <Input
                placeholder="Min"
                value={filters.ticketMin}
                onChange={(e) => { setFilters(f => ({ ...f, ticketMin: e.target.value })); setPage(1); }}
                className="h-8 text-sm w-1/2"
                type="number"
              />
              <Input
                placeholder="Max"
                value={filters.ticketMax}
                onChange={(e) => { setFilters(f => ({ ...f, ticketMax: e.target.value })); setPage(1); }}
                className="h-8 text-sm w-1/2"
                type="number"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="rounded-md border border-border overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <SortableHeader column="nome_principal" className="w-[160px]">Nome</SortableHeader>
              <SortableHeader column="telefone" className="w-[120px]">Telefone</SortableHeader>
              <SortableHeader column="total_visitas" className="w-[80px] text-center">Visitas</SortableHeader>
              <SortableHeader column="valor_total_entrada" className="w-[110px] text-right">🎫 Entrada</SortableHeader>
              <SortableHeader column="valor_total_consumo" className="w-[110px] text-right">🍺 Consumo</SortableHeader>
              <SortableHeader column="ticket_medio_geral" className="w-[140px] text-center">Tickets</SortableHeader>
              <SortableHeader column="tempo_medio_estadia_minutos" className="w-[100px] text-center">⏱️ Tempo</SortableHeader>
              <SortableHeader column="ultima_visita" className="w-[110px] text-center">Última visita</SortableHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : paginatedClientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            ) : (
              paginatedClientes.map((cliente, index) => (
                <TableRow
                  key={`${cliente.identificador_principal}-${index}`}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onClienteSelect(cliente)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onClienteSelect(cliente)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                >
                  <TableCell className="font-medium truncate max-w-[160px]">{cliente.nome_principal}</TableCell>
                  <TableCell className="text-muted-foreground truncate max-w-[120px]">
                    {cliente.telefone ?? '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                      {cliente.visitas_formatadas ?? cliente.total_visitas}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(Number(cliente.valor_total_entrada) || 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(Number(cliente.valor_total_consumo) || 0)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col gap-0.5 items-center justify-center">
                      <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-xs font-semibold">
                        {formatCurrency(Number(cliente.ticket_medio_geral) || 0)}
                      </Badge>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px]">
                          🎫 {formatCurrency(Number(cliente.ticket_medio_entrada) || 0)}
                        </Badge>
                        <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 text-[10px]">
                          🍺 {formatCurrency(Number(cliente.ticket_medio_consumo) || 0)}
                        </Badge>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {cliente.tempo_medio_estadia_formatado && cliente.tempo_medio_estadia_formatado !== 'N/A' ? (
                      <div className="flex flex-col gap-0.5 items-center justify-center">
                        <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 text-xs">
                          {cliente.tempo_medio_estadia_formatado}
                        </Badge>
                        {cliente.total_visitas_com_tempo && cliente.total_visitas_com_tempo > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {cliente.total_visitas_com_tempo}/{cliente.total_visitas}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {formatDate(cliente.ultima_visita)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
            {!loading && paginatedClientes.length > 0 && (
              <>
                {' '}· Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, filteredAndSortedClientes.length)}
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' })
                setPage(Math.max(1, page - 1))
              }}
              disabled={page <= 1 || loading}
              className="h-8 w-8 p-0"
            >
              <span className="sr-only">Página anterior</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            {/* Números de página */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
                  <Button
                    key={pageNum}
                    type="button"
                    variant={page === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                      setPage(pageNum)
                    }}
                    disabled={loading}
                    className="h-8 w-8 p-0"
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' })
                setPage(Math.min(totalPages, page + 1))
              }}
              disabled={page >= totalPages || loading}
              className="h-8 w-8 p-0"
            >
              <span className="sr-only">Próxima página</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
