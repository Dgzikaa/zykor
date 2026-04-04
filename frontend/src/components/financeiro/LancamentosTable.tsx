'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ChevronUp, ChevronDown } from 'lucide-react';

export interface Lancamento {
  id: number;
  contaazul_id: string;
  tipo: string;
  status: string;
  descricao: string | null;
  pessoa_nome: string | null;
  categoria_nome: string | null;
  centro_custo_nome: string | null;
  valor_bruto: number;
  valor_liquido: number | null;
  valor_pago: number;
  data_vencimento: string | null;
  data_competencia: string | null;
  data_pagamento: string | null;
  conta_financeira_nome: string | null;
  metodo_pagamento: string | null;
}

interface LancamentosTableProps {
  data: Lancamento[];
  loading?: boolean;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
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

function getStatusBadge(status: string) {
  const st = (status || '').toUpperCase();
  
  if (st === 'QUITADO' || st === 'PAGO' || st === 'RECEBIDO') {
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Pago</Badge>;
  }
  if (st === 'PENDENTE' || st === 'EM_ABERTO') {
    return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Pendente</Badge>;
  }
  if (st === 'ATRASADO') {
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Atrasado</Badge>;
  }
  if (st === 'CANCELADO' || st === 'PERDIDO') {
    return <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">Cancelado</Badge>;
  }
  if (st === 'RECEBIDO_PARCIAL') {
    return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Parcial</Badge>;
  }
  if (st === 'RENEGOCIADO') {
    return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">Renegociado</Badge>;
  }
  
  return <Badge variant="outline">{status}</Badge>;
}

function truncateText(text: string | null, maxLength: number): string {
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function SortHeader({ 
  column, 
  label, 
  sortColumn, 
  sortDirection, 
  onSort 
}: { 
  column: string; 
  label: string; 
  sortColumn?: string; 
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
}) {
  const isActive = sortColumn === column;
  
  return (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => onSort?.(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive && (
          sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
        )}
      </div>
    </TableHead>
  );
}

export function LancamentosTable({ 
  data, 
  loading = false,
  sortColumn,
  sortDirection,
  onSort
}: LancamentosTableProps) {
  
  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: 11 }).map((_, i) => (
                <TableHead key={i}><Skeleton className="h-4 w-20" /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 11 }).map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">Nenhum lancamento encontrado</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
              <SortHeader column="descricao" label="Descricao" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
              <SortHeader column="pessoa_nome" label="Fornecedor" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
              <TableHead>Categoria</TableHead>
              <TableHead>Centro Custo</TableHead>
              <SortHeader column="valor_bruto" label="Valor Bruto" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
              <TableHead>Valor Liquido</TableHead>
              <SortHeader column="data_vencimento" label="Vencimento" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
              <SortHeader column="data_competencia" label="Competencia" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
              <TableHead>Pagamento</TableHead>
              <TableHead>Conta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{getStatusBadge(item.status)}</TableCell>
                <TableCell>
                  {item.descricao && item.descricao.length > 50 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">{truncateText(item.descricao, 50)}</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md">
                        <p>{item.descricao}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    truncateText(item.descricao, 50)
                  )}
                </TableCell>
                <TableCell>{item.pessoa_nome || '-'}</TableCell>
                <TableCell>{truncateText(item.categoria_nome, 25)}</TableCell>
                <TableCell>{truncateText(item.centro_custo_nome, 20)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(item.valor_bruto)}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.valor_liquido)}</TableCell>
                <TableCell>{formatDate(item.data_vencimento)}</TableCell>
                <TableCell>{formatDate(item.data_competencia)}</TableCell>
                <TableCell>{formatDate(item.data_pagamento)}</TableCell>
                <TableCell>{truncateText(item.conta_financeira_nome, 15)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}

export default LancamentosTable;