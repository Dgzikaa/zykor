'use client';

import { useEffect, useState, useCallback } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { XCircle, X } from 'lucide-react';

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
interface ItemDetalhe {
  dt_gerencial: string;
  prd_desc: string | null;
  grp_desc: string | null;
  itm_qtd: number | null;
  itm_vrunitario: number | null;
  itm_vrcheio: number | null;
  cancelou: string | null;
  motivocancdesconto: string | null;
  vd_mesadesc: string | null;
}

const PERIODOS = [
  { label: 'Semana', dias: 7 },
  { label: 'Mês', dias: 30 },
  { label: 'Semestre', dias: 180 },
  { label: 'Ano', dias: 365 },
] as const;

const moeda = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
const moedaP = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const dataLabel = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

/**
 * Cancelamentos: perda por dia (valor cheio), custo e % sobre faturamento + top motivos.
 * Período selecionável (semana/mês/semestre/ano). Clicar num dia abre modal com
 * todos os itens cancelados: descrição, valor unitário, qtd, garçom (cancelou), motivo, mesa.
 * Fonte: gold.cancelamentos_diario + bronze (motivos/detalhe).
 */
export default function CancelamentosPage() {
  const { selectedBar } = useBar();
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState<number>(30);
  const [diario, setDiario] = useState<Dia[]>([]);
  const [motivos, setMotivos] = useState<Motivo[]>([]);

  // modal de detalhe
  const [diaModal, setDiaModal] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<ItemDetalhe[]>([]);
  const [loadingDet, setLoadingDet] = useState(false);

  useEffect(() => {
    if (!selectedBar?.id) return;
    let ativo = true;
    setLoading(true);
    fetch(`/api/ferramentas/cancelamentos?dias=${dias}`, {
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
  }, [selectedBar?.id, dias]);

  const abrirDia = useCallback((dia: string) => {
    if (!selectedBar?.id) return;
    setDiaModal(dia);
    setLoadingDet(true);
    setDetalhe([]);
    fetch(`/api/ferramentas/cancelamentos/detalhe?inicio=${dia}&fim=${dia}`, {
      headers: { 'x-selected-bar-id': String(selectedBar.id) },
    })
      .then((r) => r.json())
      .then((j) => setDetalhe(j.success ? j.itens : []))
      .catch(() => setDetalhe([]))
      .finally(() => setLoadingDet(false));
  }, [selectedBar?.id]);

  const totalPerda = diario.reduce((s, d) => s + Number(d.valor_cancelado || 0), 0);
  const totalCusto = diario.reduce((s, d) => s + Number(d.custo_perdido || 0), 0);
  const totalFat = diario.reduce((s, d) => s + Number(d.faturamento_liquido || 0), 0);
  const pctMedio = totalFat > 0 ? (totalPerda / totalFat) * 100 : 0;
  const maxMotivo = motivos.reduce((mx, m) => Math.max(mx, m.valor), 0);
  const periodoLabel = PERIODOS.find((p) => p.dias === dias)?.label ?? `${dias}d`;

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <XCircle className="w-6 h-6 text-red-600" /> Cancelamentos
          </h1>
          <p className="text-sm text-muted-foreground">
            Perda por itens cancelados (valor cheio), custo e % sobre o faturamento. Clique num dia para ver os itens.
          </p>
        </div>
        <div className="flex gap-1">
          {PERIODOS.map((p) => (
            <button key={p.dias} onClick={() => setDias(p.dias)}
              className={`px-3 py-1.5 text-xs rounded-md border ${dias === p.dias ? 'bg-red-600 text-white border-red-600' : 'border-[hsl(var(--border))]'}`}>
              {p.label}
            </button>
          ))}
        </div>
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
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Perda ({periodoLabel})</CardTitle></CardHeader>
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
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Por dia <span className="text-xs text-muted-foreground font-normal">(clique para detalhar)</span></CardTitle></CardHeader>
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
                      <tr key={d.dt_gerencial} onClick={() => abrirDia(d.dt_gerencial)}
                        className="border-b last:border-0 border-[hsl(var(--border))] cursor-pointer hover:bg-muted/50">
                        <td className="py-1 text-red-600 underline-offset-2 hover:underline">{dataLabel(d.dt_gerencial)}</td>
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

      {/* Modal de detalhe do dia */}
      {diaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDiaModal(null)}>
          <div className="bg-background rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
              <h3 className="font-semibold">Cancelamentos — {new Date(diaModal + 'T00:00:00').toLocaleDateString('pt-BR')}</h3>
              <button onClick={() => setDiaModal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-4">
              {loadingDet ? (
                <Skeleton className="h-40 w-full" />
              ) : detalhe.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum item cancelado neste dia.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b text-left">
                      <th className="py-1 font-medium">Item</th>
                      <th className="py-1 font-medium text-right">Qtd</th>
                      <th className="py-1 font-medium text-right">Vlr unit.</th>
                      <th className="py-1 font-medium text-right">Total</th>
                      <th className="py-1 font-medium">Garçom</th>
                      <th className="py-1 font-medium">Motivo</th>
                      <th className="py-1 font-medium">Mesa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalhe.map((it, i) => (
                      <tr key={i} className="border-b last:border-0 border-[hsl(var(--border))]">
                        <td className="py-1.5">{it.prd_desc || '—'}<div className="text-[10px] text-muted-foreground">{it.grp_desc}</div></td>
                        <td className="py-1.5 text-right">{Number(it.itm_qtd || 0)}</td>
                        <td className="py-1.5 text-right">{moedaP(Number(it.itm_vrunitario))}</td>
                        <td className="py-1.5 text-right text-red-600 font-medium">{moedaP(Number(it.itm_vrcheio))}</td>
                        <td className="py-1.5">{it.cancelou || '—'}</td>
                        <td className="py-1.5 text-xs">{it.motivocancdesconto || '—'}</td>
                        <td className="py-1.5 text-xs text-muted-foreground">{it.vd_mesadesc || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
