'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Wallet, TrendingDown, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine,
} from 'recharts';

const fmtBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n || 0);
const fmtK = (n: number) => `${(n / 1000).toFixed(0)}k`;

interface Linha { bar_id: number; data_referencia: string; cenario: string; saldo_dia: number; receita_prevista: number; }

export default function FluxoCaixaPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);

  const carregar = async () => {
    if (!selectedBar?.id) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/fluxo-caixa?bar_id=${selectedBar.id}`, { cache: 'no-store' });
      const j = await r.json();
      setLinhas((j.fluxo || []).map((l: any) => ({ ...l, saldo_dia: Number(l.saldo_dia), receita_prevista: Number(l.receita_prevista) })));
    } finally { setLoading(false); }
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedBar?.id]);

  const gerar = async () => {
    if (!selectedBar?.id) return;
    setGerando(true);
    try {
      const r = await fetch('/api/fluxo-caixa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'gerar', bar_id: selectedBar.id }) });
      if (!r.ok) throw new Error();
      toast({ title: 'Projeção recalculada' });
    } catch { toast({ title: 'Falha ao recalcular', variant: 'destructive' }); }
    finally { setGerando(false); await carregar(); }
  };

  // Pivota por data + saldo ACUMULADO por cenário
  const { chart, resumo } = useMemo(() => {
    const dias = Array.from(new Set(linhas.map(l => l.data_referencia))).sort();
    const porCen = (cen: string) => new Map(linhas.filter(l => l.cenario === cen).map(l => [l.data_referencia, l.saldo_dia]));
    const mB = porCen('base'), mO = porCen('otimista'), mP = porCen('pessimista');
    let aB = 0, aO = 0, aP = 0;
    const chart = dias.map(d => {
      aB += mB.get(d) || 0; aO += mO.get(d) || 0; aP += mP.get(d) || 0;
      const [, mm, dd] = d.split('-');
      return { data: `${dd}/${mm}`, base: Math.round(aB), otimista: Math.round(aO), pessimista: Math.round(aP) };
    });
    const totalBase = chart.length ? chart[chart.length - 1].base : 0;
    const totalPess = chart.length ? chart[chart.length - 1].pessimista : 0;
    // primeiro dia em que o acumulado pessimista fica negativo (caixa aperta)
    const aperta = chart.find(p => p.pessimista < 0)?.data ?? null;
    const piorDiaPess = chart.reduce((min, p) => (p.pessimista < min.v ? { d: p.data, v: p.pessimista } : min), { d: '', v: Infinity });
    return { chart, resumo: { totalBase, totalPess, aperta, piorDiaPess } };
  }, [linhas]);

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="w-6 h-6 text-emerald-600" /> Fluxo de Caixa Projetado (90 dias)</h1>
          <p className="text-sm text-gray-500">Saldo acumulado projetado em 3 cenários. Use pra antecipar quando o caixa aperta.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={gerar} disabled={gerando}>
          <RefreshCw className={`w-4 h-4 ${gerando ? 'animate-spin' : ''}`} /> Recalcular
        </Button>
      </div>

      {loading ? <Skeleton className="h-96" /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 border-l-4 border-l-blue-500">
              <p className="text-xs text-gray-500">Saldo 90d (base)</p>
              <p className={`text-2xl font-bold ${resumo.totalBase >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmtBRL(resumo.totalBase)}</p>
            </Card>
            <Card className="p-4 border-l-4 border-l-red-500">
              <p className="text-xs text-gray-500">Saldo 90d (pessimista)</p>
              <p className={`text-2xl font-bold ${resumo.totalPess >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtBRL(resumo.totalPess)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-gray-500">Caixa aperta (pessimista)</p>
              <p className={`text-2xl font-bold ${resumo.aperta ? 'text-amber-600' : 'text-emerald-600'}`}>{resumo.aperta ?? 'não no período'}</p>
              <p className="text-[10px] text-gray-400">1º dia com acumulado negativo</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-gray-500">Pior ponto (pessimista)</p>
              <p className={`text-2xl font-bold ${resumo.piorDiaPess.v >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{Number.isFinite(resumo.piorDiaPess.v) ? fmtBRL(resumo.piorDiaPess.v) : '—'}</p>
              <p className="text-[10px] text-gray-400">{resumo.piorDiaPess.d}</p>
            </Card>
          </div>

          <Card className="p-4">
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="data" tick={{ fontSize: 10 }} interval={6} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} width={44} />
                  <Tooltip formatter={(v) => fmtBRL(Number(v) || 0)} labelClassName="text-xs" />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="otimista" name="Otimista" stroke="#10b981" dot={false} strokeWidth={1.5} />
                  <Line type="monotone" dataKey="base" name="Base" stroke="#3b82f6" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="pessimista" name="Pessimista" stroke="#ef4444" dot={false} strokeWidth={1.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Saldo <strong>acumulado</strong> (receita − CMV − CMO − fixos − outros), partindo de 0 hoje. A linha vermelha é o zero —
              quando o cenário pessimista cruza pra baixo, é o sinal de atenção de caixa.
            </p>
          </Card>
        </>
      )}
    </main>
  );
}
