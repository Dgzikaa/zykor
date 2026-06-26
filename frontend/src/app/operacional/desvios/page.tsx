'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { Scale, Loader2, Search, CalendarDays, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

const fmtBRL = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

export default function DesviosPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  const [datas, setDatas] = useState<string[]>([]);
  const [ini, setIni] = useState<string | null>(null);
  const [fim, setFim] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any | null>(null);
  const [busca, setBusca] = useState('');
  const [soSuspeitos, setSoSuspeitos] = useState(false);

  // carrega datas e pré-seleciona as 2 contagens semanais mais recentes
  useEffect(() => {
    if (!barId) return;
    api.get('/api/operacional/desvios').then((r) => {
      if (r.success) {
        const ds: string[] = r.datas || [];
        setDatas(ds);
        if (ds.length >= 2) { setFim(ds[0]); setIni(ds[1]); }
      }
    });
  }, [barId]);

  const carregar = useCallback(async (a: string, b: string) => {
    if (!barId || !a || !b) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/operacional/desvios?ini=${a}&fim=${b}`);
      if (r.success) setRes(r);
    } finally { setLoading(false); }
  }, [barId]);
  useEffect(() => { if (ini && fim) carregar(ini, fim); }, [ini, fim, carregar]);

  const itensView = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return (res?.itens || []).filter((i: any) =>
      (!soSuspeitos || i.unidade_suspeita) &&
      (!s || (i.insumo_nome || '').toLowerCase().includes(s) || (i.insumo_codigo || '').toLowerCase().includes(s)));
  }, [res, busca, soSuspeitos]);

  const h = res?.headline_sem_suspeitos;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-100 dark:bg-rose-900/30 rounded-xl"><Scale className="w-6 h-6 text-rose-600 dark:text-rose-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Desvios de Consumo</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Real (estoque + compras) × Teórico (vendas × ficha) por insumo · {selectedBar?.nome || ''}</p>
          </div>
        </div>

        {/* Período */}
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500">de</span>
          <select value={ini || ''} onChange={e => setIni(e.target.value)} className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm">
            {datas.map(d => <option key={d} value={d}>{fmtData(d)}</option>)}
          </select>
          <span className="text-sm text-gray-500">até</span>
          <select value={fim || ''} onChange={e => setFim(e.target.value)} className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm">
            {datas.map(d => <option key={d} value={d}>{fmtData(d)}</option>)}
          </select>
        </div>

        {/* Headline */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <Card className="card-dark"><CardContent className="py-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Consumo Real</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{fmtBRL(h?.real)}</div>
            <div className="text-[11px] text-gray-400">estoque + compras</div>
          </CardContent></Card>
          <Card className="card-dark"><CardContent className="py-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Consumo Teórico</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{fmtBRL(h?.teorico)}</div>
            <div className="text-[11px] text-gray-400">vendas × ficha</div>
          </CardContent></Card>
          <Card className="card-dark"><CardContent className="py-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Desvio</div>
            <div className={`text-2xl font-bold ${(h?.desvio ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{fmtBRL(h?.desvio)}</div>
            <div className="text-[11px] text-gray-400">real − teórico (sem suspeitos)</div>
          </CardContent></Card>
          <Card className="card-dark"><CardContent className="py-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Unidade p/ revisar</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{res?.n_suspeitos ?? 0}</div>
            <div className="text-[11px] text-gray-400">fora do cálculo (unidade errada)</div>
          </CardContent></Card>
        </div>

        {res?.n_suspeitos > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/15 px-3 py-2 text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {res.n_suspeitos} insumo(s) com teórico absurdo (unidade provavelmente errada) ficaram fora do total. Arrume a unidade em Insumos pra entrarem no desvio.
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar insumo…" className="pl-9" />
          </div>
          <button onClick={() => setSoSuspeitos(s => !s)} className={`h-10 rounded-md px-3 text-sm border ${soSuspeitos ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>
            Só unidade p/ revisar
          </button>
        </div>

        {/* Tabela */}
        <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
              <th className="text-left font-medium px-3 py-2">Insumo</th>
              <th className="text-left font-medium px-3 py-2">Área</th>
              <th className="text-right font-medium px-3 py-2">Estoque ini</th>
              <th className="text-right font-medium px-3 py-2">Estoque fim</th>
              <th className="text-right font-medium px-3 py-2">Compras</th>
              <th className="text-right font-medium px-3 py-2">Real</th>
              <th className="text-right font-medium px-3 py-2">Teórico</th>
              <th className="text-right font-medium px-3 py-2">Desvio</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : itensView.length === 0 ? <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400">Sem dados nesse período.</td></tr>
              : itensView.map((it: any, i: number) => (
                <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 ${it.unidade_suspeita ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                    {it.unidade_suspeita && <AlertTriangle className="w-3.5 h-3.5 inline text-amber-500 mr-1" />}
                    {it.insumo_nome}<span className="text-xs text-gray-400 font-mono ml-1">{it.insumo_codigo}</span>
                  </td>
                  <td className="px-3 py-2"><Badge variant="outline">{it.area}</Badge></td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtBRL(it.valor_ini)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtBRL(it.valor_fim)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtBRL(it.compras_rs)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtBRL(it.real_rs)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(it.teorico_rs)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${it.desvio_rs > 1 ? 'text-red-600 dark:text-red-400' : it.desvio_rs < -1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                    {it.desvio_rs > 0 ? <TrendingUp className="w-3 h-3 inline mr-0.5" /> : it.desvio_rs < 0 ? <TrendingDown className="w-3 h-3 inline mr-0.5" /> : null}
                    {fmtBRL(it.desvio_rs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></CardContent></Card>
      </div>
    </div>
  );
}
