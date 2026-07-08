'use client';

/**
 * Card "Inputs de Crescimento" do Dashboard de Receitas.
 * Três mini-gráficos lado a lado: reservas (pessoas), clientes/dia e ticket médio.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { ChartCard, GraficoBarra } from '@/components/graficos/Charts';
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
    const url = `/api/receitas/inputs?bar_id=${barId}&granularidade=${periodo.granularidade}&inicio=${periodo.inicio}&fim=${periodo.fim}`;
    api
      .get(url)
      .then((r: any) => setPontos(r?.success ? (r.pontos ?? []) : []))
      .catch(() => setPontos([]))
      .finally(() => setLoading(false));
  }, [barId, periodo.granularidade, periodo.inicio, periodo.fim]);

  const rot = pontos.length > 8 ? 30 : 0;

  return (
    <ChartCard titulo="Inputs de Crescimento" subtitulo="reservas, clientes/dia e ticket médio" className="md:col-span-2">
      {loading ? (
        <div className="flex h-[240px] items-center justify-center text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : pontos.length === 0 ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
          Sem dados no período selecionado.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Mini titulo="Reservas (pessoas)">
            <GraficoBarra data={pontos} xKey="label" valueKey="reservas" formatV={num} height={220} rotacaoX={rot} cor="#6366f1" mostrarRotulo={false} />
          </Mini>
          <Mini titulo="Clientes por dia">
            <GraficoBarra data={pontos} xKey="label" valueKey="clientes_por_dia" formatV={num} height={220} rotacaoX={rot} cor="#0ea5e9" mostrarRotulo={false} />
          </Mini>
          <Mini titulo="Ticket médio">
            <GraficoBarra data={pontos} xKey="label" valueKey="ticket_medio" formatV={money2} height={220} rotacaoX={rot} cor="#22c55e" mostrarRotulo={false} />
          </Mini>
        </div>
      )}
    </ChartCard>
  );
}

function Mini({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">{titulo}</p>
      {children}
    </div>
  );
}
