'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell } from 'recharts';
import { CalendarDays, TrendingUp, TrendingDown, Minus, Sparkles, AlertTriangle, Star, Users, Lightbulb } from 'lucide-react';
import { NpsRetornoCard, NpsLotacaoCard, NpsTemasCard } from '@/components/nps/NpsCasa';

const money = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const num = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');
const pct = (v: number | null) => v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`;
const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// piso de amostra: abaixo disso o selo não decide (evita renovar/cortar em cima de ruído)
const SELO_MIN_SHOWS = 4;   // shows mínimos pra emitir uma decisão
const NPS_MIN_RESP = 5;     // respostas mínimas pra o NPS pesar no selo
// recência: "em ascensão"/encaixe/estreia têm que ser sobre quem ANDA tocando
const DIAS_ATIVO = 75;      // além disso não é "em ascensão" nem entra em encaixe
const DIAS_INATIVO = 120;   // além disso o selo vira "Inativo" (manter/renovar não faz sentido)
const DIAS_ESTREIA = 90;    // estreia = primeiro show dentro dessa janela (artista novo de fato)
const GRAY = 'text-gray-500 bg-gray-100 dark:text-gray-400 dark:bg-gray-800';

// selo de decisão por artista (combina tendência + retorno + NPS + momentum de público)
// só emite quando há amostra suficiente E o artista anda tocando; senão sinaliza o motivo.
function seloArtista(a: any, momPubUp: boolean | null): { txt: string; cls: string; insuf?: boolean; motivo?: string } {
  if ((a.dias_sem_tocar ?? 0) > DIAS_INATIVO) {
    return { txt: 'Inativo', insuf: true, motivo: `sem tocar há ${a.dias_sem_tocar} dias`, cls: GRAY };
  }
  if ((a.shows || 0) < SELO_MIN_SHOWS) {
    return { txt: 'Poucos dados', insuf: true, motivo: `${a.shows} show${a.shows === 1 ? '' : 's'} — mín. ${SELO_MIN_SHOWS} p/ avaliar`, cls: GRAY };
  }
  let pts = 0, sinais = 0;
  if (a.tendencia === 'subindo') { pts += 1; sinais++; } else if (a.tendencia === 'caindo') { pts -= 1; sinais++; }
  if (a.retorno != null) { sinais++; if (a.retorno >= 2) pts += 1; else if (a.retorno < 1) pts -= 1; }
  if (a.nps_score != null && (a.nps_respostas || 0) >= NPS_MIN_RESP) { sinais++; if (a.nps_score >= 40) pts += 1; else if (a.nps_score < 15) pts -= 1; }
  if (momPubUp === true) { pts += 1; sinais++; } else if (momPubUp === false) { pts -= 1; sinais++; }
  if (sinais < 2) return { txt: 'Poucos dados', insuf: true, motivo: 'sinais insuficientes (sem tendência/retorno/NPS confiável)', cls: GRAY };
  if (pts >= 2) return { txt: 'Manter', cls: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/25' };
  if (pts <= -2) return { txt: 'Renovar', cls: 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-900/25' };
  return { txt: 'Observar', cls: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/25' };
}

export default function InsightsTab({ barId, periodo }: { barId?: number; periodo: number }) {
  const [rank, setRank] = useState<any[] | null>(null);
  const [dias, setDias] = useState<any[] | null>(null);
  const ateStr = new Date().toISOString().slice(0, 10);
  const deStr = (() => { const d = new Date(); d.setMonth(d.getMonth() - periodo); return d.toISOString().slice(0, 10); })();

  useEffect(() => {
    if (!barId) return;
    setRank(null); setDias(null);
    fetch(`/api/analitico/atracoes?periodo=${periodo}&bar_id=${barId}`, { cache: 'no-store' })
      .then(r => r.json()).then(j => setRank(j.data || [])).catch(() => setRank([]));
    fetch(`/api/analitico/atracoes?view=insights-dias&periodo=${periodo}&bar_id=${barId}`, { cache: 'no-store' })
      .then(r => r.json()).then(j => setDias(j.dias || [])).catch(() => setDias([]));
  }, [barId, periodo]);

  // momentum por artista (últimos 3 shows × 3 anteriores) + cadência (shows/mês) + selo
  const artistas = useMemo(() => {
    if (!rank) return [];
    return rank.map((a: any) => {
      const evs: any[] = a.eventos || []; // ascendente
      const rec = evs.slice(-3), prev = evs.slice(-6, -3);
      const avg = (arr: any[], k: string) => arr.length ? arr.reduce((s, x) => s + (Number(x[k]) || 0), 0) / arr.length : 0;
      const fatRec = avg(rec, 'faturamento'), fatPrev = avg(prev, 'faturamento');
      const pubRec = avg(rec, 'publico'), pubPrev = avg(prev, 'publico');
      const podeMom = rec.length >= 2 && prev.length >= 2;
      const dFat = podeMom && fatPrev > 0 ? Math.round((fatRec - fatPrev) / fatPrev * 100) : null;
      const dPub = podeMom && pubPrev > 0 ? Math.round((pubRec - pubPrev) / pubPrev * 100) : null;
      const cadencia = a.shows / Math.max(periodo, 1); // shows por mês
      const bucket = cadencia >= 3 ? 'Residente' : cadencia >= 1 ? 'Frequente' : 'Pontual';
      const ativo = (a.dias_sem_tocar ?? 999) <= DIAS_ATIVO;
      const inativo = (a.dias_sem_tocar ?? 0) > DIAS_INATIVO;
      const primeiro = evs[0]?.data ? Math.floor((Date.now() - new Date(String(evs[0].data).slice(0, 10) + 'T12:00:00Z').getTime()) / 86400000) : null;
      const selo = seloArtista(a, dPub == null ? null : dPub >= 0);
      return { ...a, fatRec, pubRec, dFat, dPub, cadencia, bucket, ativo, inativo, estreouDias: primeiro, selo };
    });
  }, [rank, periodo]);

  // leituras automáticas
  const leituras = useMemo(() => {
    if (!artistas.length || !dias) return null;
    const comShows = [...artistas].filter(a => a.shows >= 2);
    const fatTotalCasa = comShows.reduce((s, a) => s + (a.fat_total || 0), 0);
    const porFat = [...comShows].sort((a, b) => b.fat_total - a.fat_total);
    const top3Share = fatTotalCasa > 0 ? Math.round(porFat.slice(0, 3).reduce((s, a) => s + a.fat_total, 0) / fatTotalCasa * 100) : 0;
    // artistas que somam 80% do faturamento
    let acc = 0, n80 = 0; for (const a of porFat) { acc += a.fat_total; n80++; if (acc >= fatTotalCasa * 0.8) break; }
    const subindo = artistas.filter(a => a.ativo && a.dFat != null && a.dFat >= 15).sort((a, b) => (b.dFat || 0) - (a.dFat || 0));
    const caindo = artistas.filter(a => a.ativo && a.dFat != null && a.dFat <= -15).sort((a, b) => (a.dFat || 0) - (b.dFat || 0));
    const diaForte = [...dias].sort((a, b) => b.fat_medio - a.fat_medio)[0];
    const diaFraco = [...dias].filter(d => d.n >= 3).sort((a, b) => a.fat_medio - b.fat_medio)[0];
    const diaEsquenta = [...dias].filter(d => d.delta_fat_pct != null).sort((a, b) => (b.delta_fat_pct || 0) - (a.delta_fat_pct || 0))[0];
    const diaEsfria = [...dias].filter(d => d.delta_fat_pct != null).sort((a, b) => (a.delta_fat_pct || 0) - (b.delta_fat_pct || 0))[0];
    return { top3Share, n80, subindo, caindo, diaForte, diaFraco, diaEsquenta, diaEsfria, top3: porFat.slice(0, 3) };
  }, [artistas, dias]);

  // estreias: quem ESTREOU de fato (1º show recente), comparado à média da casa
  const estreias = useMemo(() => {
    if (!artistas.length) return [];
    const comShows = artistas.filter(a => a.shows >= 2);
    const fatMedioCasa = comShows.length ? comShows.reduce((s, a) => s + a.fat_medio, 0) / comShows.length : 0;
    return artistas.filter(a => a.estreouDias != null && a.estreouDias <= DIAS_ESTREIA)
      .map(a => ({ ...a, vsCasa: fatMedioCasa > 0 ? Math.round((a.fat_medio - fatMedioCasa) / fatMedioCasa * 100) : null }))
      .sort((a, b) => (a.estreouDias ?? 999) - (b.estreouDias ?? 999)).slice(0, 6);
  }, [artistas]);

  // encaixe artista × dia: melhor artista por dia da semana (min 2 shows no dia)
  const encaixe = useMemo(() => {
    const porDia = new Map<number, Map<string, { nome: string; fat: number[]; id: number | null }>>();
    for (const a of artistas) {
      if (!a.ativo) continue; // só quem anda tocando entra no "melhor encaixe" (serve pra escalar a grade)
      for (const e of (a.eventos || [])) {
        const dow = new Date(String(e.data).slice(0, 10) + 'T12:00:00Z').getUTCDay();
        const m = porDia.get(dow) || new Map(); porDia.set(dow, m);
        const k = a.artista_id ? `id:${a.artista_id}` : `n:${a.nome}`;
        const cur = m.get(k) || { nome: a.nome, fat: [], id: a.artista_id }; cur.fat.push(Number(e.faturamento) || 0); m.set(k, cur);
      }
    }
    const res: Array<{ dow: number; dia: string; nome: string; fat: number; n: number }> = [];
    for (const [dow, m] of porDia) {
      let best: { nome: string; fat: number; n: number } | null = null;
      for (const v of m.values()) { if (v.fat.length < 2) continue; const avg = v.fat.reduce((s, x) => s + x, 0) / v.fat.length; if (!best || avg > best.fat) best = { nome: v.nome, fat: avg, n: v.fat.length }; }
      if (best) res.push({ dow, dia: DIAS_CURTO[dow], ...best });
    }
    return res.sort((a, b) => (a.dow === 0 ? 7 : a.dow) - (b.dow === 0 ? 7 : b.dow));
  }, [artistas]);

  if (!barId) return <div className="py-16 text-center text-gray-500">Selecione um bar.</div>;
  if (rank === null || dias === null) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>;

  return (
    <div className="space-y-4">
      {/* Leituras automáticas */}
      {leituras && (
        <Card className="border-violet-100 dark:border-violet-900/40">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4 text-violet-500" />Leitura rápida</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {leituras.diaEsquenta?.delta_fat_pct != null && leituras.diaEsquenta.delta_fat_pct > 5 && <div>🔥 <b>{leituras.diaEsquenta.dia}</b> vem esquentando ({pct(leituras.diaEsquenta.delta_fat_pct)} vs a média do dia).</div>}
            {leituras.diaEsfria?.delta_fat_pct != null && leituras.diaEsfria.delta_fat_pct < -5 && <div>🧊 <b>{leituras.diaEsfria.dia}</b> esfriando ({pct(leituras.diaEsfria.delta_fat_pct)}) — atenção à grade.</div>}
            {leituras.diaForte && <div>💪 Dia mais forte: <b>{leituras.diaForte.dia}</b> ({money(leituras.diaForte.fat_medio)}/noite).</div>}
            {leituras.diaFraco && <div>🌱 Oportunidade: <b>{leituras.diaFraco.dia}</b> é o mais fraco ({money(leituras.diaFraco.fat_medio)}).</div>}
            {leituras.subindo[0] && <div>📈 Em ascensão: <b>{leituras.subindo.slice(0, 3).map((a: any) => a.nome).join(', ')}</b>.</div>}
            {leituras.caindo[0] && <div>📉 Em queda: <b>{leituras.caindo.slice(0, 3).map((a: any) => a.nome).join(', ')}</b> — avaliar renovação.</div>}
            <div>🎯 Concentração: os <b>3 maiores</b> valem <b>{leituras.top3Share}%</b> do faturamento artístico ({leituras.n80} artistas fazem 80%).</div>
            {estreias[0]?.vsCasa != null && estreias[0].vsCasa > 0 && <div>✨ Estreia de destaque: <b>{estreias[0].nome}</b> ({pct(estreias[0].vsCasa)} vs a média da casa).</div>}
          </CardContent>
        </Card>
      )}

      {/* Dia da semana */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4 text-sky-500" />Como vem cada dia da semana</CardTitle>
          <CardDescription>faturamento e público médio por dia · a seta compara os últimos 4 daquele dia com a média do período</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] text-gray-400 mb-1">Faturamento médio por dia</div>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={dias} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).slice(0, 3)} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={34} />
                    <RTooltip formatter={((v: number) => money(Number(v))) as any} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="fat_medio" radius={[4, 4, 0, 0]}>{dias.map((_, i) => <Cell key={i} fill="#8b5cf6" />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <div className="text-[11px] text-gray-400 mb-1">Público médio por dia</div>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={dias} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).slice(0, 3)} />
                    <YAxis tick={{ fontSize: 10 }} width={30} />
                    <RTooltip formatter={((v: number) => [num(Number(v)), 'público']) as any} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="publico_medio" radius={[4, 4, 0, 0]}>{dias.map((_, i) => <Cell key={i} fill="#3b82f6" />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {dias.map((d: any) => (
              <div key={d.dow} className="rounded-lg border border-gray-200 dark:border-gray-800 p-2 text-center">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-200">{d.dia}</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">{money(d.fat_medio)}</div>
                <div className={`text-[11px] font-medium inline-flex items-center gap-0.5 ${d.delta_fat_pct == null ? 'text-gray-400' : d.delta_fat_pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {d.delta_fat_pct != null && (d.delta_fat_pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}{pct(d.delta_fat_pct)}
                </div>
                <div className="text-[10px] text-gray-400">{num(d.publico_medio)} pes. · {d.n}x</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Momentum dos artistas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-500" />Momentum dos artistas</CardTitle>
          <CardDescription>últimos 3 shows × os 3 anteriores · cadência = shows/mês · selo combina tendência, retorno e NPS</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
              <th className="text-left px-3 py-2">Artista</th>
              <th className="text-left px-3 py-2">Cadência</th>
              <th className="text-right px-3 py-2">Shows</th>
              <th className="text-right px-3 py-2" title="Faturamento: últimos 3 shows × 3 anteriores">Fat. recente</th>
              <th className="text-right px-3 py-2" title="Público: últimos 3 shows × 3 anteriores">Público</th>
              <th className="text-right px-3 py-2">NPS</th>
              <th className="text-center px-3 py-2">Selo</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {artistas.filter((a: any) => a.shows >= 2).sort((a: any, b: any) => (b.ativo ? 1 : 0) - (a.ativo ? 1 : 0) || (b.dFat ?? -999) - (a.dFat ?? -999)).map((a: any) => (
                <tr key={a.artista_id ?? a.nome} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100 whitespace-nowrap">
                    {a.artista_id ? <Link href={`/analitico/atracoes?artista=${a.artista_id}`} className="hover:text-violet-600 hover:underline">{a.nome}</Link> : a.nome}
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                    <span className="text-[11px]">{a.bucket}</span> <span className="text-[10px] text-gray-400">{a.cadencia.toFixed(1).replace('.', ',')}/mês</span>
                    {!a.ativo && <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400" title={`último show há ${a.dias_sem_tocar} dias`}>· inativo {a.dias_sem_tocar}d</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.shows}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <div>{money(a.fatRec)}</div>
                    {a.dFat == null ? <div className="text-[11px] text-gray-400" title="sem base (precisa de ~5+ shows p/ comparar 3×3)">sem base</div>
                      : <div className={`text-[11px] ${a.dFat >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{pct(a.dFat)}</div>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <div>{num(a.pubRec)}</div>
                    {a.dPub == null ? <div className="text-[11px] text-gray-400">sem base</div>
                      : <div className={`text-[11px] ${a.dPub >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{pct(a.dPub)}</div>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {a.nps_score == null ? <span className="text-gray-400">—</span>
                      : <span className={(a.nps_respostas || 0) < NPS_MIN_RESP ? 'text-gray-400' : 'text-gray-600 dark:text-gray-300'} title={`${a.nps_respostas || 0} resposta${a.nps_respostas === 1 ? '' : 's'}${(a.nps_respostas || 0) < NPS_MIN_RESP ? ' — amostra baixa, não pesa no selo' : ''}`}>{a.nps_score > 0 ? '+' : ''}{a.nps_score}<span className="text-[10px] text-gray-400"> ·{a.nps_respostas || 0}</span></span>}
                  </td>
                  <td className="px-3 py-2 text-center"><span title={a.selo.motivo || ''} className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${a.selo.cls}`}>{a.selo.txt}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-[11px] text-gray-400 border-t border-gray-100 dark:border-gray-800">
            O selo só decide com <b>≥ {SELO_MIN_SHOWS} shows</b> e pelo menos 2 sinais confiáveis; o NPS só pesa com <b>≥ {NPS_MIN_RESP} respostas</b>. Abaixo disso mostra <b>Poucos dados</b> — de propósito, pra ninguém renovar/cortar em cima de ruído.
          </p>
        </CardContent>
      </Card>

      {/* Estreias + Encaixe */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-pink-500" />Estreias & novos</CardTitle><CardDescription>quem estreou nos últimos {DIAS_ESTREIA} dias — e como foi vs a média da casa</CardDescription></CardHeader>
          <CardContent className="space-y-1.5">
            {estreias.length === 0 ? <p className="text-sm text-gray-500 py-2">Sem estreias no período.</p>
              : estreias.map((a: any) => (
                <div key={a.artista_id ?? a.nome} className="flex items-center justify-between text-sm">
                  <span className="text-gray-800 dark:text-gray-200">{a.nome} <span className="text-[11px] text-gray-400">· estreou há {a.estreouDias}d · {a.shows} show{a.shows > 1 ? 's' : ''}</span></span>
                  <span className={`text-[12px] font-medium ${a.vsCasa == null ? 'text-gray-400' : a.vsCasa >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{money(a.fat_medio)} · {pct(a.vsCasa)} vs casa</span>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" />Melhor encaixe artista × dia</CardTitle><CardDescription>quem mais fatura em cada dia da semana (mín. 2 shows no dia)</CardDescription></CardHeader>
          <CardContent className="space-y-1.5">
            {encaixe.length === 0 ? <p className="text-sm text-gray-500 py-2">Sem dados suficientes.</p>
              : encaixe.map((e: any) => (
                <div key={e.dow} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 w-12">{e.dia}</span>
                  <span className="flex-1 text-gray-800 dark:text-gray-200 truncate px-2">{e.nome}</span>
                  <span className="text-[12px] tabular-nums text-gray-600 dark:text-gray-300">{money(e.fat)}<span className="text-[10px] text-gray-400"> ·{e.n}x</span></span>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      {/* NPS da casa (movido do topo da página) */}
      {leituras && (
        <div className="pt-2 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300"><Users className="h-4 w-4 text-indigo-500" />NPS do público (casa)</div>
          <NpsRetornoCard barId={barId} de={deStr} ate={ateStr} dow="" />
          <div className="grid lg:grid-cols-2 gap-3 items-start">
            <NpsLotacaoCard barId={barId} de={deStr} ate={ateStr} dow="" />
            <NpsTemasCard barId={barId} de={deStr} ate={ateStr} dow="" />
          </div>
        </div>
      )}
    </div>
  );
}
