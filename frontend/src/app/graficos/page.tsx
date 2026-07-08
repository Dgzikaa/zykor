'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell } from '@/components/layout/PageShell';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { GraficoBase } from '@/components/graficos/GraficoBase';
import { BarChart3, Loader2, Boxes, DollarSign, Target } from 'lucide-react';

const anoAtual = new Date().getFullYear();
const fmtPct = (v: number) => `${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const fmtBRL0 = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

// card que envolve cada gráfico (título + subtítulo + corpo)
function ChartCard({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <Card className="card-dark">
      <CardContent className="py-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{titulo}</h3>
          {subtitulo && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitulo}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function EmBreve({ o }: { o: string }) {
  return (
    <Card className="card-dark"><CardContent className="py-16 text-center text-gray-400">
      <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
      <p className="text-sm">Gráficos de <b>{o}</b> entram na próxima leva.</p>
    </CardContent></Card>
  );
}

// ===== Produção-CMV → Estoque & CMV (fonte: /api/cmv-semanal?ano) =====
function CmvEstoque({ barId }: { barId: number }) {
  const [ano, setAno] = useState(anoAtual);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/cmv-semanal?ano=${ano}`);
      setRows(r.success ? (r.data || []) : []);
    } finally { setLoading(false); }
  }, [barId, ano]);
  useEffect(() => { carregar(); }, [carregar]);

  // ordena por semana asc e monta os pontos do gráfico
  const data = useMemo(() => {
    return [...rows]
      .sort((a, b) => (a.ano - b.ano) || (a.semana - b.semana))
      .map((d) => ({
        semana: `S${d.semana}`,
        cozinha: Number(d.estoque_final_cozinha || 0),
        bebidas: Number(d.estoque_final_bebidas || 0),
        drinks: Number(d.estoque_final_drinks || 0),
        cmv_limpo: Number(d.cmv_limpo_percentual || 0),
        cmv_teorico: Number(d.cmv_teorico_percentual || 0),
      }));
  }, [rows]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Ano</span>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))}
          className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">
          {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {loading ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <ChartCard titulo="Estoque final por categoria" subtitulo="Valor em estoque no fim de cada semana (Cozinha / Bebidas / Drinks)">
            <GraficoBase tipo="area" stacked data={data} xKey="semana" formatY={fmtBRL0}
              series={[{ key: 'cozinha', label: 'Cozinha' }, { key: 'bebidas', label: 'Bebidas' }, { key: 'drinks', label: 'Drinks' }]} />
          </ChartCard>
          <ChartCard titulo="CMV Limpo × Teórico" subtitulo="% por semana — quanto o real se distancia do teórico">
            <GraficoBase tipo="linha" data={data} xKey="semana" formatY={fmtPct}
              series={[{ key: 'cmv_limpo', label: 'CMV Limpo' }, { key: 'cmv_teorico', label: 'CMV Teórico' }]} />
          </ChartCard>
        </div>
      )}
    </div>
  );
}

// ===== Produção-CMV → Produções (fonte: /api/operacional/producoes/execucao) =====
const isoLocal = (ts: string) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const segundaDaSemana = (iso: string) => { const d = new Date(iso + 'T12:00:00'); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d.toISOString().slice(0, 10); };
const ddmm = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
const nomeMes = (ym: string) => { const [a, m] = ym.split('-'); return new Date(Number(a), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }); };

function Producoes({ barId }: { barId: number }) {
  const [gran, setGran] = useState<'dia' | 'semana' | 'mes'>('semana');
  const [secao, setSecao] = useState<'Todos' | 'Cozinha' | 'Bar'>('Todos');
  const [loading, setLoading] = useState(true);
  const [execs, setExecs] = useState<any[]>([]);

  useEffect(() => {
    if (!barId) return; setLoading(true);
    const de = new Date(); de.setDate(de.getDate() - 180);
    const qs = new URLSearchParams({ bar_id: String(barId), de: de.toISOString().slice(0, 10), ate: `${new Date().toISOString().slice(0, 10)}T23:59:59.999` });
    api.get(`/api/operacional/producoes/execucao?${qs.toString()}`).then((r) => setExecs(r.success ? (r.execucoes || []) : [])).finally(() => setLoading(false));
  }, [barId]);

  const data = useMemo(() => {
    const sec = (cod: string) => String(cod || '').toLowerCase().startsWith('pd') ? 'Bar' : 'Cozinha';
    const filt = execs.filter((e) => secao === 'Todos' || sec(e.producao_codigo) === secao);
    const key = (e: any) => { const dia = isoLocal(e.criado_em); return gran === 'dia' ? dia : gran === 'semana' ? segundaDaSemana(dia) : dia.slice(0, 7); };
    const lbl = (k: string) => gran === 'mes' ? nomeMes(k) : ddmm(k);
    const buckets = new Map<string, any[]>();
    for (const e of filt) { const k = key(e); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k)!.push(e); }
    return Array.from(buckets.entries()).sort((a, b) => a[0] < b[0] ? -1 : 1).map(([k, list]) => {
      const comRend = list.filter((e) => e.rendimento_real != null && e.rendimento_esperado);
      const dentro = comRend.filter((e) => Math.abs(Number(e.rendimento_real) / Number(e.rendimento_esperado) - 1) <= 0.05).length;
      const custoPlan = list.reduce((s, e) => s + (Number(e.custo_planejado) || 0), 0);
      const custoReal = list.reduce((s, e) => s + (Number(e.custo_real) || 0), 0);
      return { periodo: lbl(k), nota: comRend.length ? Number((dentro / comRend.length * 100).toFixed(1)) : 0, desvio: Number((custoReal - custoPlan).toFixed(2)), producoes: list.length };
    });
  }, [execs, gran, secao]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5">
          {(['dia', 'semana', 'mes'] as const).map((g) => (
            <button key={g} onClick={() => setGran(g)} className={`text-sm rounded-md px-3 py-1 ${gran === g ? 'bg-indigo-500 text-white' : 'text-gray-600 dark:text-gray-300'}`}>{g === 'mes' ? 'Mês' : g === 'dia' ? 'Dia' : 'Semana'}</button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5">
          {(['Todos', 'Cozinha', 'Bar'] as const).map((s) => (
            <button key={s} onClick={() => setSecao(s)} className={`text-sm rounded-md px-3 py-1 ${secao === s ? 'bg-indigo-500 text-white' : 'text-gray-600 dark:text-gray-300'}`}>{s}</button>
          ))}
        </div>
      </div>
      {loading ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <ChartCard titulo="Nota das produções" subtitulo="% das produções dentro do rendimento esperado (±5%), por período">
            <GraficoBase tipo="linha" data={data} xKey="periodo" formatY={(v) => `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`} series={[{ key: 'nota', label: 'Nota' }]} />
          </ChartCard>
          <ChartCard titulo="Desvio de custo (real − planejado)" subtitulo="R$ por período — positivo = gastou mais que o previsto">
            <GraficoBase tipo="barra" data={data} xKey="periodo" formatY={fmtBRL0} series={[{ key: 'desvio', label: 'Desvio R$' }]} />
          </ChartCard>
        </div>
      )}
    </div>
  );
}

// ===== Produção-CMV → Compras (fonte: /api/operacional/compras) =====
function Compras({ barId }: { barId: number }) {
  const [dias, setDias] = useState(90);
  const [loading, setLoading] = useState(true);
  const [forn, setForn] = useState<any[]>([]);

  useEffect(() => {
    if (!barId) return; setLoading(true);
    const de = new Date(); de.setDate(de.getDate() - dias);
    const qs = new URLSearchParams({ bar_id: String(barId), de: de.toISOString().slice(0, 10), ate: new Date().toISOString().slice(0, 10) });
    api.get(`/api/operacional/compras?${qs.toString()}`).then((r) => setForn(r.success ? (r.topFornecedores || []) : [])).finally(() => setLoading(false));
  }, [barId, dias]);

  const data = useMemo(() => [...forn].sort((a, b) => Number(b.valor) - Number(a.valor)).slice(0, 12)
    .map((f) => ({ fornecedor: String(f.fornecedor || '—').split(' ').slice(0, 2).join(' '), valor: Number(f.valor || 0) })), [forn]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Período</span>
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5">
          {[30, 90, 180].map((d) => <button key={d} onClick={() => setDias(d)} className={`text-sm rounded-md px-3 py-1 ${dias === d ? 'bg-indigo-500 text-white' : 'text-gray-600 dark:text-gray-300'}`}>{d}d</button>)}
        </div>
      </div>
      {loading ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : (
        <ChartCard titulo="Gasto por fornecedor" subtitulo={`Top fornecedores nos últimos ${dias} dias`}>
          <GraficoBase tipo="barra" data={data} xKey="fornecedor" formatY={fmtBRL0} height={360} series={[{ key: 'valor', label: 'Gasto' }]} />
        </ChartCard>
      )}
    </div>
  );
}

const mesCurto = (m: number) => new Date(2000, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' });

// ===== Financeiro → DRE (fonte: /api/estrategico/orcamentacao/dre-excel) =====
function DRE({ barId }: { barId: number }) {
  const [ano, setAno] = useState(anoAtual);
  const [loading, setLoading] = useState(true);
  const [linhas, setLinhas] = useState<any[]>([]);
  useEffect(() => {
    if (!barId) return; setLoading(true);
    api.get(`/api/estrategico/orcamentacao/dre-excel?bar_id=${barId}&ano=${ano}`).then((r) => setLinhas(r?.linhas || [])).finally(() => setLoading(false));
  }, [barId, ano]);

  const data = useMemo(() => {
    const norm = (s: string) => String(s || '').toLowerCase();
    const porMes = new Map<number, any>();
    for (const l of linhas) {
      const m = Number(l.mes); if (!m) continue;
      if (!porMes.has(m)) porMes.set(m, { receita: 0, resto: 0, cmv: 0, variaveis: 0 });
      const v = Number(l.valor_com_sinal || 0); const mac = norm(l.categoria_macro); const o = porMes.get(m);
      if (mac.includes('receita')) o.receita += v; else o.resto += v; // resto = despesas (valor já negativo)
      if (mac.includes('cmv') || mac.includes('insumos')) o.cmv += Math.abs(v);
      if (mac.includes('variáveis') || mac.includes('variaveis')) o.variaveis += Math.abs(v);
    }
    return Array.from(porMes.entries()).sort((a, b) => a[0] - b[0]).map(([m, o]) => ({
      mes: mesCurto(m),
      receita: Number(o.receita.toFixed(2)),
      resultado: Number((o.receita + o.resto).toFixed(2)),
      cmv_pct: o.receita > 0 ? Number((o.cmv / o.receita * 100).toFixed(1)) : 0,
      var_pct: o.receita > 0 ? Number((o.variaveis / o.receita * 100).toFixed(1)) : 0,
    }));
  }, [linhas]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Ano</span>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">
          {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {loading ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <ChartCard titulo="Receita × Resultado" subtitulo="R$ por mês — receita e resultado (receita − custos)">
            <GraficoBase tipo="linha" data={data} xKey="mes" formatY={fmtBRL0} series={[{ key: 'receita', label: 'Receita' }, { key: 'resultado', label: 'Resultado' }]} />
          </ChartCard>
          <ChartCard titulo="CMV % × Custos Variáveis %" subtitulo="% da receita por mês">
            <GraficoBase tipo="linha" data={data} xKey="mes" formatY={fmtPct} series={[{ key: 'cmv_pct', label: 'CMV' }, { key: 'var_pct', label: 'Variáveis' }]} />
          </ChartCard>
        </div>
      )}
    </div>
  );
}

// ===== Financeiro → DFC (fonte: /api/financeiro/dfc) =====
function DFC({ barId }: { barId: number }) {
  const [ano, setAno] = useState(anoAtual);
  const [loading, setLoading] = useState(true);
  const [linhas, setLinhas] = useState<any[]>([]);
  useEffect(() => {
    if (!barId) return; setLoading(true);
    api.get(`/api/financeiro/dfc?bar_id=${barId}&ano=${ano}`).then((r) => setLinhas(r?.linhas || [])).finally(() => setLoading(false));
  }, [barId, ano]);

  const { fluxo, caixa } = useMemo(() => {
    const norm = (s: string) => String(s || '').toLowerCase();
    const porMes = new Map<number, any>();
    for (const l of linhas) {
      const m = Number(l.mes); if (!m) continue;
      if (!porMes.has(m)) porMes.set(m, { operacional: 0, investimento: 0, financiamento: 0 });
      const g = norm(l.grupo_dfc); const net = Number(l.net || 0); const o = porMes.get(m);
      if (g.includes('operac')) o.operacional += net; else if (g.includes('invest')) o.investimento += net; else if (g.includes('financ')) o.financiamento += net;
    }
    const ord = Array.from(porMes.entries()).sort((a, b) => a[0] - b[0]);
    let acc = 0;
    const fluxo = ord.map(([m, o]) => ({ mes: mesCurto(m), operacional: Number(o.operacional.toFixed(2)), investimento: Number(o.investimento.toFixed(2)), financiamento: Number(o.financiamento.toFixed(2)) }));
    const caixa = ord.map(([m, o]) => { acc += o.operacional + o.investimento + o.financiamento; return { mes: mesCurto(m), saldo: Number(acc.toFixed(2)) }; });
    return { fluxo, caixa };
  }, [linhas]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Ano</span>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">
          {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {loading ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <ChartCard titulo="Fluxo por grupo" subtitulo="Net por mês — Operacional / Investimento / Financiamento">
            <GraficoBase tipo="barra" data={fluxo} xKey="mes" formatY={fmtBRL0} series={[{ key: 'operacional', label: 'Operacional' }, { key: 'investimento', label: 'Investimento' }, { key: 'financiamento', label: 'Financiamento' }]} />
          </ChartCard>
          <ChartCard titulo="Caixa acumulado" subtitulo="Variação de caixa acumulada no ano">
            <GraficoBase tipo="area" data={caixa} xKey="mes" formatY={fmtBRL0} series={[{ key: 'saldo', label: 'Caixa acumulado' }]} />
          </ChartCard>
        </div>
      )}
    </div>
  );
}

// ===== Produção-CMV → Desvios (fonte: /api/operacional/desvios) =====
function Desvios({ barId }: { barId: number }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [win, setWin] = useState<{ ini: string; fim: string } | null>(null);
  useEffect(() => {
    if (!barId) return; setLoading(true); setRows([]);
    api.get('/api/operacional/desvios?tipo=semanal').then(async (r) => {
      const datas: string[] = r?.datas || [];
      if (datas.length < 2) { setLoading(false); return; }
      const ini = datas[1], fim = datas[0]; setWin({ ini, fim });
      const rr = await api.get(`/api/operacional/desvios?tipo=semanal&ini=${ini}&fim=${fim}`);
      setRows(rr?.itens || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [barId]);
  const data = useMemo(() => {
    const byArea = new Map<string, { perda: number; sobra: number }>();
    for (const it of rows) {
      if (it.is_producao) continue;
      const a = it.area || '—'; if (!byArea.has(a)) byArea.set(a, { perda: 0, sobra: 0 });
      const v = Number(it.desvio_rs || 0); const o = byArea.get(a)!;
      if (v < 0) o.perda += Math.abs(v); else o.sobra += v;
    }
    return Array.from(byArea.entries()).sort((a, b) => (b[1].perda + b[1].sobra) - (a[1].perda + a[1].sobra))
      .map(([a, o]) => ({ area: a, perda: Number(o.perda.toFixed(2)), sobra: Number(o.sobra.toFixed(2)) }));
  }, [rows]);

  return (
    <div className="space-y-3">
      {loading ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : (
        <ChartCard titulo="Perdas × Sobras por área" subtitulo={win ? `Última contagem semanal: ${ddmm(win.ini)} → ${ddmm(win.fim)}` : 'Sem contagens suficientes'}>
          <GraficoBase tipo="barra" data={data} xKey="area" formatY={fmtBRL0} cores={['#e34948', '#1baf7a']} height={360}
            series={[{ key: 'perda', label: 'Perda' }, { key: 'sobra', label: 'Sobra' }]} />
        </ChartCard>
      )}
    </div>
  );
}

// ===== Estratégico → Desempenho (fonte: /api/estrategico/desempenho-v2) =====
function Desempenho({ barId }: { barId: number }) {
  const [ano, setAno] = useState(anoAtual);
  const [loading, setLoading] = useState(true);
  const [semanas, setSemanas] = useState<any[]>([]);
  useEffect(() => {
    if (!barId) return; setLoading(true);
    api.get(`/api/estrategico/desempenho-v2?ano=${ano}`).then((r) => setSemanas(r?.success ? (r.semanas || []) : [])).finally(() => setLoading(false));
  }, [barId, ano]);

  const data = useMemo(() => [...semanas].sort((a, b) => a.semana - b.semana).map((s) => ({
    periodo: s.periodo || `S${s.semana}`,
    faturamento: Number(s.faturamento_total || 0),
    cmv: Number(s.cmv_limpo_percentual || 0),
    cmo: Number(s.cmo_percentual || 0),
  })), [semanas]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Ano</span>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">
          {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {loading ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <ChartCard titulo="Faturamento por semana" subtitulo="R$ por semana operacional">
            <GraficoBase tipo="area" data={data} xKey="periodo" formatY={fmtBRL0} series={[{ key: 'faturamento', label: 'Faturamento' }]} />
          </ChartCard>
          <ChartCard titulo="CMV % × CMO %" subtitulo="% da receita por semana">
            <GraficoBase tipo="linha" data={data} xKey="periodo" formatY={fmtPct} series={[{ key: 'cmv', label: 'CMV Limpo' }, { key: 'cmo', label: 'CMO' }]} />
          </ChartCard>
        </div>
      )}
    </div>
  );
}

// ===== Estratégico → Orçamentação (fonte: /api/graficos/orcamentacao) =====
function Orcamentacao({ barId }: { barId: number }) {
  const [ano, setAno] = useState(anoAtual);
  const [loading, setLoading] = useState(true);
  const [meses, setMeses] = useState<any[]>([]);
  useEffect(() => {
    if (!barId) return; setLoading(true);
    api.get(`/api/graficos/orcamentacao?ano=${ano}`).then((r) => setMeses(r?.success ? (r.meses || []) : [])).finally(() => setLoading(false));
  }, [barId, ano]);
  const data = useMemo(() => meses.map((m) => ({
    mes: mesCurto(m.mes),
    meta_plan: Number(m.totais?.faturamento_meta_plan || 0), meta_proj: Number(m.totais?.faturamento_meta_proj || 0), meta_real: Number(m.totais?.faturamento_meta_real || 0),
    lucro_plan: Number(m.totais?.ebitda_plan || 0), lucro_proj: Number(m.totais?.ebitda_proj || 0), lucro_real: Number(m.totais?.ebitda_real || 0),
  })), [meses]);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Ano</span>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">
          {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {loading ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <ChartCard titulo="Faturamento Meta" subtitulo="Planejado × Projetado × Realizado por mês">
            <GraficoBase tipo="linha" data={data} xKey="mes" formatY={fmtBRL0} series={[{ key: 'meta_plan', label: 'Planejado' }, { key: 'meta_proj', label: 'Projetado' }, { key: 'meta_real', label: 'Realizado' }]} />
          </ChartCard>
          <ChartCard titulo="Lucro Líquido" subtitulo="Planejado × Projetado × Realizado por mês">
            <GraficoBase tipo="linha" data={data} xKey="mes" formatY={fmtBRL0} series={[{ key: 'lucro_plan', label: 'Planejado' }, { key: 'lucro_proj', label: 'Projetado' }, { key: 'lucro_real', label: 'Realizado' }]} />
          </ChartCard>
        </div>
      )}
    </div>
  );
}

// ===== Estratégico → Planejamento (fonte: /api/estrategico/planejamento-comercial) =====
function Planejamento({ barId }: { barId: number }) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (!barId) return; setLoading(true);
    api.get(`/api/estrategico/planejamento-comercial?mes=${mes}&ano=${hoje.getFullYear()}`).then((r) => setItems(r?.success ? (r.data || []) : [])).finally(() => setLoading(false));
  }, [barId, mes]); // eslint-disable-line react-hooks/exhaustive-deps
  const { evento, acum } = useMemo(() => {
    const sorted = [...items].filter((e) => e.data_evento).sort((a, b) => a.data_evento < b.data_evento ? -1 : 1);
    let m1a = 0, ra = 0;
    const evento = sorted.map((e) => ({ dia: ddmm(e.data_evento), m1: Number(e.m1_receita || 0), real: Number(e.real_receita || 0) }));
    const acum = sorted.map((e) => { m1a += Number(e.m1_receita || 0); ra += Number(e.real_receita || 0); return { dia: ddmm(e.data_evento), m1: Number(m1a.toFixed(2)), real: Number(ra.toFixed(2)) }; });
    return { evento, acum };
  }, [items]);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Mês</span>
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm capitalize">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })}</option>)}
        </select>
      </div>
      {loading ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <ChartCard titulo="Meta M1 × Realizado por evento" subtitulo="R$ por dia/evento do mês">
            <GraficoBase tipo="barra" data={evento} xKey="dia" formatY={fmtBRL0} series={[{ key: 'm1', label: 'Meta M1' }, { key: 'real', label: 'Realizado' }]} />
          </ChartCard>
          <ChartCard titulo="Empilhamento acumulado" subtitulo="Meta M1 × Realizado acumulado no mês">
            <GraficoBase tipo="area" data={acum} xKey="dia" formatY={fmtBRL0} series={[{ key: 'm1', label: 'Meta M1 acum.' }, { key: 'real', label: 'Realizado acum.' }]} />
          </ChartCard>
        </div>
      )}
    </div>
  );
}

// ===== Financeiro → Conciliação (fonte: /api/financeiro/conciliacao/analise) =====
function Conciliacao({ barId }: { barId: number }) {
  const [dias, setDias] = useState(30);
  const [loading, setLoading] = useState(true);
  const [analise, setAnalise] = useState<any>(null);
  useEffect(() => {
    if (!barId) return; setLoading(true);
    const de = new Date(); de.setDate(de.getDate() - dias);
    const qs = new URLSearchParams({ de: de.toISOString().slice(0, 10), ate: new Date().toISOString().slice(0, 10) });
    api.get(`/api/financeiro/conciliacao/analise?${qs.toString()}`).then((r) => setAnalise(r?.success ? r.analise : null)).finally(() => setLoading(false));
  }, [barId, dias]);
  const data = useMemo(() => {
    const nomeTipo = (t: number) => t === 1 ? 'Crédito' : t === 2 ? 'Débito' : t === 99 ? 'Pix' : 'Outro';
    const acc = new Map<string, number>();
    for (const b of (analise?.por_bandeira || [])) { const k = nomeTipo(Number(b.account_type)); acc.set(k, (acc.get(k) || 0) + Number(b.liquido || 0)); }
    return ['Crédito', 'Débito', 'Pix', 'Outro'].filter((k) => acc.has(k)).map((k) => ({ tipo: k, liquido: Number((acc.get(k) || 0).toFixed(2)) }));
  }, [analise]);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Período</span>
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5">
          {[30, 90, 180].map((d) => <button key={d} onClick={() => setDias(d)} className={`text-sm rounded-md px-3 py-1 ${dias === d ? 'bg-indigo-500 text-white' : 'text-gray-600 dark:text-gray-300'}`}>{d}d</button>)}
        </div>
      </div>
      {loading ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : (
        <ChartCard titulo="Recebido líquido por tipo" subtitulo={`Crédito / Débito / Pix — últimos ${dias} dias`}>
          <GraficoBase tipo="barra" data={data} xKey="tipo" formatY={fmtBRL0} height={340} series={[{ key: 'liquido', label: 'Líquido' }]} />
        </ChartCard>
      )}
    </div>
  );
}

const SUBS: Record<string, { key: string; label: string; el?: (barId: number) => React.ReactNode; o?: string }[]> = {
  producao: [
    { key: 'cmv', label: 'Estoque & CMV', el: (b) => <CmvEstoque barId={b} /> },
    { key: 'producoes', label: 'Produções', el: (b) => <Producoes barId={b} /> },
    { key: 'compras', label: 'Compras', el: (b) => <Compras barId={b} /> },
    { key: 'desvios', label: 'Desvios', el: (b) => <Desvios barId={b} /> },
  ],
  financeiro: [
    { key: 'dre', label: 'DRE', el: (b) => <DRE barId={b} /> },
    { key: 'dfc', label: 'DFC', el: (b) => <DFC barId={b} /> },
    { key: 'stone', label: 'Conciliação', el: (b) => <Conciliacao barId={b} /> },
  ],
  estrategico: [
    { key: 'desempenho', label: 'Desempenho', el: (b) => <Desempenho barId={b} /> },
    { key: 'orcamentacao', label: 'Orçamentação', el: (b) => <Orcamentacao barId={b} /> },
    { key: 'planejamento', label: 'Planejamento', el: (b) => <Planejamento barId={b} /> },
  ],
};

export default function GraficosPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  const [modulo, setModulo] = useState('producao');
  const [sub, setSub] = useState<Record<string, string>>({ producao: 'cmv', financeiro: 'dre', estrategico: 'desempenho' });

  // abre na aba vinda do menu lateral (/graficos?m=financeiro etc.)
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get('m');
    if (m && ['producao', 'financeiro', 'estrategico'].includes(m)) setModulo(m);
  }, []);

  return (
    <PageShell width="wide">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl"><BarChart3 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gráficos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Visão gráfica das análises · {selectedBar?.nome || ''}</p>
        </div>
      </div>

      <Tabs value={modulo} onValueChange={setModulo} className="mt-2">
        <TabsList>
          <TabsTrigger value="producao"><Boxes className="w-4 h-4 mr-1.5" />Produção-CMV</TabsTrigger>
          <TabsTrigger value="financeiro"><DollarSign className="w-4 h-4 mr-1.5" />Financeiro</TabsTrigger>
          <TabsTrigger value="estrategico"><Target className="w-4 h-4 mr-1.5" />Estratégico</TabsTrigger>
        </TabsList>

        {Object.entries(SUBS).map(([mod, subs]) => (
          <TabsContent key={mod} value={mod} className="mt-3">
            <Tabs value={sub[mod]} onValueChange={(v) => setSub((s) => ({ ...s, [mod]: v }))}>
              <TabsList>
                {subs.map((s) => <TabsTrigger key={s.key} value={s.key}>{s.label}</TabsTrigger>)}
              </TabsList>
              {subs.map((s) => (
                <TabsContent key={s.key} value={s.key} className="mt-3">
                  {!barId ? <Card className="card-dark"><CardContent className="py-16 text-center text-gray-400">Selecione um bar.</CardContent></Card>
                    : s.el ? s.el(barId) : <EmBreve o={s.o || s.label} />}
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>
        ))}
      </Tabs>
    </PageShell>
  );
}
