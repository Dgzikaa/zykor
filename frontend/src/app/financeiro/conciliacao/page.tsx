'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Scale, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

type Row = {
  data: string; status: string; stone_cnpjs: string | null;
  contahub_cartao: number; stone_bruto: number; diferenca: number;
  stone_taxa: number; stone_liquido: number; stone_transacoes: number;
};

const fmtBRL = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const fmtData = (d: string) => { try { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y.slice(2)}`; } catch { return d; } };

export default function ConciliacaoPage() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [resumo, setResumo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    if (!selectedBar) return;
    setLoading(true);
    try {
      const r = await api.get('/api/financeiro/conciliacao');
      setRows(r.conciliacao || []); setResumo(r.resumo || null);
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao carregar conciliação', message: e?.message }); }
    finally { setLoading(false); }
  }, [selectedBar, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const corDif = (v: number) => Math.abs(v) < 0.01 ? 'text-muted-foreground' : v > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-3 py-5 max-w-5xl">
        <div className="flex items-center gap-2 mb-1">
          <Scale className="w-5 h-5" /><h1 className="text-xl font-bold">Conciliação Stone × ContaHub</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Vendas no cartão (ContaHub) × recebimento na Stone, por dia operacional. Diferença ≠ 0 = investigar.
        </p>

        {resumo && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Dias conciliados</div><div className="text-lg font-bold">{resumo.dias}</div></CardContent></Card>
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-600" />Batendo</div><div className="text-lg font-bold text-emerald-600">{resumo.ok}</div></CardContent></Card>
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-600" />A verificar</div><div className="text-lg font-bold text-amber-600">{resumo.verificar}</div></CardContent></Card>
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Taxa Stone (MDR)</div><div className="text-lg font-bold">{fmtBRL(resumo.taxa_total)}</div></CardContent></Card>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground"><Scale className="w-9 h-9 mx-auto mb-2 opacity-40" />Sem dados de conciliação ainda.</CardContent></Card>
        ) : (
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b"><tr>
                <th className="text-left px-3 py-2">Dia</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">ContaHub cartão</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">Stone bruto</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">Diferença</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">Taxa</th>
                <th className="text-right px-3 py-2">Tx</th>
                <th className="text-left px-3 py-2 whitespace-nowrap">CNPJ</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.data} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-1.5 whitespace-nowrap font-medium">
                      {fmtData(r.data)}{i === 0 && <span className="text-[10px] text-muted-foreground ml-1">(parcial)</span>}
                    </td>
                    <td className="px-3 py-1.5">
                      {r.status === 'ok'
                        ? <span className="text-[10px] rounded px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">● bate</span>
                        : <span className="text-[10px] rounded px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">▲ verificar</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">{fmtBRL(r.contahub_cartao)}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">{fmtBRL(r.stone_bruto)}</td>
                    <td className={`px-3 py-1.5 text-right whitespace-nowrap font-medium ${corDif(r.diferenca)}`}>{fmtBRL(r.diferenca)}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap text-muted-foreground">{fmtBRL(r.stone_taxa)}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{r.stone_transacoes ?? '—'}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground text-xs">{r.stone_cnpjs || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
}
