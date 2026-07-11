'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBar } from '@/contexts/BarContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { HeroRow, ChartCard, ChartGrid, GraficoBarra, type Kpi } from '@/components/graficos/Charts';
import { Gauge, Receipt, Timer, DollarSign } from 'lucide-react';

const fmtBRL = (n: number | null | undefined) =>
  n == null ? 'R$ 0' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const fmtBRLk = (n: number | null | undefined) => {
  const v = Number(n || 0);
  return v >= 1000 ? `R$ ${(v / 1000).toFixed(1).replace('.', ',')}k` : fmtBRL(v);
};
const fmtMin = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(Number(n))} min`);
const fmtN = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));

interface Resp {
  success: boolean;
  kpis?: { visitas: number; receita_total: number; tempo_medio_min: number; ticket_medio: number; rs_por_mesa_hora: number };
  por_hora?: { hora: number; visitas: number; receita: number; tempo_medio: number; ticket: number }[];
  por_faixa?: { faixa: string; ord: number; visitas: number; ticket: number; receita: number }[];
}

const PERIODOS = [30, 90] as const;

export function GiroMesaTab() {
  const { selectedBar } = useBar();
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(90);
  const { data, isLoading: loading } = useApiSWR<Resp>(
    selectedBar?.id ? `/api/relatorios/giro-mesa?bar_id=${selectedBar.id}&dias=${dias}` : null
  );

  const k = data?.kpis;
  const porHora = useMemo(() => (data?.por_hora || []).map((h) => ({ ...h, label: `${h.hora}h` })), [data?.por_hora]);

  const kpis: Kpi[] = useMemo(() => {
    if (!k) return [];
    return [
      { label: 'R$ por mesa-hora', valor: fmtBRL(k.rs_por_mesa_hora), icon: Gauge, sub: 'receita ÷ horas ocupadas' },
      { label: 'Ticket médio', valor: fmtBRL(k.ticket_medio), icon: Receipt },
      { label: 'Permanência média', valor: fmtMin(k.tempo_medio_min), icon: Timer },
      { label: 'Receita no período', valor: fmtBRLk(k.receita_total), icon: DollarSign },
    ];
  }, [k]);

  if (!selectedBar?.id) return null;

  return (
    <div className="space-y-4">
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

      {loading && !data ? (
        <Skeleton className="h-96 w-full" />
      ) : !k || k.visitas === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-gray-500">Sem visitas com tempo/receita no período.</CardContent></Card>
      ) : (
        <>
          <HeroRow kpis={kpis} cols={4} />

          <ChartGrid cols={2}>
            <ChartCard titulo="Receita por hora de chegada" subtitulo="quando entra o dinheiro (linha = ticket)" span={2}>
              <GraficoBarra
                data={porHora}
                xKey="label"
                valueKey="receita"
                lineKey="ticket"
                formatV={fmtBRLk}
                formatLine={fmtBRL}
                nomeBarra="Receita"
                nomeLinha="Ticket"
                corLinha="#f59e0b"
              />
            </ChartCard>

            <ChartCard titulo="Quem fica mais, gasta mais?" subtitulo="ticket médio por faixa de permanência" span={2}>
              <GraficoBarra
                data={data?.por_faixa || []}
                xKey="faixa"
                valueKey="ticket"
                formatV={fmtBRL}
                nomeBarra="Ticket médio"
                cor="#8b5cf6"
                mostrarRotulo
              />
            </ChartCard>
          </ChartGrid>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500">
                Métricas por mesa física foram omitidas de propósito: o identificador de mesa no dado
                ({fmtN(k.visitas)} visitas) não é estável o bastante para giro por mesa confiável.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
