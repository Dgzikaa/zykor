'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Banknote, Edit, FileText, Loader2, Trash2 } from 'lucide-react';
import type { PagamentoAgendamento } from '../types';

function formatarDocumento(valor: string): string {
  const apenasDigitos = valor.replace(/\D/g, '');

  if (apenasDigitos.length <= 11) {
    return apenasDigitos
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  return apenasDigitos
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function getStatusBadge(status: PagamentoAgendamento['status']) {
  switch (status) {
    case 'pendente':
      return (
        <Badge
          variant="secondary"
          className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
        >
          Pendente
        </Badge>
      );
    case 'agendado':
      return (
        <Badge
          variant="secondary"
          className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
        >
          Agendado
        </Badge>
      );
    case 'aguardando_aprovacao':
      return (
        <Badge
          variant="secondary"
          className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
        >
          Aguardando Aprovação
        </Badge>
      );
    case 'aprovado':
      return (
        <Badge
          variant="secondary"
          className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
        >
          Aprovado
        </Badge>
      );
    case 'erro':
      return (
        <Badge
          variant="secondary"
          className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
        >
          Erro
        </Badge>
      );
    case 'erro_inter':
      return (
        <Badge
          variant="secondary"
          className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
        >
          Inter ❌
        </Badge>
      );
    default:
      return <Badge variant="secondary">Desconhecido</Badge>;
  }
}

export interface PagamentosListProps {
  pagamentos: PagamentoAgendamento[];
  onEditar: (id: string) => void;
  onExcluir: (id: string) => void;
  onEnviarPix: (id: string) => void;
  isProcessing: boolean;
  pagandoPixId: string | null;
}

export function PagamentosList({
  pagamentos,
  onEditar,
  onExcluir,
  onEnviarPix,
  isProcessing,
  pagandoPixId,
}: PagamentosListProps) {
  if (pagamentos.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">
          Nenhum pagamento na lista
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Adicione pagamentos manualmente para começar
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
      <Table>
        <TableHeader>
          <TableRow animated={false}>
            <TableHead>Nome</TableHead>
            <TableHead>CPF/CNPJ</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Centro de custo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right w-[1%] whitespace-nowrap">
              Ações
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagamentos.map(pagamento => {
            const enviandoEste =
              pagandoPixId !== null && pagandoPixId === pagamento.id;

            return (
              <TableRow key={pagamento.id} animated={false}>
                <TableCell className="font-medium text-gray-900 dark:text-white max-w-[200px]">
                  <span className="line-clamp-2">{pagamento.nome_beneficiario}</span>
                </TableCell>
                <TableCell className="text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {pagamento.cpf_cnpj
                    ? formatarDocumento(pagamento.cpf_cnpj)
                    : 'Não informado'}
                </TableCell>
                <TableCell className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                  {pagamento.valor}
                </TableCell>
                <TableCell className="text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {new Date(pagamento.data_pagamento).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell className="text-gray-700 dark:text-gray-300">
                  {pagamento.categoria_nome || 'N/A'}
                </TableCell>
                <TableCell className="text-gray-700 dark:text-gray-300">
                  {pagamento.centro_custo_nome || 'N/A'}
                </TableCell>
                <TableCell>{getStatusBadge(pagamento.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      title="Editar"
                      disabled={isProcessing}
                      onClick={() => onEditar(pagamento.id)}
                    >
                      <Edit className="w-4 h-4" />
                      <span className="sr-only">Editar</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 w-8 p-0 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white"
                      title="Excluir"
                      disabled={isProcessing}
                      onClick={() => onExcluir(pagamento.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="sr-only">Excluir</span>
                    </Button>
                    {pagamento.status === 'agendado' && (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 gap-1 px-2 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white"
                        title="Enviar PIX pelo Inter"
                        disabled={isProcessing}
                        onClick={() => onEnviarPix(pagamento.id)}
                      >
                        {enviandoEste ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Banknote className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">Inter</span>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
