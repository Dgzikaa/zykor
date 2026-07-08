'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { GraficoBase } from '@/components/graficos/GraficoBase';
import { HeroRow, ChartCard, ChartGrid, GraficoBarraH, GraficoDonut, GraficoHeatmap, GraficoScatter, type Kpi } from '@/components/graficos/Charts';
import { Users, UserPlus, Repeat, Crown, AlertTriangle, Gem, Loader2 } from 'lucide-react';

const money = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const moneyK = (v: number) => `${v < 0 ? '-' : ''}R$ ${Math.abs(Math.round((v || 0) / 1000))}k`;
const pct = (v: number) => `${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const num = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');
const mesLabel = (iso: string) => { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); return d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + '/' + String(d.getFullYear()).slice(2); };

const NIVEL_ORDEM = ['bronze', 'prata', 'ouro', 'diamante', 'platina'];

export function SecaoCrm({ barId, periodo }: { barId: number; periodo: number }) {
  const [evo, setEvo] = useState<any[]>([]);
  const [coorte, setCoorte] = useState<any[]>([]);
  const [rfm, setRfm] = useState<any[]>([]);
  const [ltv, setLtv] = useState<any>(null);
  const [churn, setChurn] = useState<any>(null);
  const [clube, setClube] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // core enxuto (RPC rápidos) — renderiza sem esperar os pesados
  const carregar = useCallback(async () => {
    setLoading(true);
    const mesesN = Math.max(6, Math.min(24, periodo));
    try {
      const [e, c, r, cl] = await Promise.all([
        api.get(`/api/clientes-ativos/evolucao?bar_id=${barId}&meses=${mesesN}`).catch(() => null),
        api.get(`/api/analitico/clientes/retencao?meses=${Math.min(12, mesesN)}`).catch(() => null),
        api.get(`/api/analitico/clientes/rfm?bar_id=${barId}`).catch(() => null),
        api.get(`/api/crm/clube?bar_id=${barId}&limit=1`).catch(() => null),
      ]);
      setEvo(e?.success ? (e.data || []) : []);
      setCoorte(c?.success ? (c.data || []) : []);
      setRfm(r?.success ? (r.resumo || []) : []);
      setClube(cl?.success ? cl : null);
    } catch { setEvo([]); setCoorte([]); setRfm([]); setClube(null); }
    finally { setLoading(false); }
  }, [barId, periodo]);
  useEffect(() => { carregar(); }, [carregar]);

  // pesados (varrem `visitas`) — carregam depois, sem bloquear a seção
  useEffect(() => {
    let vivo = true;
    setLtv(null); setChurn(null);
    (async () => {
      const [l, ch] = await Promise.all([
        api.get(`/api/crm/ltv-engajamento?bar_id=${barId}`).catch(() => null),
        api.get(`/api/crm/churn-prediction?bar_id=${barId}&limit=1`).catch(() => null),
      ]);
      if (!vivo) return;
      setLtv(l?.success ? l.stats : null);
      setChurn(ch?.success ? ch.stats : null);
    })();
    return () => { vivo = false; };
  }, [barId]);

  const evoData = useMemo(() => {
    const hojeMes = new Date().toISOString().slice(0, 7); // descarta mês corrente parcial (zera base ativa)
    return evo.filter((m) => String(m.mes || '').slice(0, 7) < hojeMes).map((m) => ({
      mes: m.mesLabel || m.mes, novos: Number(m.novosClientes) || 0, retornantes: Number(m.clientesRetornantes) || 0,
      base: Number(m.baseAtiva) || 0, total: Number(m.totalClientes) || 0, pctNovos: Number(m.percentualNovos) || 0,
    }));
  }, [evo]);

  // heatmap de retenção: linhas = coorte (mês entrada), colunas = mes_offset, valor = % retenção
  const heat = useMemo(() => {
    if (!coorte.length) return { xs: [], ys: [], cells: [] as [number, number, number][] };
    const coortes = [...new Set(coorte.map((c) => String(c.coorte).slice(0, 10)))].sort();
    const offs = [...new Set(coorte.map((c) => Number(c.mes_offset)))].sort((a, b) => a - b);
    const base = new Map<string, number>();
    for (const c of coorte) { if (Number(c.mes_offset) === 0) base.set(String(c.coorte).slice(0, 10), Number(c.clientes) || 0); }
    const xi = new Map(offs.map((o, i) => [o, i])); const yi = new Map(coortes.map((c, i) => [c, i]));
    const cells = coorte.map((c) => {
      const co = String(c.coorte).slice(0, 10); const bs = base.get(co) || 0;
      const r = bs > 0 ? (Number(c.clientes) / bs) * 100 : 0;
      return [xi.get(Number(c.mes_offset)) ?? -1, yi.get(co) ?? -1, +r.toFixed(1)] as [number, number, number];
    }).filter((c) => c[0] >= 0 && c[1] >= 0);
    return { xs: offs.map((o) => `M${o}`), ys: coortes.map(mesLabel), cells };
  }, [coorte]);

  const rfmData = useMemo(() => rfm.map((s: any) => ({
    segmento: s.segmento, clientes: Number(s.clientes) || 0, valor: Number(s.valor_total) || 0,
    recencia: Number(s.recencia_media) || 0, frequencia: Number(s.frequencia_media) || 0, ticket: Number(s.ticket_medio) || 0,
  })), [rfm]);

  const engaj = useMemo(() => {
    if (!ltv) return [];
    return [
      { nome: 'Muito alto', v: Number(ltv.engajamento_muito_alto) || 0 },
      { nome: 'Alto', v: Number(ltv.engajamento_alto) || 0 },
      { nome: 'Médio', v: Number(ltv.engajamento_medio) || 0 },
      { nome: 'Baixo', v: Number(ltv.engajamento_baixo) || 0 },
    ].filter((x) => x.v > 0);
  }, [ltv]);

  const risco = useMemo(() => {
    if (!churn) return [];
    return [
      { nome: 'Crítico', v: Number(churn.critico) || 0 },
      { nome: 'Alto', v: Number(churn.alto) || 0 },
      { nome: 'Médio', v: Number(churn.medio) || 0 },
      { nome: 'Baixo', v: Number(churn.baixo) || 0 },
    ].filter((x) => x.v > 0);
  }, [churn]);

  const clubeNivel = useMemo(() => {
    const pn = clube?.por_nivel || {};
    return Object.entries(pn).map(([nivel, n]) => ({ nivel, n: Number(n) || 0 }))
      .filter((x) => x.n > 0 && x.nivel !== 'sem_nivel')
      .sort((a, b) => (NIVEL_ORDEM.indexOf(a.nivel) - NIVEL_ORDEM.indexOf(b.nivel)));
  }, [clube]);
  const clubeSeg = useMemo(() => {
    const ps = clube?.por_segmento || {};
    return Object.entries(ps).map(([segmento, n]) => ({ segmento, n: Number(n) || 0 })).filter((x) => x.n > 0);
  }, [clube]);

  const kpis: Kpi[] = useMemo(() => {
    const u = evoData[evoData.length - 1] || {}; const p = evoData[evoData.length - 2] || {};
    const campeoes = rfmData.find((s) => /campe/i.test(s.segmento));
    const emRisco = rfmData.find((s) => /risco/i.test(s.segmento));
    const d = (a?: number, b?: number) => (a != null && b ? ((a - b) / Math.abs(b)) * 100 : null);
    return [
      { label: 'Base ativa', valor: num(u.base || 0), delta: d(u.base, p.base), icon: Users },
      { label: 'Novos no mês', valor: num(u.novos || 0), sub: u.pctNovos ? `${pct(u.pctNovos)} do total` : undefined, icon: UserPlus },
      { label: 'Retornantes no mês', valor: num(u.retornantes || 0), delta: d(u.retornantes, p.retornantes), icon: Repeat },
      { label: 'Campeões (RFM)', valor: campeoes ? num(campeoes.clientes) : '—', sub: campeoes ? money(campeoes.valor) : undefined, icon: Crown },
      { label: 'Em risco (RFM)', valor: emRisco ? num(emRisco.clientes) : '—', sub: emRisco ? money(emRisco.valor) : undefined, cor: '#f0a020', icon: AlertTriangle },
      { label: 'LTV médio', valor: ltv?.ltv_medio_atual != null ? money(ltv.ltv_medio_atual) : '—', sub: ltv?.clientes_confiaveis ? `${num(ltv.clientes_confiaveis)} confiáveis` : undefined, icon: Gem },
    ];
  }, [evoData, rfmData, ltv]);

  if (loading) return <div className="py-20 text-center text-gray-400"><Loader2 className="w-7 h-7 animate-spin mx-auto" /></div>;
  if (!evoData.length && !rfmData.length) return <div className="py-20 text-center text-gray-400">Sem dados de clientes para este bar.</div>;

  return (
    <div className="space-y-4">
      <HeroRow kpis={kpis} cols={6} />

      <ChartGrid>
        <ChartCard titulo="Novos × Retornantes por mês" subtitulo="composição da base atendida ao longo do tempo" span={2}>
          <GraficoBase tipo="barra" stacked data={evoData} xKey="mes" formatY={num} height={330}
            series={[{ key: 'novos', label: 'Novos' }, { key: 'retornantes', label: 'Retornantes' }]} />
        </ChartCard>

        <ChartCard titulo="Segmentação RFM" subtitulo="clientes por segmento de valor">
          <GraficoBarraH data={[...rfmData].sort((a, b) => b.clientes - a.clientes)} xKey="segmento" valueKey="clientes" formatV={num} height={330} />
        </ChartCard>

        <ChartCard titulo="Mapa de comportamento RFM" subtitulo="recência × frequência · bolha = nº de clientes" span={2}>
          <GraficoScatter data={rfmData} xKey="recencia" yKey="frequencia" sizeKey="clientes" nameKey="segmento" height={330}
            xLabel="Recência média (dias)" yLabel="Frequência média" formatX={(v) => `${Math.round(v)}d`} formatY={(v) => v.toFixed(1)} />
        </ChartCard>

        <ChartCard titulo="Valor por segmento" subtitulo="R$ acumulado por segmento RFM">
          <GraficoBarraH data={[...rfmData].sort((a, b) => b.valor - a.valor)} xKey="segmento" valueKey="valor" formatV={moneyK} height={330} />
        </ChartCard>

        <ChartCard titulo="Retenção por coorte" subtitulo="% que voltou X meses após a 1ª visita (por mês de entrada)" span={2}>
          <GraficoHeatmap data={heat.cells} xs={heat.xs} ys={heat.ys} formatV={pct} height={340} />
        </ChartCard>

        <ChartCard titulo="Base ativa por mês" subtitulo="clientes ativos ao longo do tempo">
          <GraficoBase tipo="area" data={evoData} xKey="mes" formatY={num} height={330} series={[{ key: 'base', label: 'Base ativa' }]} />
        </ChartCard>

        {engaj.length > 0 && (
        <ChartCard titulo="Engajamento da base" subtitulo="distribuição por nível de engajamento (LTV)">
          <GraficoDonut data={engaj} nameKey="nome" valueKey="v" formatV={num} height={330}
            cores={['#1baf7a', '#4a9de6', '#e6c34a', '#c7cdd6']} centro={num(engaj.reduce((s, x) => s + x.v, 0))} />
        </ChartCard>)}

        {risco.length > 0 && (
        <ChartCard titulo="Risco de churn" subtitulo="clientes por nível de risco de abandono">
          <GraficoDonut data={risco} nameKey="nome" valueKey="v" formatV={num} height={330}
            cores={['#e34948', '#f0a020', '#e6c34a', '#1baf7a']}
            centro={churn?.valor_total_em_risco ? moneyK(churn.valor_total_em_risco) : undefined} />
        </ChartCard>)}

        {clubeNivel.length > 0 && (
        <ChartCard titulo="Clube — membros por nível" subtitulo="fidelização por tier (exclui sem nível)">
          <GraficoBarraH data={clubeNivel} xKey="nivel" valueKey="n" formatV={num} height={330} cor="#c9a227" />
        </ChartCard>)}

        {clubeSeg.length > 0 && (
        <ChartCard titulo="Clube — por segmento" subtitulo="membros do clube por estágio de relacionamento">
          <GraficoDonut data={clubeSeg} nameKey="segmento" valueKey="n" formatV={num} height={330}
            centro={clube?.total_membros ? num(clube.total_membros) : undefined} />
        </ChartCard>)}
      </ChartGrid>
    </div>
  );
}
