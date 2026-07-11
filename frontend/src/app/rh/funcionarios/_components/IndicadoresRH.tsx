'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { GraficoBase } from '@/components/graficos/GraficoBase';
import { GraficoLinha, GraficoBarrasAgrupadas } from '@/components/graficos/Charts';
import { useToast } from '@/components/ui/toast';
import { Users, Loader2, TrendingDown, UserPlus, UserMinus, CalendarX, Smile, Copy, MessageSquare } from 'lucide-react';

export function IndicadoresRH() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const [d, setD] = useState<any>(null);
  const [enps, setEnps] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!selectedBar) return;
    setLoading(true);
    try {
      const [r, e] = await Promise.all([api.get('/api/rh/indicadores'), api.get('/api/rh/enps').catch(() => null)]);
      setD(r); setEnps(e);
    } catch { setD(null); } finally { setLoading(false); }
  }, [selectedBar]);
  useEffect(() => { carregar(); }, [carregar]);

  const linkPulse = selectedBar ? `${typeof window !== 'undefined' ? window.location.origin : ''}/pulse?bar=${selectedBar.id}` : '';

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

      {/* eNPS — clima recorrente (pulso anônimo) */}
      <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="text-sm font-semibold flex items-center gap-1.5"><Smile className="w-4 h-4 text-emerald-500" />eNPS · clima (90 dias)</div>
            <button onClick={() => { navigator.clipboard?.writeText(linkPulse); showToast({ type: 'success', title: 'Link copiado', message: 'Compartilhe com a equipe (resposta anônima).' }); }}
              className="text-xs inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-muted"><Copy className="w-3 h-3" />Copiar link da pesquisa</button>
          </div>
          {!enps || enps.total === 0 ? (
            <div className="text-sm text-muted-foreground py-2">Sem respostas ainda. Compartilhe o link acima com a equipe pra começar a medir.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div className="text-center">
                <div className={cn('text-4xl font-bold', enps.enps >= 50 ? 'text-emerald-600' : enps.enps >= 0 ? 'text-amber-600' : 'text-red-600')}>{enps.enps > 0 ? '+' : ''}{enps.enps}</div>
                <div className="text-[11px] text-muted-foreground">eNPS · {enps.total} resposta(s)</div>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                {[['Promotores (9-10)', enps.promotores, 'bg-emerald-500'], ['Neutros (7-8)', enps.neutros, 'bg-amber-400'], ['Detratores (0-6)', enps.detratores, 'bg-red-500']].map(([l, v, c]: any) => (
                  <div key={l} className="flex items-center gap-2">
                    <span className="text-[11px] w-28 text-muted-foreground shrink-0">{l}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden"><div className={cn('h-full', c)} style={{ width: `${enps.total ? (v / enps.total) * 100 : 0}%` }} /></div>
                    <span className="text-[11px] w-6 text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {enps?.comentarios?.length > 0 && (
            <div className="mt-3 pt-3 border-t space-y-1.5 max-h-40 overflow-y-auto">
              {enps.comentarios.map((c: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs"><MessageSquare className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" /><span><b className={c.nota >= 9 ? 'text-emerald-600' : c.nota <= 6 ? 'text-red-600' : 'text-amber-600'}>{c.nota}</b> · {c.comentario}</span></div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
        <CardContent className="py-4">
          <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Users className="w-4 h-4" />Headcount, admissões e demissões</div>
          <GraficoBarrasAgrupadas
            data={d.meses}
            xKey="label"
            series={[
              { key: 'admissoes', nome: 'Admissões', cor: '#10b981' },
              { key: 'demissoes', nome: 'Demissões', cor: '#f97316' },
            ]}
            lineKey="headcount"
            nomeLinha="Headcount"
            corLinha="#6366f1"
            height={240}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
          <CardContent className="py-4">
            <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><TrendingDown className="w-4 h-4 text-rose-500" />Turnover mensal (%)</div>
            <GraficoLinha
              data={d.meses}
              xKey="label"
              series={[{ key: 'turnover', nome: 'Turnover', cor: '#e11d48' }]}
              height={200}
              formatV={(v) => `${v}%`}
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
          <CardContent className="py-4">
            <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><CalendarX className="w-4 h-4 text-amber-500" />Absenteísmo (faltas + atestados)</div>
            <GraficoBase
              tipo="barra"
              stacked
              data={d.meses}
              xKey="label"
              series={[
                { key: 'faltas', label: 'Faltas' },
                { key: 'atestados', label: 'Atestados' },
              ]}
              cores={['#f59e0b', '#eab308']}
              height={200}
            />
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
