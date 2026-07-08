'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { GraficoBase } from '@/components/graficos/GraficoBase';
import { HeroRow, ChartCard, ChartGrid, GraficoBarraH, type Kpi } from '@/components/graficos/Charts';
import { Boxes, Percent, TrendingDown, Package, Truck, Loader2 } from 'lucide-react';

const anoAtual = new Date().getFullYear();
const money = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const moneyK = (v: number) => `${v < 0 ? '-' : ''}R$ ${Math.abs(Math.round((v || 0) / 1000))}k`;
const pct = (v: number) => `${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const isoLocal = (ts: string) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const segSemana = (iso: string) => { const d = new Date(iso + 'T12:00:00'); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d.toISOString().slice(0, 10); };
const ddmm = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');

export function SecaoCmv({ barId, periodo }: { barId: number; periodo: number }) {
  const [ano, setAno] = useState(anoAtual);
  const [cmv, setCmv] = useState<any[]>([]);
  const [forn, setForn] = useState<any[]>([]);
  const [desv, setDesv] = useState<any[]>([]);
  const [execs, setExecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const de = new Date(); de.setDate(de.getDate() - periodo * 30);
    const deStr = de.toISOString().slice(0, 10); const ateStr = new Date().toISOString().slice(0, 10);
    try {
      const [c, f, dd, e] = await Promise.all([
        api.get(`/api/cmv-semanal?ano=${ano}&bar_id=${barId}`),
        api.get(`/api/operacional/compras?de=${deStr}&ate=${ateStr}&bar_id=${barId}`).catch(() => null),
        api.get('/api/operacional/desvios?tipo=semanal').catch(() => null),
        api.get(`/api/operacional/producoes/execucao?bar_id=${barId}&de=${deStr}&ate=${ateStr}T23:59:59.999`).catch(() => null),
      ]);
      setCmv(c?.success ? (c.data || []) : []);
      setForn(f?.success ? (f.topFornecedores || []) : []);
      setExecs(e?.success ? (e.execucoes || []) : []);
      // desvios: pega a última contagem semanal e busca itens
      const datas: string[] = dd?.datas || [];
      if (datas.length >= 2) {
        const rr = await api.get(`/api/operacional/desvios?tipo=semanal&ini=${datas[1]}&fim=${datas[0]}`).catch(() => null);
        setDesv(rr?.itens || []);
      } else setDesv([]);
    } catch { setCmv([]); setForn([]); setDesv([]); setExecs([]); }
    finally { setLoading(false); }
  }, [barId, ano, periodo]);
  useEffect(() => { carregar(); }, [carregar]);

  const cmvData = useMemo(() => [...cmv].sort((a, b) => (a.ano - b.ano) || (a.semana - b.semana)).map((d) => ({
    semana: `S${d.semana}`,
    cozinha: Number(d.estoque_final_cozinha || 0), bebidas: Number(d.estoque_final_bebidas || 0), drinks: Number(d.estoque_final_drinks || 0),
    limpo: Number(d.cmv_limpo_percentual || 0), teorico: Number(d.cmv_teorico_percentual || 0),
    // descarta semanas futuras/sem dado (deixavam metade do gráfico vazia + platô fantasma)
  })).filter((d) => d.limpo > 0 || (d.cozinha + d.bebidas + d.drinks) > 0), [cmv]);

  const desviosArea = useMemo(() => {
    const by = new Map<string, { perda: number; sobra: number }>();
    for (const it of desv) { if (it.is_producao) continue; const a = it.area || '—'; if (!by.has(a)) by.set(a, { perda: 0, sobra: 0 }); const v = Number(it.desvio_rs || 0); const o = by.get(a)!; if (v < 0) o.perda += Math.abs(v); else o.sobra += v; }
    return [...by.entries()].sort((a, b) => (b[1].perda + b[1].sobra) - (a[1].perda + a[1].sobra)).map(([area, o]) => ({ area, perda: Math.round(o.perda), sobra: Math.round(o.sobra) }));
  }, [desv]);

  const topPerda = useMemo(() => desv.filter((i) => !i.is_producao && !i.dado_faltando && Number(i.desvio_rs || 0) < 0)
    .map((i) => ({ nome: i.insumo_nome || i.insumo_codigo || '—', perda: Math.round(Math.abs(Number(i.desvio_rs))) }))
    .sort((a, b) => b.perda - a.perda).slice(0, 14), [desv]);

  const fornData = useMemo(() => [...forn].sort((a, b) => Number(b.valor) - Number(a.valor)).slice(0, 14)
    .map((f) => ({ fornecedor: String(f.fornecedor || '—').split(' ').slice(0, 2).join(' '), valor: Number(f.valor || 0) })), [forn]);

  // produções por semana: nota (aderência) + desvio de custo
  const prodData = useMemo(() => {
    const buckets = new Map<string, any[]>();
    for (const e of execs) { const k = segSemana(isoLocal(e.criado_em)); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k)!.push(e); }
    return [...buckets.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([k, list]) => {
      const comRend = list.filter((e) => e.rendimento_real != null && e.rendimento_esperado);
      const dentro = comRend.filter((e) => Math.abs(Number(e.rendimento_real) / Number(e.rendimento_esperado) - 1) <= 0.05).length;
      const cp = list.reduce((s, e) => s + (Number(e.custo_planejado) || 0), 0);
      const cr = list.reduce((s, e) => s + (Number(e.custo_real) || 0), 0);
      return { periodo: ddmm(k), nota: comRend.length ? +(dentro / comRend.length * 100).toFixed(0) : 0, desvio: Math.round(cr - cp) };
    });
  }, [execs]);

  const kpis: Kpi[] = useMemo(() => {
    const u = cmvData[cmvData.length - 1];
    const estoque = u ? u.cozinha + u.bebidas + u.drinks : 0;
    const perdaTot = desviosArea.reduce((s, a) => s + a.perda, 0);
    return [
      { label: 'CMV limpo', valor: u ? pct(u.limpo) : '—', icon: Percent },
      { label: 'CMV teórico', valor: u ? pct(u.teorico) : '—', icon: Percent },
      { label: 'Gap (limpo−teórico)', valor: u ? pct(u.limpo - u.teorico) : '—', invLower: true, icon: TrendingDown },
      { label: 'Valor em estoque', valor: money(estoque), icon: Package },
      { label: 'Perda (últ. contagem)', valor: money(perdaTot), cor: '#e34948', icon: TrendingDown },
      { label: 'Compras no período', valor: money(fornData.reduce((s, f) => s + f.valor, 0)), icon: Truck },
    ];
  }, [cmvData, desviosArea, fornData]);

  if (loading) return <div className="py-20 text-center text-gray-400"><Loader2 className="w-7 h-7 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Ano</span>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-8 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">
          {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <HeroRow kpis={kpis} cols={6} />

      <ChartGrid>
        <ChartCard titulo="CMV limpo × teórico" subtitulo="% por semana — quanto o real se distancia do que a ficha prevê" span={2}>
          <GraficoBase tipo="linha" data={cmvData} xKey="semana" formatY={pct} height={330}
            series={[{ key: 'limpo', label: 'CMV Limpo' }, { key: 'teorico', label: 'CMV Teórico' }]} />
        </ChartCard>

        <ChartCard titulo="Valor de estoque por categoria" subtitulo="R$ no fim de cada semana">
          <GraficoBase tipo="area" stacked data={cmvData} xKey="semana" formatY={moneyK} height={330}
            series={[{ key: 'cozinha', label: 'Cozinha' }, { key: 'bebidas', label: 'Bebidas' }, { key: 'drinks', label: 'Drinks' }]} />
        </ChartCard>

        <ChartCard titulo="Desvios — perda × sobra por área" subtitulo="R$ da última contagem semanal (real − teórico)">
          <GraficoBase tipo="barra" data={desviosArea} xKey="area" formatY={moneyK} height={330} cores={['#e34948', '#1baf7a']}
            series={[{ key: 'perda', label: 'Perda' }, { key: 'sobra', label: 'Sobra' }]} />
        </ChartCard>

        <ChartCard titulo="Top insumos em perda" subtitulo="maiores perdas valorizadas (dado limpo)">
          <GraficoBarraH data={topPerda} xKey="nome" valueKey="perda" cor="#e34948" formatV={moneyK} height={330} />
        </ChartCard>

        <ChartCard titulo="Gasto por fornecedor" subtitulo="top fornecedores no período">
          <GraficoBarraH data={fornData} xKey="fornecedor" valueKey="valor" formatV={moneyK} height={330} />
        </ChartCard>

        <ChartCard titulo="Nota das produções" subtitulo="% dentro do rendimento esperado (±5%) por semana">
          <GraficoBase tipo="linha" data={prodData} xKey="periodo" formatY={(v) => `${Math.round(v)}%`} height={330} series={[{ key: 'nota', label: 'Nota' }]} />
        </ChartCard>

        <ChartCard titulo="Desvio de custo das produções" subtitulo="real − planejado por semana (positivo = gastou mais)">
          <GraficoBase tipo="barra" data={prodData} xKey="periodo" formatY={moneyK} height={330} series={[{ key: 'desvio', label: 'Desvio R$' }]} />
        </ChartCard>
      </ChartGrid>
    </div>
  );
}
