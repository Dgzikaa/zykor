'use client';

/**
 * Comunicação (área Receitas) — mídia/marketing.
 *
 * Orgânico do Instagram (alcance, engajamento…) já vem da Graph API
 * (integrations.instagram_conta_metricas). Só a mídia PAGA (Meta Ads: investimento,
 * CPM, CTR, conversas) fica "em desenvolvimento" até a operação de anúncios rodar.
 * Traz também o ROAS / Gasto Comercial (retorno de gasto).
 */

import { useEffect, useState } from 'react';
import { Eye, Heart, UserCheck, Users, UserPlus, Megaphone } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { PageShell } from '@/components/layout/PageShell';
import { PeriodRangePicker } from '@/components/receitas/PeriodRangePicker';
import { CardRoas } from '@/components/receitas/CardRoas';
import { HeroRow, type Kpi } from '@/components/graficos/Charts';
import { periodoPadrao, type PeriodoValor } from '@/lib/receitas/periodo';

const fmt = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('pt-BR').format(n));
const KPIS_ADS = ['Investimento em mídia', 'CPM', 'CTR', 'Conversas iniciadas', 'Cliques', 'Frequência'];

export default function ComunicacaoPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [periodo, setPeriodo] = useState<PeriodoValor>(() => periodoPadrao('mes', 'trimestral'));
  const [org, setOrg] = useState<any>(null);
  const [loadingOrg, setLoadingOrg] = useState(true);

  useEffect(() => {
    setPageTitle('📣 Comunicação');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const barId = selectedBar?.id;

  useEffect(() => {
    if (!barId) return;
    setLoadingOrg(true);
    api
      .get(`/api/receitas/comunicacao-organico?bar_id=${barId}&inicio=${periodo.inicio}&fim=${periodo.fim}`)
      .then((r: any) => setOrg(r?.success ? r : null))
      .catch(() => setOrg(null))
      .finally(() => setLoadingOrg(false));
  }, [barId, periodo.inicio, periodo.fim]);

  const kpis: Kpi[] = org?.conectado
    ? [
        { label: 'Alcance (orgânico)', valor: fmt(org.alcance), icon: Eye },
        { label: 'Engajamento', valor: fmt(org.engajamento), icon: Heart },
        { label: 'Contas engajadas', valor: fmt(org.contas_engajadas), icon: UserCheck },
        { label: 'Visitas de perfil', valor: fmt(org.visitas_perfil), icon: Users },
        { label: 'Seguidores', valor: fmt(org.seguidores), icon: UserPlus },
      ]
    : [];

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
        <>
          <div>
            <h2 className="mb-2 text-sm font-semibold text-[hsl(var(--foreground))]">Instagram — orgânico</h2>
            {loadingOrg ? (
              <div className="flex h-24 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">Carregando…</div>
            ) : org?.conectado ? (
              <HeroRow kpis={kpis} cols={5} />
            ) : (
              <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-5 text-sm text-[hsl(var(--muted-foreground))]">
                Sem dados de Instagram no período (conta não conectada ou sync ainda sem cobertura). O orgânico é capturado a partir do início da integração.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <CardRoas barId={barId} periodo={periodo} />

            <div className="flex flex-col rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
              <div className="mb-2 flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Mídia paga (Meta Ads)</h3>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  em desenvolvimento
                </span>
              </div>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Quando a operação de anúncios estiver rodando, entram aqui — com o mesmo filtro de período:
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-[hsl(var(--muted-foreground))]">
                {KPIS_ADS.map((k) => (
                  <li key={k} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--muted-foreground))]/50" />
                    {k}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
