'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

export interface ClientesListProps {
  clientes: Cliente[]
  busca: string
  onBuscaChange: (value: string) => void
  onClienteSelect: (cliente: Cliente) => void
  loading: boolean
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function ClientesList({
  clientes,
  busca,
  onBuscaChange,
  onClienteSelect,
  loading,
  page,
  totalPages,
  onPageChange,
}: ClientesListProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          type="search"
          placeholder="Buscar cliente..."
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          className="w-full sm:max-w-sm"
          aria-label="Buscar cliente"
        />
      </div>

      <div className="rounded-md border border-border overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-semibold">Nome</TableHead>
              <TableHead className="font-semibold">Telefone</TableHead>
              <TableHead className="font-semibold">E-mail</TableHead>
              <TableHead className="font-semibold text-center">Visitas</TableHead>
              <TableHead className="font-semibold text-right">Valor gasto</TableHead>
              <TableHead className="font-semibold text-right">Ticket médio</TableHead>
              <TableHead className="font-semibold text-center">Última visita</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : clientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            ) : (
              clientes.map((cliente, index) => (
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
                  <TableCell className="font-medium">{cliente.nome_principal}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {cliente.telefone ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {cliente.email ?? '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    {cliente.visitas_formatadas ?? cliente.total_visitas}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(Number(cliente.valor_total_gasto) || 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(Number(cliente.ticket_medio_geral) || 0)}
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

      {totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
            {!loading && clientes.length > 0 && (
              <>
                {' '}
                · {clientes.length}{' '}
                {clientes.length === 1 ? 'cliente nesta página' : 'clientes nesta página'}
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
                onPageChange(Math.max(1, page - 1))
              }}
              disabled={page <= 1 || loading}
              className="h-8 w-8 p-0"
            >
              <span className="sr-only">Página anterior</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' })
                onPageChange(Math.min(totalPages, page + 1))
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
