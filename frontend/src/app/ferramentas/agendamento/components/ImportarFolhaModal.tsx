'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SelectWithSearch } from '@/components/ui/select-with-search';
import { useToast } from '@/components/ui/toast';
import type { FolhaPreviewItem, PagamentoAgendamento } from '../types';

type NiboListaItem = {
  nibo_id?: string;
  id?: string;
  categoria_nome?: string;
  name?: string;
  nome?: string;
};

export interface ImportarFolhaModalProps {
  isOpen: boolean;
  onClose: () => void;
  barId?: number;
  barNome?: string;
  categorias: NiboListaItem[];
  centrosCusto: NiboListaItem[];
  onImportado: (pagamentos: PagamentoAgendamento[]) => void;
}

function removerFormatacao(valor: string): string {
  return valor.replace(/\D/g, '');
}

function parseCurrencyToNumber(value: string): number {
  let normalized = String(value || '').trim();
  const isNegative = normalized.includes('-');
  normalized = normalized.replace(/[R$\s]/g, '');
  normalized = normalized.replace(/\./g, '').replace(',', '.');
  normalized = normalized.replace('-', '');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return isNegative ? -Math.abs(parsed) : parsed;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ImportarFolhaModal({
  isOpen,
  onClose,
  barId,
  barNome,
  categorias,
  centrosCusto,
  onImportado,
}: ImportarFolhaModalProps) {
  const { showToast } = useToast();
  const { user } = useUser();

  const [textoFolha, setTextoFolha] = useState('');
  const [previewFolha, setPreviewFolha] = useState<FolhaPreviewItem[]>([]);
  const [categoriaFolhaId, setCategoriaFolhaId] = useState('');
  const [centroCustoFolhaId, setCentroCustoFolhaId] = useState('');
  const [competenciaFolha, setCompetenciaFolha] = useState(
    () => new Date().toISOString().slice(0, 7)
  );
  const [dataPagamentoFolha, setDataPagamentoFolha] = useState(
    () => new Date().toISOString().split('T')[0]
  );

  const toast = useCallback(
    (options: {
      title: string;
      description?: string;
      variant?: 'destructive';
    }) => {
      showToast({
        type: options.variant === 'destructive' ? 'error' : 'success',
        title: options.title,
        message: options.description,
      });
    },
    [showToast]
  );

  useEffect(() => {
    if (!isOpen || categorias.length === 0) return;
    setCategoriaFolhaId(prev => {
      if (prev) return prev;
      const categoriaSalario = categorias.find(c => {
        const nome = String(
          c.categoria_nome || c.name || c.nome || ''
        ).toLowerCase();
        return (
          nome.includes('sal') ||
          nome.includes('folha') ||
          nome.includes('funcion')
        );
      });
      return String(
        categoriaSalario?.nibo_id || categoriaSalario?.id || ''
      );
    });
  }, [isOpen, categorias]);

  const processarPreviewFolha = useCallback(() => {
    const linhas = textoFolha
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    const ignorarLinha = (linhaLower: string): boolean => {
      return (
        linhaLower.includes('qtd\t') ||
        linhaLower.includes('nome completo') ||
        linhaLower.includes('pagamentos pj') ||
        linhaLower.includes('totais')
      );
    };

    const normalizeHeader = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    let indiceNome = 0;
    let indicePix = 1;
    let indiceCargo = 3;
    let indiceValor = 2;
    let inicioDados = 0;

    const extrairNomeEPix = (prefixo: string): { nome: string; pix: string } => {
      const base = prefixo.trim();
      if (!base) return { nome: '', pix: '' };

      const emailMatch = base.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      if (emailMatch?.[0]) {
        return {
          nome: base.replace(emailMatch[0], '').trim(),
          pix: emailMatch[0].trim(),
        };
      }

      const uuidMatch = base.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
      );
      if (uuidMatch?.[0]) {
        return {
          nome: base.replace(uuidMatch[0], '').trim(),
          pix: uuidMatch[0].trim(),
        };
      }

      const cpfCnpjMatch = base.match(
        /(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{11,14})(?!.*(\d{11,14}))/i
      );
      if (cpfCnpjMatch?.[0]) {
        return {
          nome: base.replace(cpfCnpjMatch[0], '').trim(),
          pix: cpfCnpjMatch[0].trim(),
        };
      }

      const phoneMatch = base.match(/(\(?\d{2}\)?\s*9?\s*\d{4,5}[-\s]?\d{4})$/i);
      if (phoneMatch?.[0]) {
        return {
          nome: base.slice(0, phoneMatch.index).trim(),
          pix: phoneMatch[0].trim(),
        };
      }

      const partes = base.split(/\s{2,}/).filter(Boolean);
      if (partes.length >= 2) {
        return {
          nome: partes.slice(0, -1).join(' ').trim(),
          pix: partes[partes.length - 1].trim(),
        };
      }

      return { nome: base, pix: '' };
    };

    if (linhas.length > 0) {
      const headerCols = linhas[0].split('\t').map(c => normalizeHeader(c));
      const headerPossuiCampos = headerCols.some(
        h =>
          h.includes('nome_beneficiario') ||
          h.includes('nome completo') ||
          h.includes('chave_pix') ||
          h === 'pix' ||
          h === 'valor' ||
          h === 'total'
      );

      if (headerPossuiCampos) {
        const idxNome = headerCols.findIndex(
          h =>
            h.includes('nome_beneficiario') ||
            h.includes('nome completo') ||
            h === 'nome'
        );
        const idxPix = headerCols.findIndex(
          h => h.includes('chave_pix') || h === 'pix' || h.includes('chave')
        );
        const idxCargo = headerCols.findIndex(
          h => h === 'cargo' || h.includes('funcao')
        );
        const idxValor = headerCols.findIndex(h => h === 'valor');
        const idxTotal = headerCols.findIndex(h => h === 'total');

        if (idxNome >= 0) indiceNome = idxNome;
        if (idxPix >= 0) indicePix = idxPix;
        if (idxCargo >= 0) indiceCargo = idxCargo;
        if (idxTotal >= 0) {
          indiceValor = idxTotal;
        } else if (idxValor >= 0) {
          indiceValor = idxValor;
        }

        inicioDados = 1;
      }
    }

    const preview: FolhaPreviewItem[] = [];

    for (const linha of linhas.slice(inicioDados)) {
      const linhaLower = linha.toLowerCase();
      if (ignorarLinha(linhaLower)) continue;

      if (linha.includes('\t')) {
        const cols = linha.split('\t').map(c => c.trim());
        if (cols.length < 2) continue;

        const nome = cols[indiceNome] || cols[0] || '';
        const pix = cols[indicePix] || '';
        const cargo = cols[indiceCargo] || cols[3] || 'Funcionário';
        const totalBruto =
          cols[indiceValor] ||
          cols.find(c => /R\$\s*[\d.,]+|^-?\d+[.,]\d{2}$/.test(c)) ||
          '';
        const total = parseCurrencyToNumber(totalBruto);

        if (!nome || total <= 0) continue;
        preview.push({ nome, pix, cargo, total });
        continue;
      }

      const matchLinha = linha.match(
        /^(.*?)\s+R\$\s*([\d.]+,\d{2})\s+(.*?)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}\/\d{2}\/\d{4}))?\s*$/
      );
      if (!matchLinha) continue;

      const prefixoNomePix = matchLinha[1] || '';
      const valorBruto = matchLinha[2] || '';
      const descricaoLinha = (matchLinha[3] || '').trim();
      const total = parseCurrencyToNumber(`R$ ${valorBruto}`);
      if (total <= 0) continue;

      const { nome, pix } = extrairNomeEPix(prefixoNomePix);
      if (!nome) continue;

      preview.push({
        nome,
        pix,
        cargo: descricaoLinha || 'Funcionário',
        total,
      });
    }

    setPreviewFolha(preview);

    if (preview.length === 0) {
      toast({
        title: 'Nenhuma linha válida',
        description:
          'Cole a planilha com TAB ou texto em linhas, contendo nome e valor positivo.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Prévia da folha gerada',
      description: `${preview.length} linha(s) pronta(s) para importação`,
    });
  }, [textoFolha, toast]);

  const importarFolhaParaLista = () => {
    if (!barId) {
      toast({
        title: '❌ Nenhum bar selecionado',
        description: 'Selecione um bar antes de importar a folha',
        variant: 'destructive',
      });
      return;
    }

    if (!categoriaFolhaId) {
      toast({
        title: 'Categoria obrigatória',
        description: 'Selecione uma categoria para os lançamentos da folha',
        variant: 'destructive',
      });
      return;
    }

    if (previewFolha.length === 0) {
      toast({
        title: 'Prévia vazia',
        description: 'Gere a prévia da folha antes de importar',
        variant: 'destructive',
      });
      return;
    }

    const now = new Date().toISOString();
    const usuarioNome = user?.nome || user?.email || 'Usuário';
    const usuarioId = user?.auth_id;
    const categoriaSelecionada = categorias.find(
      c => c.nibo_id === categoriaFolhaId || c.id === categoriaFolhaId
    );
    const centroSelecionado = centrosCusto.find(
      c => c.nibo_id === centroCustoFolhaId || c.id === centroCustoFolhaId
    );

    const pagamentosFolha: PagamentoAgendamento[] = previewFolha.map(
      (item, index) => {
        const documentoLimpo = removerFormatacao(item.pix);
        const documento =
          documentoLimpo.length === 11 || documentoLimpo.length === 14
            ? documentoLimpo
            : '';

        return {
          id: `${Date.now()}-${index}`,
          cpf_cnpj: documento,
          nome_beneficiario: item.nome,
          chave_pix: item.pix,
          valor: formatCurrency(item.total),
          descricao: `Folha ${competenciaFolha} - ${item.cargo}`,
          data_pagamento: dataPagamentoFolha,
          data_competencia: `${competenciaFolha}-01`,
          categoria_id: categoriaFolhaId,
          categoria_nome:
            categoriaSelecionada?.categoria_nome ||
            categoriaSelecionada?.name ||
            categoriaSelecionada?.nome ||
            '',
          centro_custo_id: centroCustoFolhaId || '',
          centro_custo_nome:
            centroSelecionado?.nome || centroSelecionado?.name || '',
          status: 'pendente',
          bar_id: barId,
          bar_nome: barNome || '',
          criado_por_id: usuarioId,
          criado_por_nome: usuarioNome,
          atualizado_por_id: usuarioId,
          atualizado_por_nome: usuarioNome,
          created_at: now,
          updated_at: now,
        };
      }
    );

    onImportado(pagamentosFolha);
    onClose();
    setPreviewFolha([]);
    setTextoFolha('');

    toast({
      title: '✅ Folha importada',
      description: `${pagamentosFolha.length} pagamento(s) adicionado(s) à lista`,
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">
            Importar Folha de Pagamento
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            Cole a planilha (tabulada), gere a prévia e importe os pagamentos para
            a lista.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700 dark:text-gray-300">
                Data de pagamento *
              </Label>
              <Input
                type="date"
                value={dataPagamentoFolha}
                onChange={e => setDataPagamentoFolha(e.target.value)}
                className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300">
                Competência (AAAA-MM) *
              </Label>
              <Input
                type="month"
                value={competenciaFolha}
                onChange={e => setCompetenciaFolha(e.target.value)}
                className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700 dark:text-gray-300">
                Categoria padrão *
              </Label>
              <SelectWithSearch
                value={categoriaFolhaId}
                onValueChange={value => setCategoriaFolhaId(value || '')}
                placeholder="Selecione a categoria da folha"
                options={categorias.map(cat => ({
                  value: String(cat.nibo_id || cat.id || ''),
                  label: String(
                    cat.categoria_nome || cat.name || cat.nome || ''
                  ),
                }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300">
                Centro de custo padrão (opcional)
              </Label>
              <SelectWithSearch
                value={centroCustoFolhaId}
                onValueChange={value => setCentroCustoFolhaId(value || '')}
                placeholder="Selecione um centro de custo"
                options={centrosCusto.map(cc => ({
                  value: String(cc.nibo_id || cc.id || ''),
                  label: String(cc.nome || cc.name || ''),
                }))}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-gray-700 dark:text-gray-300">
              Cole a planilha da folha (TAB)
            </Label>
            <Textarea
              className="w-full h-40 mt-1 p-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono resize-none border border-gray-300 dark:border-gray-600 rounded-md focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400"
              value={textoFolha}
              onChange={e => setTextoFolha(e.target.value)}
              placeholder="Cole aqui as linhas da folha copiadas do Excel/Sheets"
            />
          </div>

          <div className="flex gap-3">
            <Button onClick={processarPreviewFolha} variant="outline">
              Gerar Prévia
            </Button>
            <Button
              onClick={importarFolhaParaLista}
              className="btn-primary"
              disabled={previewFolha.length === 0}
            >
              Importar{' '}
              {previewFolha.length > 0
                ? `${previewFolha.length} pagamento(s)`
                : 'Folha'}
            </Button>
          </div>

          {previewFolha.length > 0 && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-left">PIX</th>
                    <th className="px-3 py-2 text-left">Cargo</th>
                    <th className="px-3 py-2 text-left">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {previewFolha.slice(0, 20).map((item, idx) => (
                    <tr
                      key={`${item.nome}-${idx}`}
                      className="border-t border-gray-200 dark:border-gray-600"
                    >
                      <td className="px-3 py-2">{item.nome}</td>
                      <td className="px-3 py-2">{item.pix}</td>
                      <td className="px-3 py-2">{item.cargo}</td>
                      <td className="px-3 py-2 font-medium">
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
