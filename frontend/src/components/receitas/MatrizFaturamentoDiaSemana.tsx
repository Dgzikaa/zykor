'use client';

/**
 * Matriz "Faturamento médio por dia da semana × mês" — tela cheia, números legíveis.
 * Linhas = dias (Seg..Dom), colunas = meses do período (média por ocorrência), com o
 * % de variação vs mês anterior colorido em cada célula + coluna de média geral e um
 * leve mapa de calor por linha (verde = mais forte). Fonte: /api/receitas/dia-semana-mensal.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '@/lib/api-client';

const money0 = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

type DiaRow = Record<string, any> & { dia: string };

export function MatrizFaturamentoDiaSemana({ barId, inicio, fim, semOutliers }: { barId?: number; inicio: string; fim: string; semOutliers?: boolean }) {
  const [dias, setDias] = useState<DiaRow[]>([]);
  const [meses, setMeses] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barId) return;
    setLoading(true);
    api
      .get(`/api/receitas/dia-semana-mensal?bar_id=${barId}&inicio=${inicio}&fim=${fim}${semOutliers ? '&sem_outliers=1' : ''}`)
      .then((r: any) => {
        if (r?.success) { setDias(r.dias ?? []); setMeses(r.meses ?? []); }
        else { setDias([]); setMeses([]); }
      })
      .catch(() => { setDias([]); setMeses([]); })
      .finally(() => setLoading(false));
  }, [barId, inicio, fim, semOutliers]);

  // média geral por dia = média das médias mensais (só meses com valor)
  const linhas = useMemo(() => dias.map((d) => {
    const vals = meses.map((m) => Number(d[m.label] || 0)).filter((v) => v > 0);
    const media = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
    const max = Math.max(...meses.map((m) => Number(d[m.label] || 0)), 1);
    return { ...d, __media: media, __max: max };
  }), [dias, meses]);

  if (loading) return <div className="flex h-52 items-center justify-center text-[hsl(var(--muted-foreground))]"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!dias.length || !meses.length) return <div className="flex h-52 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">Sem eventos no período selecionado.</div>;

  return (
    <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[hsl(var(--muted))]/50">
            <th className="sticky left-0 z-10 bg-[hsl(var(--muted))]/50 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Dia</th>
            {meses.map((m) => (
              <th key={m.key} className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] whitespace-nowrap">{m.label}</th>
            ))}
            <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[hsl(var(--foreground))] whitespace-nowrap border-l border-[hsl(var(--border))]">Média</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((d) => (
            <tr key={d.dia} className="border-t border-[hsl(var(--border))]">
              <td className="sticky left-0 z-10 bg-[hsl(var(--card))] px-3 py-2.5 font-semibold text-[hsl(var(--foreground))] whitespace-nowrap">{d.dia}</td>
              {meses.map((m, i) => {
                const val = Number(d[m.label] || 0);
                const varp: number | null = d[`${m.label}__var`];
                const intensidade = val > 0 ? val / d.__max : 0;
                return (
                  <td
                    key={m.key}
                    className="px-3 py-2 text-right align-middle"
                    style={{ background: val > 0 ? `hsl(152 62% 45% / ${(0.05 + intensidade * 0.24).toFixed(3)})` : undefined }}
                  >
                    <div className="tabular-nums font-semibold text-[hsl(var(--foreground))]">{val > 0 ? money0(val) : '—'}</div>
                    {i > 0 && varp != null && (
                      <div className={`text-[11px] tabular-nums inline-flex items-center gap-0.5 ${varp >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {varp >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{varp > 0 ? '+' : ''}{varp}%
                      </div>
                    )}
                  </td>
                );
              })}
              <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[hsl(var(--foreground))] bg-[hsl(var(--muted))]/40 border-l border-[hsl(var(--border))]">{money0(d.__media)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
