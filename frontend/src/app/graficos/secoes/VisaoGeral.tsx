'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { GraficoBase } from '@/components/graficos/GraficoBase';
import { HeroRow, ChartCard, ChartGrid, type Kpi } from '@/components/graficos/Charts';
import { DollarSign, TrendingUp, Percent, CalendarDays, Boxes, Wallet, Loader2 } from 'lucide-react';

const anoAtual = new Date().getFullYear();
const mesAtual = new Date().getMonth() + 1;
const money = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const moneyK = (v: number) => `${v < 0 ? '-' : ''}R$ ${Math.abs(Math.round((v || 0) / 1000))}k`;
const pct = (v: number) => `${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const num = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');
const asPct = (v: number) => (Math.abs(v) <= 1.5 ? v * 100 : v);
const mesCurto = (m: number) => new Date(2000, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
const mesNum = (v: any) => { const s = String(v ?? ''); return s.includes('-') ? Number(s.slice(5, 7)) : Number(s); };

export function SecaoVisaoGeral({ barId }: { barId: number; periodo: number }) {
  const [ano, setAno] = useState(anoAtual);
  const [painel, setPainel] = useState<any>(null);
  const [dre, setDre] = useState<any[]>([]);
  const [sem, setSem] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [p, d, s] = await Promise.all([
        api.get(`/api/estrategico/painel-executivo?bar_id=${barId}`).catch(() => null),
        api.get(`/api/estrategico/orcamentacao/dre-excel?bar_id=${barId}&ano=${ano}`).catch(() => null),
        api.get(`/api/graficos/desempenho?semanas=62&bar_id=${barId}`).catch(() => null),
      ]);
      setPainel(p && (p.dre || p.cmv || p.rfm) ? p : null);
      setDre(d?.linhas || []);
      setSem(s?.success ? (s.semanas || []) : []);
    } catch { setPainel(null); setDre([]); setSem([]); }
    finally { setLoading(false); }
  }, [barId, ano]);
  useEffect(() => { carregar(); }, [carregar]);

  const fechado = useCallback((m: number) => (ano < anoAtual) || (ano === anoAtual && m < mesAtual), [ano]);

  // Receita × Resultado por mês (ordem_macro<=9 = resultado operacional; meses fechados)
  const dreMes = useMemo(() => {
    const porMes = new Map<number, { receita: number; resultado: number }>();
    for (const l of dre) {
      const m = mesNum(l.mes); if (!m) continue; const om = Number(l.ordem_macro); if (om > 9) continue;
      if (!porMes.has(m)) porMes.set(m, { receita: 0, resultado: 0 });
      const v = Number(l.valor_com_sinal || 0); const o = porMes.get(m)!; o.resultado += v; if (om === 1) o.receita += v;
    }
    return Array.from(porMes.entries()).filter(([m]) => fechado(m)).sort((a, b) => a[0] - b[0])
      .map(([m, o]) => ({ mes: mesCurto(m), receita: Math.round(o.receita), resultado: Math.round(o.resultado) }));
  }, [dre, fechado]);

  // agregação do desempenho semanal → mensal (público + composição). Descarta mês corrente parcial.
  const mesOperacional = useMemo(() => {
    const hojeMes = `${anoAtual}-${String(mesAtual).padStart(2, '0')}`;
    const by = new Map<string, { fat: number; couvert: number; bar: number; comivel: number; publico: number }>();
    for (const s of sem) {
      const ym = String(s.data_fim || '').slice(0, 7); if (!ym || ym >= hojeMes) continue;
      if (!by.has(ym)) by.set(ym, { fat: 0, couvert: 0, bar: 0, comivel: 0, publico: 0 });
      const o = by.get(ym)!;
      o.fat += Number(s.faturamento_total) || 0; o.couvert += Number(s.faturamento_entrada) || 0;
      o.bar += Number(s.faturamento_bar) || 0; o.comivel += Number(s.faturamento_cmvivel) || 0;
      o.publico += Number(s.clientes_atendidos) || 0;
    }
    return [...by.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([ym, o]) => ({
      mes: mesCurto(Number(ym.slice(5, 7))), fat: Math.round(o.fat), couvert: Math.round(o.couvert),
      bar: Math.round(o.bar), comivel: Math.round(o.comivel), publico: o.publico,
    }));
  }, [sem]);

  const semData = useMemo(() => {
    const hojeISO = new Date().toISOString().slice(0, 10);
    return sem.filter((s) => !s.data_fim || s.data_fim < hojeISO).slice(-16).map((s) => ({
      periodo: s.periodo || `S${s.numero_semana}`, fat: Number(s.faturamento_total) || 0, meta: 263000,
    }));
  }, [sem]);

  const kpis: Kpi[] = useMemo(() => {
    const dreP = painel?.dre; const fluxo = painel?.fluxo; const cmv = painel?.cmv;
    const margem = dreP?.margem_ytd != null ? asPct(Number(dreP.margem_ytd)) : null;
    const cmvPct = cmv?.pct != null ? asPct(Number(cmv.pct)) : null;
    const cmvMeta = cmv?.meta != null ? asPct(Number(cmv.meta)) : null;
    return [
      { label: 'Receita YTD', valor: dreP ? money(dreP.receita_ytd) : '—', icon: DollarSign },
      { label: 'Resultado YTD', valor: dreP ? money(dreP.lucro_ytd) : '—', cor: dreP && dreP.lucro_ytd < 0 ? '#e34948' : undefined, icon: TrendingUp },
      { label: 'Margem YTD', valor: margem != null ? pct(margem) : '—', icon: Percent },
      { label: 'Faturamento do mês', valor: dreP ? money(dreP.faturamento_mes) : '—', sub: dreP ? `resultado ${moneyK(dreP.lucro_mes)}` : undefined, icon: CalendarDays },
      { label: 'CMV', valor: cmvPct != null ? pct(cmvPct) : '—', sub: cmvMeta != null ? `meta ${pct(cmvMeta)}` : undefined, invLower: true, icon: Boxes },
      { label: 'Caixa projetado 90d', valor: fluxo?.saldo90_base != null ? money(fluxo.saldo90_base) : '—', cor: fluxo?.aperta ? '#f0a020' : undefined, icon: Wallet },
    ];
  }, [painel]);

  if (loading) return <div className="py-20 text-center text-gray-400"><Loader2 className="w-7 h-7 animate-spin mx-auto" /></div>;
  if (!painel && !dreMes.length && !mesOperacional.length) return <div className="py-20 text-center text-gray-400">Sem dados executivos para este bar.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Ano</span>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-8 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">
          {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <HeroRow kpis={kpis} cols={6} />

      <ChartGrid>
        <ChartCard titulo="Receita × Resultado por mês" subtitulo="R$ por mês — resultado operacional (meses fechados)" span={2}>
          <GraficoBase tipo="linha" data={dreMes} xKey="mes" formatY={moneyK} height={330}
            series={[{ key: 'receita', label: 'Receita' }, { key: 'resultado', label: 'Resultado' }]} />
        </ChartCard>

        <ChartCard titulo="Público por mês" subtitulo="clientes atendidos (ContaHub)">
          <GraficoBase tipo="barra" data={mesOperacional} xKey="mes" formatY={num} height={330} series={[{ key: 'publico', label: 'Público' }]} />
        </ChartCard>

        <ChartCard titulo="Composição do faturamento por mês" subtitulo="Couvert · Bar · Comível" span={2}>
          <GraficoBase tipo="area" stacked data={mesOperacional} xKey="mes" formatY={moneyK} height={320}
            series={[{ key: 'couvert', label: 'Couvert' }, { key: 'bar', label: 'Bar' }, { key: 'comivel', label: 'Comível' }]} />
        </ChartCard>

        <ChartCard titulo="Faturamento semanal recente" subtitulo="pulso operacional — últimas 16 semanas × meta">
          <GraficoBase tipo="linha" data={semData} xKey="periodo" formatY={moneyK} height={320}
            series={[{ key: 'fat', label: 'Faturamento' }, { key: 'meta', label: 'Meta' }]} />
        </ChartCard>
      </ChartGrid>
    </div>
  );
}
