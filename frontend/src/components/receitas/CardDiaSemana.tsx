'use client';

/**
 * Card "Faturamento por Dia da Semana" — cada dia da semana × cada mês do período,
 * em barras HORIZONTAIS agrupadas por mês (número no fim de cada barra, sem sobrepor).
 * Mostra como cada dia (Seg..Dom) performou mês a mês (detrator/promotor). Usa o range.
 *
 * Abaixo: comparativo do mês de referência (fim do período) contra uma janela selecionável
 * — mês passado / mesmo mês do ano passado / média do trimestre — por dia da semana.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { api } from '@/lib/api-client';
import { ChartCard, GraficoBarrasAgrupadasH } from '@/components/graficos/Charts';
import type { PeriodoValor } from '@/lib/receitas/periodo';

const money0 = (v: number | null) => (v == null ? '—' : (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));

type Comp = 'mom' | 'yoy' | 'tri';
const COMPS: { key: Comp; rotulo: string }[] = [
  { key: 'mom', rotulo: 'Mês passado' },
  { key: 'yoy', rotulo: 'Ano passado' },
  { key: 'tri', rotulo: 'Trimestre' },
];

function DeltaBadge({ valor, classe }: { valor: number | null; classe: string | null }) {
  if (valor == null) return <span className="text-[hsl(var(--muted-foreground))]">—</span>;
  const cor = classe === 'promotor' ? 'text-emerald-600 dark:text-emerald-400'
    : classe === 'detrator' ? 'text-rose-600 dark:text-rose-400'
    : 'text-[hsl(var(--muted-foreground))]';
  const Icon = classe === 'promotor' ? TrendingUp : classe === 'detrator' ? TrendingDown : Minus;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${cor}`}>
      <Icon className="h-3.5 w-3.5" />{valor >= 0 ? '+' : ''}{valor}%
    </span>
  );
}

export function CardDiaSemana({ barId, periodo }: { barId?: number; periodo: PeriodoValor }) {
  const [dias, setDias] = useState<Record<string, any>[]>([]);
  const [meses, setMeses] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Comparativo (mês de referência = fim do período selecionado)
  const mesRef = (periodo.fim || '').slice(0, 7);
  const [comp, setComp] = useState<Comp>('mom');
  const [cmpDias, setCmpDias] = useState<any[]>([]);
  const [cmpLabels, setCmpLabels] = useState<Record<string, string>>({});
  const [cmpLoading, setCmpLoading] = useState(true);

  useEffect(() => {
    if (!barId) return;
    setLoading(true);
    api
      .get(`/api/receitas/dia-semana-mensal?bar_id=${barId}&inicio=${periodo.inicio}&fim=${periodo.fim}`)
      .then((r: any) => {
        if (r?.success) {
          setDias(r.dias ?? []);
          setMeses(r.meses ?? []);
        } else {
          setDias([]);
          setMeses([]);
        }
      })
      .catch(() => {
        setDias([]);
        setMeses([]);
      })
      .finally(() => setLoading(false));
  }, [barId, periodo.inicio, periodo.fim]);

  useEffect(() => {
    if (!barId || !mesRef) return;
    setCmpLoading(true);
    api
      .get(`/api/receitas/analise-dia-semana?bar_id=${barId}&mes=${mesRef}`)
      .then((r: any) => {
        if (r?.success) { setCmpDias(r.dias ?? []); setCmpLabels(r.labels ?? {}); }
        else { setCmpDias([]); setCmpLabels({}); }
      })
      .catch(() => { setCmpDias([]); setCmpLabels({}); })
      .finally(() => setCmpLoading(false));
  }, [barId, mesRef]);

  const series = meses.map((m) => ({ key: m.label, nome: m.label }));
  const altura = Math.max(340, meses.length * 78);

  return (
    <ChartCard titulo="Faturamento por Dia da Semana" subtitulo="média por dia da semana, mês a mês (com variação vs mês anterior)" className="md:col-span-2">
      {loading ? (
        <div className="flex h-[340px] items-center justify-center text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !dias.length || !meses.length ? (
        <div className="flex h-[340px] items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">Sem eventos no período selecionado.</div>
      ) : (
        <>
          <GraficoBarrasAgrupadasH data={dias} yKey="dia" series={series} formatV={money0} height={altura} mostrarVariacao />

          {/* Comparativo selecionável do mês de referência */}
          <div className="mt-4 border-t border-[hsl(var(--border))] pt-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-[hsl(var(--foreground))]">
                {cmpLabels.atual ? `${cmpLabels.atual} vs` : 'Comparar com'}
              </span>
              <div className="inline-flex rounded-md border border-[hsl(var(--border))] p-0.5">
                {COMPS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setComp(c.key)}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${comp === c.key ? 'bg-[hsl(var(--primary))] text-white' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'}`}
                  >
                    {c.rotulo}
                  </button>
                ))}
              </div>
            </div>
            {cmpLoading ? (
              <div className="flex h-16 items-center justify-center text-[hsl(var(--muted-foreground))]"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : !cmpDias.length ? (
              <div className="py-2 text-xs text-[hsl(var(--muted-foreground))]">Sem dados para o comparativo.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                      <th className="py-1 pr-2 font-medium">Dia</th>
                      <th className="py-1 px-2 text-right font-medium">{cmpLabels.atual ?? 'Atual'}</th>
                      <th className="py-1 px-2 text-right font-medium">{cmpLabels[comp] ?? 'Comparativo'}</th>
                      <th className="py-1 pl-2 text-right font-medium">Δ%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cmpDias.map((d: any) => (
                      <tr key={d.dow} className="border-t border-[hsl(var(--border))]">
                        <td className="py-1 pr-2 text-[hsl(var(--foreground))]">{d.dia}</td>
                        <td className="py-1 px-2 text-right tabular-nums">{money0(d.atual)}</td>
                        <td className="py-1 px-2 text-right tabular-nums text-[hsl(var(--muted-foreground))]">{money0(d[comp])}</td>
                        <td className="py-1 pl-2 text-right"><DeltaBadge valor={d[`delta_${comp}`]} classe={d[`classe_${comp}`]} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-2 flex justify-end">
            <Link href="/receitas/analise" className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--primary))] hover:underline">
              Ver mês a mês em tela cheia (médias + %) <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </>
      )}
    </ChartCard>
  );
}
