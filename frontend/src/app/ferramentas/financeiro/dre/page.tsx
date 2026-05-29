'use client';

import { useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText } from 'lucide-react';

const fmtBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const fmtMes = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

interface Mes {
  mes: string; receita_total: number; cmv: number; cmo: number;
  ocupacao: number; impostos: number; marketing: number; atracoes: number;
  despesa_total: number; lucro_bruto: number; resultado_liquido: number; margem_pct: number;
}

export default function DREPage() {
  const { selectedBar } = useBar();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    fetch(`/api/financeiro/dre?bar_id=${selectedBar.id}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [selectedBar?.id]);

  if (loading) return <main className="max-w-7xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  const meses: Mes[] = data?.meses || [];

  const LINHAS = [
    { rotulo: 'Receita Total', key: 'receita_total', destaque: true, cor: 'text-emerald-700' },
    { rotulo: '(-) CMV', key: 'cmv', negativo: true },
    { rotulo: '(-) CMO (mão de obra)', key: 'cmo', negativo: true },
    { rotulo: 'Lucro Bruto', key: 'lucro_bruto', destaque: true },
    { rotulo: '(-) Ocupação', key: 'ocupacao', negativo: true },
    { rotulo: '(-) Impostos', key: 'impostos', negativo: true },
    { rotulo: '(-) Marketing', key: 'marketing', negativo: true },
    { rotulo: '(-) Atrações', key: 'atracoes', negativo: true },
    { rotulo: '(-) Despesa Total', key: 'despesa_total', negativo: true, destaque: true },
    { rotulo: 'Resultado Líquido', key: 'resultado_liquido', destaque: true, cor: 'font-bold' },
  ];

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-emerald-600" /> DRE mensal</h1>
        <p className="text-sm text-gray-500">
          Demonstrativo de Resultados via ContaAzul. Classificação automática por palavras-chave nas categorias.
          Últimos 6 meses.
        </p>
      </div>

      <Card className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                <th className="text-left py-2 sticky left-0 bg-white dark:bg-gray-950 min-w-[200px]">Linha</th>
                {meses.map(m => <th key={m.mes} className="text-right py-2 px-4">{fmtMes(m.mes)}</th>)}
              </tr>
            </thead>
            <tbody>
              {LINHAS.map(l => (
                <tr key={l.key} className={`border-b last:border-0 ${l.destaque ? 'bg-gray-50 dark:bg-gray-900/40' : ''}`}>
                  <td className={`py-2 sticky left-0 bg-white dark:bg-gray-950 ${l.destaque ? 'font-semibold' : ''}`}>{l.rotulo}</td>
                  {meses.map(m => {
                    const v = Number((m as any)[l.key] || 0);
                    return (
                      <td key={m.mes} className={`py-2 px-4 text-right tabular-nums ${l.cor ?? ''} ${l.negativo ? 'text-red-600' : ''}`}>
                        {fmtBRL(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 dark:border-gray-700 bg-emerald-50/30 dark:bg-emerald-900/10">
                <td className="py-3 font-bold sticky left-0 bg-emerald-50/30 dark:bg-emerald-900/10">Margem líquida %</td>
                {meses.map(m => (
                  <td key={m.mes} className={`py-3 px-4 text-right font-bold tabular-nums ${Number(m.margem_pct) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {m.margem_pct != null ? `${m.margem_pct}%` : '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4 border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-900/10">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          ⚠️ <strong>Classificação automática</strong> por palavras-chave em categoria_nome (cmv/insumo/fornec, salario/cmo, aluguel/iptu, imposto/tribut, etc).
          Lançamentos com categoria não-mapeada caem em &ldquo;Despesa Total&rdquo; mas não em sub-linha. Pra melhorar, ajuste as keywords ou padronize categorias no ContaAzul.
        </p>
      </Card>
    </main>
  );
}
