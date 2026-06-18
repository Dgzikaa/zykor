'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronRight } from 'lucide-react';

type Linha = { mes: string; grupo_dfc: string; categoria: string; categoria_macro?: string; ordem_macro?: number; ordem_sub?: number; entradas: number; saidas: number; net: number };

const MES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const GRUPOS = ['OPERACIONAL', 'INVESTIMENTO', 'FINANCIAMENTO'] as const;
const GRUPO_LABEL: Record<string, string> = {
  OPERACIONAL: 'Fluxo Operacional', INVESTIMENTO: 'Fluxo de Investimento', FINANCIAMENTO: 'Fluxo de Financiamento',
};
const n = (x: unknown) => Number(x) || 0;
const fmt = (v: number) => v === 0 ? '–' : `${v < 0 ? '-' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

export default function DfcPage() {
  const { selectedBar } = useBar();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [soConciliado, setSoConciliado] = useState(true); // padrão: só conciliado (decisão do sócio)
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!selectedBar) return;
    setLoading(true);
    fetch(`/api/financeiro/dfc?bar_id=${selectedBar.id}&ano=${ano}&conciliado=${soConciliado ? '1' : '0'}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setLinhas(Array.isArray(d.linhas) ? d.linhas : []))
      .catch(() => setLinhas([]))
      .finally(() => setLoading(false));
  }, [selectedBar, ano, soConciliado]);

  // mesNum (1-12) -> net, por grupo e por categoria
  const dados = useMemo(() => {
    const grupoMes: Record<string, number[]> = {};        // grupo -> [12] net
    const catMes: Record<string, Record<string, number[]>> = {}; // grupo -> categoria -> [12] net
    const catOrder: Record<string, [number, number]> = {};       // categoria -> [ordem_macro, ordem_sub] (ordem da DRE)
    for (const g of GRUPOS) { grupoMes[g] = Array(12).fill(0); catMes[g] = {}; }
    for (const l of linhas) {
      const m = new Date(l.mes + 'T00:00:00').getMonth(); // 0-11
      const g = l.grupo_dfc;
      if (!grupoMes[g]) continue;
      grupoMes[g][m] += n(l.net);
      (catMes[g][l.categoria] ||= Array(12).fill(0))[m] += n(l.net);
      catOrder[l.categoria] = [l.ordem_macro ?? 999, l.ordem_sub ?? 999];
    }
    const variacao = Array(12).fill(0).map((_, m) => GRUPOS.reduce((s, g) => s + grupoMes[g][m], 0));
    return { grupoMes, catMes, catOrder, variacao };
  }, [linhas]);

  const cor = (v: number) => v > 0 ? 'text-emerald-600 dark:text-emerald-400' : v < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400';

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Demonstrativo de Fluxo de Caixa (DFC)</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Por caixa (data de pagamento) · {selectedBar?.nome || 'Bar'} · derivado do Conta Azul (exclui ajustes não-caixa).
            {soConciliado ? ' Mostrando só o que foi conciliado no banco.' : ' "Baixado no CA" (não reflete conciliação bancária).'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none" title="Conta só o que foi conciliado no extrato do banco (exclui pago-mas-não-conciliado, ex.: dinheiro e ajustes).">
            <input type="checkbox" checked={soConciliado} onChange={e => setSoConciliado(e.target.checked)} className="accent-emerald-600" />
            Só conciliado
          </label>
          <select value={ano} onChange={e => setAno(Number(e.target.value))} className="h-8 text-sm border rounded px-2 bg-white dark:bg-gray-800">
            {[2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {loading ? <Skeleton className="h-[500px]" /> : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-800/60">
                <th className="text-left font-semibold px-3 py-2 sticky left-0 bg-gray-50 dark:bg-gray-800/60 z-10 min-w-[220px]">Grupo / Categoria</th>
                {MES_ABBR.map((m, i) => <th key={i} className="text-right font-semibold px-3 py-2 whitespace-nowrap min-w-[100px]">{m}</th>)}
              </tr>
            </thead>
              {GRUPOS.map(g => {
                const aberto = !!abertos[g];
                const cats = Object.entries(dados.catMes[g]).sort((a, b) => {
                  const oa = dados.catOrder[a[0]] ?? [999, 999], ob = dados.catOrder[b[0]] ?? [999, 999];
                  return oa[0] - ob[0] || oa[1] - ob[1] || a[0].localeCompare(b[0]); // ordem da DRE
                });
                return (
                  <tbody key={g}>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 font-bold cursor-pointer" onClick={() => setAbertos(p => ({ ...p, [g]: !p[g] }))}>
                      <td className="px-3 py-1.5 sticky left-0 bg-gray-50/70 dark:bg-gray-800/40 flex items-center gap-1 whitespace-nowrap">
                        {aberto ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                        {GRUPO_LABEL[g]}
                      </td>
                      {dados.grupoMes[g].map((v, m) => <td key={m} className={`px-3 py-1.5 text-right tabular-nums whitespace-nowrap ${cor(v)}`}>{fmt(v)}</td>)}
                    </tr>
                    {aberto && cats.map(([cat, arr]) => (
                      <tr key={cat} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-1 pl-8 sticky left-0 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 whitespace-nowrap">{cat}</td>
                        {arr.map((v, m) => <td key={m} className={`px-3 py-1 text-right tabular-nums whitespace-nowrap ${cor(v)}`}>{fmt(v)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                );
              })}
              <tbody>
                <tr className="border-t-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20 font-bold">
                  <td className="px-3 py-2 sticky left-0 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 whitespace-nowrap">Variação de Caixa</td>
                  {dados.variacao.map((v, m) => <td key={m} className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${cor(v)}`}>{fmt(v)}</td>)}
                </tr>
              </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
