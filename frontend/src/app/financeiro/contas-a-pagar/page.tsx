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
import { LancamentosTable, Lancamento } from '@/components/financeiro/LancamentosTable';
import { 
  DollarSign, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  Download,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import PageHeader from '@/components/layouts/PageHeader';

interface Totalizadores {
  total_bruto: number;
  total_liquido: number;
  total_pago: number;
  valor_pendente: number;
  valor_atrasado: number;
  count_pendente: number;
  count_pago: number;
  count_atrasado: number;
  count_cancelado: number;
  count_parcial: number;
}

interface Categoria {
  id: number;
  nome: string;
}

interface CentroCusto {
  id: number;
  nome: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function getFirstDayOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
}

function getLastDayOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
}

export default function ContasAPagarPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [totalizadores, setTotalizadores] = useState<Totalizadores | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  const [dataVencimentoDe, setDataVencimentoDe] = useState(getFirstDayOfMonth());
  const [dataVencimentoAte, setDataVencimentoAte] = useState(getLastDayOfMonth());
  const [dataCompetenciaDe, setDataCompetenciaDe] = useState('');
  const [dataCompetenciaAte, setDataCompetenciaAte] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [centroCustoFilter, setCentroCustoFilter] = useState('');
  const [busca, setBusca] = useState('');
  const [sortColumn, setSortColumn] = useState('data_vencimento');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);

  const fetchLancamentos = useCallback(async () => {
    if (!barId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        bar_id: String(barId),
        tipo: 'DESPESA',
        page: String(page),
        limit: String(limit),
        ordenar: sortColumn,
        ordem: sortDirection
      });

      if (dataVencimentoDe) params.set('data_vencimento_de', dataVencimentoDe);
      if (dataVencimentoAte) params.set('data_vencimento_ate', dataVencimentoAte);
      if (dataCompetenciaDe) params.set('data_competencia_de', dataCompetenciaDe);
      if (dataCompetenciaAte) params.set('data_competencia_ate', dataCompetenciaAte);
      if (statusFilter) params.set('status', statusFilter);
      if (categoriaFilter) params.set('categoria', categoriaFilter);
      if (centroCustoFilter) params.set('centro_custo', centroCustoFilter);
      if (busca) params.set('busca', busca);

      const res = await fetch('/api/financeiro/contaazul/lancamentos?' + params.toString());
      const data = await res.json();

      if (res.ok) {
        setLancamentos(data.data || []);
        setTotal(data.total || 0);
        setTotalizadores(data.totalizadores || null);
      }
    } catch (err) {
      console.error('Erro ao buscar lancamentos:', err);
    } finally {
      setLoading(false);
    }
  }, [barId, page, limit, dataVencimentoDe, dataVencimentoAte, dataCompetenciaDe, dataCompetenciaAte, statusFilter, categoriaFilter, centroCustoFilter, busca, sortColumn, sortDirection]);

  const fetchFiltros = useCallback(async () => {
    if (!barId) return;

    try {
      const [catRes, ccRes] = await Promise.all([
        fetch('/api/financeiro/contaazul/categorias?bar_id=' + barId),
        fetch('/api/financeiro/contaazul/centros-custo?bar_id=' + barId)
      ]);

      if (catRes.ok) {
        const catData = await catRes.json();
        setCategorias(catData.data || []);
      }
      if (ccRes.ok) {
        const ccData = await ccRes.json();
        setCentrosCusto(ccData.data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar filtros:', err);
    }
  }, [barId]);

  useEffect(() => {
    fetchLancamentos();
  }, [fetchLancamentos]);

  useEffect(() => {
    fetchFiltros();
  }, [fetchFiltros]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
    setPage(1);
  };

  const clearFilters = () => {
    setDataVencimentoDe(getFirstDayOfMonth());
    setDataVencimentoAte(getLastDayOfMonth());
    setDataCompetenciaDe('');
    setDataCompetenciaAte('');
    setStatusFilter('');
    setCategoriaFilter('');
    setCentroCustoFilter('');
    setBusca('');
    setPage(1);
  };

  const exportCSV = () => {
    const headers = ['Status', 'Descricao', 'Fornecedor', 'Categoria', 'Centro Custo', 'Valor Bruto', 'Valor Liquido', 'Vencimento', 'Competencia', 'Pagamento', 'Conta'];
    const rows = lancamentos.map(l => [
      l.status,
      l.descricao || '',
      l.pessoa_nome || '',
      l.categoria_nome || '',
      l.centro_custo_nome || '',
      l.valor_bruto,
      l.valor_liquido || '',
      l.data_vencimento || '',
      l.data_competencia || '',
      l.data_pagamento || '',
      l.conta_financeira_nome || ''
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'contas-a-pagar-' + new Date().toISOString().split('T')[0] + '.csv';
    link.click();
  };

  const totalPages = Math.ceil(total / limit);

  if (!barId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Selecione um bar para visualizar as contas a pagar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a Pagar"
        description="Gerencie suas despesas com visibilidade completa de vencimento e competencia"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Aberto</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(totalizadores?.valor_pendente || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalizadores?.count_pendente || 0} lancamentos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pago</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalizadores?.total_pago || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalizadores?.count_pago || 0} lancamentos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atrasado</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totalizadores?.valor_atrasado || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalizadores?.count_atrasado || 0} lancamentos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Geral</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalizadores?.total_bruto || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {total} lancamentos no periodo
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Vencimento De</Label>
              <Input
                type="date"
                value={dataVencimentoDe}
                onChange={(e) => { setDataVencimentoDe(e.target.value); setPage(1); }}
              />
            </div>
            <div className="space-y-2">
              <Label>Vencimento Ate</Label>
              <Input
                type="date"
                value={dataVencimentoAte}
                onChange={(e) => { setDataVencimentoAte(e.target.value); setPage(1); }}
              />
            </div>
            <div className="space-y-2">
              <Label>Competencia De</Label>
              <Input
                type="date"
                value={dataCompetenciaDe}
                onChange={(e) => { setDataCompetenciaDe(e.target.value); setPage(1); }}
              />
            </div>
            <div className="space-y-2">
              <Label>Competencia Ate</Label>
              <Input
                type="date"
                value={dataCompetenciaAte}
                onChange={(e) => { setDataCompetenciaAte(e.target.value); setPage(1); }}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="PENDENTE,EM_ABERTO">Em Aberto</SelectItem>
                  <SelectItem value="QUITADO,PAGO,RECEBIDO">Pago</SelectItem>
                  <SelectItem value="ATRASADO">Atrasado</SelectItem>
                  <SelectItem value="CANCELADO,PERDIDO">Cancelado</SelectItem>
                  <SelectItem value="RECEBIDO_PARCIAL">Parcial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoriaFilter} onValueChange={(v) => { setCategoriaFilter(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.nome}>{cat.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Centro de Custo</Label>
              <Select value={centroCustoFilter} onValueChange={(v) => { setCentroCustoFilter(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {centrosCusto.map((cc) => (
                    <SelectItem key={cc.id} value={cc.nome}>{cc.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Busca</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Descricao ou fornecedor..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchLancamentos(); } }}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lancamentos</CardTitle>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <LancamentosTable
            data={lancamentos}
            loading={loading}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {((page - 1) * limit) + 1} a {Math.min(page * limit, total)} de {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Pagina {page} de {totalPages}
                </span>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}