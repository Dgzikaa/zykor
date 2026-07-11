'use client';

import dynamic from 'next/dynamic';
import { HorarioPicoChart } from '@/components/ferramentas/HorarioPicoChart';
import { ConsumoPorHorarioChart } from '@/components/ferramentas/ConsumoPorHorarioChart';
import ProdutosDoDiaDataTable from '@/components/ferramentas/ProdutosDoDiaDataTable';
import { useGraficoTheme } from '@/components/graficos/GraficoBase';
import { GraficoBarra } from '@/components/graficos/Charts';
import { formatCurrency } from '@/lib/utils';
import { EventoResponse, Gran } from './types';

// ECharts inline (barra + 2 linhas no 2º eixo, 100%-empilhado, barra+linha com eixos
// invertidos) — sem equivalente no catálogo. Padrão: dynamic + useGraficoTheme + option custom.
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

function ddmm(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// rótulos de valor nas barras
const lblCompact = (v: any) => {
  const n = Number(v) || 0;
  if (n === 0) return '';
  return Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`;
};
const lblPct = (v: any) => {
  const n = Number(v) || 0;
  return n >= 6 ? `${Math.round(n)}%` : ''; // esconde fatia muito pequena
};
const fmtKAxis = (v: number) => `${(v / 1000).toFixed(0)}k`;
const LBL_STYLE = { fontSize: 10, fill: '#6b7280', fontWeight: 600 } as const;
const LBL_PCT_STYLE = { fontSize: 9, fill: '#ffffff', fontWeight: 700 } as const;

interface Props {
  data: EventoResponse;
  dataSelecionada: string;
  onDataChange: (d: string) => void;
  gran?: Gran;
}

export function TabRelatorios({ data, dataSelecionada, onDataChange, gran = 'dia' }: Props) {
  const th = useGraficoTheme();
  const m = data.metricas!;
  const baseEventos = data.baseline?.eventos ?? [];
  const isPeriodo = gran !== 'dia';

  const ponto = (e: any, atual: boolean) => ({
    label: ddmm(e.data_evento),
    faturamento: Math.round(e.faturamento),
    publico: Math.round(e.publico),
    reservas: Math.round(e.res_tot || 0),
    c_art: Math.round(e.c_art),
    ticket: Math.round(e.ticket),
    comida: Number(e.percent_comida.toFixed(1)),
    bebida: Number(e.percent_bebida.toFixed(1)),
    drink: Number(e.percent_drink.toFixed(1)),
    atual,
  });

  // Dia: 4 datas anteriores (desc) + este evento. Período: eventos do período (asc).
  const serie = isPeriodo
    ? baseEventos.map((e) => ponto(e, false))
    : [
        ...[...baseEventos].reverse().map((e) => ponto(e, false)),
        ponto({ ...m, data_evento: dataSelecionada }, true),
      ];

  const temBaseline = serie.length > 1;

  // Leitura por dia da semana (período): agrega os eventos por dow
  const DIAS_SEM = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const porDiaSemana = (() => {
    const acc = DIAS_SEM.map((label) => ({
      label,
      fat: 0,
      publico: 0,
      cancel: 0,
      conta: 0,
      n: 0,
    }));
    baseEventos.forEach((e: any) => {
      const [y, mo, d] = e.data_evento.split('-').map(Number);
      const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
      const a = acc[dow];
      a.fat += e.faturamento || 0;
      a.publico += e.publico || 0;
      a.cancel += e.cancelamentos || 0;
      a.conta += e.conta_assinada || 0;
      a.n += 1;
    });
    return acc
      .filter((a) => a.n > 0)
      .map((a) => ({
        ...a,
        fatMed: a.n ? Math.round(a.fat / a.n) : 0,
        pubMed: a.n ? Math.round(a.publico / a.n) : 0,
      }));
  })();

  // NPS por dia (silver.nps_diario)
  const npsSerie = (data.nps_diario ?? []).map((n) => ({
    label: ddmm(n.data),
    score: Math.round(n.score),
    respostas: n.respostas,
  }));

  // ── Faturamento vs público/reservas — barra (fat) + 2 linhas no 2º eixo ──
  const optFatPublico = {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    grid: { top: 24, right: 48, bottom: 40, left: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: th.surface,
      borderColor: th.eixo,
      borderWidth: 1,
      textStyle: { color: th.texto, fontSize: 12 },
      formatter: (params: any[]) => {
        const head = params[0]?.axisValueLabel ?? params[0]?.name ?? '';
        const linhas = params
          .map((p) => {
            const val =
              p.seriesName === 'Faturamento'
                ? formatCurrency(Number(p.value))
                : Number(p.value).toLocaleString('pt-BR');
            return `${p.marker} ${p.seriesName}: <b>${val}</b>`;
          })
          .join('<br/>');
        return `${head}<br/>${linhas}`;
      },
    },
    legend: { bottom: 0, icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { color: th.texto2, fontSize: 11 } },
    xAxis: {
      type: 'category',
      data: serie.map((e) => e.label),
      axisLine: { lineStyle: { color: th.eixo } },
      axisTick: { show: false },
      axisLabel: { color: th.texto2, fontSize: 11, hideOverlap: true },
    },
    yAxis: [
      {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: th.grid } },
        axisLabel: { color: th.muted, fontSize: 10, formatter: (v: number) => fmtKAxis(v) },
      },
      {
        type: 'value',
        position: 'right',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: th.muted, fontSize: 10 },
      },
    ],
    series: [
      {
        name: 'Faturamento',
        type: 'bar',
        yAxisIndex: 0,
        data: serie.map((e) => e.faturamento),
        barMaxWidth: 30,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: (p: any) => (serie[p.dataIndex]?.atual ? '#2563eb' : '#93c5fd'),
        },
        label: {
          show: true,
          position: 'top',
          formatter: (p: any) => lblCompact(p.value),
          color: LBL_STYLE.fill,
          fontSize: LBL_STYLE.fontSize,
          fontWeight: LBL_STYLE.fontWeight,
        },
      },
      {
        name: 'Público',
        type: 'line',
        yAxisIndex: 1,
        data: serie.map((e) => e.publico),
        smooth: false,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#16a34a' },
        itemStyle: { color: '#16a34a' },
      },
      {
        name: 'Reservas',
        type: 'line',
        yAxisIndex: 1,
        data: serie.map((e) => e.reservas),
        smooth: false,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#d97706', type: 'dashed' },
        itemStyle: { color: '#d97706' },
      },
    ],
  };

  // ── Evolução do mix (%) — barra 100%-empilhada (comida/bebida/drink) ──
  // Normaliza para % do total da linha (geometria 100%-stacked); preserva o valor
  // real em `raw` para o rótulo centralizado e o tooltip.
  const mixRows = serie.map((e) => {
    const soma = e.comida + e.bebida + e.drink || 1;
    return {
      label: e.label,
      comida: { value: (e.comida / soma) * 100, raw: e.comida },
      bebida: { value: (e.bebida / soma) * 100, raw: e.bebida },
      drink: { value: (e.drink / soma) * 100, raw: e.drink },
    };
  });
  const mixSerie = (nome: string, key: 'comida' | 'bebida' | 'drink', cor: string) => ({
    name: nome,
    type: 'bar' as const,
    stack: 'mix',
    data: mixRows.map((r) => r[key]),
    itemStyle: { color: cor },
    label: {
      show: true,
      position: 'inside' as const,
      formatter: (p: any) => lblPct(p.data?.raw),
      color: LBL_PCT_STYLE.fill,
      fontSize: LBL_PCT_STYLE.fontSize,
      fontWeight: LBL_PCT_STYLE.fontWeight,
    },
  });
  const optMix = {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    grid: { top: 12, right: 14, bottom: 40, left: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: th.surface,
      borderColor: th.eixo,
      borderWidth: 1,
      textStyle: { color: th.texto, fontSize: 12 },
      formatter: (params: any[]) => {
        const head = params[0]?.axisValueLabel ?? params[0]?.name ?? '';
        const linhas = params
          .map((p) => `${p.marker} ${p.seriesName}: <b>${Number(p.data?.raw ?? 0).toFixed(1)}%</b>`)
          .join('<br/>');
        return `${head}<br/>${linhas}`;
      },
    },
    legend: { bottom: 0, icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { color: th.texto2, fontSize: 11 } },
    xAxis: {
      type: 'category',
      data: mixRows.map((r) => r.label),
      axisLine: { lineStyle: { color: th.eixo } },
      axisTick: { show: false },
      axisLabel: { color: th.texto2, fontSize: 11, hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: th.grid } },
      axisLabel: { color: th.muted, fontSize: 10, formatter: (v: number) => `${v}%` },
    },
    series: [
      mixSerie('Comida', 'comida', '#f59e0b'),
      mixSerie('Bebida', 'bebida', '#3b82f6'),
      mixSerie('Drink', 'drink', '#8b5cf6'),
    ],
  };

  // ── NPS por dia — barra (respostas, 2º eixo à direita) + linha (score, eixo esq. -100..100) ──
  const optNps = {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    grid: { top: 16, right: 48, bottom: 40, left: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: th.surface,
      borderColor: th.eixo,
      borderWidth: 1,
      textStyle: { color: th.texto, fontSize: 12 },
    },
    legend: { bottom: 0, icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { color: th.texto2, fontSize: 11 } },
    xAxis: {
      type: 'category',
      data: npsSerie.map((n) => n.label),
      axisLine: { lineStyle: { color: th.eixo } },
      axisTick: { show: false },
      axisLabel: { color: th.texto2, fontSize: 10, hideOverlap: true },
    },
    yAxis: [
      {
        type: 'value',
        min: -100,
        max: 100,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: th.grid } },
        axisLabel: { color: th.muted, fontSize: 10 },
      },
      {
        type: 'value',
        position: 'right',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: th.muted, fontSize: 10 },
      },
    ],
    series: [
      {
        name: 'Respostas',
        type: 'bar',
        yAxisIndex: 1,
        data: npsSerie.map((n) => n.respostas),
        barMaxWidth: 30,
        itemStyle: { color: '#e5e7eb', borderRadius: [4, 4, 0, 0] },
      },
      {
        name: 'NPS',
        type: 'line',
        yAxisIndex: 0,
        data: npsSerie.map((n) => n.score),
        smooth: false,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#8b5cf6' },
        itemStyle: { color: '#8b5cf6' },
      },
    ],
  };

  return (
    <div className="space-y-4">
      {/* Faturamento por hora — só faz sentido na visão de dia único */}
      {!isPeriodo && (
        <HorarioPicoChart dataSelecionada={dataSelecionada} onDataChange={onDataChange} />
      )}

      {/* Consumo por horário (top produtos por hora) — visão de dia único */}
      {!isPeriodo && <ConsumoPorHorarioChart dataSelecionada={dataSelecionada} />}

      {temBaseline ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Faturamento x Público */}
          <ChartCard
            titulo={isPeriodo ? 'Faturamento por evento' : 'Faturamento vs últimas datas equivalentes'}
            descricao={
              isPeriodo
                ? 'Faturamento e público de cada evento do período'
                : 'Comparação deste evento com as 4 datas anteriores do mesmo dia da semana'
            }
          >
            <ReactECharts option={optFatPublico} style={{ height: 260, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge lazyUpdate />
          </ChartCard>

          {/* Custo artístico */}
          <ChartCard
            titulo={isPeriodo ? 'Custo artístico por evento' : 'Custo artístico vs últimas datas'}
            descricao={
              isPeriodo
                ? 'Quanto cada atração custou no período'
                : 'Quanto a atração custou em relação às datas anteriores'
            }
          >
            <GraficoBarra
              data={serie}
              xKey="label"
              valueKey="c_art"
              height={260}
              nomeBarra="Custo artístico"
              formatV={lblCompact}
              mostrarRotulo
              corPorItem={(_v, i) => (serie[i]?.atual ? '#d97706' : '#fcd34d')}
            />
          </ChartCard>

          {/* Evolução do mix */}
          <ChartCard
            titulo="Evolução do mix (%)"
            descricao="Como a divisão comida / bebida / drink mudou ao longo das datas"
          >
            <ReactECharts option={optMix} style={{ height: 260, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge lazyUpdate />
          </ChartCard>

          {/* Ticket médio */}
          <ChartCard
            titulo={isPeriodo ? 'Ticket médio por evento' : 'Ticket médio vs últimas datas'}
            descricao="Consumo médio por pessoa ao longo das datas"
          >
            <GraficoBarra
              data={serie}
              xKey="label"
              valueKey="ticket"
              height={260}
              nomeBarra="Ticket médio"
              formatV={lblCompact}
              mostrarRotulo
              corPorItem={(_v, i) => (serie[i]?.atual ? '#16a34a' : '#86efac')}
            />
          </ChartCard>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center text-sm text-gray-400">
          {isPeriodo
            ? 'Sem eventos suficientes no período para os gráficos.'
            : 'Sem datas anteriores suficientes para comparação histórica.'}
        </div>
      )}

      {/* Leitura por DIA DA SEMANA + NPS por dia (só período) */}
      {isPeriodo && porDiaSemana.length > 0 && (
        <>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-2">
            Por dia da semana
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard
              titulo="Faturamento médio por dia da semana"
              descricao="Qual dia da semana rende mais, em média"
            >
              <GraficoBarra
                data={porDiaSemana}
                xKey="label"
                valueKey="fatMed"
                height={240}
                nomeBarra="Fat. médio"
                cor="#2563eb"
                formatV={fmtKAxis}
              />
            </ChartCard>

            <ChartCard
              titulo="Público médio por dia da semana"
              descricao="Movimento típico de cada dia"
            >
              <GraficoBarra
                data={porDiaSemana}
                xKey="label"
                valueKey="pubMed"
                height={240}
                nomeBarra="Público médio"
                cor="#16a34a"
              />
            </ChartCard>

            <ChartCard
              titulo="Cancelamentos por dia da semana"
              descricao="Onde se concentra o cancelamento (R$)"
            >
              <GraficoBarra
                data={porDiaSemana}
                xKey="label"
                valueKey="cancel"
                height={240}
                nomeBarra="Cancelamentos"
                cor="#dc2626"
                formatV={fmtKAxis}
              />
            </ChartCard>

            <ChartCard
              titulo="Conta assinada por dia da semana"
              descricao="Onde se concentra a conta assinada (R$)"
            >
              <GraficoBarra
                data={porDiaSemana}
                xKey="label"
                valueKey="conta"
                height={240}
                nomeBarra="Conta assinada"
                cor="#d97706"
                formatV={fmtKAxis}
              />
            </ChartCard>
          </div>
        </>
      )}

      {isPeriodo && npsSerie.length > 0 && (
        <ChartCard
          titulo="NPS por dia"
          descricao="Evolução diária do NPS no período (faixa -100 a 100)"
        >
          <ReactECharts option={optNps} style={{ height: 260, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge lazyUpdate />
        </ChartCard>
      )}

      {/* Produtos mais vendidos — visão de dia único */}
      {!isPeriodo && <ProdutosDoDiaDataTable dataSelecionada={dataSelecionada} />}
    </div>
  );
}

function ChartCard({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{titulo}</h3>
      {descricao && <p className="text-[11px] text-gray-400 mb-2">{descricao}</p>}
      {children}
    </div>
  );
}
