'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Cake, Download, Star, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { apiCall } from '@/lib/api-client'

interface ProdutoFavorito {
  produto: string
  categoria?: string
  quantidade: number
  vezes_pediu?: number
}

interface Aniversariante {
  nome: string
  telefone: string
  dtnasc: string
  dia: number
  mes: number
  total_visitas: number
  ultima_visita: string | null
  dias_desde_ultima_visita: number | null
  status: 'novo' | 'ativo' | 'dormente' | 'churn'
  eh_vip: boolean
  ticket_medio: number
  gasto_total: number
  produtos_favoritos: ProdutoFavorito[]
}

interface ApiResponse {
  mes: number
  total: number
  total_ativos: number
  total_vip: number
  aniversariantes: Aniversariante[]
}

const MESES = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' }, { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' }, { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' },
]

function formatTelefone(t: string): string {
  if (!t) return ''
  const d = t.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return t
}

function formatDataAniv(dia: number, mes: number): string {
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    novo:     { label: 'Novo',     className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    ativo:    { label: 'Ativo',    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    dormente: { label: 'Dormente', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    churn:    { label: 'Churn',    className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  }
  const cfg = map[status] || { label: status, className: 'bg-gray-100 text-gray-700' }
  return <Badge className={`${cfg.className} border-0 text-xs`}>{cfg.label}</Badge>
}

export function AniversariantesList() {
  const { toast } = useToast()
  const hoje = new Date()
  const [mes, setMes] = useState<number>(hoje.getMonth() + 1)
  const [dados, setDados] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [busca, setBusca] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const json: ApiResponse = await apiCall(`/api/analitico/aniversariantes?mes=${mes}`)
      setDados(json)
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Falha', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [mes, toast])

  useEffect(() => { carregar() }, [carregar])

  const filtrados = (dados?.aniversariantes || []).filter(a => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return a.nome.toLowerCase().includes(q) || a.telefone.includes(q.replace(/\D/g, ''))
  })

  const exportarCSV = () => {
    const linhas = [
      ['Dia', 'Nome', 'Telefone', 'Total Visitas', 'Última Visita', 'Status', 'VIP', 'Ticket Médio'].join(','),
      ...filtrados.map(a => [
        formatDataAniv(a.dia, a.mes),
        `"${a.nome.replace(/"/g, '""')}"`,
        a.telefone,
        a.total_visitas,
        a.ultima_visita || '',
        a.status,
        a.eh_vip ? 'sim' : 'nao',
        a.ticket_medio.toFixed(2),
      ].join(',')),
    ]
    const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const nomeMes = MESES.find(m => m.value === mes)?.label || `mes-${mes}`
    a.download = `aniversariantes-${nomeMes.toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={String(mes)} onValueChange={(v) => setMes(parseInt(v))}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MESES.map(m => (
              <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        <Button variant="outline" size="sm" onClick={exportarCSV} disabled={!filtrados.length}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {dados && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total aniversariantes</div>
            <div className="text-2xl font-bold">{dados.total.toLocaleString('pt-BR')}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Ativos (visitaram &lt;30d)</div>
            <div className="text-2xl font-bold text-green-600">{dados.total_ativos.toLocaleString('pt-BR')}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">VIPs</div>
            <div className="text-2xl font-bold text-amber-600">{dados.total_vip.toLocaleString('pt-BR')}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Mostrando</div>
            <div className="text-2xl font-bold">{filtrados.length.toLocaleString('pt-BR')}</div>
          </CardContent></Card>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Carregando aniversariantes...</span>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Cake className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <div>Nenhum aniversariante encontrado.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Dia</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="text-right">Visitas</TableHead>
                    <TableHead>Última visita</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ticket médio</TableHead>
                    <TableHead>Top produtos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((a, idx) => (
                    <TableRow key={`${a.telefone}-${idx}`}>
                      <TableCell className="font-mono font-semibold">
                        {formatDataAniv(a.dia, a.mes)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {a.eh_vip && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                          <span>{a.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{formatTelefone(a.telefone)}</TableCell>
                      <TableCell className="text-right font-semibold">{a.total_visitas}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.ultima_visita ? new Date(a.ultima_visita + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}
                        {a.dias_desde_ultima_visita !== null && a.dias_desde_ultima_visita >= 0 && (
                          <span className="ml-1 text-xs">({a.dias_desde_ultima_visita}d)</span>
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(a.status)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        R$ {a.ticket_medio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {a.produtos_favoritos.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-xs space-y-0.5 cursor-help">
                                  {a.produtos_favoritos.slice(0, 3).map((p, i) => (
                                    <div key={i} className="flex items-center gap-1.5 truncate">
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-mono shrink-0">{p.quantidade}x</Badge>
                                      <span className="truncate">{p.produto}</span>
                                    </div>
                                  ))}
                                  {a.produtos_favoritos.length > 3 && (
                                    <div className="text-[10px] text-muted-foreground pl-1">+{a.produtos_favoritos.length - 3} outros</div>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-md">
                                <div className="space-y-1">
                                  <div className="font-semibold mb-1">Top {a.produtos_favoritos.length} produtos</div>
                                  {a.produtos_favoritos.map((p, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                      <span className="font-mono text-muted-foreground w-12">{p.quantidade}x</span>
                                      <span className="flex-1">{p.produto}</span>
                                      {p.categoria && <span className="text-[10px] text-muted-foreground">{p.categoria}</span>}
                                    </div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
