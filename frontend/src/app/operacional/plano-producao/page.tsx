'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { ChefHat, Search, Loader2, TrendingUp, TrendingDown, CalendarDays, Sparkles } from 'lucide-react';

const fmtN = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const fmtDM = (s: string) => s ? s.split('-').reverse().slice(0, 2).join('/') : '';

// mini barras das 6 semanas (sparkline simples)
function Spark({ vals }: { vals: number[] }) {
  const max = Math.max(1, ...vals);
  return (
    <span className="inline-flex items-end gap-0.5 h-5 align-middle">
      {vals.map((v, i) => <span key={i} className="w-1 bg-violet-300 dark:bg-violet-700 rounded-sm" style={{ height: `${Math.max(8, (v / max) * 100)}%` }} title={`${fmtN(v)}`} />)}
    </span>
  );
}

export default function PlanoProducaoPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  const [res, setRes] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [soCurvaA, setSoCurvaA] = useState(true);
  const [soFazer, setSoFazer] = useState(false);

  const carregar = useCallback(async () => {
    if (!barId) return; setLoading(true);
    try { const r = await api.get('/api/operacional/plano-producao'); if (r.success) setRes(r); }
    finally { setLoading(false); }
  }, [barId]);
  useEffect(() => { carregar(); }, [carregar]);

  const itens = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return ((res?.itens || []) as any[]).filter((i) => (!soCurvaA || i.curva_a)
      && (!soFazer || (i.fornadas || 0) > 0)
      && (!s || (i.nome || '').toLowerCase().includes(s) || (i.codigo || '').toLowerCase().includes(s)));
  }, [res, busca, soCurvaA, soFazer]);

  const totFornadas = useMemo(() => itens.reduce((s, i) => s + (i.fornadas || 0), 0), [itens]);
  const totFazer = useMemo(() => itens.filter((i) => (i.fornadas || 0) > 0).length, [itens]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 dark:bg-violet-900/30 rounded-xl"><ChefHat className="w-6 h-6 text-violet-600 dark:text-violet-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Planejamento da Produção</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Sugestão de quanto produzir na próxima semana = média 6 semanas + tendência + eventos − estoque · {selectedBar?.nome || ''}</p>
          </div>
        </div>

        {/* Próxima semana + eventos */}
        {res?.semana && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 px-3 py-1"><CalendarDays className="w-4 h-4" />Próxima semana: <b>{fmtDM(res.semana.ini)} – {fmtDM(res.semana.fim)}</b></span>
            {(res.eventos || []).length > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-3 py-1"><Sparkles className="w-4 h-4" />{res.eventos.map((e: any) => e.nome).join(', ')} {res.fator_evento !== 1 && `(×${res.fator_evento})`}</span>}
          </div>
        )}

        {/* Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Produções a fazer</div><div className="text-2xl font-bold text-violet-600 dark:text-violet-400">{totFazer}</div></CardContent></Card>
          <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Total de fornadas</div><div className="text-2xl font-bold">{totFornadas}</div></CardContent></Card>
          <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Itens no plano</div><div className="text-2xl font-bold">{itens.length}</div></CardContent></Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produção…" className="pl-9" /></div>
          <button onClick={() => setSoCurvaA(v => !v)}><Badge variant="outline" className={`cursor-pointer text-indigo-600 border-indigo-300 ${soCurvaA ? 'ring-1 ring-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>Só Curva A</Badge></button>
          <button onClick={() => setSoFazer(v => !v)}><Badge variant="outline" className={`cursor-pointer ${soFazer ? 'ring-1 ring-violet-400 bg-violet-50 dark:bg-violet-900/20 text-violet-700' : ''}`}>Só o que tem a fazer</Badge></button>
        </div>

        {/* Tabela */}
        <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
              <th className="text-left font-medium px-3 py-2">Produção</th>
              <th className="text-center font-medium px-3 py-2" title="Saída das últimas 6 semanas">6 semanas</th>
              <th className="text-right font-medium px-3 py-2" title="Média semanal das últimas 6 semanas">Saída média</th>
              <th className="text-right font-medium px-3 py-2" title="Últimas 2 semanas vs média">Tendência</th>
              <th className="text-right font-medium px-3 py-2">Estoque atual</th>
              <th className="text-right font-medium px-3 py-2" title="Dias de estoque ao ritmo atual">Cobertura</th>
              <th className="text-right font-medium px-3 py-2" title="Demanda projetada da próxima semana (média + tendência + evento)">Projetado</th>
              <th className="text-right font-medium px-3 py-2" title="Quanto fazer (já desconta o estoque + 15% de segurança)">A fazer</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? <tr><td colSpan={8} className="px-3 py-12 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : itens.length === 0 ? <tr><td colSpan={8} className="px-3 py-12 text-center text-gray-400">Sem produções no filtro.</td></tr>
              : itens.map((it, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{it.nome}{it.curva_a && <Badge variant="outline" className="ml-1.5 text-[10px] text-indigo-600 border-indigo-300">A</Badge>}<span className="block text-[11px] text-gray-400">rende {fmtN(it.rendimento / it.fator)} {it.unidade || ''}/fornada</span></td>
                  <td className="px-3 py-2 text-center"><Spark vals={it.saidas || []} /></td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtN(it.media6)} {it.unidade || ''}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${it.tendencia_pct > 5 ? 'text-amber-600 dark:text-amber-400' : it.tendencia_pct < -5 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>{it.tendencia_pct > 5 ? <TrendingUp className="w-3 h-3 inline" /> : it.tendencia_pct < -5 ? <TrendingDown className="w-3 h-3 inline" /> : null} {it.tendencia_pct > 0 ? '+' : ''}{it.tendencia_pct}%</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtN(it.estoque)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${(it.cobertura_dias ?? 99) < 3 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500'}`}>{it.cobertura_dias == null ? '—' : `${fmtN(it.cobertura_dias)}d`}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{fmtN(it.projetada)}</td>
                  <td className="px-3 py-2 text-right">
                    {it.fornadas > 0
                      ? <span className="inline-flex flex-col items-end"><span className="font-bold text-violet-700 dark:text-violet-300 tabular-nums">{it.fornadas} fornada{it.fornadas > 1 ? 's' : ''}</span><span className="text-[10px] text-gray-400">≈ {fmtN(it.a_produzir)} {it.unidade || ''}</span></span>
                      : <span className="text-emerald-600 dark:text-emerald-400 text-xs">estoque ok</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></CardContent></Card>
        <p className="text-[11px] text-gray-400">A sugestão usa a mesma saída teórica (vendas × ficha) do Desvios. Quando o Controle de Produção rodar, o realizado baixa do plano automaticamente.</p>
      </div>
    </div>
  );
}
