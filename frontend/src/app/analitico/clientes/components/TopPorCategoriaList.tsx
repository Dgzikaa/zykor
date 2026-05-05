'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Beer, Download, Star, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Categoria {
  nome: string
  clientes: number
  qtd_total: number
}

interface ClienteCategoria {
  nome: string
  telefone: string
  qtd_categoria: number
  vezes_pediu: number
  produtos_distintos: number
  top_produto_categoria: string
  total_visitas: number
  ultima_visita: string | null
  dias_desde_ultima_visita: number | null
  status: 'novo' | 'ativo' | 'dormente' | 'churn'
  eh_vip: boolean
  ticket_medio: number
  cliente_dtnasc: string | null
}

function formatTelefone(t: string): string {
  if (!t) return ''
  const d = t.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return t
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

export function TopPorCategoriaList() {
  const { toast } = useToast()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaSel, setCategoriaSel] = useState<string>('')
  const [limit, setLimit] = useState<number>(100)
  const [clientes, setClientes] = useState<ClienteCategoria[]>([])
  const [loading, setLoading] = useState(false)
  const [busca, setBusca] = useState('')

  // Carregar categorias na primeira vez
  useEffect(() => {
    fetch('/api/analitico/clientes-por-categoria?categoria=__listar__')
      .then(r => r.json())
      .then(json => {
        const cats = json.categorias || []
        setCategorias(cats)
        if (cats.length > 0 && !categoriaSel) setCategoriaSel(cats[0].nome)
      })
      .catch((e) => toast({ title: 'Erro', description: 'Falha ao carregar categorias', variant: 'destructive' }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const carregarClientes = useCallback(async () => {
    if (!categoriaSel) return
    setLoading(true)
    try {
      const resp = await fetch(`/api/analitico/clientes-por-categoria?categoria=${encodeURIComponent(categoriaSel)}&limit=${limit}`)
      if (!resp.ok) throw new Error('Falha')
      const json = await resp.json()
      setClientes(json.clientes || [])
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [categoriaSel, limit, toast])

  useEffect(() => { carregarClientes() }, [carregarClientes])

  const filtrados = clientes.filter(c => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return c.nome.toLowerCase().includes(q) || c.telefone.includes(q.replace(/\D/g, ''))
  })

  const exportarCSV = () => {
    const linhas = [
      ['Ranking', 'Nome', 'Telefone', `Qtd ${categoriaSel}`, 'Vezes pediu', 'Top produto', 'Total visitas', 'Status', 'VIP', 'Ticket médio'].join(','),
      ...filtrados.map((c, i) => [
        i + 1,
        `"${c.nome.replace(/"/g, '""')}"`,
        c.telefone,
        c.qtd_categoria,
        c.vezes_pediu,
        `"${(c.top_produto_categoria || '').replace(/"/g, '""')}"`,
        c.total_visitas,
        c.status,
        c.eh_vip ? 'sim' : 'nao',
        Number(c.ticket_medio || 0).toFixed(2),
      ].join(',')),
    ]
    const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `top-${categoriaSel.toLowerCase().replace(/\s+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={categoriaSel} onValueChange={setCategoriaSel}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Selecione uma categoria" />
          </SelectTrigger>
          <SelectContent className="max-h-96">
            {categorias.map(c => (
              <SelectItem key={c.nome} value={c.nome}>
                {c.nome} <span className="text-xs text-muted-foreground ml-1">({c.clientes.toLocaleString('pt-BR')} clientes)</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(limit)} onValueChange={(v) => setLimit(parseInt(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">Top 50</SelectItem>
            <SelectItem value="100">Top 100</SelectItem>
            <SelectItem value="200">Top 200</SelectItem>
            <SelectItem value="500">Top 500</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nome ou telefone..."
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

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Carregando ranking...</span>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Beer className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <div>Nenhum cliente encontrado.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14 text-center">#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Vezes</TableHead>
                    <TableHead>Top produto</TableHead>
                    <TableHead className="text-right">Visitas</TableHead>
                    <TableHead>Última visita</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ticket médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((c, idx) => (
                    <TableRow key={`${c.telefone}-${idx}`}>
                      <TableCell className="text-center font-bold text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {c.eh_vip && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                          <span className="font-medium">{c.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{formatTelefone(c.telefone)}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">{Math.round(Number(c.qtd_categoria))}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{c.vezes_pediu}</TableCell>
                      <TableCell className="text-sm truncate max-w-[200px]" title={c.top_produto_categoria}>
                        {c.top_produto_categoria || '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.total_visitas}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.ultima_visita ? new Date(c.ultima_visita + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}
                      </TableCell>
                      <TableCell>{statusBadge(c.status)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        R$ {Number(c.ticket_medio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
