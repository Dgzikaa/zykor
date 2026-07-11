'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useApiSWR } from '@/hooks/useApiSWR';

// Blocos válidos da Orçamentação/DRE (espelham a ESTRUTURA do orcamentacao-service).
const BLOCOS = [
  'Receita',
  'Custos Variáveis',
  'Custo insumos (CMV)',
  'Mão-de-Obra',
  'Despesas Comerciais',
  'Despesas Administrativas',
  'Despesas Operacionais',
  'Despesas de Ocupação',
  'Não Operacionais',
  'Investimentos',
] as const;

interface CategoriaRow {
  categoria_ca: string;
  n: number;
  total: number | null;
  tipo_ca: string | null;
  map_id: number | null;
  categoria_zykor: string | null;
  bloco_dre: string | null;
  tipo_zykor: string | null;
  ignorar: boolean | null;
}

interface Edicao {
  bloco_dre: string;
  tipo_zykor: string;
  ignorar: boolean;
  categoria_zykor: string;
}

const fmtMoeda = (v: number | null) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const anos = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

export function CategoriasTab({ barId }: { barId: number }) {
  const { toast } = useToast();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [salvando, setSalvando] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [soNaoMapeadas, setSoNaoMapeadas] = useState(false);
  const [edits, setEdits] = useState<Record<string, Edicao>>({});

  // Cache via SWR: chave = endpoint (bar_id + ano). Trocar bar/ano re-busca.
  const { data, isLoading: loading, mutate } = useApiSWR<{ categorias?: CategoriaRow[] }>(
    barId ? `/api/estrategico/orcamentacao/categorias?bar_id=${barId}&ano=${ano}` : null,
    {
      shouldRetryOnError: false,
      onError: (e: any) =>
        toast({ title: 'Erro ao carregar categorias', description: e?.message, variant: 'destructive' }),
    },
  );
  const rows = useMemo(() => (data?.categorias || []) as CategoriaRow[], [data]);

  // Ao trocar bar/ano, descarta edições pendentes (equivalente ao setEdits({}) do
  // antigo carregar()). Salvar também reseta (ver abaixo).
  useEffect(() => { setEdits({}); }, [barId, ano]);

  const editOf = (row: CategoriaRow): Edicao =>
    edits[row.categoria_ca] ?? {
      bloco_dre: row.bloco_dre ?? '',
      tipo_zykor: row.tipo_zykor ?? (row.tipo_ca === 'RECEITA' ? 'receita' : 'despesa'),
      ignorar: !!row.ignorar,
      categoria_zykor: row.categoria_zykor ?? '',
    };

  const setEdit = (cat: string, patch: Partial<Edicao>, base: Edicao) =>
    setEdits(prev => ({ ...prev, [cat]: { ...base, ...patch } }));

  const salvar = async (row: CategoriaRow) => {
    const e = editOf(row);
    if (!e.ignorar && !e.bloco_dre) {
      toast({ title: 'Escolha um bloco', description: 'Selecione o bloco da DRE ou marque "Não mostrar".', variant: 'destructive' });
      return;
    }
    setSalvando(row.categoria_ca);
    try {
      const r = await fetch('/api/estrategico/orcamentacao/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: barId,
          ano,
          categoria_ca: row.categoria_ca,
          categoria_zykor: e.categoria_zykor || row.categoria_ca,
          bloco_dre: e.ignorar ? '' : e.bloco_dre,
          tipo_zykor: e.tipo_zykor,
          ignorar: e.ignorar,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Falha ao salvar');
      toast({ title: 'Categoria salva', description: `"${row.categoria_ca}" — Orçamentação reprocessada para ${ano}.` });
      setEdits({});
      await mutate();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err?.message, variant: 'destructive' });
    } finally {
      setSalvando(null);
    }
  };

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter(r => {
      if (soNaoMapeadas && r.bloco_dre) return false;
      if (q && !r.categoria_ca.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, busca, soNaoMapeadas]);

  const nNaoMapeadas = rows.filter(r => !r.bloco_dre && !r.ignorar).length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Central de Categorias</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Mapeie categorias do Conta Azul para os blocos da DRE/Orçamentação, mova de bloco ou marque para não mostrar.
            Salvar reprocessa o ano selecionado na hora.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {nNaoMapeadas > 0 && (
            <span className="text-xs font-medium px-2 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {nNaoMapeadas} não mapeada(s)
            </span>
          )}
          <select
            value={ano}
            onChange={e => setAno(Number(e.target.value))}
            className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm"
          >
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar categoria..."
            className="w-full h-9 pl-8 pr-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={soNaoMapeadas} onChange={e => setSoNaoMapeadas(e.target.checked)} />
          Só não mapeadas
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="text-left font-medium px-3 py-2">Categoria (Conta Azul)</th>
                <th className="text-right font-medium px-3 py-2">{ano}</th>
                <th className="text-left font-medium px-3 py-2">Bloco DRE</th>
                <th className="text-left font-medium px-3 py-2">Tipo</th>
                <th className="text-center font-medium px-3 py-2">Não mostrar</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(row => {
                const e = editOf(row);
                const dirty = !!edits[row.categoria_ca];
                const naoMapeada = !row.bloco_dre && !row.ignorar;
                return (
                  <tr key={row.categoria_ca} className={`border-t border-gray-100 dark:border-gray-700 ${naoMapeada ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{row.categoria_ca}</div>
                      <div className="text-xs text-gray-400">{row.n} lançamentos · CA: {row.tipo_ca || '—'}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{fmtMoeda(row.total)}</td>
                    <td className="px-3 py-2">
                      <select
                        value={e.bloco_dre}
                        disabled={e.ignorar}
                        onChange={ev => setEdit(row.categoria_ca, { bloco_dre: ev.target.value }, e)}
                        className="h-8 min-w-[170px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm disabled:opacity-50"
                      >
                        <option value="">— não mapeada —</option>
                        {BLOCOS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={e.tipo_zykor}
                        disabled={e.ignorar}
                        onChange={ev => setEdit(row.categoria_ca, { tipo_zykor: ev.target.value }, e)}
                        className="h-8 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm disabled:opacity-50"
                      >
                        <option value="despesa">despesa</option>
                        <option value="receita">receita</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={e.ignorar}
                        onChange={ev => setEdit(row.categoria_ca, { ignorar: ev.target.checked }, e)}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => salvar(row)}
                        disabled={salvando === row.categoria_ca || !dirty}
                        className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {salvando === row.categoria_ca ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Salvar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtradas.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Nenhuma categoria encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
