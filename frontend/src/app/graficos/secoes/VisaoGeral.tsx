'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { GraficoBase } from '@/components/graficos/GraficoBase';
import { HeroRow, ChartCard, ChartGrid, GraficoGauge, type Kpi } from '@/components/graficos/Charts';
import { DollarSign, TrendingUp, Percent, CalendarDays, Boxes, Wallet, Loader2 } from 'lucide-react';

const anoAtual = new Date().getFullYear();
const mesAtual = new Date().getMonth() + 1;
const money = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const moneyK = (v: number) => `${v < 0 ? '-' : ''}R$ ${Math.abs(Math.round((v || 0) / 1000))}k`;
const pct = (v: number) => `${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const asPct = (v: number) => (Math.abs(v) <= 1.5 ? v * 100 : v); // margem pode vir 0-1 ou 0-100

export function SecaoVisaoGeral({ barId }: { barId: number; periodo: number }) {
  const [ano, setAno] = useState(anoAtual);
  const [painel, setPainel] = useState<any>(null);
  const [meses, setMeses] = useState<any[]>([]);
  const [sem, setSem] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [p, m, s] = await Promise.all([
        api.get(`/api/estrategico/painel-executivo?bar_id=${barId}`).catch(() => null),
        api.get(`/api/estrategico/orcamentacao/todos-meses?bar_id=${barId}&ano=${ano}&quantidade=12`).catch(() => null),
        api.get(`/api/graficos/desempenho?semanas=16&bar_id=${barId}`).catch(() => null),
      ]);
      setPainel(p && (p.dre || p.cmv || p.rfm) ? p : null);
      setMeses(m?.success ? (m.data || []) : []);
      setSem(s?.success ? (s.semanas || []) : []);
    } catch { setPainel(null); setMeses([]); setSem([]); }
    finally { setLoading(false); }
  }, [barId, ano]);
  useEffect(() => { carregar(); }, [carregar]);

  const mesData = useMemo(() => meses.map((m: any) => {
    const t = m.totais || {};
    const completo = (ano < anoAtual) || (Number(m.mes) < mesAtual);
    const fatReal = Number(t.faturamento_meta_real) || 0;
    const lucReal = Number(t.ebitda_real) || 0;
    return {
      mes: String(m.label || '').slice(0, 3),
      fatReal: completo && fatReal > 0 ? fatReal : null,
      fatMeta: Number(t.faturamento_meta_plan) || 0,
      lucroReal: completo && (fatReal > 0) ? lucReal : null,
      lucroMeta: Number(t.ebitda_plan) || 0,
      margem: completo && fatReal > 0 ? +asPct(Number(t.margem_ebitda_real) || 0).toFixed(1) : null,
    };
  }), [meses, ano]);

  const semData = useMemo(() => {
    const hojeISO = new Date().toISOString().slice(0, 10);
    return sem.filter((s) => !s.data_fim || s.data_fim < hojeISO).map((s) => ({
      periodo: s.periodo || `S${s.numero_semana}`, fat: Number(s.faturamento_total) || 0, meta: 263000,
    }));
  }, [sem]);

  const cmvPct = painel?.cmv?.pct != null ? asPct(Number(painel.cmv.pct)) : null;
  const cmvMeta = painel?.cmv?.meta != null ? asPct(Number(painel.cmv.meta)) : null;

  const kpis: Kpi[] = useMemo(() => {
    const dre = painel?.dre; const fluxo = painel?.fluxo;
    const margem = dre?.margem_ytd != null ? asPct(Number(dre.margem_ytd)) : null;
    return [
      { label: 'Receita YTD', valor: dre ? money(dre.receita_ytd) : '—', icon: DollarSign },
      { label: 'Resultado YTD', valor: dre ? money(dre.lucro_ytd) : '—', cor: dre && dre.lucro_ytd < 0 ? '#e34948' : undefined, icon: TrendingUp },
      { label: 'Margem YTD', valor: margem != null ? pct(margem) : '—', icon: Percent },
      { label: 'Faturamento do mês', valor: dre ? money(dre.faturamento_mes) : '—', sub: dre ? `resultado ${moneyK(dre.lucro_mes)}` : undefined, icon: CalendarDays },
      { label: 'CMV', valor: cmvPct != null ? pct(cmvPct) : '—', sub: cmvMeta != null ? `meta ${pct(cmvMeta)}` : undefined, invLower: true, icon: Boxes },
      { label: 'Caixa projetado 90d', valor: fluxo?.saldo90_base != null ? moneyK(fluxo.saldo90_base) : '—', cor: fluxo?.aperta ? '#f0a020' : undefined, icon: Wallet },
    ];
  }, [painel, cmvPct, cmvMeta]);

  if (loading) return <div className="py-20 text-center text-gray-400"><Loader2 className="w-7 h-7 animate-spin mx-auto" /></div>;
  if (!painel && !mesData.length && !semData.length) return <div className="py-20 text-center text-gray-400">Sem dados executivos para este bar.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Ano</span>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-8 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">
          {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <HeroRow kpis={kpis} cols={6} />

      <ChartGrid>
        <ChartCard titulo="Faturamento mensal" subtitulo="realizado (Conta Azul) × meta empilhada dos eventos" span={2}>
          <GraficoBase tipo="linha" data={mesData} xKey="mes" formatY={moneyK} height={330}
            series={[{ key: 'fatReal', label: 'Realizado' }, { key: 'fatMeta', label: 'Meta' }]} />
        </ChartCard>

        {cmvPct != null && (
        <ChartCard titulo="CMV — realizado × meta" subtitulo="quanto menor, melhor">
          <GraficoGauge valor={+cmvPct.toFixed(1)} max={Math.max(50, Math.ceil((cmvMeta || 40) * 1.3))} alvo={cmvMeta || undefined} cor={cmvMeta != null && cmvPct > cmvMeta ? '#e34948' : '#1baf7a'} height={330} />
        </ChartCard>)}

        <ChartCard titulo="Resultado líquido mensal" subtitulo="realizado × meta (Lucro Líquido)" span={2}>
          <GraficoBase tipo="barra" data={mesData} xKey="mes" formatY={moneyK} height={320}
            series={[{ key: 'lucroReal', label: 'Realizado' }, { key: 'lucroMeta', label: 'Meta' }]} />
        </ChartCard>

        <ChartCard titulo="Margem líquida" subtitulo="% de lucro sobre o faturamento por mês">
          <GraficoBase tipo="linha" data={mesData.filter((m) => m.margem != null)} xKey="mes" formatY={pct} height={320}
            series={[{ key: 'margem', label: 'Margem' }]} />
        </ChartCard>

        <ChartCard titulo="Faturamento semanal recente" subtitulo="pulso operacional — últimas semanas × meta" span={3}>
          <GraficoBase tipo="linha" data={semData} xKey="periodo" formatY={moneyK} height={300}
            series={[{ key: 'fat', label: 'Faturamento' }, { key: 'meta', label: 'Meta' }]} />
        </ChartCard>
      </ChartGrid>
    </div>
  );
}
