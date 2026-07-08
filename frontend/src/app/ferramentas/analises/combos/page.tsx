'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Layers, ArrowRight, Search } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';

const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(n);

export default function CombosPage() {
  const { selectedBar } = useBar();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState(60);
  const [incluirBanda, setIncluirBanda] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState<string | null>(null);
  const { setPageTitle } = usePageTitle();

  useEffect(() => { setPageTitle('🔗 Combos que convertem'); return () => setPageTitle(''); }, [setPageTitle]);

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    fetch(`/api/combos?bar_id=${selectedBar.id}&dias=${dias}&incluir_banda=${incluirBanda ? 1 : 0}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [selectedBar?.id, dias, incluirBanda]);

  const combos = data?.combos || [];

  const produtos = useMemo(() => {
    const set = new Map<string, { qtd: number; grp: string }>();
    for (const c of combos) {
      const cur = set.get(c.produto_a);
      if (!cur || cur.qtd < c.comandas_com_a) set.set(c.produto_a, { qtd: c.comandas_com_a, grp: c.grp_a });
    }
    const arr = Array.from(set.entries()).map(([nome, v]) => ({ nome, ...v }));
    return arr.filter(p => !filtro || p.nome.toLowerCase().includes(filtro.toLowerCase())).sort((a, b) => b.qtd - a.qtd);
  }, [combos, filtro]);

  const combosDoProduto = useMemo(() => {
    if (!produtoSelecionado) return [];
    return combos.filter((c: any) => c.produto_a === produtoSelecionado).slice(0, 10);
  }, [combos, produtoSelecionado]);

  const topCombos = useMemo(() => {
    const seen = new Set<string>();
    const out: any[] = [];
    // Ordena por confidence (% de chance) — sócio quer saber o combo mais provável
    for (const c of [...combos].sort((a: any, b: any) => Number(b.confidence_pct) - Number(a.confidence_pct))) {
      const key = [c.produto_a, c.produto_b].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
      if (out.length >= 20) break;
    }
    return out;
  }, [combos]);

  if (loading) return <main className="max-w-7xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Layers className="w-6 h-6 text-pink-600" /> Combos que convertem</h1>
          <p className="text-sm text-gray-500">
            Market basket: pra cada produto, quais outros aparecem na mesma mesa. Use pra treinar garçom em upsell.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-xs flex items-center gap-1">
            <input type="checkbox" checked={incluirBanda} onChange={e => setIncluirBanda(e.target.checked)} />
            Incluir [Banda]
          </label>
          <select value={dias} onChange={e => setDias(parseInt(e.target.value, 10))}
            className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
            <option value={30}>30d</option>
            <option value={60}>60d</option>
            <option value={90}>90d</option>
            <option value={180}>180d</option>
          </select>
        </div>
      </div>

      {/* Top combos por lift */}
      <Card className="p-4">
        <h2 className="font-semibold mb-3">🔥 Top 20 combos mais prováveis (ordenado por confidence)</h2>
        <p className="text-xs text-gray-500 mb-3">
          <strong>Confidence</strong> = de toda vez que o cliente pede A, % das vezes que ele também pede B. Quanto maior, mais provável o combo. <strong>Lift</strong> = força além do acaso (lift &gt; 5 = muito associado).
        </p>
        <div className="space-y-2">
          {topCombos.map((c: any, i: number) => (
            <div key={i} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-800 rounded-md">
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">{c.grp_a}</Badge>
                <span className="font-semibold">{c.produto_a}</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <Badge variant="outline" className="text-xs">{c.grp_b}</Badge>
                <span className="font-semibold">{c.produto_b}</span>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-500">{c.comandas_com_ambos} comandas</p>
                <p className="text-sm font-bold text-pink-600">{c.confidence_pct}% confidence</p>
                <p className="text-[10px] text-gray-400">lift {c.lift}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Drilldown por produto */}
      <Card className="p-4">
        <h2 className="font-semibold mb-3">🔍 Sugestão por produto (drilldown)</h2>
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
          <div>
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar produto..." className="pl-9" />
            </div>
            <div className="max-h-[400px] overflow-y-auto space-y-1">
              {produtos.slice(0, 60).map(p => (
                <button key={p.nome}
                  onClick={() => setProdutoSelecionado(p.nome)}
                  className={`w-full text-left p-2 rounded text-xs border ${produtoSelecionado === p.nome ? 'bg-pink-50 dark:bg-pink-900/20 border-pink-300' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-900/40'}`}>
                  <p className="font-medium truncate">{p.nome}</p>
                  <p className="text-[10px] text-gray-500">{p.grp} · {fmt(p.qtd)} comandas</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            {!produtoSelecionado && <p className="text-sm text-gray-400 py-8 text-center">Selecione um produto à esquerda pra ver o que mais sai junto.</p>}
            {produtoSelecionado && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 mb-2">
                  Quem pede <strong>{produtoSelecionado}</strong>, também pede:
                </p>
                {combosDoProduto.length === 0 && <p className="text-sm text-gray-400">Sem combo significativo.</p>}
                {combosDoProduto.map((c: any) => (
                  <div key={c.produto_b} className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-800 rounded">
                    <div>
                      <span className="font-medium">{c.produto_b}</span>
                      <Badge variant="outline" className="text-[10px] ml-2">{c.grp_b}</Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-pink-600">{c.confidence_pct}%</p>
                      <p className="text-[10px] text-gray-500">{c.comandas_com_ambos}/{c.comandas_com_a} · lift {c.lift}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </main>
  );
}
