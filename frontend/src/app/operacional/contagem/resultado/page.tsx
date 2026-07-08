'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { TrendingUp, AlertTriangle, ChevronLeft } from 'lucide-react';

type Item = { codigo: string; nome: string; categoria: string | null; unidade: string | null; anterior: number; contado: number; consumo: number; valor_consumo: number; esperado: number | null; variacao_pct: number | null; anomalo: boolean };
type Resumo = { total_consumo: number; qtd_itens: number; qtd_anomalos: number };

const fmtBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
const hoje = () => new Date().toISOString().slice(0, 10);

export default function ResultadoContagemPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  useEffect(() => { setPageTitle('📈 Resultado da Contagem'); return () => setPageTitle(''); }, [setPageTitle]);
  const [data, setData] = useState(hoje());
  const [itens, setItens] = useState<Item[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    if (!selectedBar?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/operacional/contagem?modo=resultado&data=${data}`);
      setItens(res.itens || []); setResumo(res.resumo || null);
    } finally { setLoading(false); }
  }, [selectedBar?.id, data]);
  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [carregar]);

  const anomalos = itens.filter(i => i.anomalo);
  const ranking = itens.slice().sort((a, b) => (b.valor_consumo || 0) - (a.valor_consumo || 0)).slice(0, 20);

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-3 py-4 max-w-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/operacional/contagem"><ChevronLeft className="w-5 h-5" /></Link>
          <TrendingUp className="w-5 h-5" /><h1 className="text-xl font-bold">Resultado da Contagem</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-3">Consumo do período, esperado (pela média histórica) e itens com consumo fora do padrão.</p>

        <Input type="date" value={data} onChange={e => setData(e.target.value)} className="w-44 mb-4" />

        {resumo && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Consumido (R$)</div><div className="text-lg font-bold">{fmtBRL(resumo.total_consumo)}</div></CardContent></Card>
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Itens</div><div className="text-lg font-bold">{resumo.qtd_itens}</div></CardContent></Card>
            <Card className={resumo.qtd_anomalos ? 'border-red-500/60' : ''}><CardContent className="py-3"><div className="text-xs text-muted-foreground">Fora do padrão</div><div className={`text-lg font-bold ${resumo.qtd_anomalos ? 'text-red-600' : ''}`}>{resumo.qtd_anomalos}</div></CardContent></Card>
          </div>
        )}

        {loading ? <Skeleton className="h-64" /> : (
          <>
            {anomalos.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-red-600 mb-2"><AlertTriangle className="w-4 h-4" />Consumo acima do esperado ({anomalos.length})</div>
                <div className="space-y-1.5">
                  {anomalos.map(i => (
                    <div key={i.codigo} className="rounded-lg border border-red-500/40 bg-red-50 dark:bg-red-900/10 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{i.nome}</span>
                        <span className="text-sm font-bold text-red-600 whitespace-nowrap">+{i.variacao_pct}%</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">consumo {i.consumo} {i.unidade} · esperado {i.esperado} · {fmtBRL(i.valor_consumo)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-sm font-semibold text-muted-foreground mb-2">Maiores consumos (R$)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr><th className="text-left py-1.5 pr-2">Item</th><th className="text-right pr-2">Consumo</th><th className="text-right pr-2">Esperado</th><th className="text-right">R$</th></tr>
                </thead>
                <tbody>
                  {ranking.map(i => (
                    <tr key={i.codigo} className="border-b last:border-0">
                      <td className="py-1.5 pr-2 truncate max-w-[180px]">{i.nome}</td>
                      <td className="pr-2 text-right whitespace-nowrap">{i.consumo} {i.unidade}</td>
                      <td className="pr-2 text-right whitespace-nowrap text-muted-foreground">{i.esperado ?? '—'}</td>
                      <td className="text-right whitespace-nowrap font-medium">{fmtBRL(i.valor_consumo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {itens.length === 0 && <div className="py-10 text-center text-muted-foreground text-sm">Sem contagem nessa data (ou sem consumo).</div>}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
