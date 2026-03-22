'use client';

import { useState, useCallback } from 'react';
import { Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import type { PagamentoAgendamento, Stakeholder } from '../types';

const inputClass =
  'mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400';

/** Remove tudo que não for dígito (CPF/CNPJ). */
export function removerFormatacaoDocumento(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** Máscara dinâmica CPF ou CNPJ. */
export function formatarDocumento(valor: string): string {
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

/**
 * Formata entrada como moeda BRL enquanto o usuário digita (centavos implícitos).
 */
export function formatarValorMoedaDigitando(valor: string): string {
  const digits = valor.replace(/\D/g, '');
  if (!digits) return '';
  const num = Number(digits) / 100;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Converte string monetária pt-BR (ex.: R$ 1.234,56) em número. */
export function parseValorMonetarioBr(valor: string): number {
  if (!valor?.trim()) return NaN;
  let normalized = valor.trim().replace(/[R$\s]/g, '');
  const isNegative = normalized.includes('-');
  normalized = normalized.replace(/\./g, '').replace(',', '.');
  normalized = normalized.replace(/-/g, '');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return NaN;
  return isNegative ? -Math.abs(parsed) : parsed;
}

export interface NovoPagamentoFormProps {
  categorias: any[];
  centrosCusto: any[];
  barId: number | null;
  onPagamentoAdicionado: (pagamento: PagamentoAgendamento) => void;
}

const estadoInicial = {
  cpf_cnpj: '',
  nome_beneficiario: '',
  chave_pix: '',
  valor: '',
  descricao: '',
  data_pagamento: '',
  data_competencia: '',
  categoria_id: '' as string,
  centro_custo_id: '' as string,
};

export function NovoPagamentoForm({
  categorias,
  centrosCusto,
  barId,
  onPagamentoAdicionado,
}: NovoPagamentoFormProps) {
  const { showToast } = useToast();
  const [form, setForm] = useState(estadoInicial);
  const [buscandoStakeholder, setBuscandoStakeholder] = useState(false);

  const buscarStakeholder = useCallback(
    async (document: string) => {
      const documentoLimpo = removerFormatacaoDocumento(document);

      if (!documentoLimpo || documentoLimpo.length < 11) {
        showToast({
          type: 'error',
          title: 'CPF/CNPJ inválido',
          message: 'Digite um CPF ou CNPJ válido',
        });
        return;
      }

      setBuscandoStakeholder(true);
      try {
        const response = await fetch(
          `/api/financeiro/nibo/stakeholders?q=${documentoLimpo}`
        );
        const data = await response.json();

        if (data.success && data.data?.length > 0) {
          const stakeholder = data.data[0] as Stakeholder;

          const pix = stakeholder.pixKey?.trim() ?? '';

          if (pix) {
            setForm(prev => ({
              ...prev,
              nome_beneficiario: stakeholder.name,
              cpf_cnpj: formatarDocumento(stakeholder.document),
              chave_pix: pix,
            }));
            showToast({
              type: 'success',
              title: '✅ Stakeholder encontrado!',
              message: `${stakeholder.name} foi encontrado com chave PIX`,
            });
          } else {
            setForm(prev => ({
              ...prev,
              nome_beneficiario: stakeholder.name,
              cpf_cnpj: formatarDocumento(stakeholder.document),
              chave_pix: '',
            }));
            showToast({
              type: 'warning',
              title: '⚠️ Stakeholder sem chave PIX',
              message: `${stakeholder.name} foi encontrado; informe a chave PIX manualmente`,
            });
          }
        } else {
          showToast({
            type: 'error',
            title: '❌ Stakeholder não encontrado',
            message:
              'Cadastre o beneficiário no NIBO ou preencha os dados manualmente',
          });
        }
      } catch (e) {
        console.error('Erro ao buscar stakeholder:', e);
        showToast({
          type: 'error',
          title: 'Erro na busca',
          message: 'Erro ao buscar stakeholder',
        });
      } finally {
        setBuscandoStakeholder(false);
      }
    },
    [showToast]
  );

  const adicionarPagamento = () => {
    if (!barId) {
      showToast({
        type: 'error',
        title: '❌ Nenhum bar selecionado',
        message:
          'Selecione um bar no menu superior antes de adicionar pagamentos',
      });
      return;
    }

    if (
      !form.cpf_cnpj ||
      !form.nome_beneficiario ||
      !form.valor ||
      !form.data_pagamento ||
      !form.categoria_id
    ) {
      showToast({
        type: 'error',
        title: '❌ Campos obrigatórios',
        message:
          'Preencha CPF/CNPJ, nome, valor, data de pagamento e categoria',
      });
      return;
    }

    const valorNumerico = parseValorMonetarioBr(form.valor);
    if (Number.isNaN(valorNumerico) || valorNumerico === 0) {
      showToast({
        type: 'error',
        title: '❌ Valor inválido',
        message: 'O valor deve ser um número diferente de zero',
      });
      return;
    }

    const now = new Date().toISOString();
    const categoriaSelecionada = categorias.find(
      c => c.nibo_id === form.categoria_id || c.id === form.categoria_id
    );
    const centroCustoSelecionado = centrosCusto.find(
      c => c.nibo_id === form.centro_custo_id || c.id === form.centro_custo_id
    );

    const novo: PagamentoAgendamento = {
      id: Date.now().toString(),
      cpf_cnpj: removerFormatacaoDocumento(form.cpf_cnpj),
      nome_beneficiario: form.nome_beneficiario,
      chave_pix: form.chave_pix,
      valor: form.valor,
      descricao: form.descricao,
      data_pagamento: form.data_pagamento,
      data_competencia: form.data_competencia,
      categoria_id: form.categoria_id,
      categoria_nome:
        categoriaSelecionada?.categoria_nome ||
        categoriaSelecionada?.name ||
        categoriaSelecionada?.nome ||
        '',
      centro_custo_id: form.centro_custo_id,
      centro_custo_nome:
        centroCustoSelecionado?.nome || centroCustoSelecionado?.name || '',
      status: 'pendente',
      bar_id: barId,
      bar_nome: '',
      created_at: now,
      updated_at: now,
    };

    onPagamentoAdicionado(novo);
    setForm(estadoInicial);

    showToast({
      type: 'success',
      title: '✅ Pagamento adicionado com sucesso!',
      message: `${form.nome_beneficiario} foi adicionado à lista de pagamentos`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="npf_cpf_cnpj" className="text-gray-700 dark:text-gray-300">
            CPF/CNPJ *
          </Label>
          <div className="mt-1 flex gap-2">
            <Input
              id="npf_cpf_cnpj"
              value={form.cpf_cnpj}
              onChange={e =>
                setForm(prev => ({
                  ...prev,
                  cpf_cnpj: formatarDocumento(e.target.value),
                }))
              }
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              className={`flex-1 ${inputClass}`}
            />
            <Button
              type="button"
              onClick={() => buscarStakeholder(form.cpf_cnpj)}
              disabled={buscandoStakeholder}
              className="shrink-0 gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Search className="h-4 w-4" />
              Buscar
            </Button>
          </div>
        </div>
        <div>
          <Label htmlFor="npf_nome" className="text-gray-700 dark:text-gray-300">
            Nome do Beneficiário *
          </Label>
          <Input
            id="npf_nome"
            value={form.nome_beneficiario}
            onChange={e =>
              setForm(prev => ({ ...prev, nome_beneficiario: e.target.value }))
            }
            placeholder="Nome completo"
            className={inputClass}
          />
        </div>
        <div>
          <Label htmlFor="npf_chave_pix" className="text-gray-700 dark:text-gray-300">
            Chave PIX
          </Label>
          <Input
            id="npf_chave_pix"
            value={form.chave_pix}
            onChange={e => setForm(prev => ({ ...prev, chave_pix: e.target.value }))}
            placeholder="CPF, CNPJ, email ou telefone"
            className={inputClass}
          />
        </div>
        <div>
          <Label htmlFor="npf_valor" className="text-gray-700 dark:text-gray-300">
            Valor *
          </Label>
          <Input
            id="npf_valor"
            value={form.valor}
            onChange={e =>
              setForm(prev => ({
                ...prev,
                valor: formatarValorMoedaDigitando(e.target.value),
              }))
            }
            placeholder="R$ 0,00"
            className={inputClass}
          />
        </div>
        <div>
          <Label htmlFor="npf_data_pagamento" className="text-gray-700 dark:text-gray-300">
            Data de Pagamento *
          </Label>
          <Input
            id="npf_data_pagamento"
            type="date"
            value={form.data_pagamento}
            onChange={e =>
              setForm(prev => ({ ...prev, data_pagamento: e.target.value }))
            }
            className={inputClass}
          />
        </div>
        <div>
          <Label htmlFor="npf_data_competencia" className="text-gray-700 dark:text-gray-300">
            Data de Competência
          </Label>
          <Input
            id="npf_data_competencia"
            type="date"
            value={form.data_competencia}
            onChange={e =>
              setForm(prev => ({ ...prev, data_competencia: e.target.value }))
            }
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label className="text-gray-700 dark:text-gray-300">Categoria *</Label>
          <Select
            value={form.categoria_id || undefined}
            onValueChange={value => setForm(prev => ({ ...prev, categoria_id: value }))}
          >
            <SelectTrigger className={`${inputClass} h-10 w-full`}>
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {categorias.map((cat: any) => (
                <SelectItem key={String(cat.id)} value={String(cat.id)}>
                  {cat.categoria_nome || cat.name || cat.nome || String(cat.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-gray-700 dark:text-gray-300">
            Centro de Custo (opcional)
          </Label>
          <Select
            value={form.centro_custo_id || undefined}
            onValueChange={value =>
              setForm(prev => ({ ...prev, centro_custo_id: value }))
            }
          >
            <SelectTrigger className={`${inputClass} h-10 w-full`}>
              <SelectValue placeholder="Selecione um centro de custo" />
            </SelectTrigger>
            <SelectContent>
              {centrosCusto.map((cc: any) => (
                <SelectItem key={String(cc.id)} value={String(cc.id)}>
                  {cc.nome || cc.name || String(cc.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="npf_descricao" className="text-gray-700 dark:text-gray-300">
          Descrição
        </Label>
        <Textarea
          id="npf_descricao"
          value={form.descricao}
          onChange={e => setForm(prev => ({ ...prev, descricao: e.target.value }))}
          placeholder="Descrição do pagamento"
          className={inputClass}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          onClick={adicionarPagamento}
          className="gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Adicionar pagamento
        </Button>
      </div>
    </div>
  );
}
