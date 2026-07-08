'use client';

/**
 * Comunicação (área Receitas) — visão de mídia/marketing.
 *
 * Por ora traz só o ROAS / Gasto Comercial (movido do Dashboard, já que é sobre
 * retorno de gasto). Os KPIs de mídia paga (Meta Ads: alcance, engajamento,
 * investimento, CPM, CTR) e orgânico ficam como "em desenvolvimento" até a
 * operação de anúncios estar rodando.
 */

import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { PageShell } from '@/components/layout/PageShell';
import { PeriodRangePicker } from '@/components/receitas/PeriodRangePicker';
import { CardRoas } from '@/components/receitas/CardRoas';
import { periodoPadrao, type PeriodoValor } from '@/lib/receitas/periodo';

const KPIS_MIDIA = ['Investimento em mídia', 'Alcance', 'Engajamento', 'CPM', 'CTR', 'Conversas iniciadas'];

export default function ComunicacaoPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [periodo, setPeriodo] = useState<PeriodoValor>(() => periodoPadrao('mes', 'trimestral'));

  useEffect(() => {
    setPageTitle('📣 Comunicação');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const barId = selectedBar?.id;

  return (
    <PageShell width="wide">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Comunicação e mídia de {selectedBar?.nome ?? 'o bar selecionado'}.
        </p>
        <div className="overflow-x-auto">
          <PeriodRangePicker value={periodo} onChange={setPeriodo} className="!flex-nowrap w-max" />
        </div>
      </div>

      {!barId ? (
        <div className="flex h-64 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
          Selecione um bar para ver a comunicação.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CardRoas barId={barId} periodo={periodo} />

          <div className="flex flex-col rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="mb-2 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">KPIs de mídia</h3>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                em desenvolvimento
              </span>
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Quando a operação de anúncios (Meta Ads) estiver rodando, entram aqui — com o mesmo filtro de período:
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-[hsl(var(--muted-foreground))]">
              {KPIS_MIDIA.map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--muted-foreground))]/50" />
                  {k}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </PageShell>
  );
}
