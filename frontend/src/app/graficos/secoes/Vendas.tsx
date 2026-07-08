'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { GraficoBase } from '@/components/graficos/GraficoBase';
import { HeroRow, ChartCard, ChartGrid, GraficoHeatmap, type Kpi } from '@/components/graficos/Charts';
import { DollarSign, Users, Ticket, Sparkles, CalendarCheck, Percent, Loader2 } from 'lucide-react';

const money = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const moneyK = (v: number) => `${v < 0 ? '-' : ''}R$ ${Math.abs(Math.round((v || 0) / 1000))}k`;
const pct = (v: number) => `${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const num = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');
const delta = (a?: number, b?: number) => (a != null && b != null && b !== 0 ? ((a - b) / Math.abs(b)) * 100 : null);

const DIAS_ORD = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function SecaoVendas({ barId, periodo }: { barId: number; periodo: number }) {
  const [sem, setSem] = useState<any[]>([]);
  const [heat, setHeat] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const semanas = Math.round(periodo * 4.35);
    const ate = new Date().toISOString().slice(0, 10);
    const de = (() => { const d = new Date(); d.setDate(d.getDate() - periodo * 30); return d.toISOString().slice(0, 10); })();
    try {
      const [d, h] = await Promise.all([
        api.get(`/api/graficos/desempenho?semanas=${semanas}&bar_id=${barId}`),
        api.get(`/api/ferramentas/insights/curva-horaria?data_inicio=${de}&data_fim=${ate}&bar_id=${barId}`).catch(() => null),
      ]);
      setSem(d?.success ? (d.semanas || []) : []);
      setHeat(h?.success ? (h.heatmap || []) : []);
    } catch { setSem([]); setHeat([]); }
    finally { setLoading(false); }
  }, [barId, periodo]);
  useEffect(() => { carregar(); }, [carregar]);

  // descarta a semana corrente (parcial): data_fim ainda no futuro/hoje distorce KPIs e derruba o fim das linhas
  const data = useMemo(() => { const hojeISO = new Date().toISOString().slice(0, 10); return sem.filter((s) => !s.data_fim || s.data_fim < hojeISO).map((s) => ({
    periodo: s.periodo || `S${s.numero_semana}`,
    fat: Number(s.faturamento_total) || 0, meta: 263000,
    couvert: Number(s.faturamento_entrada) || 0, bar: Number(s.faturamento_bar) || 0, cmvivel: Number(s.faturamento_cmvivel) || 0,
    tm: Number(s.ticket_medio) || 0, tm_ent: Number(s.tm_entrada) || 0, tm_bar: Number(s.tm_bar) || 0,
    publico: Number(s.clientes_atendidos) || 0, ativos: Number(s.clientes_ativos) || 0, novos: Number(s.perc_clientes_novos) || 0,
    res_tot: Number(s.reservas_totais_pessoas) || 0, res_pres: Number(s.reservas_presentes_pessoas) || 0, quebra: Number(s.reservas_quebra_pct) || 0,
    beb: Number(s.perc_bebidas) || 0, drk: Number(s.perc_drinks) || 0, com: Number(s.perc_comida) || 0,
    hh: Number(s.perc_happy_hour) || 0, ate19: Number(s.perc_faturamento_ate_19h) || 0,
    so_bar: Number(s.stockout_bar_perc) || 0, so_com: Number(s.stockout_comidas_perc) || 0, so_drk: Number(s.stockout_drinks_perc) || 0,
    nps: s.nps_geral == null ? null : Number(s.nps_geral),
  })); }, [sem]);

  const temNps = useMemo(() => data.some((d) => d.nps != null && d.nps !== 0), [data]);
  const temStockout = useMemo(() => data.some((d) => d.so_bar || d.so_com || d.so_drk), [data]);

  const kpis: Kpi[] = useMemo(() => {
    if (!data.length) return [];
    const u = data[data.length - 1], p = data[data.length - 2] || {};
    return [
      { label: 'Fat. última semana', valor: money(u.fat), delta: delta(u.fat, p.fat), icon: DollarSign },
      { label: 'Ticket médio', valor: money(u.tm), delta: delta(u.tm, p.tm), icon: Ticket },
      { label: 'Público', valor: num(u.publico), delta: delta(u.publico, p.publico), icon: Users },
      { label: '% clientes novos', valor: pct(u.novos), delta: delta(u.novos, p.novos), icon: Sparkles },
      { label: 'Reservas presentes', valor: num(u.res_pres), sub: `${num(u.res_tot)} reservadas`, icon: CalendarCheck },
      { label: 'Quebra de reservas', valor: pct(u.quebra), delta: delta(u.quebra, p.quebra), invLower: true, icon: Percent },
    ];
  }, [data]);

  // heatmap dia × hora
  const heatmap = useMemo(() => {
    if (!heat.length) return { xs: [], ys: [], cells: [] as [number, number, number][] };
    const horas = [...new Set(heat.map((h) => Number(h.hora)))].sort((a, b) => ((a < 12 ? a + 24 : a) - (b < 12 ? b + 24 : b)));
    const diasPresentes = [...new Set(heat.map((h) => h.dia_semana))];
    const ys = DIAS_ORD.filter((d) => diasPresentes.includes(d)).concat(diasPresentes.filter((d) => !DIAS_ORD.includes(d)));
    const xi = new Map(horas.map((h, i) => [h, i])); const yi = new Map(ys.map((d, i) => [d, i]));
    const cells = heat.map((h) => [xi.get(Number(h.hora)) ?? -1, yi.get(h.dia_semana) ?? -1, Math.round(Number(h.faturamento_medio) || 0)] as [number, number, number]).filter((c) => c[0] >= 0 && c[1] >= 0);
    return { xs: horas.map((h) => `${h}h`), ys, cells };
  }, [heat]);

  if (loading) return <div className="py-20 text-center text-gray-400"><Loader2 className="w-7 h-7 animate-spin mx-auto" /></div>;
  if (!data.length) return <div className="py-20 text-center text-gray-400">Sem dados de desempenho semanal no período.</div>;

  return (
    <div className="space-y-4">
      {kpis.length > 0 && <HeroRow kpis={kpis} cols={6} />}

      <ChartGrid>
        <ChartCard titulo="Faturamento semanal" subtitulo="realizado × meta (R$263k)" span={2}>
          <GraficoBase tipo="linha" data={data} xKey="periodo" formatY={moneyK} height={320}
            series={[{ key: 'fat', label: 'Faturamento' }, { key: 'meta', label: 'Meta' }]} />
        </ChartCard>

        <ChartCard titulo="Ticket médio decomposto" subtitulo="entrada (couvert) + bar por semana">
          <GraficoBase tipo="barra" stacked data={data} xKey="periodo" formatY={(v) => `R$${Math.round(v)}`} height={320}
            series={[{ key: 'tm_ent', label: 'Couvert' }, { key: 'tm_bar', label: 'Bar' }]} />
        </ChartCard>

        <ChartCard titulo="Composição do faturamento" subtitulo="Couvert · Bar · Comível por semana">
          <GraficoBase tipo="area" stacked data={data} xKey="periodo" formatY={moneyK} height={320}
            series={[{ key: 'couvert', label: 'Couvert' }, { key: 'bar', label: 'Bar' }, { key: 'cmvivel', label: 'Comível' }]} />
        </ChartCard>

        <ChartCard titulo="Mix de vendas" subtitulo="% Bebidas · Drinks · Comida por semana">
          <GraficoBase tipo="area" stacked data={data} xKey="periodo" formatY={pct} height={320}
            series={[{ key: 'beb', label: 'Bebidas' }, { key: 'drk', label: 'Drinks' }, { key: 'com', label: 'Comida' }]} />
        </ChartCard>

        <ChartCard titulo="Heatmap — faturamento por dia × hora" subtitulo="onde e quando a receita se concentra" span={2}>
          <GraficoHeatmap data={heatmap.cells} xs={heatmap.xs} ys={heatmap.ys} formatV={moneyK} height={320} />
        </ChartCard>

        {temStockout && (
        <ChartCard titulo="Stockout por área" subtitulo="% de ruptura de estoque (Bar · Comidas · Drinks)">
          <GraficoBase tipo="linha" data={data} xKey="periodo" formatY={pct} height={320}
            series={[{ key: 'so_bar', label: 'Bar' }, { key: 'so_com', label: 'Comidas' }, { key: 'so_drk', label: 'Drinks' }]} />
        </ChartCard>)}

        <ChartCard titulo="Reservas — reservadas × presentes" subtitulo="pessoas por semana (gap = quebra/no-show)">
          <GraficoBase tipo="barra" data={data} xKey="periodo" formatY={num} height={320}
            series={[{ key: 'res_tot', label: 'Reservadas' }, { key: 'res_pres', label: 'Presentes' }]} />
        </ChartCard>

        <ChartCard titulo="Público — atendidos × base ativa" subtitulo="clientes por semana">
          <GraficoBase tipo="barra" data={data} xKey="periodo" formatY={num} height={320}
            series={[{ key: 'publico', label: 'Atendidos' }, { key: 'ativos', label: 'Ativos' }]} />
        </ChartCard>

        <ChartCard titulo="Antecipação da receita" subtitulo="% Happy Hour · % faturamento até 19h">
          <GraficoBase tipo="linha" data={data} xKey="periodo" formatY={pct} height={320}
            series={[{ key: 'hh', label: 'Happy Hour' }, { key: 'ate19', label: 'Até 19h' }]} />
        </ChartCard>

        {temNps && (
        <ChartCard titulo="NPS geral por semana" subtitulo="satisfação do público ao longo do tempo">
          <GraficoBase tipo="linha" data={data.filter((d) => d.nps != null && d.nps !== 0)} xKey="periodo" formatY={(v) => `${Math.round(v)}`} height={320}
            series={[{ key: 'nps', label: 'NPS' }]} />
        </ChartCard>)}
      </ChartGrid>
    </div>
  );
}
