'use client';

/**
 * Card "Inputs de Crescimento" do Dashboard de Receitas.
 * Um gráfico só: barras de reservas/dia + clientes/dia (eixo esq., pessoas/dia) e
 * ticket médio como linha (eixo dir., R$) — volume × valor no mesmo quadro.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { ChartCard, GraficoBarrasAgrupadas } from '@/components/graficos/Charts';
import type { PeriodoValor } from '@/lib/receitas/periodo';

const money2 = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
const num = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');

interface Ponto {
  key: string;
  label: string;
  dias_abertos: number;
  reservas: number;
  reservas_por_dia: number;
  clientes_por_dia: number;
  ticket_medio: number;
}

export function CardInputs({ barId, periodo }: { barId?: number; periodo: PeriodoValor }) {
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barId) return;
    setLoading(true);
    api
      .get(`/api/receitas/inputs?bar_id=${barId}&granularidade=${periodo.granularidade}&inicio=${periodo.inicio}&fim=${periodo.fim}`)
      .then((r: any) => setPontos(r?.success ? (r.pontos ?? []) : []))
      .catch(() => setPontos([]))
      .finally(() => setLoading(false));
  }, [barId, periodo.granularidade, periodo.inicio, periodo.fim]);

  return (
    <ChartCard titulo="Inputs de Crescimento" subtitulo="reservas/dia e clientes/dia (barras) × ticket médio (linha)" className="md:col-span-2">
      {loading ? (
        <div className="flex h-[320px] items-center justify-center text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : pontos.length === 0 ? (
        <div className="flex h-[320px] items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">Sem dados no período selecionado.</div>
      ) : (
        <GraficoBarrasAgrupadas
          data={pontos}
          xKey="label"
          series={[
            { key: 'reservas_por_dia', nome: 'Reservas/dia', cor: '#6366f1' },
            { key: 'clientes_por_dia', nome: 'Clientes/dia', cor: '#0ea5e9' },
          ]}
          lineKey="ticket_medio"
          nomeLinha="Ticket médio"
          formatV={num}
          formatLine={money2}
          corLinha="#22c55e"
          height={320}
          rotacaoX={pontos.length > 8 ? 30 : 0}
        />
      )}
    </ChartCard>
  );
}
