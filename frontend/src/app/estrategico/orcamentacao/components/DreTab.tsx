'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface DreRow {
  bar_id: number;
  mes: string;
  categoria_macro: string;
  ordem_macro: number;
  ordem_sub: number;
  categoria: string;
  sinal: number;
  valor_com_sinal: number;
  percentual_receita: number | null;
}

interface Props { barId: number; }

const MACRO_ORDEM = [
  'Receita',
  'Custos Variáveis',
  'Custo insumos (CMV)',
  'Mão-de-Obra',
  'Despesas Comerciais',
  'Despesas Administrativas',
  'Despesas Operacionais',
  'Despesas de Ocupação (Contas)',
  'Não Operacionais',
];

const MES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const fmtBRL = (n: number) => {
  const v = Math.abs(n);
  const neg = n < 0;
  const str = v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return neg ? `-R$ ${str}` : `R$ ${str}`;
};
const fmtPct = (n: number | null) => n == null ? '' : `${n > 0 ? '' : ''}${n.toFixed(1)}%`;

export function DreTab({ barId }: Props) {
  const [linhas, setLinhas] = useState<DreRow[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/estrategico/orcamentacao/dre-excel?bar_id=${barId}`);
      const j = await r.json();
      setLinhas((j?.linhas || []).map((l: any) => ({
        ...l,
        valor_com_sinal: Number(l.valor_com_sinal),
        percentual_receita: l.percentual_receita == null ? null : Number(l.percentual_receita),
      })));
    } finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, [barId]);

  const dados = useMemo(() => {
    // Agrupa por macro → sub → mes
    const macroMap = new Map<string, Map<string, Map<number, DreRow>>>();
    for (const l of linhas) {
      const mes = new Date(l.mes + 'T00:00:00').getMonth(); // 0-11
      if (!macroMap.has(l.categoria_macro)) macroMap.set(l.categoria_macro, new Map());
      const subMap = macroMap.get(l.categoria_macro)!;
      if (!subMap.has(l.categoria)) subMap.set(l.categoria, new Map());
      subMap.get(l.categoria)!.set(mes, l);
    }

    // Receita total por mês (pra calcular % das outras macros)
    const receitaTotalMes: number[] = Array(12).fill(0);
    const subRec = macroMap.get('Receita');
    if (subRec) {
      for (const [, mesMap] of subRec) {
        for (const [mes, row] of mesMap) {
          receitaTotalMes[mes] += row.valor_com_sinal;
        }
      }
    }
    const receitaYTD = receitaTotalMes.reduce((s, v) => s + v, 0);

    // Monta linhas finais com ordem
    const out: Array<{
      tipo: 'macro' | 'sub';
      label: string;
      label2?: string;
      valores: number[];        // 12 valores
      percentuais: (number | null)[];
      ytd: number;
      ytdPct: number | null;
      cor?: string;
      destaque?: boolean;
    }> = [];

    for (const macroNome of MACRO_ORDEM) {
      const subMap = macroMap.get(macroNome);
      if (!subMap) continue;

      // Linha TOTAL do macro
      const valoresMacro: number[] = Array(12).fill(0);
      for (const [, mesMap] of subMap) {
        for (const [mes, row] of mesMap) valoresMacro[mes] += row.valor_com_sinal;
      }
      const ytdMacro = valoresMacro.reduce((s, v) => s + v, 0);
      const pctMacro = valoresMacro.map(v => receitaTotalMes[valoresMacro.indexOf(v)] !== 0
        ? null : null);
      // Calcula % de cada mês do macro
      const pctMacroPorMes = valoresMacro.map((v, i) => receitaTotalMes[i] > 0 ? (v / receitaTotalMes[i] * 100) : null);

      out.push({
        tipo: 'macro',
        label: macroNome,
        label2: 'TOTAL',
        valores: valoresMacro,
        percentuais: pctMacroPorMes,
        ytd: ytdMacro,
        ytdPct: receitaYTD > 0 ? (ytdMacro / receitaYTD * 100) : null,
        destaque: true,
        cor: macroNome === 'Receita' ? 'text-emerald-700' : 'text-gray-900 dark:text-gray-100',
      });

      // Subcategorias ordenadas
      const subs = Array.from(subMap.entries()).sort((a, b) => {
        const oa = Array.from(a[1].values())[0]?.ordem_sub ?? 99;
        const ob = Array.from(b[1].values())[0]?.ordem_sub ?? 99;
        return oa - ob;
      });
      for (const [subNome, mesMap] of subs) {
        const valoresSub: number[] = Array(12).fill(0);
        for (const [mes, row] of mesMap) valoresSub[mes] = row.valor_com_sinal;
        const ytdSub = valoresSub.reduce((s, v) => s + v, 0);
        const pctSub = valoresSub.map((v, i) => receitaTotalMes[i] > 0 ? (v / receitaTotalMes[i] * 100) : null);
        out.push({
          tipo: 'sub',
          label: '',
          label2: subNome,
          valores: valoresSub,
          percentuais: pctSub,
          ytd: ytdSub,
          ytdPct: receitaYTD > 0 ? (ytdSub / receitaYTD * 100) : null,
        });
      }
    }

    // Lucro Líquido = Receita + Não Operacionais - todas despesas
    const receita = macroMap.get('Receita');
    const naoOp = macroMap.get('Não Operacionais');
    const lucroPorMes: number[] = Array(12).fill(0);
    for (const m of MACRO_ORDEM) {
      const subM = macroMap.get(m);
      if (!subM) continue;
      for (const [, mesMap] of subM) {
        for (const [mes, row] of mesMap) lucroPorMes[mes] += row.valor_com_sinal;
      }
    }
    const lucroYTD = lucroPorMes.reduce((s, v) => s + v, 0);
    const pctLucro = lucroPorMes.map((v, i) => receitaTotalMes[i] > 0 ? (v / receitaTotalMes[i] * 100) : null);

    out.push({
      tipo: 'macro',
      label: 'Lucro Líquido',
      label2: '',
      valores: lucroPorMes,
      percentuais: pctLucro,
      ytd: lucroYTD,
      ytdPct: receitaYTD > 0 ? (lucroYTD / receitaYTD * 100) : null,
      destaque: true,
      cor: lucroYTD < 0 ? 'text-red-700 font-bold' : 'text-emerald-700 font-bold',
    });

    // Investimentos (linha de baixo)
    const investMap = macroMap.get('Investimentos');
    if (investMap) {
      const valoresInv: number[] = Array(12).fill(0);
      for (const [, mesMap] of investMap) {
        for (const [mes, row] of mesMap) valoresInv[mes] += row.valor_com_sinal;
      }
      const ytdInv = valoresInv.reduce((s, v) => s + v, 0);
      out.push({
        tipo: 'macro',
        label: 'Investimentos',
        label2: 'TOTAL',
        valores: valoresInv,
        percentuais: valoresInv.map(() => null),
        ytd: ytdInv,
        ytdPct: null,
        destaque: true,
        cor: 'text-blue-700',
      });
      const subsInv = Array.from(investMap.entries()).sort((a, b) => {
        const oa = Array.from(a[1].values())[0]?.ordem_sub ?? 99;
        const ob = Array.from(b[1].values())[0]?.ordem_sub ?? 99;
        return oa - ob;
      });
      for (const [subNome, mesMap] of subsInv) {
        const valoresSub: number[] = Array(12).fill(0);
        for (const [mes, row] of mesMap) valoresSub[mes] = row.valor_com_sinal;
        const ytdSub = valoresSub.reduce((s, v) => s + v, 0);
        out.push({
          tipo: 'sub',
          label: '',
          label2: subNome,
          valores: valoresSub,
          percentuais: valoresSub.map(() => null),
          ytd: ytdSub,
          ytdPct: null,
        });
      }
    }

    return { rows: out, receitaTotalMes, receitaYTD };
  }, [linhas]);

  if (loading) return <div className="p-4"><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">DRE — Demonstrativo de Resultados</h2>
          <p className="text-xs text-muted-foreground">
            Dados ContaAzul agregados por competência. Estrutura espelha planilha &ldquo;[Ordinário] DRE e DFC&rdquo;.
          </p>
        </div>
        <Button onClick={carregar} variant="outline" size="sm" className="gap-1">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-100 dark:bg-gray-800 text-[10px] uppercase">
            <tr>
              <th className="text-left py-2 px-2 sticky left-0 bg-gray-100 dark:bg-gray-800 min-w-[180px] z-10">Categ MACRO</th>
              <th className="text-left py-2 px-2 sticky left-[180px] bg-gray-100 dark:bg-gray-800 min-w-[200px] z-10">Categoria</th>
              {MES_LABEL.map((m, i) => (
                <th key={i} className="text-right py-2 px-2 min-w-[110px]" colSpan={2}>{m}/26</th>
              ))}
              <th className="text-right py-2 px-2 bg-gray-200 dark:bg-gray-700 min-w-[120px]" colSpan={2}>YTD 2026</th>
            </tr>
          </thead>
          <tbody>
            {dados.rows.map((row, idx) => (
              <tr key={idx} className={`border-b ${row.destaque ? 'bg-gray-50 dark:bg-gray-900/40 font-semibold' : ''}`}>
                <td className={`py-1.5 px-2 sticky left-0 z-10 ${row.destaque ? 'bg-gray-50 dark:bg-gray-900/40 font-bold' : 'bg-white dark:bg-gray-950'} ${row.cor ?? ''}`}>
                  {row.label}
                </td>
                <td className={`py-1.5 px-2 sticky left-[180px] z-10 ${row.destaque ? 'bg-gray-50 dark:bg-gray-900/40' : 'bg-white dark:bg-gray-950'}`}>
                  {row.label2}
                </td>
                {row.valores.map((v, i) => (
                  <>
                    <td key={`v${i}`} className={`py-1.5 px-2 text-right tabular-nums ${v < 0 ? 'text-red-600' : v > 0 && row.label === 'Receita' ? 'text-emerald-600' : ''}`}>
                      {v !== 0 ? fmtBRL(v) : '—'}
                    </td>
                    <td key={`p${i}`} className="py-1.5 px-1 text-right tabular-nums text-[10px] text-muted-foreground">
                      {row.percentuais[i] != null && v !== 0 ? `${row.percentuais[i]!.toFixed(1)}%` : ''}
                    </td>
                  </>
                ))}
                <td className={`py-1.5 px-2 text-right tabular-nums bg-gray-100 dark:bg-gray-800 ${row.ytd < 0 ? 'text-red-600 font-bold' : 'font-bold'}`}>
                  {fmtBRL(row.ytd)}
                </td>
                <td className="py-1.5 px-1 text-right text-[10px] bg-gray-100 dark:bg-gray-800 text-muted-foreground">
                  {row.ytdPct != null ? `${row.ytdPct.toFixed(1)}%` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-3 border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-900/10">
        <p className="text-xs text-muted-foreground">
          ⚠️ Valores vêm de <code className="bg-white dark:bg-gray-800 px-1 rounded">bronze.bronze_contaazul_lancamentos</code>
          {' '}usando <strong>valor_bruto</strong> agregado por <strong>data_competencia</strong> (regime de competência, igual ao Excel).
          {' '}Mapeamento categoria → MACRO em <code className="bg-white dark:bg-gray-800 px-1 rounded">financial.dre_categoria_macro</code>.
          {' '}Se uma categoria do ContaAzul não estiver mapeada, aparece como &ldquo;Não Mapeado&rdquo;.
        </p>
      </Card>
    </div>
  );
}
