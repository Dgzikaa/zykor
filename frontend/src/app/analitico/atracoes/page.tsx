'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useBar } from '@/contexts/BarContext';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Music, Users, DollarSign, Calendar, Award, TrendingUp, TrendingDown, Star, Trophy, Ticket, ArrowUpRight, ArrowDownRight, Sparkles, Handshake, Share2, Camera, X, Smile, MessageSquare } from 'lucide-react';

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

interface ArtistaLista { artista_id: number; nome: string; tipo: string; foto_url?: string | null; shows: number; primeiro: string; ultimo: string }
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

  // Filtro global: período (de/ate) + dia da semana (dow 0=dom..6=sáb). Afeta lista, trajetória e NPS.
  const anoAtual = new Date().getFullYear();
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [dow, setDow] = useState('');
  const [presetAtivo, setPresetAtivo] = useState('tudo');
  const aplicarPreset = useCallback((key: string) => {
    const now = new Date(); const y = now.getFullYear(); const p2 = (n: number) => String(n).padStart(2, '0');
    if (key === 'tudo') { setDe(''); setAte(''); }
    else if (key === 'mes') { setDe(`${y}-${p2(now.getMonth() + 1)}-01`); setAte(''); }
    else if (key === 'mesAnt') { const m0 = now.getMonth(); const my = m0 === 0 ? y - 1 : y; const mm = m0 === 0 ? 12 : m0; const last = new Date(my, mm, 0).getDate(); setDe(`${my}-${p2(mm)}-01`); setAte(`${my}-${p2(mm)}-${p2(last)}`); }
    else if (/^\d{4}$/.test(key)) { setDe(`${key}-01-01`); setAte(`${key}-12-31`); }
    setPresetAtivo(key);
  }, []);
  const filtroQS = useCallback(() => {
    const p = new URLSearchParams();
    if (de) p.set('de', de);
    if (ate) p.set('ate', ate);
    if (dow !== '') p.set('dow', dow);
    const s = p.toString();
    return s ? `&${s}` : '';
  }, [de, ate, dow]);

  const artistaSel = useMemo(() => lista.find(a => String(a.artista_id) === artistaId), [lista, artistaId]);

  const carregarLista = useCallback(async () => {
    if (!barId) return;
    setLoadingLista(true);
    try {
      const r = await fetch(`/api/analitico/atracoes?view=lista&bar_id=${barId}${filtroQS()}`, { cache: 'no-store' });
      const j = await r.json();
      const l: ArtistaLista[] = j.lista || [];
      setLista(l);
      const urlA = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('artista') : null;
      setArtistaId(prev => {
        if (urlA && l.some(a => String(a.artista_id) === urlA)) return urlA;
        if (prev && l.some(a => String(a.artista_id) === prev)) return prev;
        return l[0] ? String(l[0].artista_id) : '';
      });
    } catch { setLista([]); }
    finally { setLoadingLista(false); }
  }, [barId, filtroQS]);

  const carregarTraj = useCallback(async (id: string) => {
    if (!barId || !id) { setTraj(null); return; }
    setLoadingTraj(true);
    try {
      const r = await fetch(`/api/analitico/atracoes?artista_id=${id}&bar_id=${barId}${filtroQS()}`, { cache: 'no-store' });
      const j = await r.json();
      setTraj(j.artista || null);
    } catch { setTraj(null); }
    finally { setLoadingTraj(false); }
  }, [barId, filtroQS]);

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
  // 1 ponto POR SHOW (label = data ISO única); eixo exibe mês/ano, tooltip mostra a data exata.
  const evolChart = evol.map(e => ({ ...e, label: e.data.slice(0, 10) }));
  const crescPublico = traj && traj.primeiro?.publico ? Math.round(((traj.atual.publico! - traj.primeiro.publico!) / traj.primeiro.publico!) * 100) : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-3 py-4 max-w-6xl space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Music className="h-6 w-6 text-violet-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Visão do Artista</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">A trajetória de cada artista com a casa — feita pra mostrar pro artista.</p>
          </div>
        </div>

        {aba === 'ranking' ? (
          <RankingView ranking={ranking} onPick={(id) => { setArtistaId(String(id)); setAba('artista'); }} />
        ) : (
          <>
            {/* Filtro global: período + dia da semana (afeta lista, trajetória e NPS) */}
            <Card>
              <CardContent className="p-3 flex flex-wrap items-end gap-x-4 gap-y-3">
                <div>
                  <span className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Período</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[{ k: 'tudo', l: 'Tudo' }, { k: String(anoAtual), l: String(anoAtual) }, { k: String(anoAtual - 1), l: String(anoAtual - 1) }, { k: 'mes', l: 'Este mês' }, { k: 'mesAnt', l: 'Mês passado' }].map(p => (
                      <button key={p.k} onClick={() => aplicarPreset(p.k)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${presetAtivo === p.k ? 'bg-violet-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{p.l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">De</span>
                  <input type="date" value={de} onChange={e => { setDe(e.target.value); setPresetAtivo(''); }} className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-2 text-sm w-[9.5rem]" />
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Até</span>
                  <input type="date" value={ate} onChange={e => { setAte(e.target.value); setPresetAtivo(''); }} className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-2 text-sm w-[9.5rem]" />
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Dia da semana</span>
                  <select value={dow} onChange={e => setDow(e.target.value)} className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-2 text-sm">
                    <option value="">Todos</option>
                    <option value="0">Domingo</option>
                    <option value="1">Segunda</option>
                    <option value="2">Terça</option>
                    <option value="3">Quarta</option>
                    <option value="4">Quinta</option>
                    <option value="5">Sexta</option>
                    <option value="6">Sábado</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* #2 O NPS prevê retorno? + #6 Motivos citados (métricas da casa) */}
            {barId ? <NpsRetornoCard barId={barId} de={de} ate={ate} dow={dow} /> : null}
            {barId ? <NpsTemasCard barId={barId} de={de} ate={ate} dow={dow} /> : null}

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
                <TrajetoriaView traj={traj} nome={artistaSel?.nome || ''} tipo={artistaSel?.tipo || ''} foto={artistaSel?.foto_url || null} artistaId={artistaSel?.artista_id || 0} onFotoSalva={carregarLista} evolChart={evolChart} crescPublico={crescPublico} barNome={selectedBar?.nome || 'a casa'} barId={barId} de={de} ate={ate} dow={dow} />
              )}
          </>
        )}
      </div>
    </div>
  );
}

// ---- Trajetória ----
function TrajetoriaView({ traj, nome, tipo, foto, artistaId, onFotoSalva, evolChart, crescPublico, barNome, barId, de, ate, dow }: { traj: Trajetoria; nome: string; tipo: string; foto: string | null; artistaId: number; onFotoSalva: () => void; evolChart: any[]; crescPublico: number | null; barNome: string; barId?: number; de: string; ate: string; dow: string }) {
  const [share, setShare] = useState(false);
  const salvarFoto = async () => {
    const url = window.prompt('Cole a URL da foto do artista:', foto || '');
    if (url === null) return;
    try { await fetch('/api/artistas/foto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artista_id: artistaId, foto_url: url }) }); onFotoSalva(); }
    catch { /* noop */ }
  };
  const Avatar = ({ size }: { size: number }) => (
    foto
      ? <img src={foto} alt={nome} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
      : <div className="rounded-full bg-violet-600 text-white flex items-center justify-center font-bold shrink-0" style={{ width: size, height: size, fontSize: size * 0.4 }}>{(nome[0] || '?').toUpperCase()}</div>
  );
  // #3 frequência
  const dp = (s?: string) => { if (!s) return null; const [y, m, d] = s.slice(0, 10).split('-').map(Number); return { y, m, d, ms: Date.UTC(y, m - 1, d) }; };
  const p0 = dp(traj.primeiro?.data), pN = dp(traj.atual?.data);
  const diasEntre = (p0 && pN && traj.total_shows > 1 && pN.ms > p0.ms) ? Math.round((pN.ms - p0.ms) / 86400000 / (traj.total_shows - 1)) : null;
  const mesesCasa = (p0 && pN) ? Math.max(1, (pN.y - p0.y) * 12 + (pN.m - p0.m) + 1) : 1;
  const showsMes = p0 ? traj.total_shows / mesesCasa : null;
  const anosCasa = p0 ? (Date.now() - p0.ms) / (365 * 86400000) : 0;
  // #2 marcos
  const marcos: { txt: string; cor: string }[] = [];
  if (traj.total_shows >= 100) marcos.push({ txt: '💯 100+ shows', cor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' });
  else if (traj.total_shows >= 50) marcos.push({ txt: '🎸 50+ shows', cor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' });
  else if (traj.total_shows >= 25) marcos.push({ txt: '⭐ 25+ shows', cor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' });
  else if (traj.total_shows >= 10) marcos.push({ txt: '10+ shows', cor: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' });
  if (anosCasa >= 2) marcos.push({ txt: `🏠 ${Math.floor(anosCasa)} anos de casa`, cor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' });
  else if (anosCasa >= 1) marcos.push({ txt: '🏠 1 ano de casa', cor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' });
  else marcos.push({ txt: '🌱 chegando agora', cor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' });
  if (diasEntre != null && diasEntre <= 10) marcos.push({ txt: '📆 residente', cor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' });
  if (traj.atual?.publico && traj.publico_recorde?.valor && traj.atual.publico >= traj.publico_recorde.valor) marcos.push({ txt: '🔥 recorde de público na última!', cor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' });
  if ((traj.cache_medio || 0) >= 5000) marcos.push({ txt: '💰 cachê top', cor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' });

  const tiles = [
    { icon: Calendar, cor: 'text-sky-500', label: '1º show', valor: fmtData(traj.primeiro?.data), sub: haQuanto(traj.primeiro?.data) },
    { icon: DollarSign, cor: 'text-emerald-500', label: '1º cachê', valor: traj.primeiro?.cache ? money(traj.primeiro.cache) : '—', sub: 'na estreia' },
    { icon: Music, cor: 'text-violet-500', label: 'Total de shows', valor: num(traj.total_shows), sub: `favorito: ${traj.dia_favorito || '—'}` },
    { icon: Users, cor: 'text-blue-500', label: 'Público', valor: `${num(traj.primeiro?.publico || 0)} → ${num(traj.atual?.publico || 0)}`, sub: crescPublico != null ? `${crescPublico >= 0 ? '+' : ''}${crescPublico}% do 1º ao último` : 'estreia → atual', up: crescPublico },
    { icon: DollarSign, cor: 'text-emerald-600', label: 'Cachê médio', valor: money(traj.cache_medio), sub: `cobertura ${traj.cobertura_cache || 0}% dos shows` },
    { icon: DollarSign, cor: 'text-emerald-700', label: 'Total de cachê pago', valor: money(traj.cache_total), sub: `em ${num(traj.total_shows)} shows` },
    { icon: Ticket, cor: 'text-amber-500', label: 'Ticket médio da noite', valor: moneyC(traj.ticket_medio), sub: 'consumo por pessoa' },
    { icon: Trophy, cor: 'text-yellow-500', label: 'Público recorde', valor: num(traj.publico_recorde?.valor || 0), sub: fmtData(traj.publico_recorde?.data) },
    { icon: Sparkles, cor: 'text-pink-500', label: 'Faturamento recorde', valor: money(traj.fat_recorde?.valor || 0), sub: `noite de ${fmtData(traj.fat_recorde?.data)}` },
  ];
  return (
    <div className="space-y-4">
      {/* Hero */}
      <Card className="bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/30 dark:to-gray-900 border-violet-100 dark:border-violet-900/40">
        <CardContent className="py-5 flex items-center gap-4 flex-wrap">
          <div className="relative group shrink-0">
            <Avatar size={56} />
            <button onClick={salvarFoto} title="Adicionar/trocar foto" className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:text-violet-600 shadow"><Camera className="h-3.5 w-3.5" /></button>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">{nome} <Badge variant="outline" className="capitalize text-xs">{tipo}</Badge></div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{num(traj.total_shows)} shows em {barNome} · desde {fmtMesAno(traj.primeiro?.data)} · toca mais às <b className="text-gray-700 dark:text-gray-200">{traj.dia_favorito || '—'}</b>{diasEntre != null && <> · em média <b className="text-gray-700 dark:text-gray-200">1 show a cada {diasEntre} dias</b>{showsMes != null && ` (~${showsMes.toFixed(1).replace('.', ',')}/mês)`}</>}</div>
          </div>
          <button onClick={() => setShare(true)} className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 hover:bg-violet-700 text-white px-3 h-9 text-sm shrink-0"><Share2 className="h-4 w-4" />Compartilhar</button>
        </CardContent>
      </Card>

      {/* Marcos */}
      {marcos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {marcos.map((m, i) => <span key={i} className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${m.cor}`}>{m.txt}</span>)}
        </div>
      )}

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

      {/* NPS do público vinculado ao artista (Falae · Data da Visita) */}
      {artistaId ? <NpsArtistaCard barId={barId} artistaId={artistaId} nome={nome} de={de} ate={ate} dow={dow} /> : null}

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
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMesAno(String(v))} interval="preserveStartEnd" minTickGap={40} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={38} />
              <RTooltip formatter={((v: number) => moneyC(Number(v))) as any} labelFormatter={(l) => fmtData(String(l))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
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
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMesAno(String(v))} interval="preserveStartEnd" minTickGap={40} />
                <YAxis tick={{ fontSize: 11 }} width={34} />
                <RTooltip formatter={((v: number) => [num(Number(v)), 'público']) as any} labelFormatter={(l) => fmtData(String(l))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
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
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtMesAno(String(v))} interval="preserveStartEnd" minTickGap={40} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={38} />
                <RTooltip formatter={((v: number) => moneyC(Number(v))) as any} labelFormatter={(l) => fmtData(String(l))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
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

      {/* #1 Card compartilhável */}
      {share && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-start justify-center p-4 overflow-auto" onClick={() => setShare(false)}>
          <div className="mt-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-end mb-2"><button onClick={() => setShare(false)} className="text-white/80 hover:text-white inline-flex items-center gap-1 text-sm"><X className="h-4 w-4" />fechar</button></div>
            {/* o card em si (tire um print) */}
            <div className="rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 text-white">
              <div className="p-6">
                <div className="flex items-center gap-4">
                  <Avatar size={72} />
                  <div className="min-w-0">
                    <div className="text-2xl font-bold leading-tight">{nome}</div>
                    <div className="text-white/70 text-sm capitalize">{tipo} · {barNome}</div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  {[
                    { l: 'Shows', v: num(traj.total_shows) },
                    { l: 'Desde', v: fmtMesAno(traj.primeiro?.data) },
                    { l: 'Público 1º → hoje', v: `${num(traj.primeiro?.publico || 0)} → ${num(traj.atual?.publico || 0)}` },
                    { l: 'Público recorde', v: num(traj.publico_recorde?.valor || 0) },
                    { l: 'Cachê total', v: money(traj.cache_total) },
                    { l: 'Melhor noite', v: money(traj.melhor_cache?.valor || 0) },
                    { l: 'Dia favorito', v: traj.dia_favorito || '—' },
                    { l: 'Fat. recorde', v: money(traj.fat_recorde?.valor || 0) },
                  ].map((s, i) => (
                    <div key={i} className="rounded-lg bg-white/10 px-3 py-2">
                      <div className="text-[11px] text-white/60">{s.l}</div>
                      <div className="font-bold text-lg leading-tight">{s.v}</div>
                    </div>
                  ))}
                </div>
                {marcos.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {marcos.slice(0, 4).map((m, i) => <span key={i} className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">{m.txt}</span>)}
                  </div>
                )}
                <div className="mt-5 text-center text-white/50 text-xs">trajetória em {barNome} · via Zykor</div>
              </div>
            </div>
            <p className="text-center text-white/70 text-xs mt-3">📸 Tire um print deste card para compartilhar com o artista.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- NPS por artista (Falae · Data da Visita → artista da noite) ----
const npsScoreCor = (s: number) => s >= 50 ? 'text-emerald-600 dark:text-emerald-400' : s >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
const npsDimCor = (nota: number) => nota >= 4.2 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : nota >= 3.5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
const npsCat = (c: string) => c === 'promotor' ? { emoji: '😍', cor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' }
  : c === 'neutro' ? { emoji: '😐', cor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' }
  : { emoji: '😕', cor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' };

// #6 — Motivos citados nos comentários (reclamações: detratores + neutros).
function NpsTemasCard({ barId, de, ate, dow }: { barId?: number; de: string; ate: string; dow: string }) {
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

// #2 — O NPS prevê retorno? Taxa de retorno ao bar por categoria (métrica da casa).
function NpsRetornoCard({ barId, de, ate, dow }: { barId?: number; de: string; ate: string; dow: string }) {
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

function NpsArtistaCard({ barId, artistaId, nome, de, ate, dow }: { barId?: number; artistaId: number; nome: string; de: string; ate: string; dow: string }) {
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
    if (de) qs.set('de', de);
    if (ate) qs.set('ate', ate);
    if (dow !== '') qs.set('dow', dow);
    fetch(`/api/analitico/atracoes?${qs.toString()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { setResumo(j.resumo || null); setRespostas(j.respostas || []); setDimensoes(j.dimensoes || []); })
      .catch(() => { setResumo(null); setRespostas([]); setDimensoes([]); })
      .finally(() => setLoading(false));
  }, [barId, artistaId, de, ate, dow]);

  // abre o modal já filtrado pela categoria clicada (ou 'todos' no botão "Ver respostas")
  const abrir = (cat: 'todos' | 'promotor' | 'neutro' | 'detrator') => { setFiltroCat(cat); setAberto(true); };
  const respostasView = filtroCat === 'todos' ? respostas : respostas.filter(r => r.categoria === filtroCat);
  const chipCat = 'cursor-pointer transition-opacity hover:opacity-80';

  return (
    <Card className="border-sky-100 dark:border-sky-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Smile className="h-4 w-4 text-sky-500" />NPS do público</CardTitle>
        <CardDescription>satisfação de quem foi nas noites de {nome} (Falae · vinculado pela data da visita) — clique numa faixa pra ver as respostas</CardDescription>
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
            {/* filtro por categoria dentro do modal */}
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
