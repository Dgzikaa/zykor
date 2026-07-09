'use client';

/**
 * Dashboard de Receitas — visão unificada (área Receitas).
 *
 * Fase 1 completa: os 8 gráficos do modelo (docs/dash/) ligados ao seletor de
 * período compartilhado. Plano em docs/planejamento-receitas.md. MVP no Ordinário.
 */

import { useEffect, useState } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { PageShell } from '@/components/layout/PageShell';
import { PeriodRangePicker } from '@/components/receitas/PeriodRangePicker';
import { CardCrescimento } from '@/components/receitas/CardCrescimento';
import { CardInputs } from '@/components/receitas/CardInputs';
import { CardLotacao } from '@/components/receitas/CardLotacao';
import { CardsClientes } from '@/components/receitas/CardsClientes';
import { CardDiaSemana } from '@/components/receitas/CardDiaSemana';
import { CardNPS } from '@/components/receitas/CardNPS';
import { periodoPadrao, type PeriodoValor } from '@/lib/receitas/periodo';

export default function DashboardReceitasPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [periodo, setPeriodo] = useState<PeriodoValor>(() => periodoPadrao('mes', 'trimestral'));

  useEffect(() => {
    setPageTitle('💰 Dashboard de Receitas');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const barId = selectedBar?.id;

  return (
    <PageShell width="wide">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Visão unificada de receita para {selectedBar?.nome ?? 'o bar selecionado'}.
        </p>
        <div className="overflow-x-auto">
          <PeriodRangePicker value={periodo} onChange={setPeriodo} className="!flex-nowrap w-max" />
        </div>
      </div>

      {!barId ? (
        <div className="flex h-64 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
          Selecione um bar para ver o dashboard.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CardCrescimento barId={barId} periodo={periodo} />
          <CardNPS barId={barId} periodo={periodo} />
          <CardInputs barId={barId} periodo={periodo} />
          <CardLotacao barId={barId} periodo={periodo} />
          <CardsClientes barId={barId} periodo={periodo} />
          <CardDiaSemana barId={barId} periodo={periodo} />
        </div>
      )}
    </PageShell>
  );
}
