'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { GraficoBase } from '@/components/graficos/GraficoBase';
import { HeroRow, ChartCard, ChartGrid, GraficoBarraH, GraficoDonut, GraficoRadar, type Kpi } from '@/components/graficos/Charts';
import { Users, UserPlus, UserMinus, Repeat, Smile, HeartPulse, Loader2 } from 'lucide-react';

const money = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const moneyK = (v: number) => `${v < 0 ? '-' : ''}R$ ${Math.abs(Math.round((v || 0) / 1000))}k`;
const pct = (v: number) => `${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const num = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');
const segSemana = (iso: string) => { const d = new Date(iso + 'T12:00:00'); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d.toISOString().slice(0, 10); };
const ddmm = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');

export function SecaoRh({ barId, periodo }: { barId: number; periodo: number }) {
  const [ind, setInd] = useState<any>(null);
  const [dash, setDash] = useState<any>(null);
  const [enps, setEnps] = useState<any>(null);
  const [custo, setCusto] = useState<any[]>([]);
  const [equipe, setEquipe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const de = new Date(); de.setDate(de.getDate() - periodo * 30);
    const deStr = de.toISOString().slice(0, 10); const ateStr = new Date().toISOString().slice(0, 10);
    try {
      const [i, d, e, c, q] = await Promise.all([
        api.get('/api/rh/indicadores').catch(() => null),
        api.get('/api/rh/funcionarios/dashboard').catch(() => null),
        api.get('/api/rh/enps').catch(() => null),
        api.get(`/api/rh/custo-mo?inicio=${deStr}&fim=${ateStr}`).catch(() => null),
        api.get(`/api/exploracao/equipe?bar_id=${barId}`).catch(() => null),
      ]);
      setInd(i?.success ? i : null);
      setDash(d?.success ? d : null);
      setEnps(e?.success ? e : null);
      setCusto(c?.success ? (c.linhas || []) : []);
      setEquipe(q?.success ? q.exploracao : null);
    } catch { setInd(null); setDash(null); setEnps(null); setCusto([]); setEquipe(null); }
    finally { setLoading(false); }
  }, [barId, periodo]);
  useEffect(() => { carregar(); }, [carregar]);

  const meses = useMemo(() => (ind?.meses || []).map((m: any) => ({
    label: m.label, admissoes: Number(m.admissoes) || 0, demissoes: Number(m.demissoes) || 0,
    headcount: Number(m.headcount) || 0, turnover: Number(m.turnover) || 0,
    faltas: Number(m.faltas) || 0, atestados: Number(m.atestados) || 0,
  })), [ind]);

  const porArea = useMemo(() => (dash?.headcount?.por_area || []).map((a: any) => ({ area: a.area || '—', n: Number(a.n) || 0 })), [dash]);
  const porTipo = useMemo(() => {
    const t = dash?.headcount?.por_tipo || {};
    return Object.entries(t).map(([tipo, n]) => ({ tipo, n: Number(n) || 0 })).filter((x) => x.n > 0);
  }, [dash]);

  const felic = dash?.felicidade;
  const radarFelic = useMemo(() => {
    const dims = felic?.dimensoes || [];
    if (!dims.length) return null;
    const valores = dims.map((d: any) => Number(d.valor) || 0);
    const mx = Math.max(...valores, 0);
    const escala = mx > 10 ? 100 : mx > 5 ? 10 : 5;
    return { indicadores: dims.map((d: any) => ({ nome: d.label, max: escala })), valores };
  }, [felic]);
  const trendFelic = useMemo(() => (felic?.trend || []).map((t: any) => ({ data: ddmm(String(t.data).slice(0, 10)), pct: Number(t.pct) || 0 })), [felic]);

  const enpsDist = useMemo(() => {
    if (!enps || !enps.total) return [];
    return [
      { nome: 'Promotores', v: Number(enps.promotores) || 0 },
      { nome: 'Neutros', v: Number(enps.neutros) || 0 },
      { nome: 'Detratores', v: Number(enps.detratores) || 0 },
    ].filter((x) => x.v > 0);
  }, [enps]);

  // custo MO diário → semanal (freelas + fixo)
  const custoSemana = useMemo(() => {
    const by = new Map<string, { freelas: number; fixo: number }>();
    for (const l of custo) { const k = segSemana(String(l.data).slice(0, 10)); if (!by.has(k)) by.set(k, { freelas: 0, fixo: 0 }); const o = by.get(k)!; o.freelas += Number(l.freelas_custo) || 0; o.fixo += Number(l.fixo_estimado) || 0; }
    return [...by.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([k, o]) => ({ periodo: ddmm(k), freelas: Math.round(o.freelas), fixo: Math.round(o.fixo) }));
  }, [custo]);

  const temTurnover = useMemo(() => meses.some((m: any) => m.turnover > 0), [meses]);
  const temAbsenteismo = useMemo(() => meses.some((m: any) => m.faltas > 0 || m.atestados > 0), [meses]);
  const temCusto = useMemo(() => custoSemana.some((c) => c.freelas > 0 || c.fixo > 0), [custoSemana]);

  const produtividade = useMemo(() => (equipe?.ranking_funcionarios || [])
    .filter((r: any) => Number(r.total_checklists) > 0)
    .map((r: any) => ({ nome: String(r.nome || '—').split(' ').slice(0, 2).join(' '), taxa: +(Number(r.taxa_conclusao) || 0).toFixed(0) }))
    .sort((a: any, b: any) => b.taxa - a.taxa).slice(0, 12), [equipe]);

  const kpis: Kpi[] = useMemo(() => {
    const r = ind?.resumo || {}; const hc = dash?.headcount;
    return [
      { label: 'Headcount ativo', valor: num(hc?.ativos ?? r.headcount_atual ?? 0), sub: hc ? `${num(hc.inativos || 0)} inativos` : undefined, icon: Users },
      { label: 'Tempo de casa médio', valor: hc?.tempo_casa_medio_meses != null ? `${num(hc.tempo_casa_medio_meses)} m` : '—', icon: Repeat },
      { label: 'Turnover 12m', valor: pct(r.turnover_12m || 0), invLower: true, icon: UserMinus },
      { label: 'Admissões 12m', valor: num(r.admissoes_12m || 0), icon: UserPlus },
      { label: 'Felicidade', valor: felic?.pct != null ? pct(felic.pct) : '—', sub: felic?.respostas ? `${num(felic.respostas)} respostas` : undefined, icon: Smile },
      { label: 'eNPS', valor: enps?.enps != null ? num(enps.enps) : '—', sub: enps?.total ? `${num(enps.total)} pulsos` : undefined, icon: HeartPulse },
    ];
  }, [ind, dash, felic, enps]);

  if (loading) return <div className="py-20 text-center text-gray-400"><Loader2 className="w-7 h-7 animate-spin mx-auto" /></div>;
  if (!ind && !dash) return <div className="py-20 text-center text-gray-400">Sem dados de RH para este bar.</div>;

  return (
    <div className="space-y-4">
      <HeroRow kpis={kpis} cols={6} />

      <ChartGrid>
        <ChartCard titulo="Admissões × Demissões" subtitulo="movimentação de pessoas por mês (12 meses)" span={2}>
          <GraficoBase tipo="barra" data={meses} xKey="label" formatY={num} height={320} cores={['#1baf7a', '#e34948']}
            series={[{ key: 'admissoes', label: 'Admissões' }, { key: 'demissoes', label: 'Demissões' }]} />
        </ChartCard>

        {porTipo.length >= 2 && (
        <ChartCard titulo="Headcount por tipo de contrato" subtitulo="CLT · PJ · Freela (ativos hoje)">
          <GraficoDonut data={porTipo} nameKey="tipo" valueKey="n" formatV={num} height={320} centro={num((porTipo).reduce((s: number, t: any) => s + t.n, 0))} />
        </ChartCard>)}

        <ChartCard titulo="Evolução do headcount" subtitulo="nº de pessoas ativas ao fim de cada mês">
          <GraficoBase tipo="area" data={meses} xKey="label" formatY={num} height={320} series={[{ key: 'headcount', label: 'Headcount' }]} />
        </ChartCard>

        {temTurnover && (
        <ChartCard titulo="Turnover mensal" subtitulo="% de rotatividade da equipe por mês">
          <GraficoBase tipo="linha" data={meses} xKey="label" formatY={pct} height={320} series={[{ key: 'turnover', label: 'Turnover' }]} />
        </ChartCard>)}

        <ChartCard titulo="Headcount por área" subtitulo="quantas pessoas em cada setor">
          <GraficoBarraH data={porArea} xKey="area" valueKey="n" formatV={num} height={320} />
        </ChartCard>

        {temAbsenteismo && (
        <ChartCard titulo="Absenteísmo" subtitulo="faltas e atestados por mês">
          <GraficoBase tipo="barra" stacked data={meses} xKey="label" formatY={num} height={320}
            series={[{ key: 'faltas', label: 'Faltas' }, { key: 'atestados', label: 'Atestados' }]} />
        </ChartCard>)}

        {temCusto && (
        <ChartCard titulo="Custo de mão de obra" subtitulo="freelas × fixo estimado por semana" span={2}>
          <GraficoBase tipo="barra" stacked data={custoSemana} xKey="periodo" formatY={moneyK} height={320}
            series={[{ key: 'freelas', label: 'Freelas' }, { key: 'fixo', label: 'Fixo estimado' }]} />
        </ChartCard>)}

        {radarFelic && (
        <ChartCard titulo="Clima — dimensões da felicidade" subtitulo="média por dimensão da pesquisa interna">
          <GraficoRadar indicadores={radarFelic.indicadores} series={[{ nome: 'Felicidade', valores: radarFelic.valores }]} height={320} />
        </ChartCard>)}

        {trendFelic.length > 1 && (
        <ChartCard titulo="Felicidade ao longo do tempo" subtitulo="% de satisfação por pesquisa">
          <GraficoBase tipo="linha" data={trendFelic} xKey="data" formatY={pct} height={320} series={[{ key: 'pct', label: 'Felicidade' }]} />
        </ChartCard>)}

        {enpsDist.length > 0 && (
        <ChartCard titulo="eNPS — composição" subtitulo="promotores · neutros · detratores (90 dias)">
          <GraficoDonut data={enpsDist} nameKey="nome" valueKey="v" formatV={num} cores={['#1baf7a', '#c7cdd6', '#e34948']} height={320}
            centro={enps?.enps != null ? `${num(enps.enps)}` : undefined} />
        </ChartCard>)}

        {produtividade.length > 0 && (
        <ChartCard titulo="Produtividade da equipe" subtitulo="% de conclusão de checklists por pessoa (90 dias)" span={2}>
          <GraficoBarraH data={produtividade} xKey="nome" valueKey="taxa" formatV={pct} height={340} maxItens={12} />
        </ChartCard>)}
      </ChartGrid>
    </div>
  );
}
