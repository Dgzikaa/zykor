'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, AreaChart, Area, CartesianGrid,
} from 'recharts';
import {
  Users, Loader2, Palmtree, CalendarX, AlertTriangle, Smile, Clock, TrendingUp, TrendingDown, FileWarning, ClipboardCheck, Cake, Gift,
} from 'lucide-react';

const CORES = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6'];
const TIPO_ALERTA: Record<string, string> = {
  sem_exame: 'Sem exame admissional', sem_contrato: 'Sem contrato', doc_vencido: 'Documento vencido', ferias_vencendo: 'Férias vencendo', treino_vencido: 'Treinamento vencido',
};
const fmtData = (d: string) => { try { const [y, m, dd] = d.split('-'); return `${dd}/${m}`; } catch { return d; } };

export function DashboardRH() {
  const { selectedBar } = useBar();
  const [d, setD] = useState<any>(null);
  const [aniv, setAniv] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!selectedBar) return;
    setLoading(true);
    try {
      const [r, a] = await Promise.all([api.get('/api/rh/funcionarios/dashboard'), api.get('/api/rh/aniversariantes').catch(() => null)]);
      setD(r); setAniv(a);
    }
    catch { setD(null); } finally { setLoading(false); }
  }, [selectedBar]);
  useEffect(() => { carregar(); }, [carregar]);

  if (loading) return <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>;
  if (!d) return <div className="py-12 text-center text-muted-foreground">Sem dados.</div>;

  const tempo = d.headcount.tempo_casa_medio_meses;
  const tempoTxt = tempo >= 12 ? `${Math.floor(tempo / 12)}a ${tempo % 12}m` : `${tempo}m`;
  const fel = d.felicidade;

  return (
    <div className="space-y-4">
      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={Users} label="Ativos" value={d.headcount.ativos} sub={`${d.headcount.inativos} inativos`} tint="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" />
        <Kpi icon={Palmtree} label="Em férias" value={d.ocorrencias.em_ferias.length} cor="text-sky-600 dark:text-sky-400" tint="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" />
        <Kpi icon={CalendarX} label="Faltas (mês)" value={d.ocorrencias.faltas_mes} cor="text-orange-600 dark:text-orange-400" tint="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" />
        <Kpi icon={AlertTriangle} label="Com alertas" value={d.alertas.com_alertas} cor="text-red-600 dark:text-red-400" tint="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" />
        <Kpi icon={Smile} label="Felicidade" value={fel ? `${fel.pct}%` : '—'} cor="text-emerald-600 dark:text-emerald-400" sub={fel ? `${fel.respostas} resp.` : 'sem pesquisa'} tint="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" />
        <Kpi icon={Clock} label="Tempo de casa" value={tempoTxt} sub="média" tint="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* ── Quadro por área ── */}
        <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
          <CardContent className="py-4">
            <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Users className="w-4 h-4" />Quadro por área</div>
            <div className="flex items-center gap-1.5 mb-3 flex-wrap text-[11px]">
              {Object.entries(d.headcount.por_tipo).map(([t, n]: any) => n > 0 && (
                <span key={t} className="rounded-full px-2 py-0.5 bg-muted">{t}: <b>{n}</b></span>
              ))}
              <span className="rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                +{d.movimentacao.admissoes_90d} adm. 90d
              </span>
              {d.movimentacao.demissoes_90d > 0 && <span className="rounded-full px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">−{d.movimentacao.demissoes_90d} dem. 90d</span>}
            </div>
            <ResponsiveContainer width="100%" height={Math.max(120, d.headcount.por_area.length * 26)}>
              <BarChart data={d.headcount.por_area} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="area" width={90} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="n" radius={[0, 4, 4, 0]} barSize={16}>
                  {d.headcount.por_area.map((_: any, i: number) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ── Clima / Felicidade ── */}
        <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
          <CardContent className="py-4">
            <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Smile className="w-4 h-4" />Clima · Felicidade {fel && <span className="text-muted-foreground font-normal text-xs">(pesquisa {fmtData(fel.data)})</span>}</div>
            {fel ? (
              <>
                <div className="flex items-end gap-3 mb-2">
                  <div className="text-3xl font-bold text-emerald-600">{fel.pct}%</div>
                  <div className="text-xs text-muted-foreground mb-1">satisfação · média {fel.media}</div>
                </div>
                <ResponsiveContainer width="100%" height={70}>
                  <AreaChart data={fel.trend} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                    <defs><linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.4} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                    <Tooltip labelFormatter={(v) => fmtData(String(v))} formatter={(v: any) => [`${v}%`, 'satisfação']} />
                    <Area type="monotone" dataKey="pct" stroke="#10b981" fill="url(#gf)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {fel.dimensoes.map((dim: any) => (
                    <div key={dim.label} className="flex items-center gap-2">
                      <span className="text-[11px] w-24 text-muted-foreground shrink-0">{dim.label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (dim.valor / 5) * 100)}%` }} /></div>
                      <span className="text-[11px] w-8 text-right">{dim.valor}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <div className="text-sm text-muted-foreground py-8 text-center">Sem pesquisa de felicidade ainda.</div>}
          </CardContent>
        </Card>
      </div>

      {/* ── Atenção + Em férias ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
          <CardContent className="py-4">
            <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><FileWarning className="w-4 h-4 text-red-500" />Pendências</div>
            {Object.keys(d.alertas.por_tipo).length ? (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(d.alertas.por_tipo).map(([t, n]: any) => (
                  <span key={t} className="text-xs rounded-md px-2 py-1 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border border-red-100 dark:border-red-900/40">
                    {TIPO_ALERTA[t] || t}: <b>{n}</b>
                  </span>
                ))}
              </div>
            ) : <div className="text-sm text-emerald-600 flex items-center gap-1.5"><ClipboardCheck className="w-4 h-4" />Tudo em dia — nenhuma pendência.</div>}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
          <CardContent className="py-4">
            <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Palmtree className="w-4 h-4 text-sky-500" />Em férias agora</div>
            {d.ocorrencias.em_ferias.length ? (
              <div className="space-y-1">
                {d.ocorrencias.em_ferias.map((f: any, i: number) => (
                  <div key={i} className="text-sm flex items-center justify-between"><span>{f.nome}</span><span className="text-xs text-muted-foreground">até {f.ate ? fmtData(f.ate) : '—'}</span></div>
                ))}
              </div>
            ) : <div className="text-sm text-muted-foreground">Ninguém de férias no momento.</div>}
          </CardContent>
        </Card>
      </div>

      {/* ── Aniversariantes & tempo de casa ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
          <CardContent className="py-4">
            <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Cake className="w-4 h-4 text-pink-500" />Aniversariantes do mês</div>
            {aniv?.aniversariantes?.length ? (
              <div className="space-y-1">
                {aniv.aniversariantes.map((a: any) => (
                  <div key={a.id} className="text-sm flex items-center justify-between"><span>{a.nome}</span><span className="text-xs text-muted-foreground">dia {a.dia}{a.idade ? ` · ${a.idade} anos` : ''}</span></div>
                ))}
              </div>
            ) : <div className="text-sm text-muted-foreground">Ninguém faz aniversário este mês.</div>}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
          <CardContent className="py-4">
            <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Gift className="w-4 h-4 text-violet-500" />Aniversários de empresa</div>
            {aniv?.aniversarios_empresa?.length ? (
              <div className="space-y-1">
                {aniv.aniversarios_empresa.map((a: any) => (
                  <div key={a.id} className="text-sm flex items-center justify-between"><span>{a.nome}</span><span className="text-xs text-muted-foreground">dia {a.dia} · {a.anos} {a.anos === 1 ? 'ano' : 'anos'} de casa</span></div>
                ))}
              </div>
            ) : <div className="text-sm text-muted-foreground">Nenhum aniversário de casa este mês.</div>}
          </CardContent>
        </Card>
      </div>

      {/* ── Avaliações (pré-construído) ── */}
      <Card className="rounded-2xl border-dashed bg-muted/20">
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="w-4 h-4 text-violet-500" />Avaliações de desempenho</div>
          <span className="text-xs text-muted-foreground">módulo de Avaliação/Calibração — em breve</span>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, cor, tint }: { icon: any; label: string; value: any; sub?: string; cor?: string; tint?: string }) {
  return (
    <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', tint || 'bg-muted text-foreground')}>
            <Icon className="w-4 h-4" />
          </span>
        </div>
        <div className={cn('text-2xl font-bold mt-2 leading-none', cor)}>{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
