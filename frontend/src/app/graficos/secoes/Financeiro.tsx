'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { GraficoBase } from '@/components/graficos/GraficoBase';
import { HeroRow, ChartCard, ChartGrid, GraficoWaterfall, GraficoDonut, GraficoBarraH, type Kpi } from '@/components/graficos/Charts';
import { mesBounds, mesLabelCurto } from '../_periodo';
import { DollarSign, TrendingUp, Percent, Boxes, Wallet, Loader2 } from 'lucide-react';

const anoAtual = new Date().getFullYear();
const mesAtual = new Date().getMonth() + 1;
const money = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const moneyK = (v: number) => `${v < 0 ? '-' : ''}R$ ${Math.abs(Math.round((v || 0) / 1000))}k`;
const pct = (v: number) => `${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const mesCurto = (m: number) => new Date(2000, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
const mesNum = (v: any) => { const s = String(v ?? ''); return s.includes('-') ? Number(s.slice(5, 7)) : Number(s); };

// Nome do bloco de custo por ordem_macro (2..8). Espelha gold.mv_dre_ano.
const CUSTO_NOME: Record<number, string> = { 2: 'Custos Variáveis', 3: 'CMV', 4: 'Mão de Obra', 5: 'Desp. Comerciais', 6: 'Desp. Administrativas', 7: 'Desp. Operacionais', 8: 'Ocupação' };

export function SecaoFinanceiro({ barId, mesRef }: { barId: number; periodo: number; mesRef: string | null }) {
  const [ano, setAno] = useState(anoAtual);
  const [dre, setDre] = useState<any[]>([]);
  const [dfc, setDfc] = useState<any[]>([]);
  const [stone, setStone] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const anoEff = mesRef ? Number(mesRef.slice(0, 4)) : ano;
  const mesSel = mesRef ? Number(mesRef.slice(5, 7)) : null;
  const mensal = mesSel != null;

  const carregar = useCallback(async () => {
    setLoading(true);
    // Stone: no modo mês usa os limites do mês; senão janela fixa de 90 dias.
    let sDe: string, sAte: string;
    if (mesRef) { const b = mesBounds(mesRef); sDe = b.de; sAte = b.ate; }
    else { const de = new Date(); de.setDate(de.getDate() - 90); sDe = de.toISOString().slice(0, 10); sAte = new Date().toISOString().slice(0, 10); }
    try {
      const [d, f, s] = await Promise.all([
        api.get(`/api/estrategico/orcamentacao/dre-excel?bar_id=${barId}&ano=${anoEff}`),
        api.get(`/api/financeiro/dfc?bar_id=${barId}&ano=${anoEff}`),
        api.get(`/api/financeiro/conciliacao/analise?de=${sDe}&ate=${sAte}`).catch(() => null),
      ]);
      setDre(d?.linhas || []);
      setDfc(f?.linhas || []);
      setStone(s?.success ? s.analise : null);
    } catch { setDre([]); setDfc([]); setStone(null); }
    finally { setLoading(false); }
  }, [barId, anoEff, mesRef]);
  useEffect(() => { carregar(); }, [carregar]);

  // Predicado de recorte: no modo mês, só o mês escolhido; senão, meses fechados do ano.
  const manter = useCallback((m: number) => mensal ? m === mesSel : ((anoEff < anoAtual) || (anoEff === anoAtual && m < mesAtual)), [mensal, mesSel, anoEff]);

  // ---- DRE por mês (só ordem_macro<=9 = resultado operacional; espelha painel-executivo) ----
  const dreMes = useMemo(() => {
    const porMes = new Map<number, { receita: number; resultado: number; cmv: number; variaveis: number; mo: number }>();
    for (const l of dre) {
      const m = mesNum(l.mes); if (!m) continue;
      const om = Number(l.ordem_macro); if (om > 9) continue; // exclui Investimentos/Dividendos/Não Mapeado
      if (!porMes.has(m)) porMes.set(m, { receita: 0, resultado: 0, cmv: 0, variaveis: 0, mo: 0 });
      const v = Number(l.valor_com_sinal || 0); const o = porMes.get(m)!;
      o.resultado += v;
      if (om === 1) o.receita += v;
      else if (om === 3) o.cmv += Math.abs(v);
      else if (om === 2) o.variaveis += Math.abs(v);
      else if (om === 4) o.mo += Math.abs(v);
    }
    return Array.from(porMes.entries()).filter(([m]) => manter(m)).sort((a, b) => a[0] - b[0]).map(([m, o]) => ({
      mes: mesCurto(m), receita: Math.round(o.receita), resultado: Math.round(o.resultado),
      cmv_pct: o.receita > 0 ? +(o.cmv / o.receita * 100).toFixed(1) : 0,
      var_pct: o.receita > 0 ? +(o.variaveis / o.receita * 100).toFixed(1) : 0,
      mo_pct: o.receita > 0 ? +(o.mo / o.receita * 100).toFixed(1) : 0,
    }));
  }, [dre, manter]);

  // ---- Waterfall YTD (meses fechados) + composição de custos ----
  const { waterfall, custos, resultadoYtd, receitaYtd } = useMemo(() => {
    const acc = new Map<number, number>(); // ordem_macro -> Σ valor_com_sinal (meses fechados)
    for (const l of dre) { const m = mesNum(l.mes); if (!m || !manter(m)) continue; const om = Number(l.ordem_macro); acc.set(om, (acc.get(om) || 0) + Number(l.valor_com_sinal || 0)); }
    const g = (om: number) => acc.get(om) || 0;
    const receita = g(1);
    const despesas = g(5) + g(6) + g(7) + g(8); // negativos
    const naoOp = g(9);
    const resultado = receita + g(2) + g(3) + g(4) + despesas + naoOp; // om 1..9
    const waterfall = [
      { nome: 'Receita', valor: Math.round(receita), tipo: 'total' as const },
      { nome: 'CMV', valor: Math.round(g(3)), tipo: 'delta' as const },
      { nome: 'Custos Var.', valor: Math.round(g(2)), tipo: 'delta' as const },
      { nome: 'Mão de obra', valor: Math.round(g(4)), tipo: 'delta' as const },
      { nome: 'Despesas', valor: Math.round(despesas), tipo: 'delta' as const },
      ...(Math.abs(naoOp) > 0 ? [{ nome: 'Não Operac.', valor: Math.round(naoOp), tipo: 'delta' as const }] : []),
      { nome: 'Resultado', valor: Math.round(resultado), tipo: 'total' as const },
    ];
    const custos = [2, 3, 4, 5, 6, 7, 8].map((om) => ({ nome: CUSTO_NOME[om], valor: Math.abs(Math.round(g(om))) })).filter((c) => c.valor > 0).sort((a, b) => b.valor - a.valor);
    return { waterfall, custos, resultadoYtd: resultado, receitaYtd: receita };
  }, [dre, manter]);

  // ---- DFC: net por grupo + caixa acumulado (meses fechados) ----
  const { fluxo, caixa } = useMemo(() => {
    const porMes = new Map<number, { op: number; inv: number; fin: number }>();
    for (const l of dfc) {
      const m = mesNum(l.mes); if (!m || !manter(m)) continue;
      if (!porMes.has(m)) porMes.set(m, { op: 0, inv: 0, fin: 0 });
      const gr = String(l.grupo_dfc || '').toLowerCase(); const net = Number(l.net || 0); const o = porMes.get(m)!;
      if (gr.includes('operac')) o.op += net; else if (gr.includes('invest')) o.inv += net; else if (gr.includes('financ')) o.fin += net; else o.op += net;
    }
    const ord = Array.from(porMes.entries()).sort((a, b) => a[0] - b[0]); let accSaldo = 0;
    return {
      fluxo: ord.map(([m, o]) => ({ mes: mesCurto(m), operacional: Math.round(o.op), investimento: Math.round(o.inv), financiamento: Math.round(o.fin) })),
      caixa: ord.map(([m, o]) => { accSaldo += o.op + o.inv + o.fin; return { mes: mesCurto(m), saldo: Math.round(accSaldo) }; }),
    };
  }, [dfc, manter]);

  // ---- Stone: MDR por tipo + mix por tipo ----
  const stoneTipo = useMemo(() => {
    const nomeTipo = (t: number) => t === 1 ? 'Crédito' : t === 2 ? 'Débito' : t === 99 ? 'Pix' : 'Outro';
    const acc = new Map<string, { bruto: number; taxa: number }>();
    for (const b of (stone?.por_bandeira || [])) { const k = nomeTipo(Number(b.account_type)); const o = acc.get(k) || { bruto: 0, taxa: 0 }; o.bruto += Number(b.bruto || 0); o.taxa += Number(b.taxa || 0); acc.set(k, o); }
    return [...acc.entries()].map(([tipo, o]) => ({ tipo, bruto: Math.round(o.bruto), mdr: o.bruto > 0 ? +(o.taxa / o.bruto * 100).toFixed(2) : 0 })).sort((a, b) => b.bruto - a.bruto);
  }, [stone]);

  const kpis: Kpi[] = useMemo(() => {
    const u = dreMes[dreMes.length - 1] || { receita: 0, resultado: 0, cmv_pct: 0, var_pct: 0, mo_pct: 0 };
    if (mensal) {
      const suf = `(${mesLabelCurto(mesRef!)})`;
      return [
        { label: `Receita ${suf}`, valor: money(receitaYtd), icon: DollarSign },
        { label: `Resultado ${suf}`, valor: money(resultadoYtd), cor: resultadoYtd < 0 ? '#e34948' : undefined, icon: TrendingUp },
        { label: `Margem ${suf}`, valor: pct(receitaYtd > 0 ? (resultadoYtd / receitaYtd * 100) : 0), icon: Percent },
        { label: 'CMV / Receita', valor: pct(u.cmv_pct || 0), invLower: true, icon: Boxes },
        { label: 'Custos variáveis', valor: pct(u.var_pct || 0), invLower: true, icon: Boxes },
        { label: 'Mão de obra', valor: pct(u.mo_pct || 0), invLower: true, icon: Wallet },
      ];
    }
    return [
      { label: 'Receita YTD', valor: money(receitaYtd), icon: DollarSign },
      { label: 'Resultado YTD', valor: money(resultadoYtd), cor: resultadoYtd < 0 ? '#e34948' : undefined, icon: TrendingUp },
      { label: 'Margem YTD', valor: pct(receitaYtd > 0 ? (resultadoYtd / receitaYtd * 100) : 0), icon: Percent },
      { label: 'Receita (últ. mês)', valor: money(u.receita), icon: DollarSign },
      { label: 'Resultado (últ. mês)', valor: money(u.resultado), cor: u.resultado < 0 ? '#e34948' : undefined, icon: TrendingUp },
      { label: 'CMV / Receita', valor: pct(u.cmv_pct || 0), invLower: true, icon: Boxes },
    ];
  }, [dreMes, receitaYtd, resultadoYtd, mensal, mesRef]);

  if (loading) return <div className="py-20 text-center text-gray-400"><Loader2 className="w-7 h-7 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-4">
      {!mensal && (
        <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Ano</span>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-8 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">
            {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      )}
      <HeroRow kpis={kpis} cols={6} />

      <ChartGrid>
        <ChartCard titulo={mensal ? `DRE em cascata — ${mesLabelCurto(mesRef!)}` : 'DRE em cascata (ano, meses fechados)'} subtitulo="da Receita ao Resultado Operacional — CMV, custos e despesas" span={2}>
          <GraficoWaterfall passos={waterfall} formatV={moneyK} height={340} />
        </ChartCard>

        <ChartCard titulo="Composição de custos" subtitulo={mensal ? 'peso de cada bloco de custo no mês' : 'peso de cada bloco de custo no ano'}>
          <GraficoDonut data={custos} nameKey="nome" valueKey="valor" formatV={moneyK} height={340} />
        </ChartCard>

        {!mensal && (
        <ChartCard titulo="Receita × Resultado por mês" subtitulo="R$ por mês (meses fechados)">
          <GraficoBase tipo="linha" data={dreMes} xKey="mes" formatY={moneyK} height={320}
            series={[{ key: 'receita', label: 'Receita' }, { key: 'resultado', label: 'Resultado' }]} />
        </ChartCard>)}

        {!mensal && (
        <ChartCard titulo="Indicadores % da receita" subtitulo="CMV · Custos Variáveis · Mão de obra por mês">
          <GraficoBase tipo="linha" data={dreMes} xKey="mes" formatY={pct} height={320}
            series={[{ key: 'cmv_pct', label: 'CMV' }, { key: 'var_pct', label: 'Variáveis' }, { key: 'mo_pct', label: 'Mão de obra' }]} />
        </ChartCard>)}

        {!mensal && fluxo.length > 0 && (
        <ChartCard titulo="Fluxo de caixa por grupo" subtitulo="net mensal — Operacional · Investimento · Financiamento">
          <GraficoBase tipo="barra" stacked data={fluxo} xKey="mes" formatY={moneyK} height={320}
            series={[{ key: 'operacional', label: 'Operacional' }, { key: 'investimento', label: 'Investimento' }, { key: 'financiamento', label: 'Financiamento' }]} />
        </ChartCard>)}

        {!mensal && caixa.length > 0 && (
        <ChartCard titulo="Caixa acumulado" subtitulo="variação de caixa acumulada no ano">
          <GraficoBase tipo="area" data={caixa} xKey="mes" formatY={moneyK} height={320} series={[{ key: 'saldo', label: 'Caixa acumulado' }]} />
        </ChartCard>)}

        {stoneTipo.length > 0 && (
        <ChartCard titulo="Recebido por meio de pagamento" subtitulo={mensal ? `bruto por tipo (Crédito · Débito · Pix) — ${mesLabelCurto(mesRef!)}` : 'bruto por tipo (Crédito · Débito · Pix) — últimos 90 dias'}>
          <GraficoDonut data={stoneTipo} nameKey="tipo" valueKey="bruto" formatV={moneyK} height={320} />
        </ChartCard>)}

        {stoneTipo.length > 0 && (
        <ChartCard titulo="Custo da maquininha (MDR) por tipo" subtitulo="% de taxa sobre o bruto — quanto maior, mais caro">
          <GraficoBarraH data={stoneTipo} xKey="tipo" valueKey="mdr" formatV={(v) => `${v.toFixed(2)}%`} height={320} maxItens={6} />
        </ChartCard>)}
      </ChartGrid>
    </div>
  );
}
