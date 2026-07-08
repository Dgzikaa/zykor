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

const SUBS: Record<string, { key: string; label: string; el?: (barId: number) => React.ReactNode; o?: string }[]> = {
  producao: [
    { key: 'cmv', label: 'Estoque & CMV', el: (b) => <CmvEstoque barId={b} /> },
    { key: 'producoes', label: 'Produções', el: (b) => <Producoes barId={b} /> },
    { key: 'compras', label: 'Compras', el: (b) => <Compras barId={b} /> },
    { key: 'desvios', label: 'Desvios', o: 'perdas e sobras' },
  ],
  financeiro: [
    { key: 'dre', label: 'DRE', o: 'receita × lucro por mês' },
    { key: 'dfc', label: 'DFC', o: 'fluxo de caixa' },
    { key: 'stone', label: 'Conciliação', o: 'mix e taxas Stone' },
  ],
  estrategico: [
    { key: 'orcamentacao', label: 'Orçamentação', o: 'plan × proj × real' },
    { key: 'desempenho', label: 'Desempenho', o: 'faturamento × meta semanal' },
    { key: 'planejamento', label: 'Planejamento', o: 'empilhamento M1 × real' },
  ],
};

export default function GraficosPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  const [modulo, setModulo] = useState('producao');
  const [sub, setSub] = useState<Record<string, string>>({ producao: 'cmv', financeiro: 'dre', estrategico: 'orcamentacao' });

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
