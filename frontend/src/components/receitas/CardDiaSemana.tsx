'use client';

/**
 * Card "Faturamento por Dia da Semana" do Dashboard de Receitas.
 * Reaproveita /api/graficos/por-dia-semana (média de faturamento por dia da semana).
 * É a base do Bloco 3 (detratores/promotores) — aqui na versão simples do período.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { ChartCard, GraficoBarraH } from '@/components/graficos/Charts';
import type { PeriodoValor } from '@/lib/receitas/periodo';

const money0 = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

interface Dia {
  dow: number;
  dia: string;
  eventos: number;
  fat_medio: number;
  publico_medio: number;
  ticket_medio: number;
}

export function CardDiaSemana({ barId, periodo }: { barId?: number; periodo: PeriodoValor }) {
  const [dias, setDias] = useState<Dia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barId) return;
    setLoading(true);
    api
      .get(`/api/graficos/por-dia-semana?bar_id=${barId}&de=${periodo.inicio}&ate=${periodo.fim}`)
      .then((r: any) => setDias(r?.success ? (r.dias || []).filter((d: Dia) => d.eventos > 0) : []))
      .catch(() => setDias([]))
      .finally(() => setLoading(false));
  }, [barId, periodo.inicio, periodo.fim]);

  return (
    <ChartCard titulo="Faturamento por Dia da Semana" subtitulo="média de faturamento por dia no período" className="md:col-span-2">
      {loading ? (
        <div className="flex h-[300px] items-center justify-center text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : dias.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">Sem eventos no período selecionado.</div>
      ) : (
        <GraficoBarraH data={dias} xKey="dia" valueKey="fat_medio" formatV={money0} height={300} maxItens={7} />
      )}
    </ChartCard>
  );
}
