'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from 'recharts';
import { Tag, Users, DollarSign, TrendingUp, TrendingDown, Minus, Trophy, Sparkles, Activity, Flame, ArrowUp, ArrowDown, Star } from 'lucide-react';

const money = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const moneyK = (v: number) => `${Math.round((v || 0) / 1000)}k`;
const num = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');
const fmtData = (d?: string) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—');
const fmtSemana = (d?: string) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '');

// consistência (coef. de variação) -> selo
function cvSelo(cv: number): { txt: string; cls: string } {
  if (cv < 0.15) return { txt: 'Muito consistente', cls: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/25' };
  if (cv < 0.3) return { txt: 'Consistente', cls: 'text-teal-700 bg-teal-50 dark:text-teal-300 dark:bg-teal-900/25' };
  if (cv < 0.5) return { txt: 'Variável', cls: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/25' };
  return { txt: 'Volátil', cls: 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-900/25' };
}

function TendIcon({ t }: { t: string }) {
  if (t === 'subindo') return <TrendingUp className="h-4 w-4 text-emerald-500 inline" />;
  if (t === 'caindo') return <TrendingDown className="h-4 w-4 text-rose-500 inline" />;
  return <Minus className="h-4 w-4 text-gray-400 inline" />;
}

type Sort = 'fat_total' | 'fat_medio' | 'publico_medio' | 'retorno' | 'shows' | 'meta_atingimento' | 'cv' | 'nps_score' | 'pct_fideliza';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'fat_total', label: 'Faturamento' },
  { key: 'nps_score', label: 'Melhor NPS' },
  { key: 'pct_fideliza', label: 'Mais fideliza' },
  { key: 'fat_medio', label: 'Fat. médio' },
  { key: 'publico_medio', label: 'Público' },
  { key: 'retorno', label: 'Retorno' },
  { key: 'meta_atingimento', label: 'Meta' },
  { key: 'shows', label: 'Nº shows' },
];
const npsCor = (s: number) => s >= 50 ? 'text-emerald-600 dark:text-emerald-400' : s >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
const fidelizaCor = (p: number) => p >= 25 ? 'text-emerald-600 dark:text-emerald-400' : p >= 15 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
const npsDimCor = (nota: number) => nota >= 4.2 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : nota >= 3.5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';

export default function LabelsTab({ barId, periodo }: { barId?: number; periodo: number }) {
  const [resp, setResp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>('fat_total');
  const [selKey, setSelKey] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true); setResp(null);
    try {
      const r = await fetch(`/api/analitico/labels?periodo=${periodo}&bar_id=${barId}`, { cache: 'no-store' });
      const j = await r.json();
      setResp(j);
      setSelKey(j?.labels?.[0]?.key ?? null);
    } catch { setResp({ labels: [] }); }
    finally { setLoading(false); }
  }, [barId, periodo]);
  useEffect(() => { carregar(); }, [carregar]);

  const labels: any[] = useMemo(() => resp?.labels || [], [resp]);
  const stats = resp?.stats;
  const insights = resp?.insights;
  const grafico = resp?.grafico;

  const linhas = useMemo(() => {
    return [...labels].sort((a, b) => (Number(b[sort] ?? -Infinity)) - (Number(a[sort] ?? -Infinity)));
  }, [labels, sort]);

  const sel = useMemo(() => labels.find((l) => l.key === selKey) || null, [labels, selKey]);

  // matriz artista×label (top labels por shows × top artistas por shows)
  const matriz = useMemo(() => {
    const topLabels = [...labels].sort((a, b) => b.shows - a.shows).slice(0, 8);
    const artTot = new Map<string, { nome: string; shows: number }>();
    for (const l of topLabels) for (const a of l.artistas || []) {
      const k = a.artista_id ? `id:${a.artista_id}` : `nome:${String(a.nome).toLowerCase()}`;
      const cur = artTot.get(k) || { nome: a.nome, shows: 0 };
      cur.shows += a.shows; artTot.set(k, cur);
    }
    const topArt = [...artTot.entries()].sort((a, b) => b[1].shows - a[1].shows).slice(0, 8);
    const cell = new Map<string, { fat: number; shows: number }>();
    let maxFat = 0;
    for (const l of topLabels) for (const a of l.artistas || []) {
      const ak = a.artista_id ? `id:${a.artista_id}` : `nome:${String(a.nome).toLowerCase()}`;
      cell.set(`${l.key}|${ak}`, { fat: a.fat_medio, shows: a.shows });
      if (a.fat_medio > maxFat) maxFat = a.fat_medio;
    }
    return { topLabels, topArt, cell, maxFat };
  }, [labels]);

  const kpis = stats ? [
    { icon: Tag, cor: 'text-violet-500', label: 'Labels ativas', v: num(stats.total_labels) },
    { icon: Users, cor: 'text-blue-500', label: 'Shows', v: num(stats.total_shows) },
    { icon: DollarSign, cor: 'text-emerald-500', label: 'Faturamento', v: money(stats.fat_total) },
    { icon: Trophy, cor: 'text-amber-500', label: 'Top faturamento', v: stats.top_fat || '—' },
    { icon: Sparkles, cor: 'text-pink-500', label: 'Maior retorno', v: stats.top_retorno || '—' },
    { icon: Flame, cor: 'text-orange-500', label: 'Maior público', v: stats.top_publico || '—' },
  ] : [];

  if (loading) {
    return <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      <Skeleton className="h-64" /><Skeleton className="h-80" />
    </div>;
  }

  if (!labels.length) {
    return <div className="py-16 text-center text-gray-500">Sem labels recorrentes no período (mínimo {resp?.periodo?.min_shows ?? 3} shows por label). Cadastre a <b>Label</b> dos eventos no Planejamento Comercial.</div>;
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k: any, i) => (
          <Card key={i}><CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-xs text-gray-500"><k.icon className={`h-3.5 w-3.5 ${k.cor}`} />{k.label}</div>
            <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white truncate" title={String(k.v)}>{k.v}</div>
          </CardContent></Card>
        ))}
      </div>

      {/* Insights automáticos */}
      {insights && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <InsightCard icon={Sparkles} cor="text-emerald-500" titulo="Mais rentável" nome={insights.mais_rentavel?.nome} detalhe={insights.mais_rentavel ? `${(insights.mais_rentavel.retorno || 0).toFixed(1).replace('.', ',')}× o cachê` : null} onClick={() => insights.mais_rentavel && setSelKey(insights.mais_rentavel.key)} />
          <InsightCard icon={TrendingUp} cor="text-blue-500" titulo="Mais cresce" nome={insights.mais_cresce?.nome} detalhe={insights.mais_cresce ? `+${Math.round(insights.mais_cresce.tendencia_var)}% recente` : 'sem tendência de alta'} onClick={() => insights.mais_cresce && setSelKey(insights.mais_cresce.key)} />
          <InsightCard icon={TrendingDown} cor="text-rose-500" titulo="Atenção (queda)" nome={insights.em_queda?.nome} detalhe={insights.em_queda ? `${Math.round(insights.em_queda.tendencia_var)}% recente` : 'nenhuma em queda'} onClick={() => insights.em_queda && setSelKey(insights.em_queda.key)} />
          <InsightCard icon={Activity} cor="text-teal-500" titulo="Mais consistente" nome={insights.mais_consistente?.nome} detalhe={insights.mais_consistente ? cvSelo(insights.mais_consistente.cv).txt : null} onClick={() => insights.mais_consistente && setSelKey(insights.mais_consistente.key)} />
          <InsightCard icon={Star} cor="text-amber-500" titulo="Melhor dupla artista × label" nome={insights.melhor_dupla ? `${insights.melhor_dupla.artista}` : null} detalhe={insights.melhor_dupla ? `em ${insights.melhor_dupla.label} · +${money(insights.melhor_dupla.lift)}/noite` : null} onClick={() => insights.melhor_dupla && setSelKey(insights.melhor_dupla.label_key)} />
        </div>
      )}

      {/* Evolução semana a semana (multi-linha por label) */}
      {grafico?.dados?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-violet-500" />Faturamento semana a semana</CardTitle>
            <CardDescription>cada linha é uma label (as {grafico.series.length} mais frequentes) — dá pra ver quem sustenta e quem oscila</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={grafico.dados} margin={{ top: 6, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="semana" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtSemana(String(v))} interval="preserveStartEnd" minTickGap={32} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => moneyK(Number(v))} width={40} />
                  <RTooltip formatter={((v: number, name: string) => [money(Number(v)), grafico.series.find((s: any) => s.key === name)?.nome || name]) as any} labelFormatter={(l) => `Semana de ${fmtData(String(l))}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => grafico.series.find((s: any) => s.key === v)?.nome || v} />
                  {grafico.series.map((s: any) => (
                    <Line key={s.key} type="monotone" dataKey={s.key} name={s.key} stroke={s.cor} strokeWidth={2} dot={{ r: 2 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ranking de labels */}
      <div className="flex items-center gap-1.5 flex-wrap text-xs">
        <span className="text-gray-400">Ordenar:</span>
        {SORTS.map(s => (
          <button key={s.key} onClick={() => setSort(s.key)} className={`h-7 px-2 rounded border ${sort === s.key ? 'border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-900/25 dark:text-violet-300' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>{s.label}</button>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Ranking de labels</CardTitle><CardDescription>clique numa label pra abrir a análise detalhada (evolução + artistas)</CardDescription></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
              <th className="text-left px-3 py-2">Label</th>
              <th className="text-left px-3 py-2">Dia</th>
              <th className="text-right px-3 py-2">Shows</th>
              <th className="text-right px-3 py-2">Fat. médio</th>
              <th className="text-right px-3 py-2">Público méd.</th>
              <th className="text-right px-3 py-2" title="Score NPS (promotores − detratores) no período · nº de respostas entre parênteses">NPS</th>
              <th className="text-right px-3 py-2" title="% dos clientes cuja 1ª visita foi numa noite desta label que viraram recorrentes · nº de novos entre parênteses">Fideliza</th>
              <th className="text-right px-3 py-2" title="Ticket médio (t_medio)">Ticket</th>
              <th className="text-right px-3 py-2" title="R$ faturado por R$ de cachê">Retorno</th>
              <th className="text-right px-3 py-2" title="% do fat que vira cachê">% cachê</th>
              <th className="text-left px-3 py-2" title="De onde vem o faturamento: Bar (consumo) × Couvert × Bilheteria (Yuzer/Sympla)">Composição</th>
              <th className="text-right px-3 py-2" title="Realizado ÷ Meta M1 (onde há meta lançada)">Meta</th>
              <th className="text-right px-3 py-2" title="Público médio ÷ capacidade">Ocup.</th>
              <th className="text-left px-3 py-2" title="Coef. de variação do faturamento — quão previsível é a label">Consistência</th>
              <th className="text-center px-3 py-2">Tend.</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {linhas.map((l) => {
                const selo = cvSelo(l.cv);
                const ativa = l.key === selKey;
                return (
                  <tr key={l.key} onClick={() => setSelKey(l.key)} className={`cursor-pointer ${ativa ? 'bg-violet-50/70 dark:bg-violet-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap max-w-[220px] truncate" title={l.nome}>{l.nome}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{l.dia_label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.shows}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(l.fat_medio)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(l.publico_medio)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {l.nps_score == null ? <span className="text-gray-400">—</span>
                        : <span className={`font-medium ${npsCor(l.nps_score)}`}>{l.nps_score > 0 ? '+' : ''}{l.nps_score}<span className="text-[10px] text-gray-400 ml-0.5">({l.nps_respostas})</span></span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {l.pct_fideliza == null ? <span className="text-gray-400">—</span>
                        : <span className={`font-medium ${fidelizaCor(l.pct_fideliza)}`}>{l.pct_fideliza}%<span className="text-[10px] text-gray-400 ml-0.5">({num(l.novos)})</span></span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{l.ticket_medio ? money(l.ticket_medio) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.retorno != null ? `${l.retorno.toFixed(1).replace('.', ',')}×` : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{l.pct_cachet != null ? `${Math.round(l.pct_cachet)}%` : '—'}</td>
                    <td className="px-3 py-2"><MiniComp c={l.composicao} /></td>
                    <td className={`px-3 py-2 text-right tabular-nums ${l.meta_atingimento == null ? 'text-gray-400' : l.meta_atingimento >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{l.meta_atingimento != null ? `${Math.round(l.meta_atingimento)}%` : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{l.ocupacao != null ? `${Math.round(l.ocupacao)}%` : '—'}</td>
                    <td className="px-3 py-2"><span className={`text-[11px] px-1.5 py-0.5 rounded ${selo.cls}`}>{selo.txt}</span></td>
                    <td className="px-3 py-2 text-center"><TendIcon t={l.tendencia} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Deep-dive da label selecionada */}
      {sel && <LabelDetalhe l={sel} />}

      {/* Matriz artista × label */}
      {matriz.topArt.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Tag className="h-4 w-4 text-violet-500" />Matriz artista × label</CardTitle>
            <CardDescription>faturamento médio por noite quando o artista foi o principal — mais escuro = fatura mais. Vazio = nunca tocou naquela label.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="text-sm border-separate" style={{ borderSpacing: 2 }}>
              <thead><tr>
                <th className="text-left px-3 py-2 text-xs text-gray-500 sticky left-0 bg-white dark:bg-gray-900 z-10">Label ↓ / Artista →</th>
                {matriz.topArt.map(([k, a]) => (
                  <th key={k} className="px-2 py-2 text-xs text-gray-500 font-medium whitespace-nowrap max-w-[90px] truncate" title={a.nome}>{a.nome}</th>
                ))}
              </tr></thead>
              <tbody>
                {matriz.topLabels.map((l) => (
                  <tr key={l.key}>
                    <td className="px-3 py-2 text-xs font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap max-w-[160px] truncate sticky left-0 bg-white dark:bg-gray-900 z-10" title={l.nome}>{l.nome}</td>
                    {matriz.topArt.map(([ak]) => {
                      const c = matriz.cell.get(`${l.key}|${ak}`);
                      if (!c) return <td key={ak} className="px-2 py-2 text-center text-gray-300 dark:text-gray-700">·</td>;
                      const inten = matriz.maxFat > 0 ? c.fat / matriz.maxFat : 0;
                      return (
                        <td key={ak} className="px-2 py-2 text-center rounded" style={{ background: `rgba(139,92,246,${0.12 + inten * 0.68})` }} title={`${l.nome} · ${c.shows} show(s) · ${money(c.fat)}/noite`}>
                          <span className={`text-[11px] font-semibold tabular-nums ${inten > 0.5 ? 'text-white' : 'text-violet-900 dark:text-violet-100'}`}>{moneyK(c.fat)}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <p className="text-[11px] text-gray-400">Label = nome recorrente da noite (<code>eventos_base.nome</code>), normalizado (acento/caixa/hífen) e com sufixo de convidado/DJ removido pra agrupar variações. Período: {periodo} meses · noites com faturamento &gt; R$1.000 · mínimo {resp?.periodo?.min_shows ?? 3} shows por label. A noite é creditada ao <b>artista principal</b> (maior cachê). Cachê exato do Conta Azul.</p>
    </div>
  );
}

function InsightCard({ icon: Icon, cor, titulo, nome, detalhe, onClick }: { icon: any; cor: string; titulo: string; nome?: string | null; detalhe?: string | null; onClick?: () => void }) {
  return (
    <Card onClick={onClick} className={onClick ? 'cursor-pointer hover:ring-1 hover:ring-violet-300 transition' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-gray-500"><Icon className={`h-3.5 w-3.5 ${cor}`} />{titulo}</div>
        <div className="mt-1 text-base font-bold text-gray-900 dark:text-white truncate" title={nome || ''}>{nome || '—'}</div>
        {detalhe && <div className="text-[11px] text-gray-500 truncate">{detalhe}</div>}
      </CardContent>
    </Card>
  );
}

function LabelDetalhe({ l }: { l: any }) {
  const artistas: any[] = l.artistas || [];
  const melhorArt = artistas[0];
  const piorArt = artistas.length > 1 ? artistas[artistas.length - 1] : null;
  return (
    <Card className="border-violet-200 dark:border-violet-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Tag className="h-4 w-4 text-violet-500" />{l.nome} <span className="text-xs font-normal text-gray-400">· {l.dia_label} · {l.shows} shows · {fmtData(l.primeiro)}–{fmtData(l.ultimo)}</span></CardTitle>
        <CardDescription>evolução da label e como cada artista performou nela</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* mini KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
          <MiniKpi label="Fat. médio/noite" v={money(l.fat_medio)} />
          <MiniKpi label="Público médio" v={num(l.publico_medio)} />
          <MiniKpi label="Retorno (fat/cachê)" v={l.retorno != null ? `${l.retorno.toFixed(1).replace('.', ',')}×` : '—'} />
          <MiniKpi label="Atingimento de meta" v={l.meta_atingimento != null ? `${Math.round(l.meta_atingimento)}%` : '—'} />
          <MiniKpi label="NPS do público" v={l.nps_score != null ? `${l.nps_score > 0 ? '+' : ''}${l.nps_score} · ${l.nps_respostas} resp.` : '—'} />
        </div>

        {/* dimensões da experiência (Falae) — o mais baixo é o gargalo */}
        {l.dimensoes?.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1.5">Dimensões da experiência (nota 1–5) — o mais baixo é o gargalo</div>
            <div className="flex flex-wrap gap-1.5">
              {l.dimensoes.map((d: any) => (
                <span key={d.dimensao} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${npsDimCor(d.nota_media)}`} title={`${d.n} avaliações`}>
                  {d.dimensao} <b className="ml-1">{Number(d.nota_media).toFixed(1).replace('.', ',')}</b>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* melhor / pior noite */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-900/15 p-3">
            <div className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1"><ArrowUp className="h-3.5 w-3.5" />Melhor noite</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{money(l.melhor_noite?.fat)}</div>
            <div className="text-[11px] text-gray-500">{fmtData(l.melhor_noite?.data)} · {num(l.melhor_noite?.publico)} pessoas{l.melhor_noite?.artista ? ` · ${l.melhor_noite.artista}` : ''}</div>
          </div>
          <div className="rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-900/15 p-3">
            <div className="text-xs text-rose-700 dark:text-rose-300 flex items-center gap-1"><ArrowDown className="h-3.5 w-3.5" />Pior noite</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{money(l.pior_noite?.fat)}</div>
            <div className="text-[11px] text-gray-500">{fmtData(l.pior_noite?.data)} · {num(l.pior_noite?.publico)} pessoas{l.pior_noite?.artista ? ` · ${l.pior_noite.artista}` : ''}</div>
          </div>
        </div>

        {/* composição do faturamento: Bar × Couvert × Bilheteria (Yuzer/Sympla) */}
        {l.composicao && <ComposicaoFat c={l.composicao} />}

        {/* evolução semanal da label */}
        {l.serie?.length > 1 && (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={l.serie} margin={{ top: 6, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="semana" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtSemana(String(v))} interval="preserveStartEnd" minTickGap={32} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => moneyK(Number(v))} width={40} />
                <RTooltip formatter={((v: number, n: string) => [money(Number(v)), n === 'meta' ? 'meta' : 'faturamento']) as any} labelFormatter={(x) => `Semana de ${fmtData(String(x))}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="fat" name="fat" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="meta" name="meta" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ranking de artistas na label */}
        <div className="overflow-x-auto">
          <div className="text-xs text-gray-500 mb-1">Artistas nesta label {melhorArt && <span className="text-emerald-600">· melhor: {melhorArt.nome}</span>}{piorArt && <span className="text-rose-500"> · pior: {piorArt.nome}</span>}</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
              <th className="text-left px-3 py-2">Artista</th>
              <th className="text-right px-3 py-2">Shows</th>
              <th className="text-right px-3 py-2">Fat. médio</th>
              <th className="text-right px-3 py-2">Público méd.</th>
              <th className="text-right px-3 py-2">Cachê méd.</th>
              <th className="text-right px-3 py-2">Retorno</th>
              <th className="text-right px-3 py-2" title="Fat médio do artista − fat médio da label">Lift vs label</th>
              <th className="text-right px-3 py-2">Melhor noite</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {artistas.map((a) => (
                <tr key={(a.artista_id ?? a.nome) + ''} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-900 dark:text-gray-100">
                    {a.artista_id ? <Link href={`/analitico/atracoes?artista=${a.artista_id}`} className="hover:text-violet-600 hover:underline">{a.nome}</Link> : a.nome}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.shows}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(a.fat_medio)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(a.publico_medio)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{a.cache_medio ? money(a.cache_medio) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.retorno != null ? `${a.retorno.toFixed(1).replace('.', ',')}×` : '—'}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${a.lift_vs_label >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    <span className="inline-flex items-center gap-0.5">{a.lift_vs_label >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{money(Math.abs(a.lift_vs_label))}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{a.melhor_noite ? `${money(a.melhor_noite.fat)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniKpi({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-lg font-bold text-gray-900 dark:text-white truncate" title={v}>{v}</div>
    </div>
  );
}

// mini-barra de composição p/ a linha do ranking (bar/couvert/bilheteria)
function MiniComp({ c }: { c: any }) {
  if (!c) return <span className="text-gray-300">—</span>;
  const segs = [
    { cor: '#10b981', pct: c.pct_bar, val: c.bar, nome: 'Bar' },
    { cor: '#8b5cf6', pct: c.pct_couvert, val: c.couvert, nome: 'Couvert' },
    { cor: '#f59e0b', pct: c.pct_bilheteria, val: c.bilheteria, nome: 'Bilheteria' },
  ].filter((s) => s.val > 0);
  const titulo = segs.map((s) => `${s.nome} ${money(s.val)} (${Math.round(s.pct)}%)`).join(' · ');
  return (
    <div className="flex items-center gap-2" title={titulo}>
      <div className="flex h-2.5 w-[68px] rounded-sm overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
        {segs.map((s, i) => <div key={i} style={{ width: `${s.pct}%`, background: s.cor }} />)}
      </div>
      <span className="text-[11px] text-gray-400 tabular-nums">{Math.round(c.pct_bar)}%<span className="text-gray-300"> bar</span></span>
    </div>
  );
}

// composição do faturamento da label em Bar (consumo) × Couvert × Bilheteria (Yuzer/Sympla)
function ComposicaoFat({ c }: { c: any }) {
  const segs = [
    { key: 'bar', label: 'Bar (consumo)', cor: '#10b981', val: c.bar, pct: c.pct_bar },
    { key: 'couvert', label: 'Couvert', cor: '#8b5cf6', val: c.couvert, pct: c.pct_couvert },
    { key: 'bilheteria', label: 'Bilheteria (Yuzer/Sympla)', cor: '#f59e0b', val: c.bilheteria, pct: c.pct_bilheteria },
  ].filter((s) => s.val > 0);
  if (!segs.length) return null;
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1.5">Composição do faturamento — de onde vem o dinheiro da label</div>
      <div className="flex h-5 w-full rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800">
        {segs.map((s) => (
          <div key={s.key} style={{ width: `${s.pct}%`, background: s.cor }} className="h-full" title={`${s.label}: ${money(s.val)} (${Math.round(s.pct)}%)`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {segs.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.cor }} />
            <span className="text-gray-500">{s.label}</span>
            <span className="font-medium text-gray-800 dark:text-gray-200 tabular-nums">{money(s.val)}</span>
            <span className="text-gray-400 tabular-nums">{Math.round(s.pct)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
