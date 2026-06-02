'use client';

import { useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { XCircle } from 'lucide-react';

interface Dia {
  dt_gerencial: string;
  qtd_itens: number;
  valor_cancelado: number;
  custo_perdido: number;
  faturamento_liquido: number;
  pct_sobre_faturamento: number | null;
}
interface Motivo {
  motivo: string;
  valor: number;
  qtd: number;
}

const moeda = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
const dataLabel = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

/**
 * Cancelamentos: perda (valor cheio) por dia, custo e % sobre faturamento + top motivos.
 * Fonte: gold.cancelamentos_diario + bronze (motivos) via /api/ferramentas/cancelamentos.
 */
export default function CancelamentosPage() {
  const { selectedBar } = useBar();
  const [loading, setLoading] = useState(true);
  const [diario, setDiario] = useState<Dia[]>([]);
  const [motivos, setMotivos] = useState<Motivo[]>([]);

  useEffect(() => {
    if (!selectedBar?.id) return;
    let ativo = true;
    setLoading(true);
    fetch('/api/ferramentas/cancelamentos?dias=60', {
      headers: { 'x-selected-bar-id': String(selectedBar.id) },
    })
      .then((r) => r.json())
      .then((j) => {
        if (!ativo) return;
        setDiario(j.success ? j.diario : []);
        setMotivos(j.success ? j.motivos : []);
      })
      .catch(() => { if (ativo) { setDiario([]); setMotivos([]); } })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [selectedBar?.id]);

  const totalPerda = diario.reduce((s, d) => s + Number(d.valor_cancelado || 0), 0);
  const totalCusto = diario.reduce((s, d) => s + Number(d.custo_perdido || 0), 0);
  const totalFat = diario.reduce((s, d) => s + Number(d.faturamento_liquido || 0), 0);
  const pctMedio = totalFat > 0 ? (totalPerda / totalFat) * 100 : 0;
  const maxMotivo = motivos.reduce((mx, m) => Math.max(mx, m.valor), 0);

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <XCircle className="w-6 h-6 text-red-600" /> Cancelamentos
        </h1>
        <p className="text-sm text-muted-foreground">
          Perda por itens cancelados (valor cheio), custo e % sobre o faturamento — últimos 60 dias.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : diario.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">Sem cancelamentos no período.</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Perda (60d)</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-red-600">{moeda(totalPerda)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">% sobre faturamento</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{pctMedio.toFixed(2)}%</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Custo perdido</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{moeda(totalCusto)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Itens cancelados</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{diario.reduce((s, d) => s + Number(d.qtd_itens || 0), 0).toLocaleString('pt-BR')}</div></CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Por dia</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b">
                      <th className="text-left py-1 font-medium">Dia</th>
                      <th className="text-right py-1 font-medium">Itens</th>
                      <th className="text-right py-1 font-medium">Perda</th>
                      <th className="text-right py-1 font-medium">% Fat.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diario.map((d) => (
                      <tr key={d.dt_gerencial} className="border-b last:border-0 border-[hsl(var(--border))]">
                        <td className="py-1">{dataLabel(d.dt_gerencial)}</td>
                        <td className="text-right py-1">{d.qtd_itens}</td>
                        <td className="text-right py-1 text-red-600">{moeda(d.valor_cancelado)}</td>
                        <td className={`text-right py-1 font-medium ${(d.pct_sobre_faturamento || 0) >= 5 ? 'text-red-600' : ''}`}>
                          {d.pct_sobre_faturamento != null ? `${d.pct_sobre_faturamento.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Top motivos (30d)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {motivos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem motivos registrados.</p>
                ) : (
                  motivos.map((m) => (
                    <div key={m.motivo}>
                      <div className="flex justify-between text-sm">
                        <span className="truncate pr-2">{m.motivo}</span>
                        <span className="font-medium whitespace-nowrap">{moeda(m.valor)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded mt-1">
                        <div className="h-1.5 bg-red-500 rounded" style={{ width: `${maxMotivo > 0 ? (m.valor / maxMotivo) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
