'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { GraficoLinha, GraficoBarra, GraficoBarraH } from '@/components/graficos/Charts';
import { cn } from '@/lib/utils';
import { Smile, Loader2, TrendingUp, TrendingDown, Users, CalendarDays, Award, Minus } from 'lucide-react';

type Dimensao = { key: string; label: string; pergunta: string };
type LinhaSemanal = { data_pesquisa: string; setor: string; quorum: number; media_geral: number | null; resultado_percentual: number | null; [k: string]: any };
type LinhaMensal = { ano: number; mes: number; periodo: string; setor: string; media_geral: number | null; resultado_percentual: number | null; [k: string]: any };
type LinhaMarca = { periodo: string; quorum: number | null; resultado_percentual: number | null };
type Resposta = {
  dimensoes: Dimensao[];
  setores: string[];
  semanal: LinhaSemanal[];
  mensal: LinhaMensal[];
  marca_empregadora: LinhaMarca[];
  resumo: { ultima: LinhaSemanal | null; variacao: number | null; total_pesquisas: number };
};

const fmtPct = (v: number | null | undefined) => (v == null ? '—' : `${v.toFixed(1).replace('.', ',')}%`);
const fmtData = (d: string) => { const [y, m, dd] = d.split('-'); return `${dd}/${m}`; };

// A escala é tipo eNPS (%favorável - %desfavorável), então cruzar o zero é o que
// importa — não a distância pra 100. Por isso o vermelho começa no negativo.
const corResultado = (v: number | null | undefined) =>
  v == null ? 'text-muted-foreground'
  : v < 0 ? 'text-red-600 dark:text-red-400'
  : v < 50 ? 'text-amber-600 dark:text-amber-400'
  : v < 75 ? 'text-sky-600 dark:text-sky-400'
  : 'text-emerald-600 dark:text-emerald-400';
const corBarra = (v: number) => (v < 0 ? '#e11d48' : v < 50 ? '#f59e0b' : v < 75 ? '#0ea5e9' : '#10b981');

export default function PesquisaFelicidadePage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [setor, setSetor] = useState('TODOS');
  const [meses, setMeses] = useState(12);

  useEffect(() => {
    setPageTitle('😊 Pesquisa da Felicidade');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const endpoint = selectedBar
    ? `/api/rh/pesquisa-felicidade?setor=${encodeURIComponent(setor)}&meses=${meses}`
    : null;
  const { data, isLoading } = useApiSWR<Resposta>(endpoint);

  const dimensoes = data?.dimensoes || [];
  const semanal = useMemo(() => data?.semanal || [], [data]);

  // Série do setor escolhido, na ordem em que as pesquisas aconteceram.
  const evolucao = useMemo(
    () => semanal.map((r) => ({ label: fmtData(r.data_pesquisa), resultado: r.resultado_percentual, media: r.media_geral })),
    [semanal],
  );

  const ultima = data?.resumo?.ultima || null;

  // Dimensões da pesquisa mais recente DO SETOR filtrado.
  const dimsUltima = useMemo(() => {
    const ref = semanal.length ? semanal[semanal.length - 1] : null;
    if (!ref) return [];
    return dimensoes.map((d) => ({ dimensao: d.label, valor: Number(ref[d.key] ?? 0) }));
  }, [semanal, dimensoes]);

  // Última rodada completa: todos os setores da data mais recente da planilha.
  const porSetor = useMemo(() => {
    if (!data?.semanal?.length) return [];
    const todas = data.semanal;
    const ultimaData = todas[todas.length - 1].data_pesquisa;
    return todas
      .filter((r) => r.data_pesquisa === ultimaData && r.setor !== 'TODOS')
      .map((r) => ({ setor: r.setor, resultado: Number(r.resultado_percentual ?? 0), quorum: r.quorum }))
      .sort((a, b) => b.resultado - a.resultado);
  }, [data]);

  const mensal = useMemo(
    () => (data?.mensal || []).map((r) => ({ label: r.periodo, resultado: r.resultado_percentual, media: r.media_geral })),
    [data],
  );

  const marca = useMemo(
    () => (data?.marca_empregadora || []).map((r) => ({ label: r.periodo, resultado: Number(r.resultado_percentual ?? 0), quorum: r.quorum })),
    [data],
  );
  const ultimaMarca = marca.length ? marca[marca.length - 1] : null;

  const variacao = data?.resumo?.variacao ?? null;

  return (
    <ProtectedRoute>
      <div className="mx-auto px-3 py-5">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 p-5 mb-5 shadow-sm">
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 text-white">
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                <Smile className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight">Pesquisa da Felicidade</h1>
                <p className="text-sm text-white/80">Clima da equipe por setor — resposta anônima, sem identificação individual</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={setor}
                onChange={(e) => setSetor(e.target.value)}
                className="h-9 rounded-md border-0 bg-white/15 backdrop-blur px-2 text-sm text-white [&>option]:text-foreground"
              >
                {(data?.setores || ['TODOS']).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={meses}
                onChange={(e) => setMeses(Number(e.target.value))}
                className="h-9 rounded-md border-0 bg-white/15 backdrop-blur px-2 text-sm text-white [&>option]:text-foreground"
              >
                <option value={6}>6 meses</option>
                <option value={12}>12 meses</option>
                <option value={24}>24 meses</option>
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
        ) : !semanal.length ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <Smile className="w-9 h-9 mx-auto mb-2 opacity-40" />
            Nenhuma pesquisa no período para este setor.
          </CardContent></Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Kpi
                icon={Smile}
                label={`Última pesquisa${ultima ? ` · ${fmtData(ultima.data_pesquisa)}` : ''}`}
                valor={fmtPct(semanal[semanal.length - 1]?.resultado_percentual)}
                cor={corResultado(semanal[semanal.length - 1]?.resultado_percentual)}
                tint="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              />
              <Kpi
                icon={variacao == null ? Minus : variacao >= 0 ? TrendingUp : TrendingDown}
                label="Variação vs. anterior"
                valor={variacao == null ? '—' : `${variacao >= 0 ? '+' : ''}${variacao.toFixed(1).replace('.', ',')} p.p.`}
                cor={variacao == null ? '' : variacao >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
                tint="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
              />
              <Kpi
                icon={Users}
                label="Quórum da última"
                valor={String(semanal[semanal.length - 1]?.quorum ?? '—')}
                tint="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
              />
              <Kpi
                icon={Award}
                label={`Marca empregadora${ultimaMarca ? ` · ${ultimaMarca.label}` : ''}`}
                valor={fmtPct(ultimaMarca?.resultado ?? null)}
                cor={corResultado(ultimaMarca?.resultado)}
                tint="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              />
            </div>

            <Tabs defaultValue="semanal" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="semanal"><CalendarDays className="w-4 h-4 mr-1.5" />Semanal</TabsTrigger>
                <TabsTrigger value="mensal">Mensal</TabsTrigger>
                <TabsTrigger value="marca"><Award className="w-4 h-4 mr-1.5" />Marca empregadora</TabsTrigger>
                <TabsTrigger value="tabela">Tabela</TabsTrigger>
              </TabsList>

              <TabsContent value="semanal" className="space-y-4">
                <Bloco titulo={`Evolução do resultado — ${setor}`} legenda="Escala tipo eNPS: % favorável menos % desfavorável. Abaixo de zero, o desfavorável é maioria.">
                  <GraficoLinha
                    data={evolucao}
                    xKey="label"
                    series={[{ key: 'resultado', nome: 'Resultado', cor: '#10b981' }]}
                    height={260}
                    formatV={(v) => `${v}%`}
                    markLines={[{ valor: 0, label: 'Zero', cor: '#94a3b8' }]}
                    connectNulls
                  />
                </Bloco>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Bloco titulo="As 5 dimensões na última pesquisa" legenda={dimensoes.map((d) => `${d.label} = "${d.pergunta}"`).join(' · ')}>
                    <GraficoBarraH
                      data={dimsUltima}
                      xKey="dimensao"
                      valueKey="valor"
                      height={230}
                      diverging
                      formatV={(v) => `${v}%`}
                    />
                  </Bloco>

                  <Bloco titulo="Resultado por setor na última rodada" legenda={porSetor.length ? `${porSetor.length} setores responderam` : undefined}>
                    <GraficoBarra
                      data={porSetor}
                      xKey="setor"
                      valueKey="resultado"
                      height={230}
                      formatV={(v) => `${v}%`}
                      nomeBarra="Resultado"
                      rotacaoX={30}
                      corPorItem={(v) => corBarra(v)}
                    />
                  </Bloco>
                </div>
              </TabsContent>

              <TabsContent value="mensal" className="space-y-4">
                <Bloco
                  titulo={`Consolidado mensal — ${setor}`}
                  legenda="Fechamento do mês feito na planilha, ponderado por quórum — não é a média simples das semanas."
                >
                  <GraficoLinha
                    data={mensal}
                    xKey="label"
                    series={[{ key: 'resultado', nome: 'Resultado', cor: '#0ea5e9' }]}
                    height={280}
                    formatV={(v) => `${v}%`}
                    markLines={[{ valor: 0, cor: '#94a3b8' }]}
                    rotacaoX={30}
                    connectNulls
                  />
                </Bloco>
              </TabsContent>

              <TabsContent value="marca" className="space-y-4">
                <Bloco titulo="NPS de Marca Empregadora" legenda="Pesquisa mensal separada: o quanto a equipe recomendaria trabalhar aqui.">
                  <GraficoBarra
                    data={marca}
                    xKey="label"
                    valueKey="resultado"
                    height={280}
                    formatV={(v) => `${v}%`}
                    nomeBarra="NPS"
                    rotacaoX={30}
                    corPorItem={(v) => corBarra(v)}
                  />
                </Bloco>
              </TabsContent>

              <TabsContent value="tabela">
                <Card className="p-0 overflow-x-auto rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-muted/40">
                      <tr>
                        <th className="text-left px-3 py-2 whitespace-nowrap">Data</th>
                        <th className="text-left px-3 py-2 whitespace-nowrap">Setor</th>
                        <th className="text-right px-3 py-2">Quórum</th>
                        {dimensoes.map((d) => <th key={d.key} className="text-right px-3 py-2 whitespace-nowrap">{d.label}</th>)}
                        <th className="text-right px-3 py-2">Média</th>
                        <th className="text-right px-3 py-2">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...semanal].reverse().map((r) => (
                        <tr key={`${r.data_pesquisa}-${r.setor}`} className="border-b last:border-0 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10">
                          <td className="px-3 py-1.5 whitespace-nowrap">{r.data_pesquisa.split('-').reverse().join('/')}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{r.setor}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{r.quorum}</td>
                          {dimensoes.map((d) => (
                            <td key={d.key} className={cn('px-3 py-1.5 text-right tabular-nums', corResultado(r[d.key]))}>
                              {fmtPct(r[d.key])}
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                            {r.media_geral == null ? '—' : r.media_geral.toFixed(2).replace('.', ',')}
                          </td>
                          <td className={cn('px-3 py-1.5 text-right tabular-nums font-semibold', corResultado(r.resultado_percentual))}>
                            {fmtPct(r.resultado_percentual)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}

function Kpi({ icon: Icon, label, valor, cor, tint }: { icon: any; label: string; valor: string; cor?: string; tint?: string }) {
  return (
    <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">{label}</span>
          <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', tint || 'bg-muted')}><Icon className="w-4 h-4" /></span>
        </div>
        <div className={cn('text-2xl font-bold mt-2 leading-none tabular-nums', cor)}>{valor}</div>
      </CardContent>
    </Card>
  );
}

function Bloco({ titulo, legenda, children }: { titulo: string; legenda?: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
      <CardContent className="py-4">
        <div className="text-sm font-semibold mb-0.5">{titulo}</div>
        {legenda && <div className="text-[11px] text-muted-foreground mb-2">{legenda}</div>}
        {children}
      </CardContent>
    </Card>
  );
}
