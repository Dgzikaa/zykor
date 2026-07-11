'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Receipt, Percent, Wine } from 'lucide-react';
import { HeroRow, ChartCard, ChartGrid, GraficoBarraH, type Kpi } from '@/components/graficos/Charts';

const fmtBRL = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const fmtBRL2 = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
const fmtPct = (n: number | null | undefined) =>
  n == null ? '—' : `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const fmtN = (n: number | null | undefined, d = 1) =>
  n == null ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: d });

interface Garcom {
  garcom: string;
  vendas: number;
  comandas: number;
  itens: number;
  ticket_medio: number;
  itens_por_comanda: number;
  desconto: number;
  desconto_pct: number;
  bebida_attach_pct: number;
  bebida_vendas_pct: number;
}
interface Resp {
  success: boolean;
  casa?: { vendas: number; comandas: number; ticket_medio: number; itens_por_comanda: number; desconto_pct: number };
  garcons?: Garcom[];
  meta?: { dias: number; min_comandas: number; desde: string };
}

const PERIODOS = [7, 30, 90] as const;

export default function RaioXGarcomPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(30);
  const { data, isLoading: loading } = useApiSWR<Resp>(
    selectedBar?.id ? `/api/operacional/raio-x-garcom?bar_id=${selectedBar.id}&dias=${dias}` : null
  );

  useEffect(() => {
    setPageTitle('🧑‍🍳 Raio-x por Garçom');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const casa = data?.casa;
  const garcons = data?.garcons || [];
  const descMedio = casa?.desconto_pct ?? 0;

  const kpis: Kpi[] = useMemo(() => {
    if (!casa) return [];
    return [
      { label: 'Vendas (equipe)', valor: fmtBRL(casa.vendas), icon: DollarSign },
      { label: 'Ticket médio / mesa', valor: fmtBRL2(casa.ticket_medio), icon: Receipt },
      { label: 'Itens / mesa', valor: fmtN(casa.itens_por_comanda), icon: Receipt },
      { label: 'Desconto médio', valor: fmtPct(casa.desconto_pct), icon: Percent, invLower: true },
    ];
  }, [casa]);

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
          por <b>quem lançou</b> o item · mesa é compartilhada entre garçons (compare entre eles, não com a casa)
        </span>
      </div>

      {loading ? (
        <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-72 w-full" /></div>
      ) : !data?.success || !casa || garcons.length === 0 ? (
        <div className="rounded-xl border border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Sem dados de venda para este bar/período.
        </div>
      ) : (
        <>
          <HeroRow kpis={kpis} cols={4} />

          <ChartGrid cols={2}>
            <ChartCard titulo="Vendas por garçom" subtitulo="R$ lançado no período">
              <GraficoBarraH data={garcons} xKey="garcom" valueKey="vendas" formatV={fmtBRL} cor="#10b981" maxItens={20} />
            </ChartCard>
            <ChartCard titulo="Quem puxa bebida" subtitulo="% das mesas com bebida (attach)">
              <GraficoBarraH
                data={[...garcons].sort((a, b) => b.bebida_attach_pct - a.bebida_attach_pct)}
                xKey="garcom"
                valueKey="bebida_attach_pct"
                formatV={(v) => `${Math.round(v)}%`}
                cor="#6366f1"
                maxItens={20}
              />
            </ChartCard>
          </ChartGrid>

          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <h3 className="mb-3 text-sm font-semibold flex items-center gap-2">
              <Wine className="h-4 w-4" /> Ranking da equipe
              <span className="ml-2 text-xs font-normal text-[hsl(var(--muted-foreground))]">desconto acima de {fmtPct(descMedio * 2)} destaca em vermelho</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                    <th className="py-2 pr-3 font-medium">Garçom</th>
                    <th className="py-2 px-3 font-medium text-right">Vendas</th>
                    <th className="py-2 px-3 font-medium text-right">Mesas</th>
                    <th className="py-2 px-3 font-medium text-right">R$/mesa</th>
                    <th className="py-2 px-3 font-medium text-right">Itens/mesa</th>
                    <th className="py-2 px-3 font-medium text-right">Desconto</th>
                    <th className="py-2 px-3 font-medium text-right">Bebida (attach)</th>
                    <th className="py-2 pl-3 font-medium text-right">% venda bebida</th>
                  </tr>
                </thead>
                <tbody>
                  {garcons.map((g) => {
                    const descAlto = g.desconto_pct > Math.max(descMedio * 2, 3);
                    return (
                      <tr key={g.garcom} className="border-b border-[hsl(var(--border))]/50">
                        <td className="py-2 pr-3 font-medium">{g.garcom}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtBRL(g.vendas)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtN(g.comandas, 0)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtBRL2(g.ticket_medio)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtN(g.itens_por_comanda)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums ${descAlto ? 'text-red-500 font-semibold' : ''}`}>
                          {fmtPct(g.desconto_pct)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">{Math.round(g.bebida_attach_pct)}%</td>
                        <td className="py-2 pl-3 text-right tabular-nums text-[hsl(var(--muted-foreground))]">{Math.round(g.bebida_vendas_pct)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
