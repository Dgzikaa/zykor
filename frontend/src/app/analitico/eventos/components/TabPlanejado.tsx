'use client';

import { GraficoBarrasAgrupadas } from '@/components/graficos/Charts';
import {
  AlertTriangle,
  CalendarHeart,
  Camera,
  Minus,
  Palette,
  Target,
  TrendingDown,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { ContextoData, EventoResponse, Gran, PlanoEventoRow, PlanoSnapshot } from './types';

function moedaCompacta(v: number) {
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(1).replace('.', ',')}k`;
  return formatCurrency(v);
}
const fmtPct = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${v.toFixed(1)}%`;

const TIPO_LABEL: Record<string, string> = {
  inicial: 'Plano inicial',
  revisao: 'Revisão',
  final: 'Realizado (final)',
};

// Card de comparação Planejado | Realizado | Δ.
// inverso=true para custos (gastar menos = bom).
function CompareCard({
  icon,
  label,
  plan,
  real,
  fmt,
  inverso = false,
  pp = false,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  plan: number | null;
  real: number | null;
  fmt: (v: number) => string;
  inverso?: boolean;
  pp?: boolean; // delta em pontos percentuais (não calcula %)
  hint?: string;
}) {
  const has = plan != null && real != null;
  const delta = has ? (real as number) - (plan as number) : null;
  const deltaPct = has && (plan as number) !== 0 ? (delta! / (plan as number)) * 100 : null;
  const bom = delta == null ? null : inverso ? delta <= 0 : delta >= 0;
  const cor =
    bom == null ? 'text-gray-400' : bom ? 'text-emerald-600' : 'text-red-600';
  const Icone = delta == null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wide">Planejado</div>
          <div className="text-sm font-bold text-gray-500 dark:text-gray-300">
            {plan != null ? fmt(plan) : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wide">Realizado</div>
          <div className="text-sm font-bold text-gray-900 dark:text-white">
            {real != null ? fmt(real) : '—'}
          </div>
        </div>
      </div>
      <div className={`mt-2 flex items-center gap-1 text-xs font-semibold ${cor}`}>
        <Icone className="w-3.5 h-3.5" />
        {delta != null ? (
          <span>
            {delta >= 0 ? '+' : ''}
            {pp ? `${delta.toFixed(1)} pp` : fmt(delta)}
            {!pp && deltaPct != null && (
              <span className="ml-1 opacity-80">
                ({deltaPct >= 0 ? '+' : ''}
                {deltaPct.toFixed(1)}%)
              </span>
            )}
          </span>
        ) : (
          <span className="text-gray-400">sem comparação</span>
        )}
      </div>
      {hint && <p className="text-[10px] text-gray-400 mt-1 leading-tight">{hint}</p>}
    </div>
  );
}

interface Props {
  data: EventoResponse;
  gran: Gran;
}

export function TabPlanejado({ data, gran }: Props) {
  const p = data.planejado;

  if (!p || (p.n_eventos === 0 && p.n_realizados === 0)) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
        <Camera className="w-6 h-6 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Ainda não há plano congelado para este período.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          A &ldquo;foto&rdquo; do plano (meta + custos previstos) passa a ser registrada
          automaticamente a partir de agora, quando o evento é lançado.
        </p>
      </div>
    );
  }

  const isPeriodo = gran !== 'dia';
  const custosParciais =
    p.realizado.faturamento > 0 && p.realizado.c_art === 0 && p.plano.c_art > 0;

  // Série para o gráfico (semana/mês): plano vs realizado por evento
  const serie = (p.eventos || [])
    .filter((e) => e.fat_planejado != null || e.fat_realizado != null)
    .map((e: PlanoEventoRow) => {
      const [, mm, dd] = e.data_evento.split('-');
      return {
        label: `${dd}/${mm}`,
        nome: e.nome || '',
        planejado: e.fat_planejado ?? 0,
        realizado: e.fat_realizado ?? 0,
      };
    });

  const datas: ContextoData[] = p.contexto_datas || [];

  return (
    <div className="space-y-5">
      {/* Contexto de datas: feriados / datas especiais com ajuste histórico */}
      {datas.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
            <CalendarHeart className="w-4 h-4" />
            Contexto de datas
          </div>
          <div className="mt-2 space-y-1.5">
            {datas.map((d) => {
              const [, mm, dd] = d.data.split('-');
              const fraco = d.ajuste > 0 && d.ajuste < 0.9;
              const forte = d.ajuste >= 1.1;
              return (
                <div key={d.data} className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
                  {fraco ? (
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-red-500 flex-shrink-0" />
                  ) : (
                    <CalendarHeart className="w-3.5 h-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
                  )}
                  <span>
                    <strong>{`${dd}/${mm}`} — {d.nome}</strong>
                    {d.ajuste > 0 && (
                      <span className={fraco ? 'text-red-600 font-semibold' : forte ? 'text-emerald-600 font-semibold' : ''}>
                        {' '}
                        (histórico: {Math.round(d.ajuste * 100)}% do normal
                        {fraco ? ' — costuma faturar menos, cuidado com meta otimista' : forte ? ' — costuma faturar mais' : ''})
                      </span>
                    )}
                    {d.observacao && <span className="text-amber-700/70 dark:text-amber-300/60"> · {d.observacao}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cards de comparação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <CompareCard
          icon={<Target className="w-3.5 h-3.5" />}
          label="Faturamento (meta M1)"
          plan={p.plano.faturamento || null}
          real={p.realizado.faturamento || null}
          fmt={moedaCompacta}
        />
        <CompareCard
          icon={<Palette className="w-3.5 h-3.5" />}
          label="Custo artístico"
          plan={p.plano.c_art || null}
          real={p.realizado.c_art || null}
          fmt={moedaCompacta}
          inverso
          hint={custosParciais ? 'Realizado pode subir conforme o Conta Azul liquida.' : undefined}
        />
        <CompareCard
          icon={<Wrench className="w-3.5 h-3.5" />}
          label="Custo produção"
          plan={p.plano.c_prod || null}
          real={p.realizado.c_prod || null}
          fmt={moedaCompacta}
          inverso
        />
        <CompareCard
          icon={<Palette className="w-3.5 h-3.5" />}
          label="% Artístico / Faturamento"
          plan={p.plano.pct_art_fat}
          real={p.realizado.pct_art_fat}
          fmt={(v) => `${v.toFixed(1)}%`}
          inverso
          pp
        />
      </div>

      {/* Resumo do desvio de faturamento */}
      {p.plano.faturamento > 0 && p.realizado.faturamento > 0 && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            (p.delta.faturamento_pct ?? 0) >= 0
              ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'
          }`}
        >
          {(p.delta.faturamento_pct ?? 0) >= 0 ? (
            <>
              O período <strong>bateu / superou</strong> a meta planejada em{' '}
              <strong>{moedaCompacta(p.delta.faturamento)}</strong> ({p.delta.faturamento_pct}%).
            </>
          ) : (
            <>
              O período ficou <strong>{moedaCompacta(Math.abs(p.delta.faturamento))}</strong> abaixo
              da meta planejada ({p.delta.faturamento_pct}%). Vale revisar se a meta foi otimista
              demais para estas datas.
            </>
          )}
        </div>
      )}

      {/* Gráfico por evento (semana/mês) */}
      {isPeriodo && serie.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Planejado vs Realizado por evento
          </h3>
          <p className="text-[11px] text-gray-400 mb-2">
            Meta M1 congelada (claro) vs faturamento realizado (escuro) de cada evento do período.
          </p>
          <GraficoBarrasAgrupadas
            data={serie}
            xKey="label"
            series={[
              { key: 'planejado', nome: 'Planejado (M1)', cor: '#93c5fd' },
              { key: 'realizado', nome: 'Realizado', cor: '#2563eb' },
            ]}
            height={280}
            formatV={(v) => formatCurrency(v)}
          />
        </div>
      )}

      {/* Tabela por evento (semana/mês) */}
      {isPeriodo && p.eventos.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="text-left font-semibold px-3 py-2">Data</th>
                  <th className="text-left font-semibold px-3 py-2">Evento</th>
                  <th className="text-right font-semibold px-3 py-2">Meta M1</th>
                  <th className="text-right font-semibold px-3 py-2">Faturou</th>
                  <th className="text-right font-semibold px-3 py-2">Δ%</th>
                  <th className="text-right font-semibold px-3 py-2">%Art plan</th>
                  <th className="text-right font-semibold px-3 py-2">%Art real</th>
                </tr>
              </thead>
              <tbody>
                {p.eventos.map((e: PlanoEventoRow) => {
                  const [, mm, dd] = e.data_evento.split('-');
                  const dpos = (e.delta_fat_pct ?? 0) >= 0;
                  return (
                    <tr
                      key={e.evento_id}
                      className="border-t border-gray-100 dark:border-gray-700/50"
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500">{`${dd}/${mm}`}</td>
                      <td className="px-3 py-2 max-w-[260px] truncate text-gray-900 dark:text-gray-100">
                        {e.nome || '—'}
                        {e.n_revisoes > 0 && (
                          <span className="ml-1 text-[10px] text-amber-600">
                            ({e.n_revisoes} revisão{e.n_revisoes > 1 ? 'es' : ''})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">
                        {e.fat_planejado != null ? moedaCompacta(e.fat_planejado) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white">
                        {e.fat_realizado != null ? moedaCompacta(e.fat_realizado) : '—'}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          e.delta_fat_pct == null
                            ? 'text-gray-400'
                            : dpos
                              ? 'text-emerald-600'
                              : 'text-red-600'
                        }`}
                      >
                        {e.delta_fat_pct == null
                          ? '—'
                          : `${dpos ? '+' : ''}${e.delta_fat_pct}%`}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">
                        {fmtPct(e.pct_art_planejado)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">
                        {fmtPct(e.pct_art_realizado)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Linha do tempo de snapshots (visão de dia) */}
      {!isPeriodo && p.snapshots.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-gray-400" />
            Histórico do plano (fotos)
          </h3>
          <p className="text-[11px] text-gray-400 mb-3">
            Do plano inicial até o que de fato foi pago — para ver onde mudou.
          </p>
          <div className="space-y-2">
            {p.snapshots.map((s: PlanoSnapshot, i: number) => {
              const isFinal = s.tipo === 'final';
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                    isFinal
                      ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                      s.tipo === 'inicial'
                        ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                        : s.tipo === 'revisao'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-600 text-white'
                    }`}
                  >
                    {TIPO_LABEL[s.tipo] || s.tipo}
                    {s.tipo === 'revisao' ? ` v${s.versao}` : ''}
                  </span>
                  <div className="flex-1 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400">Faturamento: </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {moedaCompacta(s.faturamento)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Artístico: </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {moedaCompacta(s.c_art)}
                      </span>
                      {s.pct_art_fat != null && (
                        <span className="text-gray-400"> ({s.pct_art_fat.toFixed(1)}%)</span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-400">Produção: </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {moedaCompacta(s.c_prod)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        Planejado = foto congelada no lançamento (meta M1 + custos previstos). Realizado = faturamento
        e custos reais do Conta Azul. Custos realizados podem subir conforme o Conta Azul liquida.
      </p>
    </div>
  );
}
