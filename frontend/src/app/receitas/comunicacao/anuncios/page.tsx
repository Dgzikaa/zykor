'use client';

/**
 * Comunicação › Anúncios (área Receitas) — mídia PAGA (Meta Ads).
 *
 * Fonte: Marketing API real (act_<id>/insights, level=campaign|ad) via System User token,
 * por /api/receitas/anuncios. Separa o investido do orgânico (que fica na "Visão geral").
 * Resumo + gráficos + tabela por campanha + tabela por anúncio (com thumbnail do criativo).
 */

import { useEffect, useMemo, useState } from 'react';
import { DollarSign, Eye, MousePointerClick, Target, Percent, MessageCircle, ArrowUpDown, Repeat, TrendingUp, ShoppingCart, PlayCircle, UserPlus } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { PageShell } from '@/components/layout/PageShell';
import { PeriodRangePicker } from '@/components/receitas/PeriodRangePicker';
import { CardRoas } from '@/components/receitas/CardRoas';
import { HeroRow, ChartCard, GraficoBarrasAgrupadasH, GraficoBarrasAgrupadas, type Kpi } from '@/components/graficos/Charts';
import { periodoPadrao, type PeriodoValor } from '@/lib/receitas/periodo';

const num = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('pt-BR').format(n));
const money = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
const money2 = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }));
const pct = (n: number | null | undefined) => (n == null ? '—' : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`);
const pct2 = (n: number | null | undefined) => (n == null ? '—' : `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);
const dec1 = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const roasFmt = (n: number | null | undefined) => (n == null ? '—' : `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`);
const data = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Ativo', PAUSED: 'Pausado', ADSET_PAUSED: 'Pausado (conj.)', CAMPAIGN_PAUSED: 'Pausado (camp.)',
  ARCHIVED: 'Arquivado', DELETED: 'Excluído', DISAPPROVED: 'Reprovado', PENDING_REVIEW: 'Em revisão', WITH_ISSUES: 'Com problema',
};

function StatusBadge({ status, ativo }: { status: string | null; ativo: boolean }) {
  if (!status) return null;
  const label = STATUS_LABEL[status] || status;
  return (
    <span
      title={status}
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        ativo ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-[hsl(var(--muted)/0.6)] text-[hsl(var(--muted-foreground))]'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ativo ? 'bg-emerald-500' : 'bg-gray-400'}`} />
      {label}
    </span>
  );
}

type SortKey = 'investimento' | 'impressoes' | 'alcance' | 'cliques' | 'ctr' | 'cpm' | 'cpc' | 'conversas' | 'frequencia' | 'custo_conversa';

const COLS: { key: SortKey; label: string; fmt: (n: any) => string }[] = [
  { key: 'investimento', label: 'Investido', fmt: money },
  { key: 'impressoes', label: 'Impressões', fmt: num },
  { key: 'alcance', label: 'Alcance', fmt: num },
  { key: 'cliques', label: 'Cliques', fmt: num },
  { key: 'ctr', label: 'CTR', fmt: pct2 },
  { key: 'cpm', label: 'CPM', fmt: money2 },
  { key: 'cpc', label: 'CPC', fmt: money2 },
  { key: 'conversas', label: 'Conversas', fmt: num },
  { key: 'custo_conversa', label: 'R$/conversa', fmt: money2 },
  { key: 'frequencia', label: 'Freq.', fmt: dec1 },
];

function useSorted<T extends Record<string, any>>(rows: T[], key: SortKey) {
  return useMemo(() => [...rows].sort((a, b) => (Number(b[key]) || 0) - (Number(a[key]) || 0)), [rows, key]);
}

export default function AnunciosPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [periodo, setPeriodo] = useState<PeriodoValor>(() => periodoPadrao('mes', 'trimestral'));
  const [sortCamp, setSortCamp] = useState<SortKey>('investimento');
  const [sortAd, setSortAd] = useState<SortKey>('investimento');

  useEffect(() => {
    setPageTitle('📣 Comunicação');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const barId = selectedBar?.id;

  // Cache via SWR: a chave inclui bar + período; trocar filtro re-busca.
  const { data: resp, isLoading } = useApiSWR<any>(
    barId ? `/api/receitas/anuncios?bar_id=${barId}&inicio=${periodo.inicio}&fim=${periodo.fim}` : null,
  );
  const dados = resp?.success ? resp : null;
  const loading = !barId || isLoading;

  const r = dados?.resumo;
  const kpis: Kpi[] = r
    ? [
        { label: 'Investimento', valor: money(r.investimento), icon: DollarSign },
        { label: 'Alcance', valor: num(r.alcance), icon: Eye },
        { label: 'Cliques', valor: num(r.cliques), icon: MousePointerClick },
        { label: 'CPM', valor: money2(r.cpm), icon: Target },
        { label: 'CTR', valor: pct2(r.ctr), icon: Percent },
        { label: 'Conversas', valor: num(r.conversas), icon: MessageCircle },
      ]
    : [];
  const kpisEfic: Kpi[] = r
    ? [
        { label: 'Custo/clique', valor: money2(r.cpc), icon: MousePointerClick },
        { label: 'Frequência', valor: dec1(r.frequencia), icon: Repeat },
        { label: 'ROAS de compra', valor: roasFmt(r.roas_compra), icon: TrendingUp },
        { label: 'Custo/conversa', valor: money2(r.custo_conversa), icon: MessageCircle },
        { label: 'Custo/venda', valor: money2(r.custo_venda), icon: ShoppingCart },
        { label: 'Leads', valor: num(r.leads), icon: UserPlus },
        { label: 'Vídeos assistidos', valor: num(r.thruplays), icon: PlayCircle },
      ]
    : [];

  const campanhas = useMemo<any[]>(() => dados?.campanhas ?? [], [dados]);
  const anuncios = useMemo<any[]>(() => dados?.anuncios ?? [], [dados]);
  const posicionamento = useMemo<any[]>(() => dados?.posicionamento ?? [], [dados]);
  const demografia = useMemo<any[]>(() => dados?.demografia ?? [], [dados]);
  const campanhasSort = useSorted(campanhas, sortCamp);
  const anunciosSort = useSorted(anuncios, sortAd);
  const topCamp = useMemo(
    () => [...campanhas].sort((a, b) => b.investimento - a.investimento).slice(0, 10).reverse(),
    [campanhas],
  );
  const topPos = useMemo(() => [...posicionamento].slice(0, 8).reverse(), [posicionamento]);

  return (
    <PageShell width="wide">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Mídia paga (Meta Ads) de {selectedBar?.nome ?? 'o bar selecionado'} — por campanha e por anúncio.
        </p>
        <div className="overflow-x-auto">
          <PeriodRangePicker value={periodo} onChange={setPeriodo} className="!flex-nowrap w-max" />
        </div>
      </div>

      {!barId ? (
        <div className="flex h-64 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
          Selecione um bar para ver os anúncios.
        </div>
      ) : loading ? (
        <div className="flex h-64 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">Carregando anúncios…</div>
      ) : dados?.configurado === false ? (
        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-5 text-sm text-[hsl(var(--muted-foreground))]">
          Conta de anúncio ainda não conectada para este bar. Configure a variável <code>META_ADS_ACCOUNTS</code> no Vercel.
        </div>
      ) : !dados?.tem_dados ? (
        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-5 text-sm text-[hsl(var(--muted-foreground))]">
          Sem anúncios com investimento no período selecionado.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Resumo do período</h2>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              dados reais via API Meta
            </span>
          </div>
          <HeroRow kpis={kpis} cols={6} />
          <HeroRow kpis={kpisEfic} cols={6} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {topPos.length > 0 && (
              <ChartCard titulo="Onde o investimento rende" subtitulo="gasto por posicionamento (Stories/Feed/Reels × IG/FB)">
                <GraficoBarrasAgrupadasH
                  data={topPos}
                  yKey="local"
                  series={[{ key: 'investimento', nome: 'Investido', cor: '#6366f1' }]}
                  formatV={money}
                  height={300}
                />
              </ChartCard>
            )}
            {demografia.length > 0 && (
              <ChartCard titulo="Público alcançado (pago)" subtitulo="impressões por faixa etária e gênero">
                <GraficoBarrasAgrupadas
                  data={demografia}
                  xKey="faixa"
                  series={[
                    { key: 'feminino', nome: 'Feminino', cor: '#ec4899' },
                    { key: 'masculino', nome: 'Masculino', cor: '#3b82f6' },
                  ]}
                  formatV={num}
                  height={300}
                />
              </ChartCard>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard titulo="Investimento por campanha" subtitulo="top 10 campanhas por gasto no período">
              <GraficoBarrasAgrupadasH
                data={topCamp}
                yKey="campanha"
                series={[{ key: 'investimento', nome: 'Investido', cor: '#ec4899' }]}
                formatV={money}
                height={340}
              />
            </ChartCard>
            <CardRoas barId={barId} periodo={periodo} />
          </div>

          <TabelaMetrica
            titulo="Por campanha"
            rows={campanhasSort}
            rotuloKey="campanha"
            rotuloHead="Campanha"
            sortKey={sortCamp}
            setSort={setSortCamp}
          />

          <TabelaMetrica
            titulo="Por anúncio"
            rows={anunciosSort}
            rotuloKey="anuncio"
            rotuloHead="Anúncio"
            sortKey={sortAd}
            setSort={setSortAd}
            comThumb
          />
        </>
      )}
    </PageShell>
  );
}

const PAGINA = 50;

function TabelaMetrica({
  titulo,
  rows,
  rotuloKey,
  rotuloHead,
  sortKey,
  setSort,
  comThumb = false,
}: {
  titulo: string;
  rows: any[];
  rotuloKey: string;
  rotuloHead: string;
  sortKey: SortKey;
  setSort: (k: SortKey) => void;
  comThumb?: boolean;
}) {
  const [visiveis, setVisiveis] = useState(PAGINA);
  // ao reordenar/trocar período, volta pro topo da lista
  useEffect(() => setVisiveis(PAGINA), [sortKey, rows]);
  const mostrados = rows.slice(0, visiveis);

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{titulo}</h3>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {rows.length > visiveis ? `${visiveis} de ${rows.length}` : `${rows.length} itens`} · clique no cabeçalho pra ordenar
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-y border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]">
              <th className="px-4 py-2 text-left font-medium">{rotuloHead}</th>
              {COLS.map((c) => (
                <th key={c.key} className="px-3 py-2 text-right font-medium">
                  <button
                    type="button"
                    onClick={() => setSort(c.key)}
                    className={`inline-flex items-center gap-1 hover:text-[hsl(var(--foreground))] ${sortKey === c.key ? 'text-[hsl(var(--foreground))] font-semibold' : ''}`}
                  >
                    {c.label}
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mostrados.map((row, i) => (
              <tr key={row.ad_id || `${row[rotuloKey]}-${i}`} className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--muted)/0.4)]">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    {comThumb &&
                      (row.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.thumbnail} alt="" loading="lazy" decoding="async" className="h-9 w-9 shrink-0 rounded-md border border-[hsl(var(--border))] object-cover" />
                      ) : (
                        <div className="h-9 w-9 shrink-0 rounded-md border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]" />
                      ))}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-[hsl(var(--foreground))]" title={row[rotuloKey]}>{row[rotuloKey]}</span>
                        {comThumb && <StatusBadge status={row.status} ativo={row.ativo} />}
                      </div>
                      {comThumb && (row.campanha || row.criado_em) && (
                        <div className="truncate text-xs text-[hsl(var(--muted-foreground))]" title={row.campanha}>
                          {row.campanha}
                          {data(row.criado_em) && <span> · criado {data(row.criado_em)}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                {COLS.map((c) => (
                  <td key={c.key} className={`px-3 py-2 text-right tabular-nums ${sortKey === c.key ? 'font-semibold text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
                    {c.fmt(row[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > visiveis && (
        <div className="flex justify-center border-t border-[hsl(var(--border))] p-3">
          <button
            type="button"
            onClick={() => setVisiveis((v) => v + PAGINA)}
            className="rounded-lg border border-[hsl(var(--border))] px-4 py-1.5 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.5)]"
          >
            Carregar mais {Math.min(PAGINA, rows.length - visiveis)}
          </button>
        </div>
      )}
    </div>
  );
}
