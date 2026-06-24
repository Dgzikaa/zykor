'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import {
  ResponsiveContainer, ComposedChart, Area, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { Users, Loader2, TrendingDown, UserPlus, UserMinus, CalendarX } from 'lucide-react';

export function IndicadoresRH() {
  const { selectedBar } = useBar();
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!selectedBar) return;
    setLoading(true);
    try { const r = await api.get('/api/rh/indicadores'); setD(r); } catch { setD(null); } finally { setLoading(false); }
  }, [selectedBar]);
  useEffect(() => { carregar(); }, [carregar]);

  if (loading) return <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>;
  if (!d?.resumo) return <div className="py-12 text-center text-muted-foreground">Sem dados.</div>;

  const r = d.resumo;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi icon={Users} label="Headcount" value={r.headcount_atual} tint="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" />
        <Kpi icon={TrendingDown} label="Turnover 12m" value={`${r.turnover_12m}%`} cor="text-rose-600 dark:text-rose-400" tint="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" />
        <Kpi icon={UserPlus} label="Admissões 12m" value={r.admissoes_12m} cor="text-emerald-600 dark:text-emerald-400" tint="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" />
        <Kpi icon={UserMinus} label="Demissões 12m" value={r.demissoes_12m} cor="text-orange-600 dark:text-orange-400" tint="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" />
        <Kpi icon={CalendarX} label="Faltas 12m" value={r.faltas_12m} cor="text-amber-600 dark:text-amber-400" tint="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" />
      </div>

      <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
        <CardContent className="py-4">
          <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Users className="w-4 h-4" />Headcount, admissões e demissões</div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={d.meses} margin={{ left: 0, right: 8, top: 8 }}>
              <defs><linearGradient id="hc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="headcount" name="Headcount" stroke="#6366f1" fill="url(#hc)" strokeWidth={2} />
              <Bar dataKey="admissoes" name="Admissões" fill="#10b981" radius={[3, 3, 0, 0]} barSize={10} />
              <Bar dataKey="demissoes" name="Demissões" fill="#f97316" radius={[3, 3, 0, 0]} barSize={10} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
          <CardContent className="py-4">
            <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><TrendingDown className="w-4 h-4 text-rose-500" />Turnover mensal (%)</div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={d.meses} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: any) => [`${v}%`, 'Turnover']} />
                <Line type="monotone" dataKey="turnover" name="Turnover" stroke="#e11d48" strokeWidth={2} dot={{ r: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
          <CardContent className="py-4">
            <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><CalendarX className="w-4 h-4 text-amber-500" />Absenteísmo (faltas + atestados)</div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={d.meses} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="faltas" name="Faltas" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} barSize={14} />
                <Bar dataKey="atestados" name="Atestados" stackId="a" fill="#eab308" radius={[3, 3, 0, 0]} barSize={14} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, cor, tint }: { icon: any; label: string; value: any; cor?: string; tint?: string }) {
  return (
    <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', tint || 'bg-muted text-foreground')}><Icon className="w-4 h-4" /></span>
        </div>
        <div className={cn('text-2xl font-bold mt-2 leading-none', cor)}>{value}</div>
      </CardContent>
    </Card>
  );
}
