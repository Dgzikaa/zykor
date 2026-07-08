'use client';

/** Card "Satisfação / NPS" do Dashboard de Receitas (silver.nps_diario / Falae). */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { ChartCard, GraficoLinha } from '@/components/graficos/Charts';
import type { PeriodoValor } from '@/lib/receitas/periodo';

interface Ponto {
  key: string;
  label: string;
  respostas: number;
  nps: number | null;
}

export function CardNPS({ barId, periodo }: { barId?: number; periodo: PeriodoValor }) {
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [npsPeriodo, setNpsPeriodo] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barId) return;
    setLoading(true);
    api
      .get(`/api/receitas/nps?bar_id=${barId}&granularidade=${periodo.granularidade}&inicio=${periodo.inicio}&fim=${periodo.fim}`)
      .then((r: any) => {
        if (r?.success) {
          setPontos(r.pontos ?? []);
          setNpsPeriodo(r.nps_periodo ?? null);
        } else {
          setPontos([]);
          setNpsPeriodo(null);
        }
      })
      .catch(() => {
        setPontos([]);
        setNpsPeriodo(null);
      })
      .finally(() => setLoading(false));
  }, [barId, periodo.granularidade, periodo.inicio, periodo.fim]);

  const comNps = pontos.filter((p) => p.nps != null);
  const right = npsPeriodo != null ? <span className="text-sm font-semibold text-[hsl(var(--foreground))]">NPS {npsPeriodo}</span> : undefined;

  return (
    <ChartCard titulo="Satisfação / NPS" subtitulo="NPS por período (Falae)" right={right}>
      {loading ? (
        <div className="flex h-[280px] items-center justify-center text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : comNps.length === 0 ? (
        <div className="flex h-[280px] items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">Sem respostas de NPS no período.</div>
      ) : (
        <GraficoLinha
          data={comNps}
          xKey="label"
          series={[{ key: 'nps', nome: 'NPS', cor: '#8b5cf6' }]}
          formatV={(v) => String(Math.round(v))}
          height={280}
          rotacaoX={comNps.length > 8 ? 30 : 0}
        />
      )}
    </ChartCard>
  );
}
