'use client';

import { useMemo, useState } from 'react';
import { useApiSWR } from '@/hooks/useApiSWR';
import {
  ChartCard, ChartGrid, GraficoBarraH, GraficoBarrasAgrupadas, GraficoDonut, GraficoLinha,
  HeroRow, type Kpi,
} from '@/components/graficos/Charts';
import { Loader2, TrendingDown, Repeat, Boxes, ChefHat, Drumstick } from 'lucide-react';

/**
 * ANÁLISES DE DESVIO — a evolução, não o retrato de uma semana.
 *
 * Gonza (20/08/2026): "gráficos dos desvios semana a semana, mês a mês. O desvio aberto por
 * Insumo/Produção/Proteína evoluindo no tempo. Quais insumos estão dando mais desvio, ranking".
 *
 * Cada ponto do gráfico é uma JANELA ENTRE DUAS CONTAGENS — que é a única forma de o desvio
 * existir. Por isso o eixo mostra a data de fechamento da contagem e não "semana 33": o time
 * conta quando conta, e forçar um calendário fixo criaria número que a tela principal não
 * confirma.
 */

const fmtBRL = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtBRL2 = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDM = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');

const GRUPO_ICONE: Record<string, any> = { insumo: Boxes, producao: ChefHat, proteina: Drumstick };
const GRUPO_LABEL: Record<string, string> = { insumo: 'Insumo', producao: 'Produção', proteina: 'Proteína' };

export function AbaAnalises() {
  const [tipo, setTipo] = useState<'semanal' | 'mensal'>('semanal');
  const [janelas, setJanelas] = useState(12);
  const [grupo, setGrupo] = useState<'todos' | 'insumo' | 'producao' | 'proteina'>('todos');

  const { data, isLoading } = useApiSWR<any>(
    `/api/operacional/desvios/analises?tipo=${tipo}&janelas=${janelas}`);

  const serie = useMemo(() => (data?.serie || []).map((s: any) => ({
    ...s,
    rotulo: fmtDM(s.fim),
    insumos_perdas: s.insumos.perdas,
    producoes_perdas: s.producoes.perdas,
    proteinas_perdas: s.proteinas.perdas,
  })), [data]);

  const ranking = useMemo(() => {
    const base = (data?.ranking || []) as any[];
    return grupo === 'todos' ? base : base.filter((r) => r.grupo === grupo);
  }, [data, grupo]);

  const kpis: Kpi[] = useMemo(() => {
    if (!serie.length) return [];
    const ultimo = serie[serie.length - 1];
    const anterior = serie.length > 1 ? serie[serie.length - 2] : null;
    const delta = anterior && anterior.perda_total > 0
      ? ((ultimo.perda_total - anterior.perda_total) / anterior.perda_total) * 100 : null;
    const recorrentes = (data?.ranking || []).filter((r: any) => r.recorrente).length;
    return [
      { label: `Perda no último período`, valor: fmtBRL(ultimo.perda_total), sub: `${fmtDM(ultimo.ini)} a ${fmtDM(ultimo.fim)}`,
        delta, invLower: true, icon: TrendingDown },
      { label: `Média por ${tipo === 'semanal' ? 'semana' : 'mês'}`, valor: fmtBRL(data?.total?.media_por_periodo || 0),
        sub: `${serie.length} períodos` },
      { label: 'Perda acumulada', valor: fmtBRL(data?.total?.perdas || 0), sub: 'no intervalo analisado' },
      { label: 'Itens recorrentes', valor: String(recorrentes), sub: 'perdem na maioria dos períodos', icon: Repeat },
    ];
  }, [serie, data, tipo]);

  if (isLoading) {
    return <div className="py-20 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-gray-400" /></div>;
  }
  if (!serie.length) {
    return (
      <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
        Ainda não há duas contagens {tipo === 'semanal' ? 'semanais' : 'mensais'} para comparar.
        O desvio só existe entre uma contagem e a seguinte.
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-lg border border-[hsl(var(--border))] overflow-hidden">
          {(['semanal', 'mensal'] as const).map((t) => (
            <button key={t} onClick={() => setTipo(t)}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                tipo === t ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-[hsl(var(--muted))]'}`}>
              {t === 'semanal' ? 'Semana a semana' : 'Mês a mês'}
            </button>
          ))}
        </div>
        <select value={janelas} onChange={(e) => setJanelas(Number(e.target.value))}
          className="h-8 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 text-xs">
          {[6, 12, 18, 26].map((j) => <option key={j} value={j}>últimos {j} períodos</option>)}
        </select>
        <span className="text-[11px] text-gray-400">
          cada ponto = intervalo entre duas contagens · itens marcados com o olhinho ficam de fora
        </span>
      </div>

      <HeroRow kpis={kpis} cols={4} />

      <ChartGrid cols={2}>
        <ChartCard titulo="Perda por período" subtitulo="Insumos, produções e proteínas — empilhados" span={2}>
          <GraficoBarrasAgrupadas
            data={serie} xKey="rotulo" height={300} formatV={fmtBRL}
            series={[
              { key: 'insumos_perdas', nome: 'Insumos' },
              { key: 'producoes_perdas', nome: 'Produções' },
              { key: 'proteinas_perdas', nome: 'Proteínas' },
            ]}
          />
        </ChartCard>

        <ChartCard titulo="Evolução por origem" subtitulo="a mesma perda, em linha — pra ver a tendência de cada uma">
          <GraficoLinha
            data={serie} xKey="rotulo" height={280} formatV={fmtBRL}
            series={[
              { key: 'insumos_perdas', nome: 'Insumos' },
              { key: 'producoes_perdas', nome: 'Produções' },
              { key: 'proteinas_perdas', nome: 'Proteínas' },
            ]}
          />
        </ChartCard>

        <ChartCard titulo="Onde a perda se concentra" subtitulo="por área, no intervalo analisado">
          {(data?.areas || []).length
            ? <GraficoDonut data={data.areas} nameKey="nome" valueKey="perda" height={280} formatV={fmtBRL}
                centro={fmtBRL(data?.total?.perdas || 0)} />
            : <div className="py-16 text-center text-xs text-gray-400">Sem perda registrada no período.</div>}
        </ChartCard>

        <ChartCard titulo="Maiores desvios acumulados" subtitulo="soma da perda em todos os períodos" span={2}
          right={
            <div className="inline-flex rounded-lg border border-[hsl(var(--border))] overflow-hidden">
              {(['todos', 'insumo', 'producao', 'proteina'] as const).map((g) => (
                <button key={g} onClick={() => setGrupo(g)}
                  className={`px-2.5 py-1 text-[11px] font-medium transition ${
                    grupo === g ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-[hsl(var(--muted))]'}`}>
                  {g === 'todos' ? 'Todos' : GRUPO_LABEL[g] + 's'}
                </button>
              ))}
            </div>
          }>
          {ranking.length ? (
            <GraficoBarraH data={ranking.map((r) => ({ nome: r.nome, perda: r.perda }))}
              xKey="nome" valueKey="perda" height={Math.min(420, 40 + ranking.length * 26)}
              formatV={fmtBRL} maxItens={14} />
          ) : <div className="py-16 text-center text-xs text-gray-400">Nada nesta origem.</div>}
        </ChartCard>
      </ChartGrid>

      {/* Ranking em tabela — o gráfico mostra a ordem, a tabela responde "por que". */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
        <div className="px-4 py-3 border-b border-[hsl(var(--border))]">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Ranking de desvios</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <b>Recorrente</b> = perdeu na maioria dos períodos. É o que vale investigar primeiro —
            um item que perdeu muito uma vez costuma ser erro de contagem; o que perde sempre é processo.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-gray-500 bg-[hsl(var(--muted))]/40">
              <tr>
                <th className="text-left px-3 py-2">#</th>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-left px-3 py-2">Origem</th>
                <th className="text-left px-3 py-2">Área</th>
                <th className="text-right px-3 py-2">Perda acumulada</th>
                <th className="text-right px-3 py-2">Períodos c/ perda</th>
                <th className="text-right px-3 py-2">Média por período</th>
              </tr>
            </thead>
            <tbody>
              {ranking.slice(0, 30).map((r: any, i: number) => {
                const Icone = GRUPO_ICONE[r.grupo] || Boxes;
                return (
                  <tr key={`${r.grupo}-${r.codigo}`} className="border-t border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/30">
                    <td className="px-3 py-2 text-gray-400 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-gray-900 dark:text-white">{r.nome}</span>
                      <span className="block text-[10px] text-gray-400">{r.codigo}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                        <Icone className="w-3.5 h-3.5" />{GRUPO_LABEL[r.grupo]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{r.grupo === 'proteina' ? '—' : r.area}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-rose-600 dark:text-rose-400">{fmtBRL2(r.perda)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.janelas_com_perda}
                      {r.recorrente && (
                        <span className="ml-1.5 text-[9px] uppercase tracking-wide px-1 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold">
                          recorrente
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtBRL2(r.media)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
