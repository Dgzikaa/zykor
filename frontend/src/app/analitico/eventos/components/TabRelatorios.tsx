'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { HorarioPicoChart } from '@/components/ferramentas/HorarioPicoChart';
import ProdutosDoDiaDataTable from '@/components/ferramentas/ProdutosDoDiaDataTable';
import { formatCurrency } from '@/lib/utils';
import { EventoResponse, Gran } from './types';

function ddmm(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

interface Props {
  data: EventoResponse;
  dataSelecionada: string;
  onDataChange: (d: string) => void;
  gran?: Gran;
}

export function TabRelatorios({ data, dataSelecionada, onDataChange, gran = 'dia' }: Props) {
  const m = data.metricas!;
  const baseEventos = data.baseline?.eventos ?? [];
  const isPeriodo = gran !== 'dia';

  const ponto = (e: any, atual: boolean) => ({
    label: ddmm(e.data_evento),
    faturamento: Math.round(e.faturamento),
    publico: Math.round(e.publico),
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

  return (
    <div className="space-y-4">
      {/* Faturamento por hora — só faz sentido na visão de dia único */}
      {!isPeriodo && (
        <HorarioPicoChart dataSelecionada={dataSelecionada} onDataChange={onDataChange} />
      )}

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
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={serie} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="l"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value: any, name: any) =>
                    name === 'Faturamento'
                      ? formatCurrency(Number(value))
                      : Number(value).toLocaleString('pt-BR')
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="l" dataKey="faturamento" name="Faturamento" radius={[4, 4, 0, 0]}>
                  {serie.map((e, i) => (
                    <Cell key={i} fill={e.atual ? '#2563eb' : '#93c5fd'} />
                  ))}
                </Bar>
                <Line
                  yAxisId="r"
                  dataKey="publico"
                  name="Público"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={serie} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                <Bar dataKey="c_art" name="Custo artístico" radius={[4, 4, 0, 0]}>
                  {serie.map((e, i) => (
                    <Cell key={i} fill={e.atual ? '#d97706' : '#fcd34d'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Evolução do mix */}
          <ChartCard
            titulo="Evolução do mix (%)"
            descricao="Como a divisão comida / bebida / drink mudou ao longo das datas"
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={serie} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} stackOffset="expand">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip formatter={(value: any) => `${Number(value).toFixed(1)}%`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="comida" name="Comida" stackId="mix" fill="#f59e0b" />
                <Bar dataKey="bebida" name="Bebida" stackId="mix" fill="#3b82f6" />
                <Bar dataKey="drink" name="Drink" stackId="mix" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Ticket médio */}
          <ChartCard
            titulo={isPeriodo ? 'Ticket médio por evento' : 'Ticket médio vs últimas datas'}
            descricao="Consumo médio por pessoa ao longo das datas"
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={serie} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}`} />
                <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                <Bar dataKey="ticket" name="Ticket médio" radius={[4, 4, 0, 0]}>
                  {serie.map((e, i) => (
                    <Cell key={i} fill={e.atual ? '#16a34a' : '#86efac'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center text-sm text-gray-400">
          {isPeriodo
            ? 'Sem eventos suficientes no período para os gráficos.'
            : 'Sem datas anteriores suficientes para comparação histórica.'}
        </div>
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
