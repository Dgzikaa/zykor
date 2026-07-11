'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Gauge, TrendingDown, TrendingUp } from 'lucide-react';
import { HeroRow, ChartCard, GraficoBarra, type Kpi } from '@/components/graficos/Charts';

const fmtBRL = (n: number | null | undefined) =>
  n == null ? 'R$ 0' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const fmtBRLk = (n: number | null | undefined) => {
  const v = Number(n || 0);
  return v >= 1000 ? `R$ ${(v / 1000).toFixed(1).replace('.', ',')}k` : fmtBRL(v);
};
const fmtN = (n: number | null | undefined, d = 1) => (n == null ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: d }));

interface Hora { hora: number; pessoas: number; vendas: number; prod: number | null; status: 'sobra' | 'aperto' | 'ok' | 'fechado' }
interface Resp {
  success: boolean;
  por_hora?: Hora[];
  kpis?: { pico_gente: { hora: number; pessoas: number } | null; prod_mediana: number; horas_sobra: number; horas_aperto: number };
  meta?: { dias: number; bar: string };
}

const PERIODOS = [30, 90] as const;
const COR: Record<string, string> = { sobra: '#ef4444', aperto: '#3b82f6', ok: '#10b981', fechado: '#9ca3af' };
const ROTULO: Record<string, string> = { sobra: 'Gente demais', aperto: 'Gente de menos', ok: 'Equilibrado', fechado: '—' };

export default function EscalaProdutividadePage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(90);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPageTitle('👥 Escala × Venda');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    fetch(`/api/operacional/escala-produtividade?bar_id=${selectedBar.id}&dias=${dias}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [selectedBar?.id, dias]);

  const k = data?.kpis;
  const horas = useMemo(() => (data?.por_hora || []).map((h) => ({ ...h, label: `${h.hora}h` })), [data?.por_hora]);
  const temDados = horas.some((h) => h.pessoas > 0);

  const kpis: Kpi[] = useMemo(() => {
    if (!k) return [];
    return [
      { label: 'Pico de gente', valor: k.pico_gente ? `${fmtN(k.pico_gente.pessoas)} às ${k.pico_gente.hora}h` : '—', icon: Users },
      { label: 'Produtividade mediana', valor: `${fmtBRL(k.prod_mediana)}/pessoa·h`, icon: Gauge },
      { label: 'Horas com gente demais', valor: String(k.horas_sobra ?? 0), icon: TrendingDown, cor: (k.horas_sobra ?? 0) > 0 ? '#ef4444' : undefined },
      { label: 'Horas apertadas', valor: String(k.horas_aperto ?? 0), icon: TrendingUp, cor: '#3b82f6' },
    ];
  }, [k]);

  if (!selectedBar?.id) return <div className="p-6 text-sm text-gray-500">Selecione um bar.</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-[hsl(var(--border))] p-0.5">
          {PERIODOS.map((p) => (
            <button
              key={p}
              onClick={() => setDias(p)}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                dias === p ? 'bg-[hsl(var(--primary))] text-white' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          média por hora do dia · gente = ponto Tangerino · <span style={{ color: COR.sobra }}>vermelho = gente demais p/ venda</span>, <span style={{ color: COR.aperto }}>azul = pouca gente</span>
        </span>
      </div>

      {loading ? (
        <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-72 w-full" /></div>
      ) : !data?.success || !temDados ? (
        <div className="rounded-xl border border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Sem dados de ponto para este bar/período.
        </div>
      ) : (
        <>
          <HeroRow kpis={kpis} cols={4} />

          <ChartCard titulo="Gente × Venda por hora" subtitulo="barras = pessoas no ponto · linha = venda média · cor = escala vs demanda">
            <GraficoBarra
              data={horas}
              xKey="label"
              valueKey="pessoas"
              lineKey="vendas"
              formatV={(v) => fmtN(v)}
              formatLine={fmtBRLk}
              nomeBarra="Pessoas"
              nomeLinha="Venda média"
              corLinha="#f59e0b"
              corPorItem={(_v, i) => COR[horas[i]?.status] || COR.ok}
              height={360}
            />
          </ChartCard>

          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <h3 className="mb-3 text-sm font-semibold">Detalhe por hora</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                    <th className="py-2 pr-3 font-medium">Hora</th>
                    <th className="py-2 px-3 font-medium text-right">Pessoas</th>
                    <th className="py-2 px-3 font-medium text-right">Venda média</th>
                    <th className="py-2 px-3 font-medium text-right">R$/pessoa·h</th>
                    <th className="py-2 pl-3 font-medium">Escala</th>
                  </tr>
                </thead>
                <tbody>
                  {horas.filter((h) => h.pessoas > 0 || h.vendas > 0).map((h) => (
                    <tr key={h.hora} className="border-b border-[hsl(var(--border))]/50">
                      <td className="py-2 pr-3 font-medium">{h.hora}h</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtN(h.pessoas)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtBRL(h.vendas)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{h.prod == null ? '—' : fmtBRL(h.prod)}</td>
                      <td className="py-2 pl-3">
                        {h.status !== 'fechado' && (
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COR[h.status] }} />
                            {ROTULO[h.status]}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
