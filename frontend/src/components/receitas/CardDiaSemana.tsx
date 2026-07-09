'use client';

/**
 * Card "Faturamento por Dia da Semana" — cada dia da semana × cada mês do período,
 * em barras HORIZONTAIS agrupadas por mês (número no fim de cada barra, sem sobrepor).
 * Mostra como cada dia (Seg..Dom) performou mês a mês (detrator/promotor). Usa o range.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { ChartCard, GraficoBarrasAgrupadasH } from '@/components/graficos/Charts';
import type { PeriodoValor } from '@/lib/receitas/periodo';

const money0 = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function CardDiaSemana({ barId, periodo }: { barId?: number; periodo: PeriodoValor }) {
  const [dias, setDias] = useState<Record<string, any>[]>([]);
  const [meses, setMeses] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barId) return;
    setLoading(true);
    api
      .get(`/api/receitas/dia-semana-mensal?bar_id=${barId}&inicio=${periodo.inicio}&fim=${periodo.fim}`)
      .then((r: any) => {
        if (r?.success) {
          setDias(r.dias ?? []);
          setMeses(r.meses ?? []);
        } else {
          setDias([]);
          setMeses([]);
        }
      })
      .catch(() => {
        setDias([]);
        setMeses([]);
      })
      .finally(() => setLoading(false));
  }, [barId, periodo.inicio, periodo.fim]);

  const series = meses.map((m) => ({ key: m.label, nome: m.label }));
  const altura = Math.max(340, meses.length * 78);

  return (
    <ChartCard titulo="Faturamento por Dia da Semana" subtitulo="média por dia da semana, mês a mês no período" className="md:col-span-2">
      {loading ? (
        <div className="flex h-[340px] items-center justify-center text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !dias.length || !meses.length ? (
        <div className="flex h-[340px] items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">Sem eventos no período selecionado.</div>
      ) : (
        <GraficoBarrasAgrupadasH data={dias} yKey="dia" series={series} formatV={money0} height={altura} />
      )}
    </ChartCard>
  );
}
