'use client';

/**
 * Card "ROAS / Gasto Comercial" do Dashboard de Receitas.
 * roas = faturamento / (artistas + produção + marketing) por período.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { ChartCard, GraficoBarra } from '@/components/graficos/Charts';
import type { PeriodoValor } from '@/lib/receitas/periodo';

const dec2 = (v: number) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Ponto {
  key: string;
  label: string;
  faturamento: number;
  gasto_comercial: number;
  marketing: number;
  artistas: number;
  producao: number;
  roas: number | null;
}

export function CardRoas({ barId, periodo }: { barId?: number; periodo: PeriodoValor }) {
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [roasPeriodo, setRoasPeriodo] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barId) return;
    setLoading(true);
    api
      .get(`/api/receitas/roas?bar_id=${barId}&granularidade=${periodo.granularidade}&inicio=${periodo.inicio}&fim=${periodo.fim}`)
      .then((r: any) => {
        if (r?.success) {
          setPontos(r.pontos ?? []);
          setRoasPeriodo(r.roas_periodo ?? null);
        } else {
          setPontos([]);
          setRoasPeriodo(null);
        }
      })
      .catch(() => {
        setPontos([]);
        setRoasPeriodo(null);
      })
      .finally(() => setLoading(false));
  }, [barId, periodo.granularidade, periodo.inicio, periodo.fim]);

  const comRoas = pontos.filter((p) => p.roas != null);
  const right = roasPeriodo != null ? <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{dec2(roasPeriodo)}× no período</span> : undefined;

  return (
    <ChartCard titulo="ROAS / Gasto Comercial" subtitulo="retorno por R$1 (artistas + produção + mkt)" right={right}>
      {loading ? (
        <div className="flex h-[280px] items-center justify-center text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : comRoas.length === 0 ? (
        <div className="flex h-[280px] items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">Sem dados de custo no período.</div>
      ) : (
        <GraficoBarra data={comRoas} xKey="label" valueKey="roas" formatV={dec2} cor="#22c55e" height={280} rotacaoX={comRoas.length > 8 ? 30 : 0} />
      )}
    </ChartCard>
  );
}
