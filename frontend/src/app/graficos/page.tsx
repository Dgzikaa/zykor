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

const SUBS: Record<string, { key: string; label: string; el?: (barId: number) => React.ReactNode; o?: string }[]> = {
  producao: [
    { key: 'cmv', label: 'Estoque & CMV', el: (b) => <CmvEstoque barId={b} /> },
    { key: 'producoes', label: 'Produções', o: 'nota das produções' },
    { key: 'desvios', label: 'Desvios', o: 'perdas e sobras' },
    { key: 'compras', label: 'Compras', o: 'compras e fornecedores' },
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
