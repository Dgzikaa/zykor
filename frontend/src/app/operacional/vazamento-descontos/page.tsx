'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { Skeleton } from '@/components/ui/skeleton';
import { Percent, Receipt, TicketPercent, DollarSign } from 'lucide-react';
import { HeroRow, ChartCard, ChartGrid, GraficoBarraH, GraficoBarra, type Kpi } from '@/components/graficos/Charts';

const fmtBRL = (n: number | null | undefined) =>
  n == null ? 'R$ 0' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const fmtBRLk = (n: number | null | undefined) => {
  const v = Number(n || 0);
  return v >= 1000 ? `R$ ${(v / 1000).toFixed(1).replace('.', ',')}k` : fmtBRL(v);
};
const fmtPct = (n: number | null | undefined) =>
  n == null ? '—' : `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const fmtN = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));

interface Resp {
  success: boolean;
  kpis?: { desconto_total: number; vendas: number; desconto_pct: number; comandas_com_desconto: number; itens_com_desconto: number };
  por_operador?: { operador: string; desconto: number; desconto_pct: number; vendas: number }[];
  por_categoria?: { categoria: string; desconto: number; desconto_pct: number }[];
  por_dia?: { dia: string; desconto: number; desconto_pct: number }[];
  top_itens?: { produto: string; ocorrencias: number; desconto: number }[];
  meta?: { dias: number; desde: string };
}

const PERIODOS = [7, 30, 90] as const;
const ddmm = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };

export default function VazamentoDescontosPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(30);
  const { data, isLoading: loading } = useApiSWR<Resp>(
    selectedBar?.id ? `/api/operacional/vazamento-descontos?bar_id=${selectedBar.id}&dias=${dias}` : null
  );

  useEffect(() => {
    setPageTitle('💸 Vazamento de Descontos');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const k = data?.kpis;
  const descMedio = k?.desconto_pct ?? 0;
  const porDia = useMemo(() => (data?.por_dia || []).map((d) => ({ ...d, label: ddmm(d.dia) })), [data?.por_dia]);

  const kpis: Kpi[] = useMemo(() => {
    if (!k) return [];
    return [
      { label: 'Desconto no período', valor: fmtBRL(k.desconto_total), icon: DollarSign, cor: '#ef4444' },
      { label: '% sobre vendas', valor: fmtPct(k.desconto_pct), icon: Percent, invLower: true },
      { label: 'Comandas com desconto', valor: fmtN(k.comandas_com_desconto), icon: Receipt },
      { label: 'Itens descontados', valor: fmtN(k.itens_com_desconto), icon: TicketPercent },
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
          desconto sobre venda real · Happy Hour aparece alto porque é promo (olhe o % por operador p/ desconto discricionário)
        </span>
      </div>

      {loading ? (
        <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-72 w-full" /></div>
      ) : !data?.success || !k ? (
        <div className="rounded-xl border border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Sem dados no período.
        </div>
      ) : (
        <>
          <HeroRow kpis={kpis} cols={4} />

          <ChartGrid cols={2}>
            <ChartCard titulo="Quem mais desconta" subtitulo="R$ de desconto por operador">
              <GraficoBarraH
                data={data.por_operador || []}
                xKey="operador"
                valueKey="desconto"
                formatV={fmtBRL}
                corPorItem={(d) => ((d.desconto_pct ?? 0) > Math.max(descMedio * 1.5, 3) ? '#ef4444' : '#f59e0b')}
                maxItens={20}
              />
            </ChartCard>
            <ChartCard titulo="Onde o desconto concentra" subtitulo="R$ por categoria">
              <GraficoBarraH data={data.por_categoria || []} xKey="categoria" valueKey="desconto" formatV={fmtBRL} cor="#6366f1" maxItens={14} />
            </ChartCard>
            <ChartCard titulo="Desconto por dia" subtitulo="R$ e % sobre vendas" span={2}>
              <GraficoBarra
                data={porDia}
                xKey="label"
                valueKey="desconto"
                lineKey="desconto_pct"
                formatV={fmtBRLk}
                formatLine={fmtPct}
                nomeBarra="Desconto R$"
                nomeLinha="% vendas"
                corLinha="#ef4444"
              />
            </ChartCard>
          </ChartGrid>

          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <h3 className="mb-3 text-sm font-semibold">Itens que mais recebem desconto</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                    <th className="py-2 pr-3 font-medium">Item</th>
                    <th className="py-2 px-3 font-medium text-right">Vezes descontado</th>
                    <th className="py-2 pl-3 font-medium text-right">Desconto total</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.top_itens || []).map((it) => (
                    <tr key={it.produto} className="border-b border-[hsl(var(--border))]/50">
                      <td className="py-2 pr-3 truncate max-w-[280px]" title={it.produto}>{it.produto}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtN(it.ocorrencias)}</td>
                      <td className="py-2 pl-3 text-right tabular-nums font-medium text-red-500">{fmtBRL(it.desconto)}</td>
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
