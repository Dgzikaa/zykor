'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
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
        <Table className="table-fixed w-full">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-semibold w-[140px]">Nome</TableHead>
              <TableHead className="font-semibold w-[110px]">Telefone</TableHead>
              <TableHead className="font-semibold w-[70px] [&>div]:justify-center">Visitas</TableHead>
              <TableHead className="font-semibold w-[100px] pr-4 [&>div]:justify-end">🎫 Entrada</TableHead>
              <TableHead className="font-semibold w-[100px] pr-4 [&>div]:justify-end">🍺 Consumo</TableHead>
              <TableHead className="font-semibold w-[160px] [&>div]:justify-center">Tickets</TableHead>
              <TableHead className="font-semibold w-[110px] [&>div]:justify-center">⏱️ Tempo Médio</TableHead>
              <TableHead className="font-semibold w-[160px]">🍺 Bebida fav</TableHead>
              <TableHead className="font-semibold w-[160px]">🍴 Comida fav</TableHead>
              <TableHead className="font-semibold w-[100px] [&>div]:justify-center">Última visita</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : clientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
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
                  <TableCell className="w-[140px] font-medium truncate">{cliente.nome_principal}</TableCell>
                  <TableCell className="w-[110px] text-muted-foreground truncate">
                    {cliente.telefone ?? '—'}
                  </TableCell>
                  <TableCell className="w-[70px] text-center">
                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                      {cliente.visitas_formatadas ?? cliente.total_visitas}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-[100px] text-right tabular-nums pr-4">
                    {formatCurrency(Number(cliente.valor_total_entrada) || 0)}
                  </TableCell>
                  <TableCell className="w-[100px] text-right tabular-nums pr-4">
                    {formatCurrency(Number(cliente.valor_total_consumo) || 0)}
                  </TableCell>
                  <TableCell className="w-[160px] text-center">
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
                  <TableCell className="w-[110px] text-center">
                    {cliente.tempo_medio_estadia_formatado && cliente.tempo_medio_estadia_formatado !== 'N/A' ? (
                      <div className="flex flex-col gap-0.5 items-center justify-center">
                        <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 text-xs">
                          {cliente.tempo_medio_estadia_formatado}
                        </Badge>
                        {(cliente.total_visitas_com_tempo ?? 0) > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {cliente.total_visitas_com_tempo}/{cliente.total_visitas}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="w-[160px]">
                    {cliente.bebida_favorita?.produto ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-mono shrink-0 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                          {Math.round(Number(cliente.bebida_favorita.quantidade))}x
                        </Badge>
                        <span className="truncate" title={`${cliente.bebida_favorita.produto} — ${cliente.bebida_favorita.vezes_pediu} vezes`}>
                          {cliente.bebida_favorita.produto}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="w-[160px]">
                    {cliente.comida_favorita?.produto ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-mono shrink-0 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800">
                          {Math.round(Number(cliente.comida_favorita.quantidade))}x
                        </Badge>
                        <span className="truncate" title={`${cliente.comida_favorita.produto} — ${cliente.comida_favorita.vezes_pediu} vezes`}>
                          {cliente.comida_favorita.produto}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="w-[100px] text-center text-muted-foreground">
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
