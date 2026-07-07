'use client';

// Componentes de NPS (Falae · Data da Visita) — INTERNOS (visão da casa), usados em
// Ferramentas → Artistas. Na tela do artista (/analitico/atracoes) usa-se só o NpsArtistaBadge
// (selo positivo), porque aquela tela é feita pra MOSTRAR pro artista.
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Smile, MessageSquare, Users, X } from 'lucide-react';

const fmtData = (s?: string) => { if (!s) return '—'; const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
export const npsScoreCor = (s: number) => s >= 50 ? 'text-emerald-600 dark:text-emerald-400' : s >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
const npsDimCor = (nota: number) => nota >= 4.2 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : nota >= 3.5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
const npsCat = (c: string) => c === 'promotor' ? { emoji: '😍', cor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' }
  : c === 'neutro' ? { emoji: '😐', cor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' }
  : { emoji: '😕', cor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' };

type FiltroBase = { barId?: number; de: string; ate: string; dow: string };

// #3 — NPS × lotação: a nota cai quando a casa enche? (tercis de público da noite)
export function NpsLotacaoCard({ barId, de, ate, dow }: FiltroBase) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    if (!barId) return;
    const qs = new URLSearchParams({ view: 'nps-lotacao', bar_id: String(barId) });
    if (de) qs.set('de', de); if (ate) qs.set('ate', ate); if (dow !== '') qs.set('dow', dow);
    fetch(`/api/analitico/atracoes?${qs.toString()}`, { cache: 'no-store' }).then(r => r.json()).then(setD).catch(() => setD(null));
  }, [barId, de, ate, dow]);
  if (!d || !d.faixas || d.faixas.length < 3) return null;
  const f = d.faixas;
  const caiu = f[0].nps_score - f[f.length - 1].nps_score;
  return (
    <Card className="border-amber-100 dark:border-amber-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-amber-500" />NPS × lotação</CardTitle>
        <CardDescription>a nota muda quando a casa enche? (público da noite){caiu >= 4 ? ` · mais cheio derruba ~${caiu} pts de NPS` : ''}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-3 text-center">
        {f.map((x: any) => (
          <div key={x.faixa}>
            <div className={`text-2xl font-bold leading-none ${npsScoreCor(x.nps_score)}`}>{x.nps_score > 0 ? '+' : ''}{x.nps_score}</div>
            <div className="text-xs font-medium text-gray-700 dark:text-gray-200 mt-1">{x.faixa}</div>
            <div className="text-[11px] text-gray-400">{x.pub_min}–{x.pub_max} pessoas · {x.n} resp.</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// #6 — Motivos citados nos comentários (reclamações: detratores + neutros).
export function NpsTemasCard({ barId, de, ate, dow }: FiltroBase) {
  const [d, setD] = useState<any>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  useEffect(() => {
    if (!barId) return;
    const qs = new URLSearchParams({ view: 'nps-temas', bar_id: String(barId) });
    if (de) qs.set('de', de); if (ate) qs.set('ate', ate); if (dow !== '') qs.set('dow', dow);
    fetch(`/api/analitico/atracoes?${qs.toString()}`, { cache: 'no-store' }).then(r => r.json()).then(setD).catch(() => setD(null));
  }, [barId, de, ate, dow]);
  if (!d || !d.temas?.length) return null;
  const max = d.temas[0]?.n || 1;
  return (
    <Card className="border-rose-100 dark:border-rose-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4 text-rose-500" />Motivos citados nos comentários</CardTitle>
        <CardDescription>o que mais aparece nas {d.total_reclamacoes} reclamações (detratores + neutros) — clique num tema pra ler exemplos</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {d.temas.slice(0, 8).map((t: any) => (
          <div key={t.tema}>
            <button onClick={() => setAberto(aberto === t.tema ? null : t.tema)} className="w-full flex items-center gap-3 text-sm py-0.5 hover:opacity-90">
              <span className="w-36 sm:w-44 shrink-0 text-left text-gray-800 dark:text-gray-200 truncate">{t.tema}</span>
              <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded h-3 overflow-hidden"><div className="h-full bg-rose-400 dark:bg-rose-500" style={{ width: `${Math.max(6, (t.n / max) * 100)}%` }} /></div>
              <span className="w-8 text-right tabular-nums text-gray-700 dark:text-gray-300">{t.n}</span>
              <span className="w-16 text-right text-[11px] text-gray-400">NPS {t.nps_medio.toFixed(1).replace('.', ',')}</span>
            </button>
            {aberto === t.tema && (
              <ul className="ml-1 mt-1 mb-2 space-y-1 text-[12px] text-gray-600 dark:text-gray-300 border-l-2 border-rose-200 dark:border-rose-900/50 pl-2">
                {t.exemplos.map((e: string, i: number) => <li key={i} className="italic">“{e}”</li>)}
              </ul>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// #2 — O NPS prevê retorno? Taxa de retorno ao bar por categoria.
export function NpsRetornoCard({ barId, de, ate, dow }: FiltroBase) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    if (!barId) return;
    const qs = new URLSearchParams({ view: 'nps-retorno', bar_id: String(barId) });
    if (de) qs.set('de', de); if (ate) qs.set('ate', ate); if (dow !== '') qs.set('dow', dow);
    fetch(`/api/analitico/atracoes?${qs.toString()}`, { cache: 'no-store' }).then(r => r.json()).then(setD).catch(() => setD(null));
  }, [barId, de, ate, dow]);
  if (!d || !d.total) return null;
  const Faixa = ({ label, c, cor }: { label: string; c: any; cor: string }) => (
    <div className="text-center px-1">
      <div className={`text-xl font-bold leading-none ${cor}`}>{c.pct == null ? '—' : `${c.pct}%`}</div>
      <div className="text-[11px] text-gray-400 mt-1">{label} <span className="text-gray-300 dark:text-gray-600">({c.voltaram}/{c.respostas})</span></div>
    </div>
  );
  return (
    <Card className="border-indigo-100 dark:border-indigo-900/40">
      <CardContent className="py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="h-4 w-4 text-indigo-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">O NPS prevê retorno?</div>
            <div className="text-[11px] text-gray-400">de {d.total} respostas com telefone rastreável, <b>{d.pct}%</b> voltaram ao bar depois</div>
          </div>
        </div>
        <div className="flex items-center gap-5 ml-auto">
          <Faixa label="Promotores" c={d.promotor} cor="text-emerald-600 dark:text-emerald-400" />
          <Faixa label="Neutros" c={d.neutro} cor="text-amber-600 dark:text-amber-400" />
          <Faixa label="Detratores" c={d.detrator} cor="text-rose-600 dark:text-rose-400" />
        </div>
      </CardContent>
    </Card>
  );
}

// Selo POSITIVO pra tela do artista: só o score + média + nº. Sem detratores, comentários ou dimensões.
export function NpsArtistaBadge({ barId, artistaId, de, ate, dow }: FiltroBase & { artistaId: number }) {
  const [resumo, setResumo] = useState<any>(null);
  useEffect(() => {
    if (!barId || !artistaId) return;
    const qs = new URLSearchParams({ view: 'nps', artista_id: String(artistaId), bar_id: String(barId) });
    if (de) qs.set('de', de); if (ate) qs.set('ate', ate); if (dow !== '') qs.set('dow', dow);
    fetch(`/api/analitico/atracoes?${qs.toString()}`, { cache: 'no-store' }).then(r => r.json()).then(j => setResumo(j.resumo || null)).catch(() => setResumo(null));
  }, [barId, artistaId, de, ate, dow]);
  if (!resumo) return null;
  return (
    <Card className="border-sky-100 dark:border-sky-900/40 bg-gradient-to-br from-sky-50/50 to-white dark:from-sky-950/20 dark:to-gray-900">
      <CardContent className="py-3 flex items-center gap-4">
        <Smile className="h-5 w-5 text-sky-500 shrink-0" />
        <div className="flex items-baseline gap-2">
          <div className={`text-2xl font-extrabold ${npsScoreCor(resumo.nps_score)}`}>{resumo.nps_score > 0 ? '+' : ''}{resumo.nps_score}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">NPS do público · nota média <b className="text-gray-700 dark:text-gray-200">{resumo.nps_medio.toFixed(1).replace('.', ',')}</b> em {resumo.respostas} avaliações</div>
        </div>
      </CardContent>
    </Card>
  );
}

// Detalhe COMPLETO de NPS por artista (score + dimensões + respostas) — uso INTERNO (drill-down).
export function NpsArtistaDetalhe({ barId, artistaId, nome, de, ate, dow, onClose }: FiltroBase & { artistaId: number; nome: string; onClose?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState<any>(null);
  const [respostas, setRespostas] = useState<any[]>([]);
  const [dimensoes, setDimensoes] = useState<any[]>([]);
  const [aberto, setAberto] = useState(false);
  const [filtroCat, setFiltroCat] = useState<'todos' | 'promotor' | 'neutro' | 'detrator'>('todos');

  useEffect(() => {
    if (!barId || !artistaId) return;
    setLoading(true);
    const qs = new URLSearchParams({ view: 'nps', artista_id: String(artistaId), bar_id: String(barId) });
    if (de) qs.set('de', de); if (ate) qs.set('ate', ate); if (dow !== '') qs.set('dow', dow);
    fetch(`/api/analitico/atracoes?${qs.toString()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { setResumo(j.resumo || null); setRespostas(j.respostas || []); setDimensoes(j.dimensoes || []); })
      .catch(() => { setResumo(null); setRespostas([]); setDimensoes([]); })
      .finally(() => setLoading(false));
  }, [barId, artistaId, de, ate, dow]);

  const abrir = (cat: 'todos' | 'promotor' | 'neutro' | 'detrator') => { setFiltroCat(cat); setAberto(true); };
  const respostasView = filtroCat === 'todos' ? respostas : respostas.filter(r => r.categoria === filtroCat);
  const chipCat = 'cursor-pointer transition-opacity hover:opacity-80';

  return (
    <Card className="border-sky-200 dark:border-sky-900/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2"><Smile className="h-4 w-4 text-sky-500" />NPS · {nome}</CardTitle>
          {onClose && <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>}
        </div>
        <CardDescription>satisfação de quem foi nas noites de {nome} — clique numa faixa pra ver as respostas</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-20 w-full" />
          : !resumo ? <p className="text-sm text-gray-500 py-4 text-center">Sem respostas de NPS vinculadas a {nome} neste período.</p>
          : (
            <>
            <div className="flex items-center gap-5 flex-wrap">
              <div className="text-center shrink-0">
                <div className={`text-4xl font-extrabold leading-none ${npsScoreCor(resumo.nps_score)}`}>{resumo.nps_score > 0 ? '+' : ''}{resumo.nps_score}</div>
                <div className="text-[11px] text-gray-400 mt-1">score NPS</div>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <div>NPS médio <b>{resumo.nps_medio.toFixed(1).replace('.', ',')}</b> · <b>{resumo.respostas}</b> resposta{resumo.respostas === 1 ? '' : 's'}</div>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => abrir('promotor')} title="Ver respostas dos promotores" className={`inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 text-xs ${chipCat}`}>😍 {resumo.promotores} promot.</button>
                  <button onClick={() => abrir('neutro')} title="Ver respostas dos neutros" className={`inline-flex items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 text-xs ${chipCat}`}>😐 {resumo.neutros} neutro</button>
                  <button onClick={() => abrir('detrator')} title="Ver respostas dos detratores" className={`inline-flex items-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 px-2 py-0.5 text-xs ${chipCat}`}>😕 {resumo.detratores} detrat.</button>
                </div>
              </div>
              <button onClick={() => abrir('todos')} className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300 px-3 h-9 text-sm hover:bg-sky-50 dark:hover:bg-sky-900/20 shrink-0">
                <MessageSquare className="h-4 w-4" />Ver respostas
              </button>
            </div>
            {dimensoes.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="text-[11px] text-gray-400 mb-1.5">Notas por dimensão (1–5) — o mais baixo é o gargalo</div>
                <div className="flex flex-wrap gap-1.5">
                  {dimensoes.map((d: any) => (
                    <span key={d.dimensao} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${npsDimCor(d.nota_media)}`} title={`${d.n} avaliações`}>
                      {d.dimensao} <b className="ml-1">{d.nota_media.toFixed(1).replace('.', ',')}</b>
                    </span>
                  ))}
                </div>
              </div>
            )}
            </>
          )}
      </CardContent>

      {aberto && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-start justify-center p-4 overflow-auto" onClick={() => setAberto(false)}>
          <div className="mt-6 w-full max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="font-semibold text-gray-900 dark:text-white">Respostas de NPS · {nome}</div>
              <button onClick={() => setAberto(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-gray-100 dark:border-gray-800">
              {([
                { k: 'todos', l: `Todos (${resumo?.respostas ?? 0})` },
                { k: 'promotor', l: `😍 Promotores (${resumo?.promotores ?? 0})` },
                { k: 'neutro', l: `😐 Neutros (${resumo?.neutros ?? 0})` },
                { k: 'detrator', l: `😕 Detratores (${resumo?.detratores ?? 0})` },
              ] as const).map(f => (
                <button key={f.k} onClick={() => setFiltroCat(f.k)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${filtroCat === f.k ? 'bg-sky-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                  {f.l}
                </button>
              ))}
            </div>
            <div className="max-h-[65vh] overflow-auto divide-y divide-gray-100 dark:divide-gray-800">
              {respostasView.length === 0 ? <p className="text-sm text-gray-500 py-8 text-center">Nenhuma resposta nesta faixa.</p>
                : respostasView.map((r, i) => {
                  const cat = npsCat(r.categoria);
                  return (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cat.cor}`}>{cat.emoji} {r.nps}</span>
                        <span className="text-xs text-gray-500">{fmtData(r.data_visita)}</span>
                        {r.evento_nome && <span className="text-xs text-gray-400">· {r.evento_nome}</span>}
                      </div>
                      {r.comentario && <p className="text-sm text-gray-700 dark:text-gray-300 mt-1.5 italic">“{r.comentario}”</p>}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
