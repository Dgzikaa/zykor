'use client';

import { Fragment, useMemo, useState } from 'react';
import { useApiSWR } from '@/hooks/useApiSWR';
import { Loader2 } from 'lucide-react';

/**
 * DRE Eventos — o COMPLEMENTO da aba "DRE Bar": mostra só a economia do show.
 *   Receita        = couvert + ingresso (Yuzer) + Sympla
 *   Custo Variável = imposto (2% da entrada) + taxa maquininha (proporcional) — mesma conta da DRE Bar
 *   Despesas Artístico = as 4 categorias que a DRE Bar remove (drilláveis no CA)
 *   = Resultado de Eventos
 * Mensal (12 meses + YTD). Dados: /api/estrategico/orcamentacao/dre-excel?modo=eventos.
 */
type EvRow = {
  mes: string; grupo: string; ordem_grupo: number; ordem_sub: number;
  categoria: string; valor: number; drill_macro?: string | null;
};

type DrillArg = { categoria_macro: string; canon: string; mes: number; ano: number; label: string };

const MES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const GRUPOS = [
  { ordem: 1, nome: 'Receita', cor: 'text-emerald-700 dark:text-emerald-400' },
  { ordem: 2, nome: 'Custo Variável', cor: 'text-amber-700 dark:text-amber-400' },
  { ordem: 3, nome: 'Despesas Artístico', cor: 'text-rose-700 dark:text-rose-400' },
];

const fmtBRL = (n: number) => {
  const v = Math.abs(n);
  const str = v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-R$ ${str}` : `R$ ${str}`;
};
const mesIdx = (mes: string) => Number(String(mes).slice(5, 7)) - 1; // 'YYYY-MM-01' → 0..11

export function DreEventosTab({ barId, anoInicial, onDrill }: {
  barId: number; anoInicial?: number; onDrill?: (p: DrillArg) => void;
}) {
  const anoSistema = new Date().getFullYear();
  const [ano, setAno] = useState<number>(anoInicial ?? anoSistema);

  const { data, isLoading } = useApiSWR<{ linhas?: EvRow[] }>(
    barId ? `/api/estrategico/orcamentacao/dre-excel?bar_id=${barId}&ano=${ano}&modo=eventos` : null,
  );

  // Pivota: por grupo → categoria → valores[12]. Guarda drill_macro pra linha artística.
  const modelo = useMemo(() => {
    const linhas = data?.linhas || [];
    // categoria única por grupo, preservando ordem_sub e drill
    type Cat = { categoria: string; ordem_sub: number; drill_macro?: string | null; valores: number[] };
    const porGrupo = new Map<number, Map<string, Cat>>();
    for (const l of linhas) {
      if (!porGrupo.has(l.ordem_grupo)) porGrupo.set(l.ordem_grupo, new Map());
      const g = porGrupo.get(l.ordem_grupo)!;
      if (!g.has(l.categoria)) g.set(l.categoria, { categoria: l.categoria, ordem_sub: l.ordem_sub, drill_macro: l.drill_macro, valores: Array(12).fill(0) });
      const c = g.get(l.categoria)!;
      const i = mesIdx(l.mes);
      if (i >= 0 && i < 12) c.valores[i] += Number(l.valor) || 0;
    }
    const grupos = GRUPOS.map((g) => {
      const cats = Array.from(porGrupo.get(g.ordem)?.values() || []).sort((a, b) => a.ordem_sub - b.ordem_sub);
      const subtotal = Array(12).fill(0);
      for (const c of cats) for (let i = 0; i < 12; i++) subtotal[i] += c.valores[i];
      return { ...g, cats, subtotal };
    });
    // Resultado de Eventos = soma de todos os grupos (custo/artístico já são negativos)
    const resultado = Array(12).fill(0);
    for (const g of grupos) for (let i = 0; i < 12; i++) resultado[i] += g.subtotal[i];
    return { grupos, resultado };
  }, [data]);

  const ytd = (v: number[]) => v.reduce((s, x) => s + x, 0);
  const temDado = modelo.grupos.some((g) => g.cats.length > 0);

  const cell = (v: number, k: string | number, bold = false) => (
    <td key={k} className={`px-2 py-1 text-right tabular-nums whitespace-nowrap ${bold ? 'font-semibold' : ''} ${v < 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
      {v === 0 ? '—' : fmtBRL(v)}
    </td>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Economia do show: entrada (couvert + ingresso + Sympla) − imposto/taxa − artístico. Complemento da DRE Bar.
        </div>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))}
          className="h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-sm">
          {[anoSistema, anoSistema - 1, anoSistema - 2].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : !temDado ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Sem dados de eventos para {ano}.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]/60 text-xs">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium sticky left-0 bg-[hsl(var(--muted))]/60 min-w-[180px]">DRE Eventos · {ano}</th>
                {MES_LABEL.map((m) => <th key={m} className="px-2 py-1.5 text-right font-medium">{m}</th>)}
                <th className="px-2 py-1.5 text-right font-semibold">Ano</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {modelo.grupos.map((g) => (
                <Fragment key={`g-${g.ordem}`}>
                  {/* header do grupo com subtotal */}
                  <tr className="bg-[hsl(var(--muted))]/30 font-semibold">
                    <td className={`px-2 py-1 text-left sticky left-0 bg-[hsl(var(--muted))]/30 ${g.cor}`}>{g.nome}</td>
                    {g.subtotal.map((v, i) => cell(v, `st-${i}`, true))}
                    {cell(ytd(g.subtotal), 'st-ytd', true)}
                  </tr>
                  {/* linhas do grupo */}
                  {g.cats.map((c) => {
                    const drillavel = !!c.drill_macro && !!onDrill;
                    return (
                      <tr key={c.categoria} className="hover:bg-[hsl(var(--muted))]/20">
                        <td className="px-2 py-1 text-left pl-5 sticky left-0 bg-[hsl(var(--background))] text-muted-foreground">{c.categoria}</td>
                        {c.valores.map((v, i) => (
                          drillavel && v !== 0 ? (
                            <td key={i} className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                              <button
                                onClick={() => onDrill!({ categoria_macro: c.drill_macro!, canon: c.categoria, mes: i + 1, ano, label: `${c.categoria} · ${MES_LABEL[i]}/${ano}` })}
                                className="hover:underline text-rose-600 dark:text-rose-400">
                                {fmtBRL(v)}
                              </button>
                            </td>
                          ) : cell(v, i)
                        ))}
                        {cell(ytd(c.valores), 'ytd')}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
              {/* Resultado de Eventos */}
              <tr className="border-t-2 border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 font-bold">
                <td className="px-2 py-1.5 text-left sticky left-0 bg-[hsl(var(--muted))]/50">Resultado de Eventos</td>
                {modelo.resultado.map((v, i) => cell(v, `res-${i}`, true))}
                {cell(ytd(modelo.resultado), 'res-ytd', true)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
