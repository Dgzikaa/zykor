'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Check, AlertTriangle, FolderTree } from 'lucide-react';

type Cat = {
  categoria_pai_id: string | null;
  nome_grupo: string | null;
  grupo_dre_macro: string | null;
  contaazul_id: string;
  categoria: string;
  tipo: string | null;
  total: number | string;
  dre_macro_atual: string | null;
  na_dre: boolean;
  na_orcamentacao: boolean;
  na_dfc: boolean;
};

const n = (x: unknown) => Number(x) || 0;
const fmt = (v: number) => v === 0 ? '–' : `${v < 0 ? '-' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CategoriasPage() {
  const { selectedBar } = useBar();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [cats, setCats] = useState<Cat[]>([]);
  const [macros, setMacros] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [edits, setEdits] = useState<Record<string, { nome: string; macro: string }>>({});
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = useCallback(() => {
    if (!selectedBar) return;
    setLoading(true);
    fetch(`/api/financeiro/categorias?bar_id=${selectedBar.id}&ano=${ano}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setCats(Array.isArray(d.categorias) ? d.categorias : []); setMacros(Array.isArray(d.macros) ? d.macros : []); })
      .catch(() => setCats([]))
      .finally(() => setLoading(false));
  }, [selectedBar, ano]);
  useEffect(() => { carregar(); }, [carregar]);

  // Agrupa por pai. Categorias sem pai vão pra um balde "sem-pai".
  const grupos = useMemo(() => {
    const map = new Map<string, { paiId: string | null; nome: string | null; macro: string | null; filhos: Cat[] }>();
    for (const c of cats) {
      const k = c.categoria_pai_id ?? 'sem-pai';
      if (!map.has(k)) map.set(k, { paiId: c.categoria_pai_id, nome: c.nome_grupo, macro: c.grupo_dre_macro, filhos: [] });
      map.get(k)!.filhos.push(c);
    }
    const arr = Array.from(map.values());
    arr.forEach(g => g.filhos.sort((a, b) => Math.abs(n(b.total)) - Math.abs(n(a.total))));
    // grupos com mais movimento primeiro; "sem-pai" por último
    arr.sort((a, b) => {
      if (!a.paiId) return 1; if (!b.paiId) return -1;
      return b.filhos.reduce((s, c) => s + Math.abs(n(c.total)), 0) - a.filhos.reduce((s, c) => s + Math.abs(n(c.total)), 0);
    });
    return arr;
  }, [cats]);

  const editOf = (paiId: string, nome: string | null, macro: string | null) =>
    edits[paiId] ?? { nome: nome ?? '', macro: macro ?? '' };

  const salvar = async (paiId: string) => {
    if (!selectedBar) return;
    const e = edits[paiId] ?? { nome: '', macro: '' };
    setSalvando(paiId);
    try {
      const r = await fetch('/api/financeiro/categorias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: selectedBar.id, categoria_pai_id: paiId, nome_grupo: e.nome, dre_macro: e.macro }),
      });
      const d = await r.json();
      if (d.ok) carregar();
    } finally { setSalvando(null); }
  };

  const macroBadge = (m: string | null) => {
    if (!m) return <span className="text-[10px] text-amber-600 dark:text-amber-400">não mapeada</span>;
    if (m === 'IGNORAR') return <span className="text-[10px] text-gray-400">fora da DRE</span>;
    return <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{m}</span>;
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderTree className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Central de Categorias</h1>
        </div>
        <select value={ano} onChange={e => setAno(Number(e.target.value))} className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-700">
          {[0, 1, 2].map(d => { const a = new Date().getFullYear() - d; return <option key={a} value={a}>{a}</option>; })}
        </select>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-3xl">
        Cada grupo abaixo é um <b>pai</b> do Conta Azul. Dê um nome ao grupo e escolha a <b>macro da DRE</b> — todos os filhos
        herdam (inclusive categorias novas criadas depois sob o mesmo pai). Mapeamento manual direto sempre prevalece.
      </p>

      {loading ? <Skeleton className="h-[500px]" /> : (
        <div className="space-y-2">
          {grupos.map((g, i) => {
            const k = g.paiId ?? 'sem-pai';
            const aberto = abertos[k] ?? false;
            const semPai = !g.paiId;
            const e = editOf(k, g.nome, g.macro);
            const totalGrupo = g.filhos.reduce((s, c) => s + n(c.total), 0);
            return (
              <Card key={k} className="p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setAbertos(p => ({ ...p, [k]: !aberto }))} className="text-gray-400 hover:text-gray-600">
                    {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  {semPai ? (
                    <span className="flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5" /> Sem grupo (pai) — {g.filhos.length} categorias
                    </span>
                  ) : (
                    <>
                      <Input value={e.nome} placeholder="nome do grupo…" onChange={ev => setEdits(p => ({ ...p, [k]: { ...e, nome: ev.target.value } }))} className="h-7 w-48 text-sm" />
                      <select value={e.macro} onChange={ev => setEdits(p => ({ ...p, [k]: { ...e, macro: ev.target.value } }))} className="h-7 text-sm border rounded px-1 bg-white dark:bg-gray-800 dark:border-gray-700">
                        <option value="">— macro da DRE —</option>
                        {macros.map(m => <option key={m} value={m}>{m === 'IGNORAR' ? '🚫 Fora da DRE' : m}</option>)}
                      </select>
                      <Button size="sm" className="h-7" disabled={salvando === k} onClick={() => salvar(k)}>
                        {salvando === k ? 'salvando…' : <><Check className="w-3.5 h-3.5 mr-1" />Salvar</>}
                      </Button>
                      <span className="text-[11px] text-gray-400">{g.filhos.length} filhos · {fmt(totalGrupo)}</span>
                    </>
                  )}
                </div>

                {aberto && (
                  <table className="w-full text-xs mt-2">
                    <thead>
                      <tr className="text-gray-400 text-left border-b dark:border-gray-700">
                        <th className="py-1 font-normal">Categoria</th>
                        <th className="py-1 font-normal text-right">Total {ano}</th>
                        <th className="py-1 font-normal pl-3">DRE atual</th>
                        <th className="py-1 font-normal text-center">Orç</th>
                        <th className="py-1 font-normal text-center">DFC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.filhos.map(c => (
                        <tr key={c.contaazul_id} className="border-b last:border-0 dark:border-gray-800">
                          <td className="py-1 text-gray-700 dark:text-gray-300">{c.categoria}</td>
                          <td className="py-1 text-right tabular-nums text-gray-600 dark:text-gray-400">{fmt(n(c.total))}</td>
                          <td className="py-1 pl-3">{macroBadge(c.dre_macro_atual)}</td>
                          <td className="py-1 text-center">{c.na_orcamentacao ? '✓' : <span className="text-gray-300">–</span>}</td>
                          <td className="py-1 text-center">{c.na_dfc ? '✓' : <span className="text-gray-300">–</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
