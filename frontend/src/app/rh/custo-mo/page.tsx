'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Coins, Loader2 } from 'lucide-react';

type Linha = { data: string; evento: string | null; freelas_custo: number; freelas_n: number; escalados_n: number; fixo_estimado: number; total: number };

const fmt = (v: number) => v === 0 ? '–' : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtData = (d: string) => { try { const [, m, dd] = d.split('-'); const dow = new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }); return `${dd}/${m} · ${dow}`; } catch { return d; } };

export default function CustoMoPage() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const [mesAno, setMesAno] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [total, setTotal] = useState<{ freelas: number; fixo: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => {
    const [a, m] = mesAno.split('-').map(Number);
    const inicio = `${mesAno}-01`;
    const fimD = new Date(a, m, 0).getDate();
    return { inicio, fim: `${mesAno}-${String(fimD).padStart(2, '0')}` };
  }, [mesAno]);

  const carregar = useCallback(async () => {
    if (!selectedBar) return;
    setLoading(true);
    try { const r = await api.get(`/api/rh/custo-mo?inicio=${range.inicio}&fim=${range.fim}`); setLinhas(r.linhas || []); setTotal(r.total || null); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro ao carregar', message: e?.message }); }
    finally { setLoading(false); }
  }, [selectedBar, range, showToast]);
  useEffect(() => { carregar(); }, [carregar]);

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-3 py-5 max-w-5xl">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 p-5 mb-5 shadow-sm">
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-3 flex-wrap text-white">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0"><Coins className="w-6 h-6" /></div>
              <div>
                <h1 className="text-xl font-bold leading-tight">Custo de Mão de Obra</h1>
                <p className="text-sm text-white/80">Freelas (real) + fixo escalado (estimado) por dia/evento</p>
              </div>
            </div>
            <input type="month" value={mesAno} onChange={(e) => setMesAno(e.target.value)} className="h-9 rounded-md bg-white/15 backdrop-blur border-0 text-white px-2 text-sm [color-scheme:dark]" />
          </div>
        </div>

        {total && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Kpi label="Freelas (real)" value={fmt(total.freelas)} cor="text-amber-600 dark:text-amber-400" />
            <Kpi label="Fixo escalado (est.)" value={fmt(total.fixo)} cor="text-sky-600 dark:text-sky-400" />
            <Kpi label="Total do mês" value={fmt(total.total)} cor="text-emerald-600 dark:text-emerald-400" />
          </div>
        )}

        <Card className="p-0 overflow-x-auto rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
          {loading ? <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
            : linhas.length === 0 ? <div className="py-16 text-center text-muted-foreground">Sem escala/freelas nesse mês.</div> : (
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-muted/40">
                  <tr>
                    <th className="text-left px-3 py-2">Dia</th>
                    <th className="text-left px-3 py-2">Evento</th>
                    <th className="text-right px-3 py-2">Freelas</th>
                    <th className="text-center px-3 py-2">Escalados</th>
                    <th className="text-right px-3 py-2">Fixo est.</th>
                    <th className="text-right px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.data} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-1.5 whitespace-nowrap">{fmtData(l.data)}</td>
                      <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[220px]">{l.evento || '—'}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmt(l.freelas_custo)}{l.freelas_n > 0 && <span className="text-[10px] text-muted-foreground"> ({l.freelas_n})</span>}</td>
                      <td className="px-3 py-1.5 text-center">{l.escalados_n || '–'}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(l.fixo_estimado)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{fmt(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Card>
        <p className="text-[11px] text-muted-foreground mt-2">Fixo estimado = salário base ÷ 30 por funcionário escalado no dia (aproximação). Freelas = valor real das convocações confirmadas/comparecidas.</p>
      </div>
    </ProtectedRoute>
  );
}

function Kpi({ label, value, cor }: { label: string; value: string; cor?: string }) {
  return (
    <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
      <CardContent className="p-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-xl font-bold mt-1 ${cor || ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
