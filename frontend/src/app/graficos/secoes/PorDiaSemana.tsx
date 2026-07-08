'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { HeroRow, ChartCard, ChartGrid, GraficoBarraH, type Kpi } from '@/components/graficos/Charts';
import { mesBounds, mesLabelCurto } from '../_periodo';
import { CalendarDays, DollarSign, Users, Ticket, Loader2 } from 'lucide-react';

const money = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const num = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');

interface Dia { dow: number; dia: string; eventos: number; fat_medio: number; publico_medio: number; ticket_medio: number; fat_total: number }

export function SecaoPorDiaSemana({ barId, periodo, mesRef }: { barId: number; periodo: number; mesRef: string | null }) {
  const [dias, setDias] = useState<Dia[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    let de: string, ate: string;
    if (mesRef) { const b = mesBounds(mesRef); de = b.de; ate = b.ate; }
    else { const d = new Date(); ate = d.toISOString().slice(0, 10); const i = new Date(); i.setDate(i.getDate() - periodo * 30); de = i.toISOString().slice(0, 10); }
    try {
      const r = await api.get(`/api/graficos/por-dia-semana?bar_id=${barId}&de=${de}&ate=${ate}`);
      setDias(r?.success ? (r.dias || []) : []);
    } catch { setDias([]); }
    finally { setLoading(false); }
  }, [barId, periodo, mesRef]);
  useEffect(() => { carregar(); }, [carregar]);

  const comEventos = useMemo(() => dias.filter((d) => d.eventos > 0), [dias]);

  const kpis: Kpi[] = useMemo(() => {
    if (!comEventos.length) return [];
    const maxFat = comEventos.reduce((a, b) => (b.fat_medio > a.fat_medio ? b : a));
    const minFat = comEventos.reduce((a, b) => (b.fat_medio < a.fat_medio ? b : a));
    const maxTicket = comEventos.reduce((a, b) => (b.ticket_medio > a.ticket_medio ? b : a));
    const maxPub = comEventos.reduce((a, b) => (b.publico_medio > a.publico_medio ? b : a));
    const totalEventos = dias.reduce((s, d) => s + d.eventos, 0);
    return [
      { label: 'Melhor dia (faturamento)', valor: maxFat.dia, sub: `${money(maxFat.fat_medio)} em média`, icon: DollarSign },
      { label: 'Pior dia (faturamento)', valor: minFat.dia, sub: `${money(minFat.fat_medio)} em média`, cor: '#e34948', icon: DollarSign },
      { label: 'Maior público médio', valor: maxPub.dia, sub: `${num(maxPub.publico_medio)} pessoas`, icon: Users },
      { label: 'Maior ticket médio', valor: maxTicket.dia, sub: `${money(maxTicket.ticket_medio)}`, icon: Ticket },
      { label: 'Eventos analisados', valor: num(totalEventos), sub: 'no período', icon: CalendarDays },
    ];
  }, [comEventos, dias]);

  if (loading) return <div className="py-20 text-center text-gray-400"><Loader2 className="w-7 h-7 animate-spin mx-auto" /></div>;
  if (!comEventos.length) return <div className="py-20 text-center text-gray-400">Sem eventos no período para comparar por dia da semana.</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 dark:border-indigo-900/50 dark:bg-indigo-900/15 px-3 py-2 text-[13px] text-indigo-800 dark:text-indigo-200">
        📅 Médias por dia da semana no período ({mesRef ? mesLabelCurto(mesRef) : `últimos ${periodo} meses`}) — a partir dos eventos realizados (faturamento &gt; R$ 1.000).
      </div>
      <HeroRow kpis={kpis} cols={5} />
      <ChartGrid>
        <ChartCard titulo="Faturamento médio por dia da semana" subtitulo="média do faturamento real por evento">
          <GraficoBarraH data={dias} xKey="dia" valueKey="fat_medio" formatV={money} height={320} maxItens={7} />
        </ChartCard>
        <ChartCard titulo="Público médio por dia da semana" subtitulo="média de pessoas por evento">
          <GraficoBarraH data={dias} xKey="dia" valueKey="publico_medio" formatV={num} height={320} maxItens={7} cor="#0ea5e9" />
        </ChartCard>
        <ChartCard titulo="Ticket médio por dia da semana" subtitulo="gasto médio por pessoa">
          <GraficoBarraH data={dias} xKey="dia" valueKey="ticket_medio" formatV={money} height={320} maxItens={7} cor="#22c55e" />
        </ChartCard>
      </ChartGrid>
    </div>
  );
}
