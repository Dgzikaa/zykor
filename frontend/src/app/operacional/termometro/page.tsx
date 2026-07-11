'use client';

import { useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const DOW = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface Sinal { nome: string; fmt: 'brl' | 'int' | 'pct'; dir: 'maior' | 'menor'; valor: number | null; base: number | null; var_pct: number | null }
interface Resp { success: boolean; data?: string; dow?: number; amostra?: number; sinais?: Sinal[] }

const ontemISO = () => new Date(Date.now() - 3 * 3600 * 1000 - 864e5).toISOString().slice(0, 10);

const fmtVal = (v: number | null, fmt: Sinal['fmt']) => {
  if (v == null) return '—';
  if (fmt === 'brl') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
  if (fmt === 'pct') return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  return v.toLocaleString('pt-BR');
};
const fmtData = (iso?: string) => { if (!iso) return ''; const [, m, d] = iso.split('-'); return `${d}/${m}`; };

// bom = do lado certo; senão gradua pela magnitude
function statusDe(s: Sinal): 'bom' | 'ok' | 'atencao' | 'ruim' | 'neutro' {
  if (s.var_pct == null) return 'neutro';
  const bom = s.dir === 'maior' ? s.var_pct >= 0 : s.var_pct <= 0;
  if (bom) return 'bom';
  const mag = Math.abs(s.var_pct);
  if (mag < 10) return 'ok';
  if (mag < 25) return 'atencao';
  return 'ruim';
}
const COR: Record<string, string> = {
  bom: 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20',
  ok: 'border-[hsl(var(--border))]',
  atencao: 'border-amber-300 bg-amber-50 dark:bg-amber-900/20',
  ruim: 'border-red-300 bg-red-50 dark:bg-red-900/20',
  neutro: 'border-[hsl(var(--border))]',
};
const CORTXT: Record<string, string> = {
  bom: 'text-emerald-600 dark:text-emerald-400',
  ok: 'text-[hsl(var(--muted-foreground))]',
  atencao: 'text-amber-600 dark:text-amber-400',
  ruim: 'text-red-500',
  neutro: 'text-[hsl(var(--muted-foreground))]',
};

export default function TermometroPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [dataSel, setDataSel] = useState<string>(ontemISO());

  useEffect(() => {
    setPageTitle('🌡️ Termômetro do Dia');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const { data, isLoading: loading } = useApiSWR<Resp>(
    selectedBar?.id ? `/api/operacional/termometro?bar_id=${selectedBar.id}&data=${dataSel}` : null
  );

  const dow = data?.dow != null ? DOW[data.dow] : '';
  const sinais = data?.sinais || [];

  if (!selectedBar?.id) return <div className="p-6 text-sm text-gray-500">Selecione um bar.</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={dataSel}
          max={ontemISO()}
          onChange={(e) => setDataSel(e.target.value)}
          className="text-sm border border-[hsl(var(--border))] rounded-md px-3 py-1.5 bg-[hsl(var(--card))]"
        />
        {data?.data && (
          <span className="text-sm text-[hsl(var(--muted-foreground))]">
            {dow} · comparado com as últimas <b>{data.amostra ?? 0}</b> {dow.toLowerCase()}s
          </span>
        )}
      </div>

      {loading && !data ? (
        <Skeleton className="h-40 w-full" />
      ) : !data?.success || sinais.length === 0 ? (
        <div className="rounded-xl border border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Sem dados para esse dia (bar fechado ou histórico insuficiente do mesmo dia da semana).
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sinais.map((s) => {
            const st = statusDe(s);
            const Icon = s.var_pct == null ? Minus : s.var_pct > 0 ? TrendingUp : s.var_pct < 0 ? TrendingDown : Minus;
            return (
              <div key={s.nome} className={`rounded-xl border p-4 ${COR[st]}`}>
                <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{s.nome}</div>
                <div className="mt-1 text-2xl font-bold">{fmtVal(s.valor, s.fmt)}</div>
                <div className="mt-1 flex items-center gap-1.5 text-sm">
                  <span className={`inline-flex items-center gap-1 font-medium ${CORTXT[st]}`}>
                    <Icon className="h-4 w-4" />
                    {s.var_pct == null ? 's/ base' : `${s.var_pct > 0 ? '+' : ''}${s.var_pct}%`}
                  </span>
                  <span className="text-[hsl(var(--muted-foreground))]">
                    vs {fmtVal(s.base, s.fmt)} normal
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        🟢 melhor que o padrão do dia · 🟠 abaixo · 🔴 bem abaixo. Baseline = mediana das últimas 6 ocorrências do mesmo dia da semana (evita comparar sexta com terça).
      </p>
    </div>
  );
}
