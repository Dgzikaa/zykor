'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, RefreshCw, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

type Linha = {
  id: number; bar_id: number; data_referencia: string; cenario: string;
  receita_prevista: number; cmv_previsto: number; cmo_previsto: number;
  fixos_previstos: number; outros_previstos: number; saldo_dia: number;
  metodologia: any;
};

const NOMES_BAR: Record<number, string> = { 3: 'Ordinário', 4: 'Deboche' };

const formatBRL = (n: number) => `R$ ${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

function fmtData(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function FluxoCaixa90dPage() {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [barFilter, setBarFilter] = useState<number>(3);

  const carregar = async () => {
    setCarregando(true);
    const r = await fetch(`/api/fluxo-caixa?bar_id=${barFilter}`);
    const j = await r.json();
    setLinhas(j?.fluxo ?? []);
    setCarregando(false);
  };

  useEffect(() => { carregar(); }, [barFilter]);

  const gerar = async () => {
    if (!confirm('Gerar projeção pra todos os bares (90 dias x 3 cenários)?')) return;
    setGerando(true);
    try {
      const r = await fetch('/api/fluxo-caixa', { method: 'POST', body: '{}' });
      const j = await r.json();
      if (j?.success) {
        alert(`Gerado pra ${j.resultados.length} bares.`);
        await carregar();
      } else alert('Erro: ' + (j?.erro || JSON.stringify(j)));
    } finally { setGerando(false); }
  };

  // Agrega: data → { pessimista_saldo_acum, base_saldo_acum, otimista_saldo_acum }
  const chartData = useMemo(() => {
    const porData = new Map<string, any>();
    const acums = { pessimista: 0, base: 0, otimista: 0 };
    const datas = Array.from(new Set(linhas.map(l => l.data_referencia))).sort();
    for (const d of datas) {
      const pes = linhas.find(l => l.data_referencia === d && l.cenario === 'pessimista');
      const bas = linhas.find(l => l.data_referencia === d && l.cenario === 'base');
      const oti = linhas.find(l => l.data_referencia === d && l.cenario === 'otimista');
      acums.pessimista += Number(pes?.saldo_dia ?? 0);
      acums.base += Number(bas?.saldo_dia ?? 0);
      acums.otimista += Number(oti?.saldo_dia ?? 0);
      porData.set(d, {
        data: d, dataFmt: fmtData(d),
        pessimista: acums.pessimista,
        base: acums.base,
        otimista: acums.otimista,
        receita_base: Number(bas?.receita_prevista ?? 0),
      });
    }
    return Array.from(porData.values());
  }, [linhas]);

  const totais = useMemo(() => {
    const t = {
      pessimista: { receita: 0, custo: 0, saldo: 0 },
      base: { receita: 0, custo: 0, saldo: 0 },
      otimista: { receita: 0, custo: 0, saldo: 0 },
    };
    for (const l of linhas) {
      const c = (t as any)[l.cenario];
      if (!c) continue;
      c.receita += Number(l.receita_prevista);
      c.custo += Number(l.cmv_previsto) + Number(l.cmo_previsto) + Number(l.fixos_previstos) + Number(l.outros_previstos);
      c.saldo += Number(l.saldo_dia);
    }
    return t;
  }, [linhas]);

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-green-600" /> Fluxo de Caixa 90 dias
          </h1>
          <p className="text-sm text-gray-500">
            Projeção próximos 90 dias em 3 cenários. Receita: previsão demanda + mediana DOW. Custos: orçamentação + CMV histórico.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={String(barFilter)}
            onChange={e => setBarFilter(parseInt(e.target.value, 10))}
            className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
          >
            <option value="3">Ordinário</option>
            <option value="4">Deboche</option>
          </select>
          <Button onClick={gerar} disabled={gerando} className="bg-green-600 hover:bg-green-700">
            <RefreshCw className={`w-4 h-4 mr-2 ${gerando ? 'animate-spin' : ''}`} />
            Gerar projeção
          </Button>
        </div>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-red-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Pessimista (-20% rec, +5% custo)</p>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-xs text-gray-500">Receita</p>
          <p className="text-lg font-bold">{formatBRL(totais.pessimista.receita)}</p>
          <p className="text-xs text-gray-500 mt-2">Custos</p>
          <p className="text-lg font-bold">{formatBRL(totais.pessimista.custo)}</p>
          <p className="text-xs text-gray-500 mt-2">Saldo 90d</p>
          <p className={`text-xl font-bold ${totais.pessimista.saldo < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatBRL(totais.pessimista.saldo)}
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Base</p>
            <Minus className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xs text-gray-500">Receita</p>
          <p className="text-lg font-bold">{formatBRL(totais.base.receita)}</p>
          <p className="text-xs text-gray-500 mt-2">Custos</p>
          <p className="text-lg font-bold">{formatBRL(totais.base.custo)}</p>
          <p className="text-xs text-gray-500 mt-2">Saldo 90d</p>
          <p className={`text-xl font-bold ${totais.base.saldo < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatBRL(totais.base.saldo)}
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-green-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Otimista (+15% rec, -3% custo)</p>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-xs text-gray-500">Receita</p>
          <p className="text-lg font-bold">{formatBRL(totais.otimista.receita)}</p>
          <p className="text-xs text-gray-500 mt-2">Custos</p>
          <p className="text-lg font-bold">{formatBRL(totais.otimista.custo)}</p>
          <p className="text-xs text-gray-500 mt-2">Saldo 90d</p>
          <p className={`text-xl font-bold ${totais.otimista.saldo < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatBRL(totais.otimista.saldo)}
          </p>
        </Card>
      </div>

      {/* Chart saldo acumulado */}
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Saldo acumulado (R$) — {NOMES_BAR[barFilter]}</h2>
        {carregando && <p className="text-sm text-gray-500 py-8 text-center">Carregando...</p>}
        {!carregando && chartData.length === 0 && (
          <p className="text-sm text-gray-500 py-8 text-center">
            Sem projeção. Clique em &ldquo;Gerar projeção&rdquo; pra criar.
          </p>
        )}
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
              <XAxis dataKey="dataFmt" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => formatBRL(v)} />
              <Legend />
              <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="pessimista" stroke="#ef4444" name="Pessimista" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="base" stroke="#3b82f6" name="Base" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="otimista" stroke="#22c55e" name="Otimista" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Receita prevista por dia */}
      {chartData.length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Receita prevista por dia (cenário base)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
              <XAxis dataKey="dataFmt" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => formatBRL(v)} />
              <Line type="monotone" dataKey="receita_base" stroke="#8b5cf6" name="Receita" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </main>
  );
}
