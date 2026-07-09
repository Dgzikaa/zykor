'use client';

/**
 * Comunicação (área Receitas) — mídia/marketing.
 *
 * - Instagram orgânico (alcance, engajamento…): Graph API (integrations.instagram_conta_metricas).
 * - Mídia paga (Meta Ads): a partir de meta.marketing_semanal (hoje manual/Reportei; a
 *   automação via API Meta/ads_read é pendente — o token IG atual é só orgânico).
 * - ROAS / Gasto Comercial.
 */

import { useEffect, useState } from 'react';
import { Eye, Heart, UserCheck, Users, UserPlus, DollarSign, MousePointerClick, Target, Percent, MessageCircle } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { PageShell } from '@/components/layout/PageShell';
import { PeriodRangePicker } from '@/components/receitas/PeriodRangePicker';
import { CardRoas } from '@/components/receitas/CardRoas';
import { HeroRow, type Kpi } from '@/components/graficos/Charts';
import { periodoPadrao, type PeriodoValor } from '@/lib/receitas/periodo';

const num = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('pt-BR').format(n));
const money = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
const money2 = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }));
const pct = (n: number | null | undefined) => (n == null ? '—' : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`);

export default function ComunicacaoPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [periodo, setPeriodo] = useState<PeriodoValor>(() => periodoPadrao('mes', 'trimestral'));
  const [org, setOrg] = useState<any>(null);
  const [pago, setPago] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPageTitle('📣 Comunicação');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const barId = selectedBar?.id;

  useEffect(() => {
    if (!barId) return;
    setLoading(true);
    const qs = `bar_id=${barId}&inicio=${periodo.inicio}&fim=${periodo.fim}`;
    Promise.all([
      api.get(`/api/receitas/comunicacao-organico?${qs}`).catch(() => null),
      api.get(`/api/receitas/comunicacao-paga?${qs}`).catch(() => null),
    ])
      .then(([o, p]: any[]) => {
        setOrg(o?.success ? o : null);
        setPago(p?.success ? p : null);
      })
      .finally(() => setLoading(false));
  }, [barId, periodo.inicio, periodo.fim]);

  const kpisOrg: Kpi[] = org?.conectado
    ? [
        { label: 'Alcance (orgânico)', valor: num(org.alcance), icon: Eye },
        { label: 'Engajamento', valor: num(org.engajamento), icon: Heart },
        { label: 'Contas engajadas', valor: num(org.contas_engajadas), icon: UserCheck },
        { label: 'Visitas de perfil', valor: num(org.visitas_perfil), icon: Users },
        { label: 'Seguidores', valor: num(org.seguidores), icon: UserPlus },
      ]
    : [];

  const kpisPago: Kpi[] = pago?.tem_dados
    ? [
        { label: 'Investimento (Meta)', valor: money(pago.investimento_meta), icon: DollarSign },
        { label: 'Alcance pago', valor: num(pago.alcance), icon: Eye },
        { label: 'Cliques', valor: num(pago.cliques), icon: MousePointerClick },
        { label: 'CPM', valor: money2(pago.cpm), icon: Target },
        { label: 'CTR', valor: pct(pago.ctr), icon: Percent },
        { label: 'Conversas', valor: num(pago.conversas), icon: MessageCircle },
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
            {loading ? (
              <div className="flex h-24 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">Carregando…</div>
            ) : org?.conectado ? (
              <HeroRow kpis={kpisOrg} cols={5} />
            ) : (
              <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-5 text-sm text-[hsl(var(--muted-foreground))]">
                Sem dados de Instagram no período (conta não conectada ou sync ainda sem cobertura).
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Mídia paga (Meta Ads)</h2>
              <span className="rounded-full bg-[hsl(var(--muted)/0.6)] px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
                fonte manual (Reportei) · automação via API Meta pendente
              </span>
            </div>
            {loading ? (
              <div className="flex h-24 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">Carregando…</div>
            ) : pago?.tem_dados ? (
              <HeroRow kpis={kpisPago} cols={6} />
            ) : (
              <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-5 text-sm text-[hsl(var(--muted-foreground))]">
                Sem investimento de mídia lançado no período.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <CardRoas barId={barId} periodo={periodo} />
          </div>
        </>
      )}
    </PageShell>
  );
}
