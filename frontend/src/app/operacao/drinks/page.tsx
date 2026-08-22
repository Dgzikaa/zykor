'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import {
  HeroRow, ChartCard, ChartGrid, GraficoBarra, GraficoLinha, type Kpi,
} from '@/components/graficos/Charts';
import {
  GlassWater, DollarSign, Percent, Receipt, Timer, TrendingDown,
  Star, Zap, Lightbulb, AlertTriangle, Tag, FileWarning, ExternalLink,
} from 'lucide-react';

/**
 * Painel de Drinks (Mafê, 22/08/2026) — o aprofundamento da área Bar do Painel do Líder.
 *
 * O recorte de "o que é um drink" mora em `gold.fn_drinks_painel`, não aqui: o ContaHub quebra o
 * mesmo drink em vários `prd` por faixa de preço ([50%], [HH], [PP], [DD]) e joga cada um num
 * grupo diferente, então o painel junta pelo NOME BASE. É por isso que o Moscow Mule aparece uma
 * vez só, com o preço médio que de fato entrou no caixa.
 */

const PERIODOS = [
  { dias: 7, rotulo: '7 dias' },
  { dias: 28, rotulo: '4 semanas' },
  { dias: 56, rotulo: '8 semanas' },
  { dias: 90, rotulo: '90 dias' },
];

const n = (v: any) => Number(v ?? 0);
const fmtBRL = (v: any) => n(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtBRL2 = (v: any) => n(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v: any) => n(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtPct = (v: any) => (v == null ? '—' : `${n(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
const fmtTempo = (s: any) => {
  const v = Number(s);
  if (!Number.isFinite(v) || v <= 0) return '—';
  const m = Math.floor(v / 60);
  const r = Math.round(v % 60);
  return m ? (r ? `${m}min ${r}s` : `${m}min`) : `${r}s`;
};

/** Variação percentual contra o período anterior. null quando não há base pra comparar. */
const delta = (atual: any, ant: any) => {
  const a = Number(atual); const b = Number(ant);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return ((a - b) / Math.abs(b)) * 100;
};

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** O ContaHub usa 24/25/26 pro pós-meia-noite do MESMO dia operacional — não é erro, é o turno. */
const rotuloHora = (h: number) => `${String(h % 24).padStart(2, '0')}h`;

const CLASSES = [
  {
    id: 'destaque', dot: 'bg-emerald-500', titulo: 'Destaques', icon: Star,
    desc: 'Vendem muito e deixam boa margem. Proteja: não tire do cardápio nem coloque em promoção.',
    cor: 'text-emerald-700 dark:text-emerald-400',
    borda: 'border-emerald-200 dark:border-emerald-900/60',
    fundo: 'bg-emerald-50/60 dark:bg-emerald-950/20',
  },
  {
    id: 'alto_giro', dot: 'bg-sky-500', titulo: 'Alto giro', icon: Zap,
    desc: 'Vendem muito, mas deixam pouco. Vale revisar preço, dose ou o quanto vão pra promoção.',
    cor: 'text-sky-700 dark:text-sky-400',
    borda: 'border-sky-200 dark:border-sky-900/60',
    fundo: 'bg-sky-50/60 dark:bg-sky-950/20',
  },
  {
    id: 'oportunidade', dot: 'bg-amber-500', titulo: 'Oportunidades', icon: Lightbulb,
    desc: 'Deixam boa margem e vendem pouco. É onde sugestão de garçom e destaque no cardápio pagam mais.',
    cor: 'text-amber-700 dark:text-amber-400',
    borda: 'border-amber-200 dark:border-amber-900/60',
    fundo: 'bg-amber-50/60 dark:bg-amber-950/20',
  },
  {
    id: 'baixa', dot: 'bg-rose-500', titulo: 'Baixa performance', icon: TrendingDown,
    desc: 'Vendem pouco e deixam pouco. Candidatos a sair do cardápio ou a serem reformulados.',
    cor: 'text-rose-700 dark:text-rose-400',
    borda: 'border-rose-200 dark:border-rose-900/60',
    fundo: 'bg-rose-50/60 dark:bg-rose-950/20',
  },
] as const;

type Ordem = 'fat' | 'qtd' | 'margem_total' | 'margem_unit' | 'cmv_pct' | 'tempo_seg' | 'pct_promo';
const ORDENS: { id: Ordem; rotulo: string }[] = [
  { id: 'fat', rotulo: 'Faturamento' },
  { id: 'qtd', rotulo: 'Quantidade' },
  { id: 'margem_total', rotulo: 'Margem total' },
  { id: 'margem_unit', rotulo: 'Margem por drink' },
  { id: 'cmv_pct', rotulo: 'CMV %' },
  { id: 'pct_promo', rotulo: '% em promoção' },
  { id: 'tempo_seg', rotulo: 'Tempo de saída' },
];

export default function PainelDrinksPage() {
  const { setPageTitle } = usePageTitle();
  const [dias, setDias] = useState(28);
  const [ordem, setOrdem] = useState<Ordem>('fat');

  useEffect(() => {
    setPageTitle('🍹 Painel de Drinks');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const { data, isLoading } = useApiSWR<any>(`/api/operacao/drinks?dias=${dias}`);
  const p = data?.painel;

  const drinks: any[] = useMemo(() => p?.drinks || [], [p]);

  const kpis: Kpi[] = useMemo(() => {
    if (!p) return [];
    const r = p.resumo || {};
    const a = p.anterior || {};
    return [
      { label: 'Faturamento drinks', valor: fmtBRL(r.fat), delta: delta(r.fat, a.fat), icon: DollarSign },
      { label: 'Drinks vendidos', valor: fmtNum(r.qtd), delta: delta(r.qtd, a.qtd), icon: GlassWater },
      {
        label: '% do faturamento', valor: fmtPct(r.pct_fat), icon: Percent,
        deltaLabel: a.pct_fat != null ? `antes ${fmtPct(a.pct_fat)}` : undefined,
        sub: `de ${fmtBRL(r.fat_casa)} da casa`,
      },
      { label: 'Ticket médio', valor: fmtBRL2(r.ticket_medio), delta: delta(r.ticket_medio, a.ticket_medio), icon: Receipt },
      // CMV menor é melhor — a seta tem que inverter, senão uma queda de custo aparece em vermelho.
      { label: 'CMV médio', valor: fmtPct(r.cmv_pct), delta: delta(r.cmv_pct, a.cmv_pct), invLower: true, icon: Percent },
      { label: 'Tempo de saída', valor: fmtTempo(r.tempo_seg), delta: delta(r.tempo_seg, a.tempo_seg), invLower: true, icon: Timer },
    ];
  }, [p]);

  const semanas = useMemo(() => (p?.semanas || []).map((s: any) => ({
    ...s,
    rotulo: String(s.semana).slice(8, 10) + '/' + String(s.semana).slice(5, 7),
  })), [p]);

  const diaSemana = useMemo(() => {
    const src = p?.dia_semana || [];
    // Ordem de semana operacional (Ter→Seg não; aqui Seg→Dom, que é como a equipe fala a escala).
    const ordemDow = [1, 2, 3, 4, 5, 6, 0];
    return ordemDow
      .map((d) => src.find((x: any) => x.dow === d))
      .filter(Boolean)
      .map((x: any) => ({ ...x, rotulo: DIAS_SEMANA[x.dow] }));
  }, [p]);

  const horas = useMemo(() => (p?.hora || []).map((h: any) => ({
    ...h, rotulo: rotuloHora(n(h.hora)),
  })), [p]);

  const ranking = useMemo(() => {
    const asc = ordem === 'cmv_pct' || ordem === 'tempo_seg';
    return [...drinks].sort((a, b) => {
      const va = a[ordem]; const vb = b[ordem];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;   // sem dado vai pro fim, independente da direção
      if (vb == null) return -1;
      return asc ? n(va) - n(vb) : n(vb) - n(va);
    });
  }, [drinks, ordem]);

  const porClasse = useMemo(() => {
    const m: Record<string, any[]> = { destaque: [], alto_giro: [], oportunidade: [], baixa: [] };
    drinks.forEach((d) => { if (d.classe && m[d.classe]) m[d.classe].push(d); });
    Object.values(m).forEach((arr) => arr.sort((a, b) => n(b.fat) - n(a.fat)));
    return m;
  }, [drinks]);

  const semFicha = useMemo(() => drinks.filter((d) => d.custo_unit == null), [drinks]);

  return (
    <ProtectedRoute>
      <div className="p-3 sm:p-5 space-y-4 max-w-[1600px] mx-auto">
        {/* Filtros. A CASA não tem seletor próprio: o painel segue o bar ativo do Zykor, senão
            existiriam dois lugares dizendo em qual bar você está. */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-0.5">
            {PERIODOS.map((op) => (
              <button
                key={op.dias}
                onClick={() => setDias(op.dias)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  dias === op.dias
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {op.rotulo}
              </button>
            ))}
          </div>
          {p?.periodo && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {String(p.periodo.ini).split('-').reverse().join('/')} a {String(p.periodo.fim).split('-').reverse().join('/')}
              {' · '}compara com {String(p.periodo.ini_ant).split('-').reverse().join('/')} a {String(p.periodo.fim_ant).split('-').reverse().join('/')}
            </span>
          )}
          <Link
            href="/operacao/painel"
            className="ml-auto inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline"
          >
            Painel do Líder <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {isLoading && !p ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        ) : !p ? (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center text-sm text-gray-500">
            Sem dados de drinks no período.
          </div>
        ) : (
          <>
            <HeroRow kpis={kpis} cols={6} />

            {/* O número que mais muda decisão de cardápio, e que nenhuma tela mostrava: quanto do
                volume sai com desconto. Fica em destaque próprio porque explica o ticket médio. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                <div className="flex items-start gap-3">
                  <Tag className="h-5 w-5 shrink-0 text-purple-500 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {fmtPct(p.resumo?.pct_promo)} dos drinks saem com desconto
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {fmtNum(p.resumo?.qtd_promo)} de {fmtNum(p.resumo?.qtd)} drinks saíram como
                      {' '}<span className="font-mono">[HH]</span>, <span className="font-mono">[50%]</span>,
                      {' '}<span className="font-mono">[PP]</span> ou <span className="font-mono">[DD]</span>.
                      O ticket médio e o CMV desta tela já são os reais — a receita do drink em promoção é a
                      mesma, só o preço muda, então o custo pesa mais.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                <div className="flex items-start gap-3">
                  <FileWarning className={`h-5 w-5 shrink-0 mt-0.5 ${semFicha.length ? 'text-amber-500' : 'text-emerald-500'}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {semFicha.length ? `${semFicha.length} drink(s) sem ficha` : 'Todo drink tem ficha'}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {semFicha.length
                        ? `Entram no faturamento mas ficam fora do CMV e da classificação: ${semFicha.slice(0, 4).map((d) => d.nome).join(', ')}${semFicha.length > 4 ? '…' : ''}`
                        : 'O CMV desta tela cobre 100% do faturamento de drinks.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <ChartGrid cols={3}>
              <ChartCard titulo="Evolução semanal" subtitulo="Faturamento e CMV por semana">
                <GraficoBarra
                  data={semanas} xKey="rotulo" valueKey="fat" lineKey="cmv_pct"
                  nomeBarra="Faturamento" nomeLinha="CMV %"
                  formatV={fmtBRL} formatLine={fmtPct} height={280}
                />
              </ChartCard>

              <ChartCard titulo="Por dia da semana" subtitulo="Média de drinks por dia de operação">
                <GraficoBarra
                  data={diaSemana} xKey="rotulo" valueKey="qtd_dia"
                  nomeBarra="Drinks/dia" formatV={fmtNum} height={280} mostrarRotulo
                />
              </ChartCard>

              <ChartCard titulo="Por faixa de horário" subtitulo="Quantidade vendida — o turno cruza a meia-noite">
                <GraficoBarra
                  data={horas} xKey="rotulo" valueKey="qtd"
                  nomeBarra="Drinks" formatV={fmtNum} height={280}
                />
              </ChartCard>

              <ChartCard titulo="Ticket médio por semana" subtitulo="Quanto entrou por drink servido" span={3}>
                <GraficoLinha
                  data={semanas} xKey="rotulo"
                  series={[{ key: 'ticket_medio', nome: 'Ticket médio' }]}
                  formatV={fmtBRL2} height={220} area
                />
              </ChartCard>
            </ChartGrid>

            {/* ── Classificação ───────────────────────────────────────────────────────────── */}
            <div>
              <div className="flex flex-wrap items-baseline gap-2 mb-2">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Classificação automática</h2>
                {p.cortes && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    corte: mediana de {fmtNum(p.cortes.qtd)} drinks vendidos e {fmtBRL2(p.cortes.margem)} de
                    margem por drink · metade do cardápio fica de cada lado
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {CLASSES.map((c) => {
                  const itens = porClasse[c.id] || [];
                  const Icon = c.icon;
                  return (
                    <div key={c.id} className={`rounded-xl border ${c.borda} ${c.fundo} p-4 flex flex-col`}>
                      <div className={`flex items-center gap-2 text-sm font-semibold ${c.cor}`}>
                        <Icon className="h-4 w-4" />
                        {c.titulo}
                        <span className="ml-auto text-xs font-normal opacity-70">{itens.length}</span>
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1.5 leading-snug">{c.desc}</p>
                      <ul className="mt-3 space-y-1 text-xs">
                        {itens.length === 0 && <li className="text-gray-400">nenhum</li>}
                        {itens.slice(0, 10).map((d) => (
                          <li key={d.nome} className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-gray-800 dark:text-gray-200" title={d.nome}>{d.nome}</span>
                            <span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
                              {fmtNum(d.qtd)}un · {fmtBRL2(d.margem_unit)}
                            </span>
                          </li>
                        ))}
                        {itens.length > 10 && (
                          <li className="text-gray-400">+{itens.length - 10} na tabela abaixo</li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Ranking completo ────────────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 p-3 border-b border-[hsl(var(--border))]">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Todos os drinks <span className="font-normal text-gray-500">({drinks.length})</span>
                </h2>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400">ordenar por</span>
                  <select
                    value={ordem}
                    onChange={(e) => setOrdem(e.target.value as Ordem)}
                    className="text-xs rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5 text-gray-800 dark:text-gray-200"
                  >
                    {ORDENS.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Drink</th>
                      <th className="text-right font-medium px-3 py-2">Qtd</th>
                      <th className="text-right font-medium px-3 py-2">Mix</th>
                      <th className="text-right font-medium px-3 py-2">Faturamento</th>
                      <th className="text-right font-medium px-3 py-2">Preço médio</th>
                      <th className="text-right font-medium px-3 py-2">Custo</th>
                      <th className="text-right font-medium px-3 py-2">CMV</th>
                      <th className="text-right font-medium px-3 py-2">Margem/un</th>
                      <th className="text-right font-medium px-3 py-2">Margem total</th>
                      <th className="text-right font-medium px-3 py-2">Promo</th>
                      <th className="text-right font-medium px-3 py-2">Tempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((d) => {
                      const c = CLASSES.find((x) => x.id === d.classe);
                      return (
                        <tr key={d.nome} className="border-t border-[hsl(var(--border))] hover:bg-gray-50 dark:hover:bg-gray-900/30">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {c && <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${c.dot}`} title={c.titulo} />}
                              <span className="truncate text-gray-900 dark:text-gray-100" title={d.nome}>{d.nome}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtNum(d.qtd)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtPct(d.mix_qtd)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtBRL(d.fat)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtBRL2(d.preco_medio)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                            {d.custo_unit == null ? '—' : fmtBRL2(d.custo_unit)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{d.cmv_pct == null ? '—' : fmtPct(d.cmv_pct)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{d.margem_unit == null ? '—' : fmtBRL2(d.margem_unit)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{d.margem_total == null ? '—' : fmtBRL(d.margem_total)}</td>
                          <td className={`px-3 py-2 text-right tabular-nums ${n(d.pct_promo) >= 50 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-gray-500'}`}>
                            {fmtPct(d.pct_promo)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtTempo(d.tempo_seg)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="flex items-start gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
              CMV e margem são <strong>teóricos</strong>: saem da ficha técnica, não do estoque. Diferença
              entre isto e o CMV real é desvio — está em Produção · Desvios.
            </p>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
