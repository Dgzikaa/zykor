'use client';

/**
 * Comunicação › Visão geral (área Receitas) — SÓ Instagram ORGÂNICO.
 *
 * - Alcance, engajamento, stories, visitas, seguidores: Graph API
 *   (integrations.instagram_conta_metricas), via /api/receitas/comunicacao-organico.
 * - Mídia PAGA (Meta Ads) e ROAS vivem na aba "Anúncios" (separação orgânico × investido).
 */

import { useEffect, useState } from 'react';
import { Eye, Heart, Share2, Camera, Users, UserPlus, Percent } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { PageShell } from '@/components/layout/PageShell';
import { PeriodRangePicker } from '@/components/receitas/PeriodRangePicker';
import { HeroRow, ChartCard, GraficoBarrasAgrupadas, type Kpi } from '@/components/graficos/Charts';
import { useComunicacaoPeriodo } from './PeriodoContext';

const num = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('pt-BR').format(n));
const pct = (n: number | null | undefined) => (n == null ? '—' : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`);

export default function ComunicacaoPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const { periodo, setPeriodo } = useComunicacaoPeriodo();
  const [org, setOrg] = useState<any>(null);
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
    api
      .get(`/api/receitas/comunicacao-organico?${qs}`)
      .then((o: any) => setOrg(o?.success ? o : null))
      .catch(() => setOrg(null))
      .finally(() => setLoading(false));
  }, [barId, periodo.inicio, periodo.fim]);

  const kpisOrg: Kpi[] = org?.conectado
    ? [
        { label: 'Alcance (orgânico)', valor: num(org.alcance), icon: Eye },
        { label: 'Interações', valor: num(org.engajamento), icon: Heart },
        { label: 'Compartilhamentos', valor: num(org.compartilhamentos), icon: Share2 },
        { label: 'Taxa de engajamento', valor: pct(org.alcance > 0 ? (org.engajamento / org.alcance) * 100 : null), icon: Percent },
        { label: 'Stories', valor: num(org.qtd_stories), icon: Camera },
        { label: 'Visualizações dos stories', valor: num(org.views_stories), icon: Eye },
        { label: 'Visitas de perfil', valor: num(org.visitas_perfil), icon: Users },
        { label: 'Seguidores', valor: num(org.seguidores), icon: UserPlus },
      ]
    : [];

  return (
    <PageShell width="wide">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Instagram orgânico de {selectedBar?.nome ?? 'o bar selecionado'}. Mídia paga na aba <strong>Anúncios</strong>.
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
              <>
                <HeroRow kpis={kpisOrg} cols={6} />
                {(org.feed || org.reels) && (
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {([
                      { nome: 'Feed', d: org.feed },
                      { nome: 'Reels', d: org.reels },
                    ] as const).map(({ nome, d }) => (
                      <div key={nome} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{nome}</span>
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">{num(d?.posts)} posts</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
                          <span>Alcance <strong className="text-[hsl(var(--foreground))]">{num(d?.alcance)}</strong></span>
                          <span>Interações <strong className="text-[hsl(var(--foreground))]">{num(d?.engajamento)}</strong></span>
                          <span>Compart. <strong className="text-[hsl(var(--foreground))]">{num(d?.shares)}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  Alcance orgânico = Feed + Reels. Ferramentas com card &ldquo;postagens do feed&rdquo; podem excluir parte dos reels e mostrar número menor.
                </p>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-5 text-sm text-[hsl(var(--muted-foreground))]">
                Sem dados de Instagram no período (conta não conectada ou sync ainda sem cobertura).
              </div>
            )}
          </div>

          {org?.conectado && Array.isArray(org.serie_mensal) && org.serie_mensal.length > 0 && (
            <ChartCard titulo="Alcance & Interações" subtitulo="orgânico do Instagram, mês a mês (alcance em barra, interações em linha)">
              <GraficoBarrasAgrupadas
                data={org.serie_mensal}
                xKey="label"
                series={[{ key: 'alcance', nome: 'Alcance', cor: '#8b5cf6' }]}
                lineKey="engajamento"
                nomeLinha="Interações"
                formatV={num}
                formatLine={num}
                height={280}
              />
            </ChartCard>
          )}
        </>
      )}
    </PageShell>
  );
}
