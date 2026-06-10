'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/components/ui/toast';
import { UserPlus } from 'lucide-react';
import type { FolhaPreviewItem, PagamentoAgendamento } from '../types';
import { CadastrarFornecedorModal } from './CadastrarFornecedorModal';

type ContaAzulListaItem = {
  contaazul_id?: string;
  id?: string | number;
  nome?: string;
  tipo?: string;
  ativo?: boolean;
};

export interface ImportarFolhaFormProps {
  barId?: number;
  barNome?: string;
  categorias: ContaAzulListaItem[];
  centrosCusto: ContaAzulListaItem[];
  onImportado: (pagamentos: PagamentoAgendamento[]) => void;
  onAfterImport?: () => void;
}

function categoriaUuid(item: ContaAzulListaItem): string {
  return String(item.contaazul_id || item.id || '');
}

function categoriaLabel(item: ContaAzulListaItem): string {
  return String(item.nome || categoriaUuid(item));
}

interface MatchResultado {
  input: { nome: string; documento?: string | null };
  tipo: 'doc' | 'exact' | 'fuzzy' | 'none';
  pessoa: { contaazul_id: string; nome: string; documento: string | null } | null;
  score: number;
  similares: Array<{ contaazul_id: string; nome: string; score: number }>;
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

export function ImportarFolhaForm({
  barId,
  barNome,
  categorias,
  centrosCusto,
  onImportado,
  onAfterImport,
}: ImportarFolhaFormProps) {
  const { showToast } = useToast();
  const { user } = useUser();

  const [textoFolha, setTextoFolha] = useState('');
  const [previewFolha, setPreviewFolha] = useState<FolhaPreviewItem[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResultado[]>([]);
  const [verificandoFornecedores, setVerificandoFornecedores] = useState(false);
  const [categoriaFolhaId, setCategoriaFolhaId] = useState('');
  const [centroCustoFolhaId, setCentroCustoFolhaId] = useState('');
  const [cadastroModal, setCadastroModal] = useState<{
    aberto: boolean;
    indexPreview: number | null;
    nome: string;
    pix: string;
  }>({ aberto: false, indexPreview: null, nome: '', pix: '' });
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

  const categoriasDespesa = useMemo(
    () =>
      categorias.filter(c => {
        const tipo = String(c.tipo || '').toUpperCase();
        if (tipo && tipo !== 'DESPESA' && tipo !== 'EXPENSE') return false;
        return c.ativo !== false;
      }),
    [categorias]
  );

  useEffect(() => {
    if (categoriasDespesa.length === 0) return;
    setCategoriaFolhaId(prev => {
      if (prev) return prev;

      // 1) Tenta restaurar a última escolha do user (por bar)
      if (barId) {
        const saved = localStorage.getItem(`sgb_agendamento_categoria_folha_bar_${barId}`);
        if (saved && categoriasDespesa.some(c => categoriaUuid(c) === saved)) {
          return saved;
        }
      }

      // 2) Auto-detect — exclui "[NÃO USAR]" e prioriza "salario funcion"
      const elegiveis = categoriasDespesa.filter(c => {
        const nome = categoriaLabel(c).toLowerCase();
        return !nome.includes('nao usar') && !nome.includes('não usar') && !nome.includes('[nao');
      });

      const exato =
        elegiveis.find(c => {
          const n = categoriaLabel(c).toLowerCase();
          return n.includes('salario') && n.includes('funcion');
        }) ||
        elegiveis.find(c => /salario funcion|salário funcion/i.test(categoriaLabel(c)));
      if (exato) return categoriaUuid(exato);

      // 3) Fallback: qualquer "salario", "folha", "funcion"
      const fallback = elegiveis.find(c => {
        const nome = categoriaLabel(c).toLowerCase();
        return nome.includes('salario') || nome.includes('folha') || nome.includes('funcion');
      });
      return fallback ? categoriaUuid(fallback) : '';
    });
  }, [categoriasDespesa, barId]);

  // Persiste a escolha do user por bar
  useEffect(() => {
    if (!barId || !categoriaFolhaId) return;
    localStorage.setItem(`sgb_agendamento_categoria_folha_bar_${barId}`, categoriaFolhaId);
  }, [barId, categoriaFolhaId]);

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
        .replace(/[̀-ͯ]/g, '')
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
    setMatchResults([]);

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
      description: `${preview.length} linha(s) — verificando cadastros no Conta Azul...`,
    });

    // Disparar verificação de fornecedores no CA (em background)
    if (barId) {
      void verificarFornecedoresAsync(preview);
    }
  }, [textoFolha, toast, barId]); // eslint-disable-line react-hooks/exhaustive-deps

  const verificarFornecedoresAsync = async (preview: FolhaPreviewItem[]) => {
    if (!barId || preview.length === 0) return;
    setVerificandoFornecedores(true);
    try {
      const r = await fetch('/api/financeiro/contaazul/match-fornecedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: barId,
          candidatos: preview.map(p => ({ nome: p.nome, documento: p.pix || null })),
        }),
      });
      const data = await r.json();
      if (r.ok && Array.isArray(data.matches)) {
        setMatchResults(data.matches);
        const naoCadastrados = data.matches.filter((m: MatchResultado) => m.tipo === 'none').length;
        const fuzzy = data.matches.filter((m: MatchResultado) => m.tipo === 'fuzzy').length;
        toast({
          title: 'Verificação concluída',
          description: `${data.matches.length - naoCadastrados} encontrados${fuzzy > 0 ? ` (${fuzzy} aproximados)` : ''}${naoCadastrados > 0 ? ` · ${naoCadastrados} sem cadastro` : ''}`,
          variant: naoCadastrados > 0 ? 'destructive' : undefined,
        });
      }
    } catch (e: any) {
      console.error('Erro match-fornecedores:', e);
    } finally {
      setVerificandoFornecedores(false);
    }
  };

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
      c => categoriaUuid(c) === categoriaFolhaId
    );
    const centroSelecionado = centrosCusto.find(
      c => categoriaUuid(c) === centroCustoFolhaId
    );

    const pagamentosFolha: PagamentoAgendamento[] = previewFolha.map(
      (item, index) => {
        const documentoLimpo = removerFormatacao(item.pix);
        const documento =
          documentoLimpo.length === 11 || documentoLimpo.length === 14
            ? documentoLimpo
            : '';

        // Aproveita o resultado do match pra pré-vincular o fornecedor CA
        const matched = matchResults[index];
        const contaazulPessoaId =
          matched && matched.pessoa &&
          (matched.tipo === 'doc' || matched.tipo === 'exact' || matched.tipo === 'fuzzy')
            ? matched.pessoa.contaazul_id
            : undefined;

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
          categoria_nome: categoriaSelecionada
            ? categoriaLabel(categoriaSelecionada)
            : '',
          centro_custo_id: centroCustoFolhaId || '',
          centro_custo_nome: centroSelecionado
            ? categoriaLabel(centroSelecionado)
            : '',
          status: 'pendente',
          bar_id: barId,
          bar_nome: barNome || '',
          contaazul_pessoa_id: contaazulPessoaId,
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
    setPreviewFolha([]);
    setTextoFolha('');
    onAfterImport?.();

    toast({
      title: '✅ Folha importada',
      description: `${pagamentosFolha.length} pagamento(s) adicionado(s) à lista`,
    });
  };

  return (
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
            Categoria *
            {categoriasDespesa.length === 0 && (
              <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">
                (vazia — clique &quot;Sync categorias&quot; no topo)
              </span>
            )}
          </Label>
          <SearchableSelect
            value={categoriaFolhaId}
            onValueChange={v => setCategoriaFolhaId(v || '')}
            disabled={categoriasDespesa.length === 0}
            placeholder="Selecione a categoria (DESPESA)"
            searchPlaceholder="Digite pra filtrar categorias..."
            emptyMessage="Nenhuma categoria"
            clearable
            className="mt-1"
            options={categoriasDespesa.map(cat => ({
              value: categoriaUuid(cat),
              label: categoriaLabel(cat),
            }))}
          />
        </div>
        <div>
          <Label className="text-gray-700 dark:text-gray-300">
            Centro de custo (opcional)
          </Label>
          <SearchableSelect
            value={centroCustoFolhaId}
            onValueChange={v => setCentroCustoFolhaId(v || '')}
            disabled={centrosCusto.length === 0}
            placeholder="Selecione um centro de custo"
            searchPlaceholder="Digite pra filtrar centros..."
            emptyMessage="Nenhum centro de custo"
            clearable
            className="mt-1"
            options={centrosCusto
              .filter(cc => cc.ativo !== false)
              .map(cc => ({
                value: categoriaUuid(cc),
                label: categoriaLabel(cc),
              }))}
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
          placeholder="Cole aqui as linhas da folha copiadas do Excel/Sheets (Ctrl+C / Ctrl+V). Formato: Nome[TAB]PIX[TAB]Valor[TAB]Cargo"
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
          {verificandoFornecedores && (
            <div className="px-3 py-2 text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900">
              Verificando cadastros no Conta Azul...
            </div>
          )}
          <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left w-[140px]">CA</th>
                <th className="px-3 py-2 text-left">Nome</th>
                <th className="px-3 py-2 text-left">PIX</th>
                <th className="px-3 py-2 text-left">Cargo</th>
                <th className="px-3 py-2 text-left">Total</th>
              </tr>
            </thead>
            <tbody>
              {previewFolha.map((item, idx) => {
                const m = matchResults[idx];
                const badge = (() => {
                  if (!m) return null;
                  if (m.tipo === 'doc') {
                    return (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        ✅ <span className="truncate" title={m.pessoa?.nome || ''}>doc</span>
                      </span>
                    );
                  }
                  if (m.tipo === 'exact') {
                    return (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        ✅ <span className="truncate" title={m.pessoa?.nome || ''}>cadastrado</span>
                      </span>
                    );
                  }
                  if (m.tipo === 'fuzzy') {
                    return (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300"
                        title={`Aproximado (${Math.round(m.score * 100)}%): ${m.pessoa?.nome || ''}`}
                      >
                        ⚠️ <span className="truncate">~{Math.round(m.score * 100)}%</span>
                      </span>
                    );
                  }
                  return (
                    <div className="flex flex-col gap-1">
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 dark:text-red-300"
                        title={
                          m.similares.length
                            ? 'Sugestões: ' + m.similares.map(s => `${s.nome} (${Math.round(s.score * 100)}%)`).join(', ')
                            : 'Sem cadastro'
                        }
                      >
                        ❌ não cadastrado
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] gap-1 px-2"
                        onClick={() =>
                          setCadastroModal({
                            aberto: true,
                            indexPreview: idx,
                            nome: item.nome,
                            pix: item.pix,
                          })
                        }
                      >
                        <UserPlus className="w-3 h-3" />
                        Cadastrar
                      </Button>
                    </div>
                  );
                })();
                return (
                  <tr
                    key={`${item.nome}-${idx}`}
                    className="border-t border-gray-200 dark:border-gray-600"
                  >
                    <td className="px-3 py-2 align-top">{badge}</td>
                    <td className="px-3 py-2">
                      <div>{item.nome}</div>
                      {m?.pessoa && m.tipo !== 'exact' && m.tipo !== 'doc' && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-[280px]" title={m.pessoa.nome}>
                          → {m.pessoa.nome}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">{item.pix}</td>
                    <td className="px-3 py-2">{item.cargo}</td>
                    <td className="px-3 py-2 font-medium">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {previewFolha.length > 8 && (
            <p className="px-3 py-1 text-[10px] text-muted-foreground border-t border-gray-200 dark:border-gray-600">
              {previewFolha.length} linhas — role pra ver todas
            </p>
          )}
          {matchResults.length > 0 && (
            <div className="px-3 py-2 text-xs border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex flex-wrap gap-x-3 gap-y-1">
              <span className="text-emerald-700 dark:text-emerald-300">
                ✅ {matchResults.filter(m => m.tipo === 'exact' || m.tipo === 'doc').length} cadastrados
              </span>
              <span className="text-amber-700 dark:text-amber-300">
                ⚠️ {matchResults.filter(m => m.tipo === 'fuzzy').length} aproximados
              </span>
              <span className="text-red-700 dark:text-red-300">
                ❌ {matchResults.filter(m => m.tipo === 'none').length} não cadastrados
              </span>
            </div>
          )}
        </div>
      )}

      <CadastrarFornecedorModal
        isOpen={cadastroModal.aberto}
        onClose={() => setCadastroModal(s => ({ ...s, aberto: false }))}
        barId={barId}
        initialNome={cadastroModal.nome}
        initialPix={cadastroModal.pix}
        onCadastrado={pessoa => {
          // Atualiza match in-place pra essa linha (vira ✅ exact)
          setMatchResults(prev =>
            prev.map((m, i) =>
              i === cadastroModal.indexPreview
                ? {
                    input: m.input,
                    tipo: 'exact',
                    pessoa: {
                      contaazul_id: pessoa.contaazul_id,
                      nome: pessoa.nome,
                      documento: pessoa.documento,
                    },
                    score: 1,
                    similares: [],
                  }
                : m
            )
          );
          // Re-roda match em background pra refletir alterações de outras linhas similares
          if (previewFolha.length > 0) {
            void verificarFornecedoresAsync(previewFolha);
          }
        }}
      />
    </div>
  );
}
