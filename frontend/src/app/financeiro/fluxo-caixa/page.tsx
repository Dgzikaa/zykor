'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useBar } from '@/contexts/BarContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Wallet, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';

const fmtBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n || 0);
const parseV = (v: string) => Number(String(v).replace(/[R$.\s]/g, '').replace(',', '.')) || 0;

interface Linha { dia: string; entradas: number; saidas: number; saldo: number; }
interface Resumo { saldo_final: number; total_entradas: number; total_saidas: number; menor_saldo: number; menor_saldo_dia: string | null; negativo: boolean; }

export default function FluxoCaixaPage() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const [saldo, setSaldo] = useState('');
  const [dias, setDias] = useState(60);
  const [puxando, setPuxando] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(false);

  // lembra o saldo digitado por bar
  useEffect(() => {
    if (selectedBar?.id) setSaldo(localStorage.getItem(`fc_saldo_${selectedBar.id}`) || '');
  }, [selectedBar?.id]);

  const carregar = useCallback(async () => {
    if (!selectedBar?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/financeiro/fluxo-caixa-real?saldo_inicial=${parseV(saldo)}&dias=${dias}`);
      setLinhas(res.linhas || []); setResumo(res.resumo || null);
    } finally { setLoading(false); }
  }, [selectedBar?.id, saldo, dias]);

  useEffect(() => { const t = setTimeout(carregar, 350); return () => clearTimeout(t); }, [carregar]);

  const puxarSaldo = async () => {
    setPuxando(true);
    try {
      const res = await api.get('/api/financeiro/contaazul/saldos');
      const v = String(res.caixa ?? 0);
      setSaldo(v);
      if (selectedBar?.id) localStorage.setItem(`fc_saldo_${selectedBar.id}`, v);
      showToast({ type: 'success', title: 'Saldo puxado do Conta Azul', message: `Caixa ${fmtBRL(Number(res.caixa))} · Investimentos ${fmtBRL(Number(res.investimentos))}` });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Não consegui puxar os saldos', message: e?.message });
    } finally { setPuxando(false); }
  };

  const chart = useMemo(() => linhas.map(l => ({
    dia: new Date(l.dia + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    saldo: Math.round(l.saldo),
  })), [linhas]);

  return (
    <ProtectedRoute>
      <div className="mx-auto px-3 py-5">
        <div className="flex items-center gap-2 mb-1"><Wallet className="w-5 h-5" /><h1 className="text-xl font-bold">Fluxo de Caixa</h1></div>
        <p className="text-sm text-muted-foreground mb-4">Saldo atual + entradas projetadas − contas a pagar comprometidas no Conta Azul. Mostra quando o caixa aperta.</p>

        <div className="flex items-end gap-2 mb-4 flex-wrap">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Saldo atual em conta (R$)</label>
            <Input value={saldo} onChange={(e) => { setSaldo(e.target.value); if (selectedBar?.id) localStorage.setItem(`fc_saldo_${selectedBar.id}`, e.target.value); }}
              placeholder="ex: 150.000" inputMode="decimal" className="w-44" />
          </div>
          <Button variant="outline" size="sm" onClick={puxarSaldo} disabled={puxando} title="Puxar o saldo atual de todas as contas do Conta Azul">
            {puxando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Puxar saldo (CA)
          </Button>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Período</label>
            <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="h-9 text-sm border rounded px-2 bg-background">
              <option value={30}>30 dias</option><option value={60}>60 dias</option><option value={90}>90 dias</option>
            </select>
          </div>
        </div>

        {resumo && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Saldo projetado no fim</div><div className="text-lg font-bold">{fmtBRL(resumo.saldo_final)}</div></CardContent></Card>
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">A pagar no período (CA)</div><div className="text-lg font-bold text-red-600">{fmtBRL(resumo.total_saidas)}</div></CardContent></Card>
            <Card className={resumo.negativo ? 'border-red-500/60' : ''}><CardContent className="py-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1">{resumo.negativo && <AlertTriangle className="w-3.5 h-3.5 text-red-600" />}Menor saldo projetado</div>
              <div className={`text-lg font-bold ${resumo.negativo ? 'text-red-600' : ''}`}>{fmtBRL(resumo.menor_saldo)}</div>
              {resumo.menor_saldo_dia && <div className="text-[11px] text-muted-foreground">em {new Date(resumo.menor_saldo_dia + 'T00:00:00').toLocaleDateString('pt-BR')}</div>}
            </CardContent></Card>
          </div>
        )}

        {resumo?.negativo && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> O caixa fica <b>negativo</b> em {resumo.menor_saldo_dia ? new Date(resumo.menor_saldo_dia + 'T00:00:00').toLocaleDateString('pt-BR') : ''}. Antecipe recebíveis ou renegocie pagamentos.
          </div>
        )}

        {loading ? <Skeleton className="h-[340px]" /> : chart.length > 0 ? (
          <Card className="p-3">
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={44} />
                <Tooltip formatter={(v: any) => fmtBRL(Number(v))} labelFormatter={(l) => `Dia ${l}`} />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="saldo" stroke="#2563eb" fill="#2563eb" fillOpacity={0.12} strokeWidth={2} name="Saldo" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        ) : (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Informe o saldo atual pra ver a projeção.</CardContent></Card>
        )}

        <p className="text-xs text-muted-foreground mt-3">Entradas = projeção de receita (modelo). Saídas = contas a pagar em aberto no Conta Azul (vencimento). Atualize o saldo atual pra a projeção bater com o banco.</p>
      </div>
    </ProtectedRoute>
  );
}
