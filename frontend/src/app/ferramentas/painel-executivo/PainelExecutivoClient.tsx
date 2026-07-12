'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useBar } from '@/contexts/BarContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, DollarSign, Wallet, Users, AlertTriangle, Percent, ArrowRight } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';

const fmtBRL = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number | null | undefined) => (n == null ? '—' : `${n.toFixed(1)}%`);
const fmtData = (s: string | null) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : null);

function Kpi({ label, value, sub, accent = 'slate', icon }: { label: string; value: string; sub?: string; accent?: string; icon?: React.ReactNode }) {
  const cor: Record<string, string> = {
    slate: 'text-gray-900 dark:text-white', green: 'text-emerald-600', red: 'text-red-600', blue: 'text-blue-600', amber: 'text-amber-600', violet: 'text-violet-600',
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{label}</p>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <p className={`text-2xl font-bold ${cor[accent] || cor.slate}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </Card>
  );
}

/**
 * Ilha client do Painel Executivo. Recebe do Server Component (page.tsx) o bar do
 * cookie (initialBar) e os dados já buscados no servidor (initialData). Usa esses
 * dados como fallbackData do SWR SÓ quando o bar da aba bate com o do servidor —
 * assim o 1º paint vem sem skeleton no caso comum (aba única), e trocar de bar /
 * multi-aba caem exatamente no caminho SWR de sempre (zero regressão).
 */
export default function PainelExecutivoClient({ initialBar, initialData }: { initialBar: number | null; initialData: any | null }) {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();

  // cookie-first: initialBar (cookie, lido no servidor) = o bar que ESTA aba vai assumir, então os
  // dados do servidor (initialData) são seguros como fallbackData SEMPRE — inclusive no 1º paint SSR,
  // quando selectedBar ainda é null (a chave vira null → SWR devolve o fallbackData). Resultado: o
  // HTML do servidor já vem com os KPIs, sem skeleton. Guarda a borda: se a aba assumir um bar
  // DIFERENTE do cookie (não deveria no cookie-first), não usa o fallback stale.
  const canUseInitial = initialData != null && (selectedBar?.id == null || selectedBar.id === initialBar);

  // Cache via SWR: navegar pra cá e voltar não re-busca do zero (dedupe 30s).
  // A chave inclui o bar, então trocar de bar re-busca automaticamente.
  const { data: swrData, isLoading } = useApiSWR<any>(
    selectedBar?.id ? `/api/estrategico/painel-executivo?bar_id=${selectedBar.id}` : null,
    canUseInitial ? { fallbackData: initialData } : undefined
  );
  // Cai EXPLICITAMENTE no dado do servidor quando o SWR ainda não tem (SSR / 1º paint): o SWR
  // com chave null não devolve fallbackData, então garantimos aqui -> KPIs já no HTML do servidor.
  const d = swrData ?? (canUseInitial ? initialData : undefined);
  // Skeleton só quando NÃO há nada (sem dado do servidor e sem busca concluída).
  const loading = isLoading && !d;

  useEffect(() => {
    setPageTitle('📈 Painel Executivo');
    return () => setPageTitle('');
  }, [setPageTitle]);

  if (loading) return <main className="max-w-7xl mx-auto px-6 py-8 space-y-4"><Skeleton className="h-32" /><Skeleton className="h-32" /></main>;

  const dre = d?.dre, cmv = d?.cmv, fluxo = d?.fluxo, rfm = d?.rfm;
  const cmvAcima = cmv?.meta != null && cmv.pct > cmv.meta + 1;
  const atencoes: string[] = [];
  if (cmvAcima) atencoes.push(`CMV ${fmtPct(cmv.pct)} acima da meta (${fmtPct(cmv.meta)}) em ${cmv.ref}`);
  if (fluxo?.aperta) atencoes.push(`Caixa pode apertar em ${fmtData(fluxo.aperta)} (cenário pessimista)`);
  if (rfm?.em_risco_valor > 0) atencoes.push(`${rfm.em_risco_n} clientes valiosos em risco (${fmtBRL(rfm.em_risco_valor)})`);

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {atencoes.length > 0 && (
        <Card className="p-4 border-l-4 border-l-amber-500 bg-amber-50/40 dark:bg-amber-900/10">
          <p className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-400 flex items-center gap-1 mb-1"><AlertTriangle className="w-3.5 h-3.5" /> Pontos de atenção</p>
          <ul className="text-sm space-y-0.5 text-gray-700 dark:text-gray-200">
            {atencoes.map((a, i) => <li key={i}>• {a}</li>)}
          </ul>
        </Card>
      )}

      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Resultado ({d?.ano})</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Faturamento do mês" value={fmtBRL(dre?.faturamento_mes)} accent="blue" icon={<TrendingUp className="w-4 h-4" />} />
          <Kpi label="Receita YTD (fechado)" value={fmtBRL(dre?.receita_ytd)} accent="blue" icon={<DollarSign className="w-4 h-4" />} />
          <Kpi label="Lucro YTD (fechado)" value={fmtBRL(dre?.lucro_ytd)} accent={(dre?.lucro_ytd ?? 0) >= 0 ? 'green' : 'red'} sub={`${fmtPct(dre?.margem_ytd)} de margem`} icon={<Wallet className="w-4 h-4" />} />
          <Kpi label="CMV" value={fmtPct(cmv?.pct)} accent={cmvAcima ? 'red' : 'green'} sub={cmv ? `meta ${fmtPct(cmv.meta)} · ${cmv.ref}` : undefined} icon={<Percent className="w-4 h-4" />} />
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Caixa & Clientes</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Saldo projetado 90d" value={fmtBRL(fluxo?.saldo90_base)} accent={(fluxo?.saldo90_base ?? 0) >= 0 ? 'green' : 'red'} sub="cenário base" icon={<Wallet className="w-4 h-4" />} />
          <Kpi label="Caixa aperta?" value={fluxo?.aperta ? (fmtData(fluxo.aperta) || '—') : 'não em 90d'} accent={fluxo?.aperta ? 'amber' : 'green'} sub="pessimista" />
          <Kpi label="Campeões" value={(rfm?.campeoes_n ?? 0).toLocaleString('pt-BR')} accent="green" sub={fmtBRL(rfm?.campeoes_valor)} icon={<Users className="w-4 h-4" />} />
          <Kpi label="Clientes em risco" value={(rfm?.em_risco_n ?? 0).toLocaleString('pt-BR')} accent="amber" sub={`${fmtBRL(rfm?.em_risco_valor)} em jogo`} icon={<Users className="w-4 h-4" />} />
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        {[
          { href: '/financeiro/dre', label: 'Ver DRE completa' },
          { href: '/estrategico/orcamentacao', label: 'Orçamentação' },
          { href: '/financeiro/fluxo-caixa', label: 'Fluxo de caixa' },
          { href: '/analitico/clientes/segmentos', label: 'Segmentos (RFM)' },
        ].map(l => (
          <Link key={l.href} href={l.href} className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
            {l.label} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ))}
      </section>
    </main>
  );
}
