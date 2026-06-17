'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { AlertTriangle, Check, Loader2, Lock, PencilLine, RefreshCw } from 'lucide-react';

const fmtMoeda = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
const fmtNum = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(n);

interface ProdutoCusto {
  produto_codigo: string;
  produto_desc: string;
  categoria_mix: string | null;
  qtd_vendida: number;
  receita_total: number;
  custo_contahub: number | null;
  custo_manual: number | null;
  custo_efetivo: number | null;
  tem_custo: boolean;
  fonte: string | null;
}

type RowStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function CustoManualEditor({ dias }: { dias: number }) {
  const { selectedBar } = useBar();
  const [produtos, setProdutos] = useState<ProdutoCusto[]>([]);
  const [podeEditar, setPodeEditar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [verManuais, setVerManuais] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const carregar = useCallback(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    setErro(null);
    api
      .get(`/api/cardapio/custo-manual?dias=${dias}`)
      .then((r: any) => {
        setProdutos(r?.produtos ?? []);
        setPodeEditar(!!r?.pode_editar);
      })
      .catch((e: any) => setErro(e?.message || 'Falha ao carregar'))
      .finally(() => setLoading(false));
  }, [selectedBar?.id, dias]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const semCusto = useMemo(
    () => produtos.filter(p => !p.tem_custo).sort((a, b) => b.receita_total - a.receita_total),
    [produtos]
  );
  const manuais = useMemo(
    () => produtos.filter(p => p.fonte === 'manual').sort((a, b) => b.receita_total - a.receita_total),
    [produtos]
  );
  // custo efetivo (total do periodo) maior que a receita => vende no prejuizo (provavel erro de dado)
  const margemNegativa = useMemo(
    () =>
      produtos
        .filter(p => p.tem_custo && Number(p.custo_efetivo) > Number(p.receita_total) && Number(p.receita_total) > 0)
        .sort((a, b) => (Number(b.custo_efetivo) - Number(b.receita_total)) - (Number(a.custo_efetivo) - Number(a.receita_total))),
    [produtos]
  );
  const receitaSemCusto = useMemo(
    () => semCusto.reduce((s, p) => s + Number(p.receita_total), 0),
    [semCusto]
  );

  const atualizarAgora = async () => {
    setSyncing(true);
    setSyncMsg(null);
    setErro(null);
    try {
      const r: any = await api.post('/api/cardapio/sync', {});
      if (r?.erro) setSyncMsg(`Sincronizou com aviso: ${r.erro}`);
      else setSyncMsg(`Planilha sincronizada — ${r?.atualizadas ?? 0} custo(s) atualizado(s).`);
      carregar();
    } catch (e: any) {
      setErro(e?.message || 'Falha ao sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const salvar = async (p: ProdutoCusto) => {
    const raw = edits[p.produto_codigo];
    if (raw === undefined || String(raw).trim() === '') return;
    const custo = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(custo) || custo < 0) {
      setStatus(s => ({ ...s, [p.produto_codigo]: 'error' }));
      return;
    }
    setStatus(s => ({ ...s, [p.produto_codigo]: 'saving' }));
    try {
      await api.post('/api/cardapio/custo-manual', {
        produto_codigo: p.produto_codigo,
        produto_desc: p.produto_desc,
        custo,
      });
      setStatus(s => ({ ...s, [p.produto_codigo]: 'saved' }));
      setProdutos(list =>
        list.map(x =>
          x.produto_codigo === p.produto_codigo
            ? { ...x, custo_manual: custo, custo_efetivo: custo * x.qtd_vendida, tem_custo: custo > 0, fonte: 'manual' }
            : x
        )
      );
    } catch (e: any) {
      setErro(e?.message || 'Falha ao salvar');
      setStatus(s => ({ ...s, [p.produto_codigo]: 'error' }));
    }
  };

  const renderLinha = (p: ProdutoCusto, modoEdicao: boolean) => {
    const precoMedio = p.qtd_vendida > 0 ? Number(p.receita_total) / Number(p.qtd_vendida) : 0;
    const st = status[p.produto_codigo] ?? 'idle';
    return (
      <tr key={p.produto_codigo} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/30">
        <td className="py-2 max-w-xs truncate" title={p.produto_desc}>{p.produto_desc}</td>
        <td className="py-2 text-xs text-gray-500">{p.categoria_mix}</td>
        <td className="py-2 text-right tabular-nums">{fmtNum(p.qtd_vendida)}</td>
        <td className="py-2 text-right tabular-nums text-gray-500">{fmtMoeda(precoMedio)}</td>
        <td className="py-2 text-right tabular-nums">{fmtMoeda(p.receita_total)}</td>
        <td className="py-2 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-gray-400 text-xs">R$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              disabled={!podeEditar}
              defaultValue={modoEdicao && p.custo_manual != null ? String(p.custo_manual) : ''}
              placeholder={modoEdicao ? '' : 'custo un.'}
              onChange={e => setEdits(s => ({ ...s, [p.produto_codigo]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') salvar(p); }}
              className="w-24 text-right text-sm border rounded px-2 py-1 bg-white dark:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {podeEditar && (
              <button
                onClick={() => salvar(p)}
                disabled={st === 'saving'}
                className="px-2 py-1 rounded text-xs font-medium bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-50 flex items-center gap-1"
              >
                {st === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : st === 'saved' ? <Check className="w-3 h-3" /> : 'Salvar'}
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-gray-500">Carregando produtos sem custo…</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Acoes + permissao */}
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-gray-500 flex items-center gap-2">
          {podeEditar ? (
            <>Atualize os custos puxando da planilha, ou preencha manualmente abaixo.</>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-600">
              <Lock className="w-3.5 h-3.5" /> Você pode visualizar, mas só admin/financeiro editam custos.
            </span>
          )}
          {syncMsg && <span className="text-emerald-600">· {syncMsg}</span>}
        </div>
        {podeEditar && (
          <button
            onClick={atualizarAgora}
            disabled={syncing}
            className="px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar agora
          </button>
        )}
      </Card>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {/* Margem negativa (custo >= preco) */}
      {margemNegativa.length > 0 && (
        <Card className="p-6 border-red-200">
          <h2 className="font-semibold flex items-center gap-2 mb-1 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Margem negativa — custo maior que a venda ({margemNegativa.length})
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Estes produtos estão com custo unitário acima do preço de venda (provável erro de cadastro na planilha). Revise na fonte.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 border-b">
                <tr>
                  <th className="text-left py-2">Produto</th>
                  <th className="text-left py-2">Categoria</th>
                  <th className="text-right py-2">Qtd</th>
                  <th className="text-right py-2">Preço méd.</th>
                  <th className="text-right py-2">Custo méd.</th>
                  <th className="text-right py-2">Prejuízo total</th>
                </tr>
              </thead>
              <tbody>
                {margemNegativa.map(p => {
                  const precoMedio = p.qtd_vendida > 0 ? Number(p.receita_total) / Number(p.qtd_vendida) : 0;
                  const custoMedio = p.qtd_vendida > 0 ? Number(p.custo_efetivo) / Number(p.qtd_vendida) : 0;
                  const prejuizo = Number(p.custo_efetivo) - Number(p.receita_total);
                  return (
                    <tr key={p.produto_codigo} className="border-b last:border-0 hover:bg-red-50/40 dark:hover:bg-red-900/10">
                      <td className="py-2 max-w-xs truncate" title={p.produto_desc}>{p.produto_desc}</td>
                      <td className="py-2 text-xs text-gray-500">{p.categoria_mix}</td>
                      <td className="py-2 text-right tabular-nums">{fmtNum(p.qtd_vendida)}</td>
                      <td className="py-2 text-right tabular-nums text-gray-500">{fmtMoeda(precoMedio)}</td>
                      <td className="py-2 text-right tabular-nums text-red-600 font-semibold">{fmtMoeda(custoMedio)}</td>
                      <td className="py-2 text-right tabular-nums text-red-600 font-semibold">-{fmtMoeda(prejuizo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Produtos sem custo */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h2 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Produtos sem custo ({semCusto.length})
          </h2>
          {manuais.length > 0 && (
            <button
              onClick={() => setVerManuais(v => !v)}
              className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1"
            >
              <PencilLine className="w-3 h-3" /> {verManuais ? 'Ocultar' : 'Ver'} preenchidos manualmente ({manuais.length})
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Sem custo cadastrado (ContaHub e planilha não cobrem) — ficam fora da matriz de classificação.
          Receita afetada: <span className="font-semibold">{fmtMoeda(receitaSemCusto)}</span>.
          {podeEditar ? ' Digite o custo unitário e salve.' : ''}
        </p>

        {semCusto.length === 0 ? (
          <p className="text-sm text-emerald-600 py-4 text-center flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> Todos os produtos do período têm custo. 🎉
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 border-b">
                <tr>
                  <th className="text-left py-2">Produto</th>
                  <th className="text-left py-2">Categoria</th>
                  <th className="text-right py-2">Qtd</th>
                  <th className="text-right py-2">Preço méd.</th>
                  <th className="text-right py-2">Receita</th>
                  <th className="text-right py-2">Custo unitário</th>
                </tr>
              </thead>
              <tbody>{semCusto.map(p => renderLinha(p, false))}</tbody>
            </table>
          </div>
        )}

        {verManuais && manuais.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
              <PencilLine className="w-4 h-4" /> Preenchidos manualmente
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 border-b">
                  <tr>
                    <th className="text-left py-2">Produto</th>
                    <th className="text-left py-2">Categoria</th>
                    <th className="text-right py-2">Qtd</th>
                    <th className="text-right py-2">Preço méd.</th>
                    <th className="text-right py-2">Receita</th>
                    <th className="text-right py-2">Custo unitário</th>
                  </tr>
                </thead>
                <tbody>{manuais.map(p => renderLinha(p, true))}</tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
