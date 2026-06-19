'use client';

import { useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart } from 'lucide-react';

interface MixCat {
  categoria: string;
  faturamento: number;
  quantidade: number;
  custo: number;
  skus: number;
  margem_pct: number | null;
}
interface CmvMes {
  mes: string;
  cmv_total: number;
  cma_alimentacao: number;
  faturamento_liquido: number;
  cmv_pct: number | null;
  cma_pct: number | null;
}

const moeda = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
const mesLabel = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

const COR_CAT: Record<string, string> = {
  BEBIDA: 'bg-amber-500',
  DRINK: 'bg-violet-500',
  COMIDA: 'bg-emerald-500',
  SEM_CATEGORIA: 'bg-gray-400',
};

/**
 * Mix & Margem por Categoria — surfacing das views gold.mix_produtos_diario
 * (composição de vendas BEBIDA/DRINK/COMIDA) e gold.cma_alimentacao_mensal
 * (CMV total vs custo de comida, % sobre faturamento). Self-contained.
 */
export default function MixCategoriaPage() {
  const { selectedBar } = useBar();
  const [loading, setLoading] = useState(true);
  const [mix, setMix] = useState<MixCat[]>([]);
  const [cmv, setCmv] = useState<CmvMes[]>([]);

  useEffect(() => {
    if (!selectedBar?.id) return;
    let ativo = true;
    setLoading(true);
    fetch('/api/ferramentas/mix-categoria?dias=30', {
      headers: { 'x-selected-bar-id': String(selectedBar.id) },
    })
      .then((r) => r.json())
      .then((j) => {
        if (!ativo) return;
        setMix(j.success ? j.mix : []);
        setCmv(j.success ? j.cmv : []);
      })
      .catch(() => { if (ativo) { setMix([]); setCmv([]); } })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [selectedBar?.id]);

  const totalFat = mix.reduce((s, m) => s + Number(m.faturamento || 0), 0);

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PieChart className="w-6 h-6 text-indigo-600" /> Mix &amp; Margem por Categoria
        </h1>
        <p className="text-sm text-muted-foreground">
          Composição das vendas por categoria (últimos 30 dias) e custo de mercadoria (CMV) mensal.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Mix de vendas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Mix de vendas (30 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              {mix.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sem vendas no período.</p>
              ) : (
                <>
                  {/* barra de composição */}
                  <div className="flex h-3 w-full rounded overflow-hidden mb-3">
                    {mix.map((m) => {
                      const pct = totalFat > 0 ? (m.faturamento / totalFat) * 100 : 0;
                      return <div key={m.categoria} className={COR_CAT[m.categoria] || 'bg-gray-400'} style={{ width: `${pct}%` }} title={`${m.categoria} ${pct.toFixed(1)}%`} />;
                    })}
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b">
                        <th className="text-left py-1 font-medium">Categoria</th>
                        <th className="text-right py-1 font-medium">Faturamento</th>
                        <th className="text-right py-1 font-medium">% Mix</th>
                        <th className="text-right py-1 font-medium">Margem*</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mix.map((m) => {
                        const pct = totalFat > 0 ? (m.faturamento / totalFat) * 100 : 0;
                        return (
                          <tr key={m.categoria} className="border-b last:border-0 border-[hsl(var(--border))]">
                            <td className="py-1.5 flex items-center gap-2">
                              <span className={`inline-block w-2.5 h-2.5 rounded-sm ${COR_CAT[m.categoria] || 'bg-gray-400'}`} />
                              {m.categoria}
                            </td>
                            <td className="text-right py-1.5">{moeda(m.faturamento)}</td>
                            <td className="text-right py-1.5 font-medium">{pct.toFixed(1)}%</td>
                            <td className="text-right py-1.5">{m.margem_pct != null ? `${m.margem_pct.toFixed(1)}%` : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    *Custo de produto só vem preenchido para BEBIDA na origem — margem de DRINK/COMIDA é otimista.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* CMV mensal */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">CMV mensal (custo de mercadoria)</CardTitle>
            </CardHeader>
            <CardContent>
              {cmv.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sem dados de CMV no período.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b">
                        <th className="text-left py-1 font-medium">Mês</th>
                        <th className="text-right py-1 font-medium">CMV total</th>
                        <th className="text-right py-1 font-medium">CMV %</th>
                        <th className="text-right py-1 font-medium">Comida %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cmv.map((c) => (
                        <tr key={c.mes} className="border-b last:border-0 border-[hsl(var(--border))]">
                          <td className="py-1.5 capitalize">{mesLabel(c.mes)}</td>
                          <td className="text-right py-1.5">{moeda(c.cmv_total)}</td>
                          <td className={`text-right py-1.5 font-medium ${(c.cmv_pct || 0) >= 35 ? 'text-red-600' : ''}`}>
                            {c.cmv_pct != null ? `${c.cmv_pct.toFixed(1)}%` : '—'}
                          </td>
                          <td className="text-right py-1.5">{c.cma_pct != null ? `${c.cma_pct.toFixed(1)}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    CMV = custo de insumos sobre faturamento. &ldquo;Comida %&rdquo; é a fatia de alimentação do CMV (≠ CMA de refeição de equipe). Deboche não separa custo de comida no CMV.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
