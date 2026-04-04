'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import PageHeader from '@/components/layouts/PageHeader';

interface Lancamento {
  id: number;
  contaazul_id: string;
  tipo: string;
  status: string;
  status_traduzido: string | null;
  descricao: string | null;
  pessoa_nome: string | null;
  categoria_nome: string | null;
  centro_custo_nome: string | null;
  valor_bruto: number;
  valor_pago: number;
  valor_nao_pago: number;
  data_vencimento: string | null;
  data_competencia: string | null;
  data_pagamento: string | null;
}

interface Totalizadores {
  total_bruto: number;
  total_pago: number;
  valor_pendente: number;
  count_receitas: number;
  count_despesas: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
}

function getStatusBadge(status: string, statusTraduzido: string | null) {
  const st = (statusTraduzido || status || '').toUpperCase();
  
  if (st.includes('RECEBIDO') || st === 'ACQUITTED' || st === 'PAGO') {
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Pago</Badge>;
  }
  if (st.includes('PENDENTE') || st === 'PENDING') {
    return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Pendente</Badge>;
  }
  if (st.includes('ATRASADO') || st === 'OVERDUE') {
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Atrasado</Badge>;
  }
  
  return <Badge variant="outline">{statusTraduzido || status}</Badge>;
}

function getFirstDayOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
}

function getLastDayOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
}

export default function ContaAzulPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [totalizadores, setTotalizadores] = useState<Totalizadores | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  const [dataVencimentoDe, setDataVencimentoDe] = useState(getFirstDayOfMonth());
  const [dataVencimentoAte, setDataVencimentoAte] = useState(getLastDayOfMonth());
  const [tipoFilter, setTipoFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busca, setBusca] = useState('');

  const fetchLancamentos = useCallback(async () => {
    if (!barId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        bar_id: String(barId),
        page: String(page),
        limit: String(limit),
      });

      if (tipoFilter) params.append('tipo', tipoFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (dataVencimentoDe) params.append('data_vencimento_de', dataVencimentoDe);
      if (dataVencimentoAte) params.append('data_vencimento_ate', dataVencimentoAte);
      if (busca) params.append('busca', busca);

      const response = await fetch(`/api/financeiro/contaazul/lancamentos?${params}`);
      
      if (!response.ok) {
        throw new Error('Erro ao buscar lançamentos');
      }

      const data = await response.json();
      setLancamentos(data.lancamentos || []);
      setTotal(data.total || 0);
      setTotalizadores(data.totalizadores || null);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  }, [barId, page, limit, tipoFilter, statusFilter, dataVencimentoDe, dataVencimentoAte, busca]);

  useEffect(() => {
    fetchLancamentos();
  }, [fetchLancamentos]);

  const handleSync = async () => {
    if (!barId) return;
    
    setSyncing(true);
    try {
      const response = await fetch('/api/financeiro/contaazul/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: barId,
          sync_mode: 'daily_incremental'
        })
      });

      if (response.ok) {
        await fetchLancamentos();
      }
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleClearFilters = () => {
    setTipoFilter('');
    setStatusFilter('');
    setDataVencimentoDe(getFirstDayOfMonth());
    setDataVencimentoAte(getLastDayOfMonth());
    setBusca('');
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Lançamentos Conta Azul"
        description="Visualize e gerencie os lançamentos financeiros sincronizados do Conta Azul"
      />

      {totalizadores && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bruto</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalizadores.total_bruto)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receitas</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totalizadores.count_receitas}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Despesas</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{totalizadores.count_despesas}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendente</CardTitle>
              <DollarSign className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{formatCurrency(totalizadores.valor_pendente)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filtros</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
              >
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Sincronizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Data Vencimento De</Label>
              <Input
                type="date"
                value={dataVencimentoDe}
                onChange={(e) => setDataVencimentoDe(e.target.value)}
              />
            </div>
            <div>
              <Label>Data Vencimento Até</Label>
              <Input
                type="date"
                value={dataVencimentoAte}
                onChange={(e) => setDataVencimentoAte(e.target.value)}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="RECEITA">Receitas</SelectItem>
                  <SelectItem value="DESPESA">Despesas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="ACQUITTED">Pago</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="OVERDUE">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição ou fornecedor..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lançamentos ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : lancamentos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum lançamento encontrado
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data Venc.</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Fornecedor/Cliente</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead className="text-right">Pendente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lancamentos.map((lanc) => (
                      <TableRow key={lanc.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(lanc.data_vencimento)}
                        </TableCell>
                        <TableCell>
                          {lanc.tipo === 'RECEITA' ? (
                            <Badge className="bg-green-100 text-green-800">Receita</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">Despesa</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(lanc.status, lanc.status_traduzido)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {lanc.descricao || '-'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {lanc.pessoa_nome || '-'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {lanc.categoria_nome || '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(lanc.valor_bruto)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(lanc.valor_pago)}
                        </TableCell>
                        <TableCell className="text-right text-yellow-600">
                          {formatCurrency(lanc.valor_nao_pago)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {((page - 1) * limit) + 1} a {Math.min(page * limit, total)} de {total} lançamentos
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center px-3 text-sm">
                    Página {page} de {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
