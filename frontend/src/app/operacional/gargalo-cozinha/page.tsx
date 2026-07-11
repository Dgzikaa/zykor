'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Timer, Truck, Users, AlertTriangle } from 'lucide-react';
import {
  HeroRow,
  ChartCard,
  ChartGrid,
  GraficoBarra,
  GraficoBarraH,
  type Kpi,
} from '@/components/graficos/Charts';

const fmtMin = (n: number | null | undefined) =>
  n == null ? '—' : `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} min`;
const fmtPct = (n: number | null | undefined) =>
  n == null ? '—' : `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const fmtInt = (n: number | null | undefined) =>
  n == null ? '—' : Number(n).toLocaleString('pt-BR');

type Categoria = 'cozinha' | 'bar' | 'todos';

interface Resp {
  success: boolean;
  kpis?: { pedidos: number; mediana_min: number | null; p90_min: number | null; atraso_pct: number | null };
  por_praca?: { setor: string; pedidos: number; mediana_min: number; p90_min: number; atraso_pct: number }[];
  por_hora?: { hora: number; pedidos: number; mediana_min: number; p90_min: number; atraso_pct: number }[];
  itens?: { produto: string; pedidos: number; mediana_min: number; atraso_pct: number }[];
  decomposicao?: { fila_min: number | null; preparo_min: number | null; expedicao_min: number | null };
  meta?: { metrica: string; limite_cozinha_seg: number; limite_bar_seg: number; dias: number; categoria: string; desde: string };
}

const PERIODOS = [7, 30, 90] as const;
const CATEGORIAS: { key: Categoria; label: string }[] = [
  { key: 'cozinha', label: 'Cozinha' },
  { key: 'bar', label: 'Bar' },
  { key: 'todos', label: 'Todos' },
];

export default function GargaloCozinhaPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(30);
  const [categoria, setCategoria] = useState<Categoria>('cozinha');
  const { data, isLoading: loading } = useApiSWR<Resp>(
    selectedBar?.id ? `/api/operacional/gargalo-cozinha?bar_id=${selectedBar.id}&dias=${dias}&categoria=${categoria}` : null
  );

  useEffect(() => {
    setPageTitle('⏱️ Gargalo de Cozinha');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const k = data?.kpis;
  const limiteMin = useMemo(() => {
    const seg = categoria === 'bar' ? data?.meta?.limite_bar_seg : data?.meta?.limite_cozinha_seg;
    return seg ? seg / 60 : null;
  }, [categoria, data?.meta]);

  const kpis: Kpi[] = useMemo(() => {
    if (!k) return [];
    return [
      { label: 'Pedidos no período', valor: fmtInt(k.pedidos), icon: Users },
      { label: 'Tempo mediano', valor: fmtMin(k.mediana_min), icon: Clock, sub: limiteMin ? `limite ${fmtMin(limiteMin)}` : undefined },
      { label: 'P90 (9 em 10 saem até)', valor: fmtMin(k.p90_min), icon: Timer },
      { label: '% de atraso', valor: fmtPct(k.atraso_pct), icon: AlertTriangle, invLower: true, cor: (k.atraso_pct ?? 0) >= 25 ? '#ef4444' : undefined },
    ];
  }, [k, limiteMin]);

  // Decomposição fila → preparo → expedição (em minutos), como ranking horizontal
  const decomp = useMemo(() => {
    const d = data?.decomposicao;
    if (!d) return [];
    const linhas = [
      { etapa: 'Fila (pediu → começou)', min: d.fila_min },
      { etapa: 'Preparo (começou → pronto)', min: d.preparo_min },
      { etapa: 'Expedição (pronto → entregue)', min: d.expedicao_min },
    ];
    return linhas.filter((l) => l.min != null) as { etapa: string; min: number }[];
  }, [data?.decomposicao]);

  const amostraBaixa = !!k && k.pedidos < 50;

  if (!selectedBar?.id) {
    return <div className="p-6 text-sm text-gray-500">Selecione um bar.</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-[hsl(var(--border))] p-0.5">
          {CATEGORIAS.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategoria(c.key)}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                categoria === c.key ? 'bg-[hsl(var(--primary))] text-white' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
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
        {data?.meta?.metrica === 't0_t2' && (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            métrica: pedido → pronto (entrega não rastreada neste bar)
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : !data?.success || !k || k.pedidos === 0 ? (
        <div className="rounded-xl border border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Sem dados de produção para este bar/período.
        </div>
      ) : (
        <>
          <HeroRow kpis={kpis} cols={4} />

          {amostraBaixa && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Amostra baixa ({fmtInt(k.pedidos)} pedidos no período) — os números podem oscilar. O rastreio de tempos neste bar/setor ainda é parcial.
            </div>
          )}

          <ChartGrid cols={2}>
            <ChartCard titulo="Onde trava — % de atraso por praça" subtitulo="ordenado do pior pro melhor">
              <GraficoBarraH
                data={data.por_praca || []}
                xKey="setor"
                valueKey="atraso_pct"
                formatV={fmtPct}
                corPorItem={(d) => ((d.atraso_pct ?? 0) >= 25 ? '#ef4444' : (d.atraso_pct ?? 0) >= 15 ? '#f59e0b' : '#10b981')}
              />
            </ChartCard>

            <ChartCard titulo="Decomposição do tempo" subtitulo="onde o tempo é gasto, em média">
              <GraficoBarraH data={decomp} xKey="etapa" valueKey="min" formatV={fmtMin} cor="#6366f1" />
              <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                <Truck className="inline h-3.5 w-3.5 mr-1" />
                Expedição alta = prato pronto parado esperando runner (problema de saída, não de cozinha).
              </p>
            </ChartCard>

            <ChartCard titulo="Quando trava — por hora do dia" subtitulo="volume de pedidos × % de atraso" span={2}>
              <GraficoBarra
                data={data.por_hora || []}
                xKey="hora"
                valueKey="pedidos"
                lineKey="atraso_pct"
                formatV={fmtInt}
                formatLine={fmtPct}
                nomeBarra="Pedidos"
                nomeLinha="% atraso"
                corLinha="#ef4444"
              />
            </ChartCard>
          </ChartGrid>

          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <h3 className="mb-3 text-sm font-semibold">Itens que mais atrasam</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                    <th className="py-2 pr-3 font-medium">Item</th>
                    <th className="py-2 px-3 font-medium text-right">Pedidos</th>
                    <th className="py-2 px-3 font-medium text-right">Tempo mediano</th>
                    <th className="py-2 pl-3 font-medium text-right">% atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.itens || []).map((it) => (
                    <tr key={it.produto} className="border-b border-[hsl(var(--border))]/50">
                      <td className="py-2 pr-3 truncate max-w-[280px]" title={it.produto}>{it.produto}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtInt(it.pedidos)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtMin(it.mediana_min)}</td>
                      <td className={`py-2 pl-3 text-right tabular-nums font-medium ${it.atraso_pct >= 25 ? 'text-red-500' : it.atraso_pct >= 15 ? 'text-amber-500' : ''}`}>
                        {fmtPct(it.atraso_pct)}
                      </td>
                    </tr>
                  ))}
                  {(data.itens || []).length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-[hsl(var(--muted-foreground))]">Sem itens com volume suficiente no período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
