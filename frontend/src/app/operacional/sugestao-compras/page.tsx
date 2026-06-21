'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, ShoppingCart, AlertTriangle } from 'lucide-react';

type Item = {
  nome: string; categoria: string | null; fornecedor: string; embalagem: string | null; unidade: string | null;
  custo: number; estoque_atual: number; ultima_contagem: string | null; consumo_dia: number;
  necessidade: number; sugestao_comprar: number; valor_estimado: number;
};

const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export default function SugestaoComprasPage() {
  const { selectedBar } = useBar();
  const [area, setArea] = useState<'bar' | 'cozinha'>('bar');
  const [dias, setDias] = useState(7);
  const [itens, setItens] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState<Record<string, boolean>>({});

  const carregar = useCallback(async () => {
    if (!selectedBar?.id) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/operacional/sugestao-compras?area=${area}&dias=${dias}`, { cache: 'no-store' });
      const j = await r.json();
      setItens(j.success ? j.itens : []);
    } catch { setItens([]); } finally { setLoading(false); }
  }, [selectedBar?.id, area, dias]);

  useEffect(() => { carregar(); }, [carregar]);

  // agrupa por fornecedor, ordenado por valor total desc
  const grupos = useMemo(() => {
    const m = new Map<string, { itens: Item[]; total: number }>();
    for (const i of itens) {
      const g = m.get(i.fornecedor) || { itens: [], total: 0 };
      g.itens.push(i); g.total += i.valor_estimado; m.set(i.fornecedor, g);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [itens]);

  const totalGeral = useMemo(() => itens.reduce((s, i) => s + i.valor_estimado, 0), [itens]);
  const contagemVelha = useMemo(() => {
    const datas = itens.map(i => i.ultima_contagem).filter(Boolean).sort() as string[];
    return datas.length ? datas[datas.length - 1] : null;
  }, [itens]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Sugestão de Compras</h1>
          <p className="text-xs text-muted-foreground">
            {selectedBar?.nome} · estoque atual + consumo médio/dia × cobertura − estoque. Exclui preparos (Produção).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden">
            {(['bar', 'cozinha'] as const).map(a => (
              <button key={a} onClick={() => setArea(a)}
                className={`px-3 h-8 text-sm capitalize ${area === a ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-gray-800'}`}>{a}</button>
            ))}
          </div>
          <select value={dias} onChange={e => setDias(Number(e.target.value))} className="h-8 text-sm border rounded px-2 bg-white dark:bg-gray-800">
            {[7, 14, 21, 30].map(d => <option key={d} value={d}>Cobertura {d} dias</option>)}
          </select>
        </div>
      </div>

      {contagemVelha && (
        <div className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Baseado na última contagem disponível ({new Date(contagemVelha + 'T00:00:00').toLocaleDateString('pt-BR')}). Faça uma contagem recente para a sugestão refletir o estoque de hoje.
        </div>
      )}

      {loading ? <Skeleton className="h-[400px]" /> : itens.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">Nada a comprar nessa cobertura (ou sem histórico de consumo).</Card>
      ) : (
        <>
          <Card className="p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{itens.length} item(ns) · {grupos.length} fornecedor(es)</span>
            <span className="text-base font-bold">Total estimado: {fmtBRL(totalGeral)}</span>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left px-3 py-2 min-w-[200px]">Fornecedor / Item</th>
                  <th className="text-right px-3 py-2 whitespace-nowrap">Estoque</th>
                  <th className="text-right px-3 py-2 whitespace-nowrap">Consumo/dia</th>
                  <th className="text-right px-3 py-2 whitespace-nowrap">Comprar</th>
                  <th className="text-right px-3 py-2 whitespace-nowrap">Valor est.</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map(([forn, g]) => {
                  const ab = aberto[forn] !== false; // default aberto
                  return (
                    <Fragment key={forn}>
                      <tr className="border-b bg-muted/40 font-semibold cursor-pointer" onClick={() => setAberto(p => ({ ...p, [forn]: !ab }))}>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1">
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${ab ? 'rotate-90' : ''}`} />
                            {forn} <span className="text-muted-foreground font-normal">({g.itens.length})</span>
                          </div>
                        </td>
                        <td colSpan={3} />
                        <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(g.total)}</td>
                      </tr>
                      {ab && g.itens.map((i, idx) => (
                        <tr key={forn + idx} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-muted/20">
                          <td className="px-3 py-1 pl-8">
                            {i.nome} {i.embalagem && <span className="text-xs text-muted-foreground">· {i.embalagem}</span>}
                          </td>
                          <td className="px-3 py-1 text-right tabular-nums text-muted-foreground">{fmtNum(i.estoque_atual)} {i.unidade}</td>
                          <td className="px-3 py-1 text-right tabular-nums text-muted-foreground">{fmtNum(i.consumo_dia)}</td>
                          <td className="px-3 py-1 text-right tabular-nums font-medium">{fmtNum(i.sugestao_comprar)}</td>
                          <td className="px-3 py-1 text-right tabular-nums">{i.valor_estimado > 0 ? fmtBRL(i.valor_estimado) : '—'}</td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
