'use client';

/**
 * Card "Taxa de Crescimento" do Dashboard de Receitas.
 * Faturamento por dia aberto, bucketizado pela granularidade do período selecionado.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { ChartCard, GraficoBarra } from '@/components/graficos/Charts';
import type { PeriodoValor } from '@/lib/receitas/periodo';

const money0 = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

interface Ponto {
  key: string;
  label: string;
  faturamento: number;
  dias_abertos: number;
  fat_por_dia: number;
  variacao_pct: number | null;
}

export function CardCrescimento({ barId, periodo }: { barId?: number; periodo: PeriodoValor }) {
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barId) return;
    setLoading(true);
    const url = `/api/receitas/crescimento?bar_id=${barId}&granularidade=${periodo.granularidade}&inicio=${periodo.inicio}&fim=${periodo.fim}`;
    api
      .get(url)
      .then((r: any) => setPontos(r?.success ? (r.pontos ?? []) : []))
      .catch(() => setPontos([]))
      .finally(() => setLoading(false));
  }, [barId, periodo.granularidade, periodo.inicio, periodo.fim]);

  const ultimo = pontos[pontos.length - 1];
  const right =
    ultimo?.variacao_pct != null ? (
      <span className={ultimo.variacao_pct >= 0 ? 'text-sm font-semibold text-emerald-600 dark:text-emerald-400' : 'text-sm font-semibold text-rose-600 dark:text-rose-400'}>
        {ultimo.variacao_pct >= 0 ? '+' : ''}
        {ultimo.variacao_pct}% vs período anterior
      </span>
    ) : undefined;

  return (
    <ChartCard titulo="Taxa de Crescimento" subtitulo="faturamento por dia aberto" right={right}>
      {loading ? (
        <div className="flex h-[300px] items-center justify-center text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : pontos.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
          Sem dados no período selecionado.
        </div>
      ) : (
        <GraficoBarra
          data={pontos}
          xKey="label"
          valueKey="fat_por_dia"
          formatV={money0}
          height={300}
          rotacaoX={pontos.length > 8 ? 30 : 0}
        />
      )}
    </ChartCard>
  );
}
