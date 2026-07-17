'use client';

/**
 * Dashboard de Receitas — visão unificada (área Receitas).
 *
 * Fase 1 completa: os 8 gráficos do modelo (docs/dash/) ligados ao seletor de
 * período compartilhado. Plano em docs/planejamento-receitas.md. MVP no Ordinário.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DollarSign, Wallet, TrendingUp, Sparkles } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { PageShell } from '@/components/layout/PageShell';
import { HeroRow, type Kpi } from '@/components/graficos/Charts';
import { PeriodRangePicker } from '@/components/receitas/PeriodRangePicker';
import { CardCrescimento } from '@/components/receitas/CardCrescimento';
import { CardInputs } from '@/components/receitas/CardInputs';
import { CardDespesasComerciais } from '@/components/receitas/CardDespesasComerciais';
import { CardLotacao } from '@/components/receitas/CardLotacao';
import { CardsClientes } from '@/components/receitas/CardsClientes';
import { CardDiaSemana } from '@/components/receitas/CardDiaSemana';
import { CardNPS } from '@/components/receitas/CardNPS';
import { periodoPadrao, type PeriodoValor } from '@/lib/receitas/periodo';

const money0 = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default function DashboardReceitasPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [periodo, setPeriodo] = useState<PeriodoValor>(() => periodoPadrao('mes', 'trimestral'));
  const [resumo, setResumo] = useState<{ faturamento_periodo: number; despesas_periodo: number; roi_periodo: number | null } | null>(null);
  const [pontosDespesas, setPontosDespesas] = useState<any[]>([]);
  const [loadingDespesas, setLoadingDespesas] = useState(true);

  useEffect(() => {
    setPageTitle('💰 Dashboard de Receitas');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const barId = selectedBar?.id;

  useEffect(() => {
    if (!barId) return;
    setLoadingDespesas(true);
    api
      .get(`/api/receitas/despesas-comerciais?bar_id=${barId}&granularidade=${periodo.granularidade}&inicio=${periodo.inicio}&fim=${periodo.fim}`)
      .then((r: any) => {
        if (r?.success) {
          setResumo({ faturamento_periodo: r.faturamento_periodo, despesas_periodo: r.despesas_periodo, roi_periodo: r.roi_periodo });
          setPontosDespesas(r.pontos ?? []);
        } else {
          setResumo(null);
          setPontosDespesas([]);
        }
      })
      .catch(() => { setResumo(null); setPontosDespesas([]); })
      .finally(() => setLoadingDespesas(false));
  }, [barId, periodo.granularidade, periodo.inicio, periodo.fim]);

  const kpis: Kpi[] = [
    { label: 'Faturamento', valor: money0(resumo?.faturamento_periodo ?? 0), icon: DollarSign, cor: '#22c55e' },
    { label: 'Despesas comerciais', valor: money0(resumo?.despesas_periodo ?? 0), icon: Wallet },
    { label: 'ROI', valor: resumo?.roi_periodo != null ? `${resumo.roi_periodo.toFixed(2).replace('.', ',')}×` : '—', icon: TrendingUp, sub: '(fat × 0,6) ÷ despesas' },
  ];

  return (
    <PageShell width="wide">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Visão unificada de receita para {selectedBar?.nome ?? 'o bar selecionado'}.
          </p>
          <Link
            href="/receitas/analise"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Sparkles className="h-4 w-4" /> Análise (IA)
          </Link>
        </div>
        <div className="overflow-x-auto">
          <PeriodRangePicker value={periodo} onChange={setPeriodo} className="!flex-nowrap w-max" />
        </div>
      </div>

      {!barId ? (
        <div className="flex h-64 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
          Selecione um bar para ver o dashboard.
        </div>
      ) : (
        <>
          <HeroRow kpis={kpis} cols={3} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <CardCrescimento barId={barId} periodo={periodo} />
            <CardNPS barId={barId} periodo={periodo} />
            <CardInputs barId={barId} periodo={periodo} />
            <CardDespesasComerciais pontos={pontosDespesas} loading={loadingDespesas} />
            <CardLotacao barId={barId} periodo={periodo} />
            <CardsClientes barId={barId} periodo={periodo} />
            <CardDiaSemana barId={barId} periodo={periodo} />
          </div>
        </>
      )}
    </PageShell>
  );
}
