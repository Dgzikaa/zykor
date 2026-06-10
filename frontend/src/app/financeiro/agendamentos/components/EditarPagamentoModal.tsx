'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PagamentoAgendamento } from '../types';

export interface EditarPagamentoModalProps {
  /** Pagamento em edição; null = modal fechado. */
  pagamento: PagamentoAgendamento | null;
  onClose: () => void;
  onSalvar: (id: string, campos: Partial<PagamentoAgendamento>) => void;
}

/**
 * Edição de um pagamento da lista (nome, chave PIX, valor, data, doc, descrição).
 * Usado pra corrigir uma chave errada / dados e reenviar. Ao salvar, o pai reseta
 * o status pra "pendente".
 */
export function EditarPagamentoModal({ pagamento, onClose, onSalvar }: EditarPagamentoModalProps) {
  const [nome, setNome] = useState('');
  const [chave, setChave] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState('');
  const [descricao, setDescricao] = useState('');

  useEffect(() => {
    if (pagamento) {
      setNome(pagamento.nome_beneficiario || '');
      setChave(pagamento.chave_pix || '');
      setCpfCnpj(pagamento.cpf_cnpj || '');
      setValor(pagamento.valor || '');
      setData(pagamento.data_pagamento || '');
      setDescricao(pagamento.descricao || '');
    }
  }, [pagamento]);

  if (!pagamento) return null;

  const podeSalvar = nome.trim() && chave.trim() && valor.trim() && /^\d{4}-\d{2}-\d{2}$/.test(data);

  const salvar = () => {
    if (!podeSalvar) return;
    onSalvar(pagamento.id, {
      nome_beneficiario: nome.trim(),
      chave_pix: chave.trim(),
      cpf_cnpj: cpfCnpj.replace(/\D/g, ''),
      valor: valor.trim(),
      data_pagamento: data,
      descricao: descricao.trim(),
    });
  };

  const jaTemCA = !!pagamento.contaazul_lancamento_id;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Editar pagamento</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Ao salvar, o status volta para <strong>pendente</strong> — depois clique
            &ldquo;Reenviar&rdquo; pra processar de novo.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <Label className="text-gray-700 dark:text-gray-300">Nome do beneficiário</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-gray-700 dark:text-gray-300">Chave PIX</Label>
            <Input
              value={chave}
              onChange={e => setChave(e.target.value)}
              className="mt-1"
              placeholder="CPF/CNPJ, e-mail, telefone ou chave aleatória"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-700 dark:text-gray-300">Valor</Label>
              <Input
                value={valor}
                onChange={e => setValor(e.target.value)}
                className="mt-1"
                placeholder="R$ 0,00"
              />
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300">Data de pagamento</Label>
              <Input type="date" value={data} onChange={e => setData(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-gray-700 dark:text-gray-300">CPF/CNPJ (opcional)</Label>
            <Input value={cpfCnpj} onChange={e => setCpfCnpj(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-gray-700 dark:text-gray-300">Descrição</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} className="mt-1" />
          </div>

          {jaTemCA && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
              ⚠️ Esse pagamento já tem lançamento no Conta Azul. Ao reenviar, a conta a pagar
              existente é reaproveitada (não duplica) — corrigir a <strong>chave PIX</strong> reenvia o
              PIX certo. Se você mudou o <strong>valor</strong>, ajuste/cancele a conta a pagar no Conta Azul.
            </p>
          )}
        </div>

        <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={salvar} disabled={!podeSalvar} className="btn-primary">
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
