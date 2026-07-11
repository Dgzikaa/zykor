'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Skeleton } from '@/components/ui/skeleton';
import { PackageX, Boxes, CalendarX2 } from 'lucide-react';
import { HeroRow, ChartCard, ChartGrid, GraficoBarrasAgrupadas, GraficoLinha, type Kpi } from '@/components/graficos/Charts';

const fmtBRL = (n: number | null | undefined) =>
  n == null ? 'R$ 0' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const fmtBRLk = (n: number | null | undefined) => {
  const v = Number(n || 0);
  return v >= 1000 ? `R$ ${(v / 1000).toFixed(1).replace('.', ',')}k` : fmtBRL(v);
};
const fmtN = (n: number | null | undefined, d = 1) =>
  n == null ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: d });

interface Prod { produto: string; dias_ruptura: number; preco: number; vel_dia: number; conservador: number; teto: number }
interface Resp {
  success: boolean;
  kpis?: { conservador: number | null; teto: number | null; produtos: number; ocorrencias: number };
  por_produto?: Prod[];
  por_categoria?: { categoria: string; conservador: number; teto: number }[];
  por_dia?: { dia: string; conservador: number; teto: number }[];
  meta?: { dias: number; desde: string; modelo: string };
}

const PERIODOS = [7, 30, 90] as const;
const ddmm = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };

export default function VendaPerdidaRupturaPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(30);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPageTitle('📦 Venda Perdida por Ruptura');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    fetch(`/api/operacional/venda-perdida-ruptura?bar_id=${selectedBar.id}&dias=${dias}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [selectedBar?.id, dias]);

  const k = data?.kpis;
  const temDados = !!k && (k.produtos ?? 0) > 0;
  const porDia = useMemo(() => (data?.por_dia || []).map((d) => ({ ...d, label: ddmm(d.dia) })), [data?.por_dia]);

  const kpis: Kpi[] = useMemo(() => {
    if (!k) return [];
    return [
      { label: 'Deixado na mesa (faixa)', valor: `${fmtBRLk(k.conservador)}–${fmtBRLk(k.teto)}`, icon: PackageX, cor: '#ef4444', sub: 'conservador → teto' },
      { label: 'Produtos afetados', valor: fmtN(k.produtos, 0), icon: Boxes },
      { label: 'Ocorrências (produto·dia)', valor: fmtN(k.ocorrencias, 0), icon: CalendarX2 },
    ];
  }, [k]);

  if (!selectedBar?.id) return <div className="p-6 text-sm text-gray-500">Selecione um bar.</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-[hsl(var(--border))] p-0.5">
          {PERIODOS.map((p) => (
            <button
              key={p}
              onClick={() => setDias(p)}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                dias === p ? 'bg-[hsl(var(--primary))] text-white' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          só ruptura <b>intermitente</b> (item que a casa costuma ter e faltou em alguns dias) · velocidade dos dias com estoque
        </span>
      </div>

      {loading ? (
        <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-72 w-full" /></div>
      ) : !data?.success ? (
        <div className="rounded-xl border border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Erro ao carregar.
        </div>
      ) : !temDados ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 p-8 text-center text-sm text-emerald-700 dark:text-emerald-300">
          Nenhuma ruptura intermitente relevante no período — ou o rastreio de estoque deste bar não gera o sinal. 👍
        </div>
      ) : (
        <>
          <HeroRow kpis={kpis} cols={3} />

          <ChartGrid cols={2}>
            <ChartCard titulo="Por categoria" subtitulo="R$ deixado na mesa (conservador × teto)">
              <GraficoBarrasAgrupadas
                data={data.por_categoria || []}
                xKey="categoria"
                series={[
                  { key: 'conservador', nome: 'Conservador', cor: '#f59e0b' },
                  { key: 'teto', nome: 'Teto', cor: '#ef4444' },
                ]}
                formatV={fmtBRLk}
              />
            </ChartCard>
            <ChartCard titulo="Por dia" subtitulo="evolução da perda estimada">
              <GraficoLinha
                data={porDia}
                xKey="label"
                series={[
                  { key: 'conservador', nome: 'Conservador', cor: '#f59e0b' },
                  { key: 'teto', nome: 'Teto', cor: '#ef4444' },
                ]}
                formatV={fmtBRLk}
                area
              />
            </ChartCard>
          </ChartGrid>

          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <h3 className="mb-3 text-sm font-semibold">Itens que mais custaram</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                    <th className="py-2 pr-3 font-medium">Item</th>
                    <th className="py-2 px-3 font-medium text-right">Dias em falta</th>
                    <th className="py-2 px-3 font-medium text-right">Preço</th>
                    <th className="py-2 px-3 font-medium text-right">Vende/dia</th>
                    <th className="py-2 px-3 font-medium text-right">Conservador</th>
                    <th className="py-2 pl-3 font-medium text-right">Teto</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.por_produto || []).map((p) => (
                    <tr key={p.produto} className="border-b border-[hsl(var(--border))]/50">
                      <td className="py-2 pr-3 truncate max-w-[260px]" title={p.produto}>{p.produto}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtN(p.dias_ruptura, 0)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtBRL(p.preco)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtN(p.vel_dia)}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-amber-500">{fmtBRL(p.conservador)}</td>
                      <td className="py-2 pl-3 text-right tabular-nums font-semibold text-red-500">{fmtBRL(p.teto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
