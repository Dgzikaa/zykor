'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useBar } from '@/contexts/BarContext';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Music, Users, DollarSign, Calendar, Award, TrendingUp, TrendingDown, Star, Trophy, Ticket, Tag, ArrowUpRight, ArrowDownRight, Sparkles, Handshake } from 'lucide-react';

// ---- formatação ----
const money = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const moneyC = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');
// parse YYYY-MM-DD sem new Date() (evita shift de fuso UTC-3)
const fmtData = (s?: string) => { if (!s) return '—'; const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
const fmtMesAno = (s?: string) => { if (!s) return '—'; const [y, m] = s.slice(0, 10).split('-'); const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']; return `${meses[Number(m) - 1]}/${y}`; };
const haQuanto = (s?: string) => {
  if (!s) return '';
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  const then = Date.UTC(y, m - 1, d); const now = Date.now();
  const dias = Math.floor((now - then) / 86400000);
  if (dias < 45) return `há ${dias} dias`;
  const meses = Math.round(dias / 30.4);
  if (meses < 24) return `há ${meses} meses`;
  return `há ${(dias / 365).toFixed(1).replace('.', ',')} anos`;
};

interface ArtistaLista { artista_id: number; nome: string; tipo: string; shows: number; primeiro: string; ultimo: string }
interface Marco { data: string; cache?: number; publico?: number; fat?: number; dow?: string; valor?: number }
interface Trajetoria {
  total_shows: number; primeiro: Marco; atual: Marco;
  melhor_cache: Marco; pior_cache: Marco; publico_recorde: Marco; fat_recorde: Marco;
  cache_total: number; cache_medio: number; publico_medio: number; fat_medio: number; ticket_medio: number;
  cobertura_cache: number; dia_favorito: string;
  parceiros: { nome: string; juntos: number }[];
  evolucao: { data: string; dow: string; cache: number; publico: number; fat: number; co: boolean }[];
}

export default function AtracoesPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;

  const [aba, setAba] = useState<'artista' | 'ranking'>('artista');
  const [lista, setLista] = useState<ArtistaLista[]>([]);
  const [artistaId, setArtistaId] = useState<string>('');
  const [traj, setTraj] = useState<Trajetoria | null>(null);
  const [loadingLista, setLoadingLista] = useState(true);
  const [loadingTraj, setLoadingTraj] = useState(false);
  const [ranking, setRanking] = useState<any[] | null>(null);

  const artistaSel = useMemo(() => lista.find(a => String(a.artista_id) === artistaId), [lista, artistaId]);

  const carregarLista = useCallback(async () => {
    if (!barId) return;
    setLoadingLista(true);
    try {
      const r = await fetch(`/api/analitico/atracoes?view=lista&bar_id=${barId}`, { cache: 'no-store' });
      const j = await r.json();
      const l: ArtistaLista[] = j.lista || [];
      setLista(l);
      setArtistaId(prev => (prev && l.some(a => String(a.artista_id) === prev) ? prev : (l[0] ? String(l[0].artista_id) : '')));
    } catch { setLista([]); }
    finally { setLoadingLista(false); }
  }, [barId]);

  const carregarTraj = useCallback(async (id: string) => {
    if (!barId || !id) { setTraj(null); return; }
    setLoadingTraj(true);
    try {
      const r = await fetch(`/api/analitico/atracoes?artista_id=${id}&bar_id=${barId}`, { cache: 'no-store' });
      const j = await r.json();
      setTraj(j.artista || null);
    } catch { setTraj(null); }
    finally { setLoadingTraj(false); }
  }, [barId]);

  const carregarRanking = useCallback(async () => {
    if (!barId) return;
    try {
      const r = await fetch(`/api/analitico/atracoes?periodo=12&bar_id=${barId}`, { cache: 'no-store' });
      const j = await r.json();
      setRanking(j.data || []);
    } catch { setRanking([]); }
  }, [barId]);

  useEffect(() => { carregarLista(); }, [carregarLista]);
  useEffect(() => { if (artistaId) carregarTraj(artistaId); }, [artistaId, carregarTraj]);
  useEffect(() => { if (aba === 'ranking' && ranking === null) carregarRanking(); }, [aba, ranking, carregarRanking]);

  const evol = traj?.evolucao || [];
  const evolChart = evol.map(e => ({ ...e, label: fmtMesAno(e.data) }));
  const crescPublico = traj && traj.primeiro?.publico ? Math.round(((traj.atual.publico! - traj.primeiro.publico!) / traj.primeiro.publico!) * 100) : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-3 py-4 max-w-6xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Music className="h-6 w-6 text-violet-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Artístico</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">A trajetória de cada artista com a casa.</p>
            </div>
          </div>
          <Link href="/analitico/atracoes/tagging" className="text-sm inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 px-3 h-9 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
            <Tag className="h-4 w-4" />Taggear eventos
          </Link>
        </div>

        {/* Abas */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
          {([['artista', 'Por artista'], ['ranking', 'Ranking']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setAba(k)}
              className={`px-3 py-2 text-sm border-b-2 -mb-px transition ${aba === k ? 'border-violet-500 text-violet-700 dark:text-violet-300 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              {label}
            </button>
          ))}
        </div>

        {aba === 'ranking' ? (
          <RankingView ranking={ranking} onPick={(id) => { setArtistaId(String(id)); setAba('artista'); }} />
        ) : (
          <>
            {/* Dropdown de artista */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-500">Artista:</span>
              {loadingLista ? <Skeleton className="h-10 w-72" /> : (
                <Select value={artistaId} onValueChange={setArtistaId}>
                  <SelectTrigger className="w-full sm:w-80 h-10"><SelectValue placeholder="Selecione um artista" /></SelectTrigger>
                  <SelectContent className="max-h-80">
                    {lista.map(a => (
                      <SelectItem key={a.artista_id} value={String(a.artista_id)}>
                        {a.nome} <span className="text-gray-400">· {a.shows} shows</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {artistaSel && <Badge variant="outline" className="capitalize">{artistaSel.tipo}</Badge>}
            </div>

            {!barId ? <p className="text-sm text-gray-500 py-10 text-center">Selecione um bar.</p>
              : loadingLista ? null
              : lista.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-gray-500">
                  Nenhum artista taggeado ainda neste bar. Use <Link href="/analitico/atracoes/tagging" className="text-violet-600 underline">Taggear eventos</Link> para associar artistas às noites.
                </CardContent></Card>
              ) : loadingTraj || !traj ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
              ) : (
                <TrajetoriaView traj={traj} nome={artistaSel?.nome || ''} tipo={artistaSel?.tipo || ''} evolChart={evolChart} crescPublico={crescPublico} barNome={selectedBar?.nome || 'a casa'} />
              )}
          </>
        )}
      </div>
    </div>
  );
}

// ---- Trajetória ----
function TrajetoriaView({ traj, nome, tipo, evolChart, crescPublico, barNome }: { traj: Trajetoria; nome: string; tipo: string; evolChart: any[]; crescPublico: number | null; barNome: string }) {
  const tiles = [
    { icon: Calendar, cor: 'text-sky-500', label: '1º show', valor: fmtData(traj.primeiro?.data), sub: haQuanto(traj.primeiro?.data) },
    { icon: DollarSign, cor: 'text-emerald-500', label: '1º cachê', valor: traj.primeiro?.cache ? money(traj.primeiro.cache) : '—', sub: 'na estreia' },
    { icon: Music, cor: 'text-violet-500', label: 'Total de shows', valor: num(traj.total_shows), sub: `favorito: ${traj.dia_favorito || '—'}` },
    { icon: Users, cor: 'text-blue-500', label: 'Público', valor: `${num(traj.primeiro?.publico || 0)} → ${num(traj.atual?.publico || 0)}`, sub: crescPublico != null ? `${crescPublico >= 0 ? '+' : ''}${crescPublico}% do 1º ao último` : 'estreia → atual', up: crescPublico },
    { icon: DollarSign, cor: 'text-emerald-600', label: 'Cachê médio', valor: money(traj.cache_medio), sub: `total ${money(traj.cache_total)} · cobertura ${traj.cobertura_cache || 0}%` },
    { icon: Ticket, cor: 'text-amber-500', label: 'Ticket médio da noite', valor: moneyC(traj.ticket_medio), sub: 'consumo por pessoa' },
    { icon: Trophy, cor: 'text-yellow-500', label: 'Público recorde', valor: num(traj.publico_recorde?.valor || 0), sub: fmtData(traj.publico_recorde?.data) },
    { icon: Sparkles, cor: 'text-pink-500', label: 'Faturamento recorde', valor: money(traj.fat_recorde?.valor || 0), sub: `noite de ${fmtData(traj.fat_recorde?.data)}` },
  ];
  return (
    <div className="space-y-4">
      {/* Hero */}
      <Card className="bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/30 dark:to-gray-900 border-violet-100 dark:border-violet-900/40">
        <CardContent className="py-5 flex items-center gap-4 flex-wrap">
          <div className="h-14 w-14 rounded-full bg-violet-600 text-white flex items-center justify-center text-xl font-bold shrink-0">{(nome[0] || '?').toUpperCase()}</div>
          <div className="min-w-0">
            <div className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">{nome} <Badge variant="outline" className="capitalize text-xs">{tipo}</Badge></div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{num(traj.total_shows)} shows em {barNome} · desde {fmtMesAno(traj.primeiro?.data)} · toca mais às <b className="text-gray-700 dark:text-gray-200">{traj.dia_favorito || '—'}</b></div>
          </div>
        </CardContent>
      </Card>

      {/* Big numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t, i) => (
          <Card key={i}><CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"><t.icon className={`h-3.5 w-3.5 ${t.cor}`} />{t.label}</div>
            <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white flex items-center gap-1">
              {t.valor}
              {typeof (t as any).up === 'number' && ((t as any).up >= 0 ? <ArrowUpRight className="h-4 w-4 text-emerald-500" /> : <ArrowDownRight className="h-4 w-4 text-rose-500" />)}
            </div>
            {t.sub && <div className="text-[11px] text-gray-400 truncate" title={t.sub}>{t.sub}</div>}
          </CardContent></Card>
        ))}
      </div>

      {/* Melhor / pior noite (cachê) */}
      <div className="grid md:grid-cols-2 gap-3">
        <Card className="border-emerald-200 dark:border-emerald-900/50">
          <CardContent className="p-4 flex items-center gap-3">
            <Star className="h-6 w-6 text-emerald-500 shrink-0" />
            <div><div className="text-xs text-gray-500">Melhor noite (cachê recebido)</div>
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{money(traj.melhor_cache?.valor || 0)}</div>
              <div className="text-[11px] text-gray-400">{fmtData(traj.melhor_cache?.data)}</div></div>
          </CardContent>
        </Card>
        <Card className="border-rose-200 dark:border-rose-900/50">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingDown className="h-6 w-6 text-rose-500 shrink-0" />
            <div><div className="text-xs text-gray-500">Menor noite (cachê recebido)</div>
              <div className="text-lg font-bold text-rose-700 dark:text-rose-400">{money(traj.pior_cache?.valor || 0)}</div>
              <div className="text-[11px] text-gray-400">{fmtData(traj.pior_cache?.data)}</div></div>
          </CardContent>
        </Card>
      </div>

      {/* Evolução de cachê */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-500" />Evolução do cachê</CardTitle><CardDescription>quanto {nome} recebeu por show ao longo do tempo</CardDescription></CardHeader>
        <CardContent><div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={evolChart} margin={{ top: 6, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={38} />
              <RTooltip formatter={((v: number) => moneyC(Number(v))) as any} labelFormatter={(l) => String(l)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line type="monotone" dataKey="cache" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} name="cachê" />
            </LineChart>
          </ResponsiveContainer>
        </div></CardContent>
      </Card>

      {/* Público + faturamento da noite */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-blue-500" />Público por show</CardTitle><CardDescription>quanta gente veio nas noites de {nome}</CardDescription></CardHeader>
          <CardContent><div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <AreaChart data={evolChart} margin={{ top: 6, right: 12, left: 4, bottom: 0 }}>
                <defs><linearGradient id="gPub" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} width={34} />
                <RTooltip formatter={((v: number) => [num(Number(v)), 'público']) as any} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Area type="monotone" dataKey="publico" stroke="#3b82f6" fill="url(#gPub)" name="público" />
              </AreaChart>
            </ResponsiveContainer>
          </div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-violet-500" />Faturamento da noite</CardTitle><CardDescription>o quanto a casa fez nas noites de {nome}</CardDescription></CardHeader>
          <CardContent><div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={evolChart} margin={{ top: 6, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={38} />
                <RTooltip formatter={((v: number) => moneyC(Number(v))) as any} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="fat" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} name="faturamento" />
              </LineChart>
            </ResponsiveContainer>
          </div></CardContent>
        </Card>
      </div>

      {/* Parceiros de palco */}
      {traj.parceiros?.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Handshake className="h-4 w-4 text-amber-500" />Parceiros de palco</CardTitle><CardDescription>com quem {nome} mais dividiu a noite</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {traj.parceiros.map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1 text-sm">
                {p.nome} <span className="text-xs text-gray-400">{p.juntos}×</span>
              </span>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---- Ranking (secundário) ----
function RankingView({ ranking, onPick }: { ranking: any[] | null; onPick: (id: number) => void }) {
  if (ranking === null) return <div className="grid gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;
  if (ranking.length === 0) return <Card><CardContent className="py-12 text-center text-gray-500">Sem dados de ranking no período.</CardContent></Card>;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4 text-amber-500" />Ranking (últimos 12 meses)</CardTitle><CardDescription>clique num artista para abrir a trajetória</CardDescription></CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 border-b"><tr>
            <th className="text-left px-3 py-2">#</th><th className="text-left px-3 py-2">Artista</th>
            <th className="text-right px-3 py-2">Shows</th><th className="text-right px-3 py-2">Público médio</th>
            <th className="text-right px-3 py-2">Fat. médio/noite</th><th className="text-right px-3 py-2">Cachê médio</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {ranking.map((a, i) => (
              <tr key={a.artista_id ?? a.nome} onClick={() => a.artista_id && onPick(a.artista_id)} className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 ${a.artista_id ? 'cursor-pointer' : ''}`}>
                <td className="px-3 py-2 text-gray-400 tabular-nums">{i + 1}</td>
                <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{a.nome} <span className="text-[11px] text-gray-400 capitalize">· {a.tipo}</span></td>
                <td className="px-3 py-2 text-right tabular-nums">{a.shows}</td>
                <td className="px-3 py-2 text-right tabular-nums">{num(a.publico_medio)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(a.fat_medio)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(a.custo_medio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
