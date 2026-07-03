'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api-client';
import { corDoBar } from '@/lib/bar-theme';
import { BarLogo } from '@/components/BarLogo';
import {
  Megaphone, Pin, Trash2, Send, Users, Music2, CalendarDays, Loader2,
  Trophy, AlertTriangle, CheckCircle2, Eye, Activity,
  Smile, Star, Timer, Heart, Repeat, CalendarX2, PackageX,
} from 'lucide-react';
import type { DestaquesHome, IndicadorCalculado } from '@/lib/home/indicadores';

// Ícone (string em indicadores.ts) -> componente lucide.
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Smile, Star, Timer, Heart, Repeat, CalendarX2, PackageX,
};

interface Aviso {
  id: number;
  bar_id: number | null;
  autor_nome: string | null;
  mensagem: string;
  fixado: boolean;
  criado_em: string;
}
interface HomeData {
  mural: Aviso[];
  destaques: DestaquesHome;
  clientes_ano: number;
  ano: number;
  atracao: { titulo: string; artista: string | null; data: string; dia_semana: string | null; eh_hoje: boolean } | null;
}

// Cor do valor por status do indicador (Orgulho = verde/teal; Atenção = âmbar/rosa).
const STATUS_COR: Record<IndicadorCalculado['status'], string> = {
  otimo: 'text-emerald-600 dark:text-emerald-400',
  bom: 'text-teal-600 dark:text-teal-400',
  neutro: 'text-neutral-600 dark:text-neutral-300',
  atencao: 'text-amber-600 dark:text-amber-400',
  critico: 'text-rose-600 dark:text-rose-400',
};

function LinhaIndicador({ i }: { i: IndicadorCalculado }) {
  const Icone = ICON_MAP[i.icone] ?? Activity;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icone className={`h-4 w-4 flex-none ${STATUS_COR[i.status]}`} />
        <div className="min-w-0">
          <div className="truncate text-sm text-neutral-600 dark:text-neutral-300">{i.label}</div>
          {i.detalhe && <div className="text-[11px] text-neutral-400">{i.detalhe}</div>}
        </div>
      </div>
      <div className={`text-2xl font-extrabold tabular-nums ${STATUS_COR[i.status]}`}>{i.valorTexto}</div>
    </div>
  );
}

function saudacao(h: number) {
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d} dias`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
const iniciais = (n?: string | null) =>
  (n || '?').trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() || '').join('') || '?';
const nf = new Intl.NumberFormat('pt-BR');

export default function HomePage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const { user } = useUser();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<Date | null>(null);
  const [rascunho, setRascunho] = useState('');
  const [enviando, setEnviando] = useState(false);

  const podeMural = user?.role === 'admin' || (user?.role as string) === 'manager';

  useEffect(() => { setPageTitle('Início'); }, [setPageTitle]);
  useEffect(() => {
    const t = () => setNow(new Date());
    t(); const id = setInterval(t, 30_000); return () => clearInterval(id);
  }, []);

  const carregar = useCallback(async () => {
    try {
      const r = await api.get('/api/home');
      setData(r as HomeData);
    } catch { /* silencioso — a home nunca deve travar */ }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar, selectedBar?.id]);

  const postar = async () => {
    const msg = rascunho.trim();
    if (!msg || enviando) return;
    setEnviando(true);
    try {
      const r = await api.post('/api/home/mural', { mensagem: msg }) as { aviso: Aviso };
      setData(d => d ? { ...d, mural: [r.aviso, ...d.mural] } : d);
      setRascunho('');
    } catch { /* noop */ }
    finally { setEnviando(false); }
  };
  const remover = async (id: number) => {
    setData(d => d ? { ...d, mural: d.mural.filter(a => a.id !== id) } : d);
    try { await api.delete(`/api/home/mural?id=${id}`); } catch { carregar(); }
  };

  const hora = now ?? new Date();
  const nomeCurto = (user?.nome || '').split(' ')[0] || '';
  const accent = corDoBar(selectedBar?.id);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10">

        {/* Banner do bar: identidade (logo + nome) + saudação + relógio */}
        <header
          className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 sm:p-6 text-white shadow-sm"
          style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)` }}
        >
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-white/95 p-2 shadow-sm">
              <BarLogo id={selectedBar?.id ?? 0} nome={selectedBar?.nome ?? 'Zykor'} logo={selectedBar?.logo_url} size={40} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl sm:text-2xl font-extrabold tracking-tight">
                {saudacao(hora.getHours())}{nomeCurto ? `, ${nomeCurto}` : ''} 👋
              </h1>
              <p className="mt-0.5 truncate text-sm text-white/85">
                Você está no <span className="font-semibold">{selectedBar?.nome || 'Zykor'}</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums">
              {hora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-xs capitalize text-white/80">
              {hora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* MURAL — coluna principal */}
          <section className="lg:col-span-2 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Megaphone className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">Mural da casa</h2>
            </div>

            {podeMural && (
              <div className="mb-5">
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-3 focus-within:border-teal-400 dark:focus-within:border-teal-500 transition-colors">
                  <textarea
                    value={rascunho}
                    onChange={e => setRascunho(e.target.value.slice(0, 500))}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postar(); }}
                    placeholder="Deixe um recado pra equipe…"
                    rows={2}
                    className="w-full resize-none bg-transparent text-sm text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 outline-none"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-neutral-400">{rascunho.length}/500 · ⌘+Enter envia</span>
                    <button
                      onClick={postar}
                      disabled={!rascunho.trim() || enviando}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Publicar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[0, 1].map(i => <div key={i} className="h-16 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse" />)}
              </div>
            ) : !data?.mural.length ? (
              <div className="py-10 text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <Megaphone className="w-6 h-6 text-neutral-400" />
                </div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Nenhum recado por aqui ainda.{podeMural ? ' Que tal deixar o primeiro? ✨' : ''}
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {data.mural.map(a => (
                  <li key={a.id} className="group flex gap-3 rounded-xl border border-neutral-100 dark:border-neutral-800 p-3">
                    <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-neutral-900 dark:bg-neutral-100 text-[11px] font-bold text-white dark:text-neutral-900">
                      {iniciais(a.autor_nome)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-neutral-800 dark:text-neutral-100 whitespace-pre-wrap break-words">{a.mensagem}</p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-400">
                        {a.fixado && <Pin className="w-3 h-3 text-teal-500" />}
                        <span className="font-medium text-neutral-500 dark:text-neutral-400">{a.autor_nome || '—'}</span>
                        <span>·</span>
                        <span>{tempoRelativo(a.criado_em)}</span>
                        {a.bar_id === null && <span className="rounded bg-violet-100 dark:bg-violet-900/40 px-1.5 text-violet-600 dark:text-violet-300">todos os bares</span>}
                      </div>
                    </div>
                    {(user?.role === 'admin' || podeMural) && (
                      <button
                        onClick={() => remover(a.id)}
                        className="flex-none self-start rounded-md p-1 text-neutral-300 opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-all"
                        title="Remover recado"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* COLUNA LATERAL: Atração do dia + Orgulho */}
          <div className="space-y-6">
            {/* Atração */}
            <section className="rounded-2xl border border-orange-300/40 bg-gradient-to-br from-orange-500 to-orange-700 p-5 text-white">
              <div className="flex items-center gap-2 mb-3 text-orange-50">
                <Music2 className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {data?.atracao?.eh_hoje ? 'Atração de hoje' : 'Próxima atração'}
                </span>
              </div>
              {loading ? (
                <div className="h-12 rounded-lg bg-white/15 animate-pulse" />
              ) : data?.atracao ? (
                <>
                  <p className="text-lg font-bold leading-snug">{data.atracao.titulo}</p>
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-orange-50">
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span className="capitalize">
                      {data.atracao.eh_hoje ? 'Hoje' : new Date(data.atracao.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-orange-50">Nenhum evento programado.</p>
              )}
            </section>

            {/* Orgulho da casa — só indicadores genuinamente bons (com amostra) */}
            <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-emerald-500" />
                <h2 className="text-base font-bold text-neutral-900 dark:text-white">Orgulho da casa</h2>
              </div>
              {loading ? (
                <div className="space-y-4">
                  {[0, 1].map(i => <div key={i} className="h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />)}
                </div>
              ) : data?.destaques.orgulho.length ? (
                <div className="space-y-4">
                  {data.destaques.orgulho.map((i, idx) => (
                    <div key={i.key} className={idx > 0 ? 'border-t border-neutral-100 dark:border-neutral-800 pt-4' : ''}>
                      <LinhaIndicador i={i} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Reunindo os destaques do mês…</p>
              )}
              {/* Clientes no ano — número cumulativo, sempre visível */}
              <div className="mt-4 flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800 pt-4">
                <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                  <Users className="w-4 h-4" /> Clientes em {data?.ano ?? ''}
                </div>
                <div className="text-2xl font-extrabold tabular-nums text-neutral-900 dark:text-white">
                  {loading ? '…' : nf.format(data?.clientes_ano ?? 0)}
                </div>
              </div>
            </section>

            {/* Pontos de atenção → De olho → estado feliz (nessa ordem de prioridade) */}
            {!loading && (
              data?.destaques.atencao.length ? (
                <section className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <h2 className="text-base font-bold text-neutral-900 dark:text-white">Pontos de atenção</h2>
                  </div>
                  <div className="space-y-4">
                    {data.destaques.atencao.map((i, idx) => (
                      <div key={i.key} className={idx > 0 ? 'border-t border-amber-100 dark:border-amber-900/40 pt-4' : ''}>
                        <LinhaIndicador i={i} />
                      </div>
                    ))}
                  </div>
                </section>
              ) : data?.destaques.monitorar.length ? (
                <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="w-5 h-5 text-neutral-500" />
                    <h2 className="text-base font-bold text-neutral-900 dark:text-white">De olho</h2>
                  </div>
                  <p className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">Nada crítico, mas dá pra melhorar.</p>
                  <div className="space-y-4">
                    {data.destaques.monitorar.map((i, idx) => (
                      <div key={i.key} className={idx > 0 ? 'border-t border-neutral-100 dark:border-neutral-800 pt-4' : ''}>
                        <LinhaIndicador i={i} />
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <section className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 flex-none text-emerald-500" />
                    <div>
                      <h2 className="text-sm font-bold text-neutral-900 dark:text-white">Tá voando esse mês 🎉</h2>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Todos os indicadores no verde.</p>
                    </div>
                  </div>
                </section>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
