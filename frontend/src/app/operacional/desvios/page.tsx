'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { Scale, Loader2, Search, CalendarDays, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

const fmtBRL = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtQtd = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const fmtData = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const TIPOS = [{ k: 'diaria', l: 'Diária' }, { k: 'semanal', l: 'Semanal' }, { k: 'mensal', l: 'Mensal' }];

export default function DesviosPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  const [tipo, setTipo] = useState('semanal');
  const [datas, setDatas] = useState<string[]>([]);
  const [ini, setIni] = useState<string | null>(null);
  const [fim, setFim] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any | null>(null);
  const [busca, setBusca] = useState('');

  // carrega datas do tipo selecionado e pré-seleciona as 2 mais recentes
  useEffect(() => {
    if (!barId) return;
    api.get(`/api/operacional/desvios?tipo=${tipo}`).then((r) => {
      if (r.success) {
        const ds: string[] = r.datas || [];
        setDatas(ds);
        if (ds.length >= 2) { setFim(ds[0]); setIni(ds[1]); }
        else { setFim(ds[0] || null); setIni(null); setRes(null); }
      }
    });
  }, [barId, tipo]);

  const carregar = useCallback(async (a: string, b: string, t: string) => {
    if (!barId || !a || !b) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/operacional/desvios?ini=${a}&fim=${b}&tipo=${t}`);
      if (r.success) setRes(r);
    } finally { setLoading(false); }
  }, [barId]);
  useEffect(() => { if (ini && fim) carregar(ini, fim, tipo); }, [ini, fim, tipo, carregar]);

  const itensView = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return (res?.itens || []).filter((i: any) =>
      !s || (i.insumo_nome || '').toLowerCase().includes(s) || (i.insumo_codigo || '').toLowerCase().includes(s));
  }, [res, busca]);

  const h = res?.headline;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-100 dark:bg-rose-900/30 rounded-xl"><Scale className="w-6 h-6 text-rose-600 dark:text-rose-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Desvios de Consumo</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Saída Real (estoque + compras) × Saída Teórica (vendas × ficha) · {selectedBar?.nome || ''}</p>
          </div>
        </div>

        {/* Tipo + Período */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {TIPOS.map(t => (
              <button key={t.k} onClick={() => setTipo(t.k)} className={`rounded-md px-3 py-1.5 text-sm border ${tipo === t.k ? 'bg-rose-500 text-white border-rose-500' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{t.l}</button>
            ))}
          </div>
          <span className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
          <CalendarDays className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500">de</span>
          <select value={ini || ''} onChange={e => setIni(e.target.value)} className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm">
            {datas.length === 0 && <option value="">—</option>}
            {datas.map(d => <option key={d} value={d}>{fmtData(d)}</option>)}
          </select>
          <span className="text-sm text-gray-500">até</span>
          <select value={fim || ''} onChange={e => setFim(e.target.value)} className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm">
            {datas.length === 0 && <option value="">—</option>}
            {datas.map(d => <option key={d} value={d}>{fmtData(d)}</option>)}
          </select>
        </div>

        {/* Headline */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Card className="card-dark"><CardContent className="py-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Desvio total</div>
            <div className={`text-2xl font-bold ${(h?.desvio_total ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{fmtBRL(h?.desvio_total)}</div>
            <div className="text-[11px] text-gray-400">real − teórico no período</div>
          </CardContent></Card>
          <Card className="card-dark"><CardContent className="py-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Perdas (consumiu a mais)</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{fmtBRL(h?.perdas)}</div>
            <div className="text-[11px] text-gray-400">saiu mais do que vendeu</div>
          </CardContent></Card>
          <Card className="card-dark"><CardContent className="py-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Sobras (consumiu a menos)</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmtBRL(h?.sobras)}</div>
            <div className="text-[11px] text-gray-400">saiu menos do que vendeu</div>
          </CardContent></Card>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar insumo…" className="pl-9" />
        </div>

        {/* Tabela */}
        <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
              <th className="text-left font-medium px-3 py-2">Insumo</th>
              <th className="text-left font-medium px-3 py-2">Área</th>
              <th className="text-right font-medium px-3 py-2" title="Estoque no início do período">Estoque ini</th>
              <th className="text-right font-medium px-3 py-2">Compras</th>
              <th className="text-right font-medium px-3 py-2" title="Estoque no fim do período">Estoque fim</th>
              <th className="text-right font-medium px-3 py-2" title="Estoque ini + compras − estoque fim">Saída real</th>
              <th className="text-right font-medium px-3 py-2" title="Vendas × ficha técnica">Saída teórica</th>
              <th className="text-right font-medium px-3 py-2" title="Saída real − saída teórica">Desvio (qtd)</th>
              <th className="text-right font-medium px-3 py-2">Desvio (R$)</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : itensView.length === 0 ? <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400">Sem dados nesse período.</td></tr>
              : itensView.map((it: any, i: number) => (
                <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 ${it.suspeita ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                    {it.suspeita && <AlertTriangle className="w-3.5 h-3.5 inline text-amber-500 mr-1" />}
                    {it.insumo_nome}{it.insumo_nome !== it.insumo_codigo && <span className="text-xs text-gray-400 font-mono ml-1">{it.insumo_codigo}</span>}
                  </td>
                  <td className="px-3 py-2"><Badge variant="outline">{it.area}</Badge></td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtQtd(it.estoque_ini)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtQtd(it.compra)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtQtd(it.estoque_fim)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtQtd(it.saida_real)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtQtd(it.saida_teorica)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${it.desvio_qtd > 0 ? 'text-red-600 dark:text-red-400' : it.desvio_qtd < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{it.desvio_qtd > 0 ? '+' : ''}{fmtQtd(it.desvio_qtd)}</td>
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
