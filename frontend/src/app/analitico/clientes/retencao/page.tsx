'use client';

import { useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';

interface Row {
  coorte: string;
  mes_offset: number;
  clientes: number;
}

const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const coorteLabel = (iso: string) => {
  const [a, m] = iso.split('-');
  return `${MESES[Number(m)]}/${a.slice(2)}`;
};

/**
 * Retenção de clientes (matriz de coorte) — % que voltou nos meses seguintes à 1ª visita.
 * Fonte: gold.cliente_coorte_mensal via /api/analitico/clientes/retencao. Self-contained.
 */
export default function RetencaoPage() {
  const { selectedBar } = useBar();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!selectedBar?.id) return;
    let ativo = true;
    setLoading(true);
    fetch('/api/analitico/clientes/retencao?meses=12', {
      headers: { 'x-selected-bar-id': String(selectedBar.id) },
    })
      .then((r) => r.json())
      .then((j) => { if (ativo) setRows(j.success ? j.data : []); })
      .catch(() => { if (ativo) setRows([]); })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [selectedBar?.id]);

  const coortes = Array.from(new Set(rows.map((r) => r.coorte))).sort();
  const maxOffset = Math.min(rows.reduce((mx, r) => Math.max(mx, r.mes_offset), 0), 6);
  const byCoorte = new Map<string, Map<number, number>>();
  for (const r of rows) {
    if (!byCoorte.has(r.coorte)) byCoorte.set(r.coorte, new Map());
    byCoorte.get(r.coorte)!.set(r.mes_offset, r.clientes);
  }

  const cor = (pct: number) => {
    if (pct >= 15) return 'bg-green-600 text-white';
    if (pct >= 8) return 'bg-green-500/40';
    if (pct >= 4) return 'bg-amber-400/30';
    if (pct > 0) return 'bg-red-400/20';
    return '';
  };

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-indigo-600" /> Retenção de Clientes (Coorte)
        </h1>
        <p className="text-sm text-muted-foreground">
          % de clientes que voltaram nos meses seguintes à 1ª visita (identificados por telefone). M+N = N meses depois.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : coortes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Sem dados de coorte para o período.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left py-2 px-2">Coorte (1ª visita)</th>
                  <th className="text-right py-2 px-2">Clientes</th>
                  {Array.from({ length: maxOffset }, (_, i) => (
                    <th key={i + 1} className="text-center py-2 px-2">M+{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coortes.map((c) => {
                  const m = byCoorte.get(c)!;
                  const base = m.get(0) || 0;
                  return (
                    <tr key={c} className="border-t border-[hsl(var(--border))]">
                      <td className="py-1.5 px-2 font-medium">{coorteLabel(c)}</td>
                      <td className="text-right py-1.5 px-2">{base.toLocaleString('pt-BR')}</td>
                      {Array.from({ length: maxOffset }, (_, i) => {
                        const off = i + 1;
                        const v = m.get(off);
                        const pct = base > 0 && v != null ? (v / base) * 100 : null;
                        return (
                          <td key={off} className={`text-center py-1.5 px-2 rounded ${pct != null ? cor(pct) : ''}`}>
                            {pct != null ? `${pct.toFixed(1)}%` : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
