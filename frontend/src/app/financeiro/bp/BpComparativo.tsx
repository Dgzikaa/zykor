'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, EyeOff } from 'lucide-react';
import type { BpLinha, BpIndicador } from '../../estrategico/bp/types';

type Versao = { ano: number; versao: string };

const fmtBRL = (n: number) => {
  const v = Math.abs(n), neg = n < 0;
  return `${neg ? '-' : ''}R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
};

const ORDEM_BLOCOS = [
  'Receitas', 'Despesas Variaveis', 'CMV', 'Mao-de-Obra', 'Despesas Comerciais',
  'Despesas Administrativas', 'Despesas Operacionais', 'Despesas Ocupacao', 'Contratos',
];

function BpPainel({ barId, versoes, inicial }: { barId: number; versoes: Versao[]; inicial: Versao }) {
  const [sel, setSel] = useState<Versao>(inicial);
  const [linhas, setLinhas] = useState<BpLinha[]>([]);
  const [indicadores, setIndicadores] = useState<BpIndicador[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/estrategico/bp/dados?bar_id=${barId}&ano=${sel.ano}&versao=${encodeURIComponent(sel.versao)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { setLinhas(j.linhas || []); setIndicadores(j.indicadores || []); })
      .finally(() => setLoading(false));
  }, [barId, sel]);

  const { blocos, receita, ebitda, breakeven, margem } = useMemo(() => {
    const grouped = new Map<string, BpLinha[]>();
    linhas.filter(l => l.bloco !== 'Metricas Operacionais').forEach(l => {
      const a = grouped.get(l.bloco) || []; a.push(l); grouped.set(l.bloco, a);
    });
    const blocos = ORDEM_BLOCOS.filter(b => grouped.has(b)).map(b => ({
      bloco: b,
      linhas: (grouped.get(b) || []).sort((a, b) => a.ordem - b.ordem),
      subtotal: (grouped.get(b) || []).reduce((s, l) => s + (Number(l.valor_mensal) || 0), 0),
    }));
    const receita = blocos.find(b => b.bloco === 'Receitas')?.subtotal || 0;
    const ebitda = blocos.reduce((s, b) => s + b.subtotal, 0);
    const breakeven = Number(indicadores.find(i => i.indicador === 'breakeven_mensal')?.valor || 0);
    const margem = receita > 0 ? (ebitda / receita) * 100 : 0;
    return { blocos, receita, ebitda, breakeven, margem };
  }, [linhas, indicadores]);

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <select
          value={`${sel.ano}|${sel.versao}`}
          onChange={(e) => { const [a, v] = e.target.value.split('|'); setSel({ ano: Number(a), versao: v }); }}
          className="h-8 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-bold px-2"
        >
          {versoes.map(v => <option key={`${v.ano}|${v.versao}`} value={`${v.ano}|${v.versao}`}>{v.versao} ({v.ano})</option>)}
        </select>
      </div>

      {loading ? <Skeleton className="h-80" /> : (
        <Card className="overflow-hidden">
          {/* KPIs compactos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-200 dark:bg-gray-700 text-center">
            <div className="bg-white dark:bg-gray-900 p-2">
              <p className="text-[10px] text-gray-500">Receita</p>
              <p className="text-sm font-bold text-blue-600">{fmtBRL(receita)}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 p-2">
              <p className="text-[10px] text-gray-500">EBITDA · {margem.toFixed(0)}%</p>
              <p className={`text-sm font-bold ${ebitda >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtBRL(ebitda)}</p>
            </div>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {blocos.map(b => (
                <Fragment key={b.bloco}>
                  <tr className="bg-gray-100 dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700">
                    <td className="py-1.5 px-2 font-semibold">{b.bloco}</td>
                    <td className="py-1.5 px-2 text-right font-semibold tabular-nums">{fmtBRL(b.subtotal)}</td>
                  </tr>
                  {b.linhas.map(l => (
                    <tr key={l.id} className="border-b border-gray-50 dark:border-gray-800/50">
                      <td className="py-1 px-2 pl-4 text-gray-600 dark:text-gray-300 truncate max-w-[180px]">{l.linha}</td>
                      <td className="py-1 px-2 text-right tabular-nums text-gray-700 dark:text-gray-200">{l.valor_mensal != null ? fmtBRL(Number(l.valor_mensal)) : '—'}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr className="bg-blue-50 dark:bg-blue-950 border-t-2 border-blue-300 font-bold">
                <td className="py-2 px-2">EBITDA</td>
                <td className={`py-2 px-2 text-right tabular-nums ${ebitda >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtBRL(ebitda)}</td>
              </tr>
              <tr className="border-t">
                <td className="py-1.5 px-2 text-gray-500">BreakEven</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-gray-600">{fmtBRL(breakeven)}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export function BpComparativo({ barId, versoes, defaultEsq, defaultDir }: {
  barId: number; versoes: Versao[]; defaultEsq: Versao; defaultDir: Versao;
}) {
  const [mostrarEsq, setMostrarEsq] = useState(true);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Business Plan — Comparativo</h1>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setMostrarEsq(v => !v)}>
          {mostrarEsq ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {mostrarEsq ? 'Ocultar o da esquerda' : 'Mostrar comparativo'}
        </Button>
      </div>
      <div className="flex gap-4 items-start">
        {mostrarEsq && <BpPainel barId={barId} versoes={versoes} inicial={defaultEsq} />}
        <BpPainel barId={barId} versoes={versoes} inicial={defaultDir} />
      </div>
    </div>
  );
}
