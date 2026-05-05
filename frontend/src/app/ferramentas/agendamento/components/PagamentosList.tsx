'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
    case 'erro_ca':
      return (
        <Badge
          variant="secondary"
          className="bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400"
        >
          Conta Azul ❌
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
  onExcluirMultiplos?: (ids: string[]) => void;
  onEnviarPix: (id: string) => void;
  isProcessing: boolean;
  pagandoPixId: string | null;
}

export function PagamentosList({
  pagamentos,
  onEditar,
  onExcluir,
  onExcluirMultiplos,
  onEnviarPix,
  isProcessing,
  pagandoPixId,
}: PagamentosListProps) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // Limpa seleção quando a lista muda (ex: após apagar)
  useEffect(() => {
    setSelecionados(prev => {
      const next = new Set<string>();
      const ids = new Set(pagamentos.map(p => p.id));
      prev.forEach(id => { if (ids.has(id)) next.add(id); });
      return next;
    });
  }, [pagamentos]);

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

  const todosSelecionados =
    pagamentos.length > 0 && selecionados.size === pagamentos.length;

  const toggleTodos = () => {
    setSelecionados(prev =>
      prev.size === pagamentos.length
        ? new Set()
        : new Set(pagamentos.map(p => p.id))
    );
  };

  const toggleUm = (id: string) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const apagarSelecionados = () => {
    if (selecionados.size === 0) return;
    const ids = Array.from(selecionados);
    if (onExcluirMultiplos) {
      onExcluirMultiplos(ids);
    } else {
      ids.forEach(id => onExcluir(id));
    }
    setSelecionados(new Set());
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {selecionados.size > 0
            ? `${selecionados.size} selecionado${selecionados.size > 1 ? 's' : ''} de ${pagamentos.length}`
            : `${pagamentos.length} pagamento${pagamentos.length > 1 ? 's' : ''}`}
        </span>
        {selecionados.size > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={apagarSelecionados}
            disabled={isProcessing}
            className="h-7 text-xs gap-1 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
          >
            <Trash2 className="w-3 h-3" />
            Apagar selecionados ({selecionados.size})
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
      <Table>
        <TableHeader>
          <TableRow animated={false}>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={todosSelecionados}
                onCheckedChange={toggleTodos}
                aria-label="Selecionar todos"
              />
            </TableHead>
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
              <TableRow
                key={pagamento.id}
                animated={false}
                data-state={selecionados.has(pagamento.id) ? 'selected' : undefined}
              >
                <TableCell className="w-[40px]">
                  <Checkbox
                    checked={selecionados.has(pagamento.id)}
                    onCheckedChange={() => toggleUm(pagamento.id)}
                    aria-label={`Selecionar ${pagamento.nome_beneficiario}`}
                  />
                </TableCell>
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
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {getStatusBadge(pagamento.status)}
                    {pagamento.erro_mensagem && (
                      <span
                        className="text-[10px] text-red-600 dark:text-red-400 max-w-[180px] line-clamp-2"
                        title={pagamento.erro_mensagem}
                      >
                        {pagamento.erro_mensagem}
                      </span>
                    )}
                    {pagamento.contaazul_lancamento_id && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        CA: {pagamento.contaazul_lancamento_id.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                </TableCell>
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
                    {(pagamento.status === 'pendente' ||
                      pagamento.status === 'agendado' ||
                      pagamento.status === 'erro_ca' ||
                      pagamento.status === 'erro_inter') && (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 gap-1 px-2 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white"
                        title="Processar (Conta Azul + Inter PIX)"
                        disabled={isProcessing}
                        onClick={() => onEnviarPix(pagamento.id)}
                      >
                        {enviandoEste ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Banknote className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">
                          {pagamento.status === 'erro_ca' ||
                          pagamento.status === 'erro_inter'
                            ? 'Reenviar'
                            : 'Pagar'}
                        </span>
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
    </div>
  );
}
