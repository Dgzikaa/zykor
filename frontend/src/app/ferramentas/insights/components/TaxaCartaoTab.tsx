'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { GraficoBarraH, GraficoLinha } from '@/components/graficos/Charts';
import { useBar } from '@/contexts/BarContext';

interface Props { dataInicio: string; dataFim: string }

interface Bandeira { brand_id: number | null; transacoes: number; bruto: number; taxa: number; taxa_pct: number }
interface ApiData {
  kpis: { taxa_total: number; bruto: number; taxa_pct: number; transacoes: number };
  por_bandeira: Bandeira[];
  por_tipo: { tipo: string; transacoes: number; bruto: number; taxa: number; taxa_pct: number }[];
  por_dia: { dia: string; taxa: number; taxa_pct: number }[];
}

// Mapa de bandeira Stone (os confiáveis; resto por id). null = débito/Pix (sem bandeira de crédito).
const BANDEIRA: Record<string, string> = { '1': 'Visa', '2': 'Mastercard', '3': 'Amex', '4': 'Elo', '5': 'Hipercard' };
const nomeBandeira = (id: number | null) => (id == null ? 'Débito / outros' : BANDEIRA[String(id)] || `Bandeira ${id}`);

const fmtBRL = (v: number | null | undefined) =>
  v == null ? 'R$ 0' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtPct = (v: number | null | undefined) => (v == null ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`);
const ddmm = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };

export function TaxaCartaoTab({ dataInicio, dataFim }: Props) {
  const { selectedBar } = useBar();
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBar) return;
    setLoading(true);
    setError(null);
    fetch(`/api/ferramentas/insights/taxas-cartao?bar_id=${selectedBar.id}&data_inicio=${dataInicio}&data_fim=${dataFim}`)
      .then((r) => r.json())
      .then((r) => { if (r.success) setData(r); else setError(r.error || 'Erro'); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedBar?.id, dataInicio, dataFim]);

  const bandeiras = useMemo(
    () => (data?.por_bandeira || []).map((b) => ({ ...b, nome: nomeBandeira(b.brand_id) })),
    [data?.por_bandeira]
  );
  const porDia = useMemo(() => (data?.por_dia || []).map((d) => ({ ...d, label: ddmm(d.dia) })), [data?.por_dia]);

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!data || !data.kpis) return null;

  const k = data.kpis;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Taxa paga no mês" value={fmtBRL(k.taxa_total)} destaque />
        <KpiCard label="Taxa efetiva" value={fmtPct(k.taxa_pct)} />
        <KpiCard label="Faturamento no cartão" value={fmtBRL(k.bruto)} />
        <KpiCard label="Transações" value={(k.transacoes || 0).toLocaleString('pt-BR')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Taxa por bandeira</CardTitle></CardHeader>
          <CardContent>
            <GraficoBarraH data={bandeiras} xKey="nome" valueKey="taxa" formatV={fmtBRL} cor="#ef4444" maxItens={10} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Taxa efetiva por bandeira</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-4">
            {bandeiras.map((b, i) => {
              const max = Math.max(...bandeiras.map((x) => x.taxa_pct), 1);
              return (
                <div key={String(b.brand_id)} className="flex items-center gap-2 text-sm">
                  <span className="w-28 truncate" title={b.nome}>{b.nome}</span>
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded h-3 overflow-hidden">
                    <div className="h-full" style={{ width: `${(b.taxa_pct / max) * 100}%`, background: b.taxa_pct >= 2 ? '#ef4444' : '#f59e0b' }} />
                  </div>
                  <span className="w-16 text-right tabular-nums">{fmtPct(b.taxa_pct)}</span>
                  <span className="text-xs text-gray-500 w-12 text-right">{b.transacoes}x</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Taxa por dia (R$ e %)</CardTitle></CardHeader>
        <CardContent>
          <GraficoLinha
            data={porDia}
            xKey="label"
            series={[{ key: 'taxa', nome: 'Taxa R$', cor: '#ef4444' }]}
            formatV={fmtBRL}
            area
          />
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, destaque }: { label: string; value: string; destaque?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`text-xl font-bold mt-1 ${destaque ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
