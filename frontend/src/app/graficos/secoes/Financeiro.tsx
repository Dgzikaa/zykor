'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { GraficoBase } from '@/components/graficos/GraficoBase';
import { HeroRow, ChartCard, ChartGrid, GraficoWaterfall, GraficoDonut, GraficoBarraH, type Kpi } from '@/components/graficos/Charts';
import { DollarSign, TrendingUp, Percent, Boxes, CreditCard, Loader2 } from 'lucide-react';

const anoAtual = new Date().getFullYear();
const money = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const moneyK = (v: number) => `${v < 0 ? '-' : ''}R$ ${Math.abs(Math.round((v || 0) / 1000))}k`;
const pct = (v: number) => `${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const mesCurto = (m: number) => new Date(2000, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' });
const norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function SecaoFinanceiro({ barId }: { barId: number; periodo: number }) {
  const [ano, setAno] = useState(anoAtual);
  const [dre, setDre] = useState<any[]>([]);
  const [dfc, setDfc] = useState<any[]>([]);
  const [stone, setStone] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const de = new Date(); de.setDate(de.getDate() - 90);
    try {
      const [d, f, s] = await Promise.all([
        api.get(`/api/estrategico/orcamentacao/dre-excel?bar_id=${barId}&ano=${ano}`),
        api.get(`/api/financeiro/dfc?bar_id=${barId}&ano=${ano}`),
        api.get(`/api/financeiro/conciliacao/analise?de=${de.toISOString().slice(0, 10)}&ate=${new Date().toISOString().slice(0, 10)}`).catch(() => null),
      ]);
      setDre(d?.linhas || []);
      setDfc(f?.linhas || []);
      setStone(s?.success ? s.analise : null);
    } catch { setDre([]); setDfc([]); setStone(null); }
    finally { setLoading(false); }
  }, [barId, ano]);
  useEffect(() => { carregar(); }, [carregar]);

  // DRE mensal (receita, resultado, %CMV, %Var, %MO)
  const dreMes = useMemo(() => {
    const porMes = new Map<number, any>();
    for (const l of dre) {
      const m = Number(l.mes); if (!m) continue;
      if (!porMes.has(m)) porMes.set(m, { receita: 0, resto: 0, cmv: 0, variaveis: 0, mo: 0 });
      const v = Number(l.valor_com_sinal || 0); const mac = norm(l.categoria_macro); const o = porMes.get(m);
      if (mac.includes('receita')) o.receita += v; else o.resto += v;
      if (mac.includes('cmv') || mac.includes('insumo')) o.cmv += Math.abs(v);
      if (mac.includes('variave')) o.variaveis += Math.abs(v);
      if (mac.includes('obra') || mac.includes('mao')) o.mo += Math.abs(v);
    }
    return Array.from(porMes.entries()).sort((a, b) => a[0] - b[0]).map(([m, o]) => ({
      mes: mesCurto(m), receita: Math.round(o.receita), resultado: Math.round(o.receita + o.resto),
      cmv_pct: o.receita > 0 ? +(o.cmv / o.receita * 100).toFixed(1) : 0,
      var_pct: o.receita > 0 ? +(o.variaveis / o.receita * 100).toFixed(1) : 0,
      mo_pct: o.receita > 0 ? +(o.mo / o.receita * 100).toFixed(1) : 0,
    }));
  }, [dre]);

  // DRE YTD por macro → waterfall + composição de despesas
  const { waterfall, despesas } = useMemo(() => {
    const mac = new Map<string, number>();
    for (const l of dre) { const k = String(l.categoria_macro || ''); mac.set(k, (mac.get(k) || 0) + Number(l.valor_com_sinal || 0)); }
    let receita = 0, cmv = 0, variaveis = 0, mo = 0, despFixas = 0;
    const despesas: { nome: string; valor: number }[] = [];
    for (const [k, v] of mac) {
      const n = norm(k);
      if (n.includes('receita')) receita += v;
      else if (n.includes('cmv') || n.includes('insumo')) cmv += Math.abs(v);
      else if (n.includes('variave')) variaveis += Math.abs(v);
      else if (n.includes('obra') || n.includes('mao')) mo += Math.abs(v);
      else if (n.includes('nao operac') || n.includes('investi') || n.includes('socio')) { /* fora do operacional */ }
      else { despFixas += Math.abs(v); if (Math.abs(v) > 0) despesas.push({ nome: k, valor: Math.abs(v) }); }
    }
    const resultado = receita - cmv - variaveis - mo - despFixas;
    const waterfall = [
      { nome: 'Receita', valor: Math.round(receita), tipo: 'total' as const },
      { nome: 'CMV', valor: -Math.round(cmv), tipo: 'delta' as const },
      { nome: 'Var.', valor: -Math.round(variaveis), tipo: 'delta' as const },
      { nome: 'Mão de obra', valor: -Math.round(mo), tipo: 'delta' as const },
      { nome: 'Despesas', valor: -Math.round(despFixas), tipo: 'delta' as const },
      { nome: 'Resultado', valor: Math.round(resultado), tipo: 'total' as const },
    ];
    return { waterfall, despesas: despesas.sort((a, b) => b.valor - a.valor) };
  }, [dre]);

  // DFC: net por grupo + caixa acumulado
  const { fluxo, caixa } = useMemo(() => {
    const porMes = new Map<number, any>();
    for (const l of dfc) {
      const m = Number(l.mes); if (!m) continue;
      if (!porMes.has(m)) porMes.set(m, { op: 0, inv: 0, fin: 0 });
      const g = norm(l.grupo_dfc); const net = Number(l.net || 0); const o = porMes.get(m);
      if (g.includes('operac')) o.op += net; else if (g.includes('invest')) o.inv += net; else if (g.includes('financ')) o.fin += net;
    }
    const ord = Array.from(porMes.entries()).sort((a, b) => a[0] - b[0]); let acc = 0;
    return {
      fluxo: ord.map(([m, o]) => ({ mes: mesCurto(m), operacional: Math.round(o.op), investimento: Math.round(o.inv), financiamento: Math.round(o.fin) })),
      caixa: ord.map(([m, o]) => { acc += o.op + o.inv + o.fin; return { mes: mesCurto(m), saldo: Math.round(acc) }; }),
    };
  }, [dfc]);

  // Stone: MDR por tipo + mix por tipo
  const stoneTipo = useMemo(() => {
    const nomeTipo = (t: number) => t === 1 ? 'Crédito' : t === 2 ? 'Débito' : t === 99 ? 'Pix' : 'Outro';
    const acc = new Map<string, { bruto: number; taxa: number }>();
    for (const b of (stone?.por_bandeira || [])) { const k = nomeTipo(Number(b.account_type)); const o = acc.get(k) || { bruto: 0, taxa: 0 }; o.bruto += Number(b.bruto || 0); o.taxa += Number(b.taxa || 0); acc.set(k, o); }
    return [...acc.entries()].map(([tipo, o]) => ({ tipo, bruto: Math.round(o.bruto), mdr: o.bruto > 0 ? +(o.taxa / o.bruto * 100).toFixed(2) : 0 })).sort((a, b) => b.bruto - a.bruto);
  }, [stone]);

  const kpis: Kpi[] = useMemo(() => {
    if (!dreMes.length) return [];
    const u = dreMes[dreMes.length - 1];
    const recYtd = dreMes.reduce((s, m) => s + m.receita, 0);
    const resYtd = dreMes.reduce((s, m) => s + m.resultado, 0);
    return [
      { label: 'Receita (mês)', valor: money(u.receita), icon: DollarSign },
      { label: 'Resultado (mês)', valor: money(u.resultado), cor: u.resultado >= 0 ? undefined : '#e34948', icon: TrendingUp },
      { label: 'Margem (mês)', valor: pct(u.receita > 0 ? (u.resultado / u.receita * 100) : 0), icon: Percent },
      { label: 'CMV (mês)', valor: pct(u.cmv_pct), icon: Boxes },
      { label: 'Receita YTD', valor: money(recYtd), icon: DollarSign },
      { label: 'Resultado YTD', valor: money(resYtd), cor: resYtd >= 0 ? undefined : '#e34948', icon: TrendingUp },
    ];
  }, [dreMes]);

  if (loading) return <div className="py-20 text-center text-gray-400"><Loader2 className="w-7 h-7 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Ano</span>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-8 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">
          {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {kpis.length > 0 && <HeroRow kpis={kpis} cols={6} />}

      <ChartGrid>
        <ChartCard titulo="DRE em cascata (ano)" subtitulo="como a Receita vira Resultado passando por CMV, custos e despesas" span={2}>
          <GraficoWaterfall passos={waterfall} formatV={moneyK} height={340} />
        </ChartCard>

        <ChartCard titulo="Composição das despesas" subtitulo="peso de cada bloco de custo no ano">
          <GraficoDonut data={despesas} nameKey="nome" valueKey="valor" formatV={moneyK} height={340} />
        </ChartCard>

        <ChartCard titulo="Receita × Resultado por mês" subtitulo="R$ por mês">
          <GraficoBase tipo="linha" data={dreMes} xKey="mes" formatY={moneyK} height={320}
            series={[{ key: 'receita', label: 'Receita' }, { key: 'resultado', label: 'Resultado' }]} />
        </ChartCard>

        <ChartCard titulo="Indicadores % da receita" subtitulo="CMV · Custos Variáveis · Mão de obra por mês">
          <GraficoBase tipo="linha" data={dreMes} xKey="mes" formatY={pct} height={320}
            series={[{ key: 'cmv_pct', label: 'CMV' }, { key: 'var_pct', label: 'Variáveis' }, { key: 'mo_pct', label: 'Mão de obra' }]} />
        </ChartCard>

        <ChartCard titulo="Fluxo de caixa por grupo" subtitulo="net mensal — Operacional · Investimento · Financiamento">
          <GraficoBase tipo="barra" stacked data={fluxo} xKey="mes" formatY={moneyK} height={320}
            series={[{ key: 'operacional', label: 'Operacional' }, { key: 'investimento', label: 'Investimento' }, { key: 'financiamento', label: 'Financiamento' }]} />
        </ChartCard>

        <ChartCard titulo="Caixa acumulado" subtitulo="variação de caixa acumulada no ano">
          <GraficoBase tipo="area" data={caixa} xKey="mes" formatY={moneyK} height={320} series={[{ key: 'saldo', label: 'Caixa acumulado' }]} />
        </ChartCard>

        <ChartCard titulo="Recebido por meio de pagamento" subtitulo="bruto por tipo (Crédito · Débito · Pix) — últimos 90 dias">
          <GraficoDonut data={stoneTipo} nameKey="tipo" valueKey="bruto" formatV={moneyK} height={320} />
        </ChartCard>

        <ChartCard titulo="Custo da maquininha (MDR) por tipo" subtitulo="% de taxa sobre o bruto — quanto maior, mais caro">
          <GraficoBarraH data={stoneTipo} xKey="tipo" valueKey="mdr" formatV={(v) => `${v.toFixed(2)}%`} height={320} maxItens={6} />
        </ChartCard>
      </ChartGrid>
    </div>
  );
}
