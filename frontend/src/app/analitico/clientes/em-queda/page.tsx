'use client';

import { useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, TrendingDown, Clock, DollarSign, Download, ArrowUpDown } from 'lucide-react';
import { exportarCSV } from '@/lib/utils/export-csv';

const fmtBRL = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n));
const fmtData = (s: string | null) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—');

const corNivel: Record<string, string> = {
  diamante: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  ouro: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
  prata: 'bg-gray-400/15 text-gray-700 dark:text-gray-300',
};

export default function ClientesEmQuedaPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [nivelFilter, setNivelFilter] = useState<string>('todos');
  const [sortKey, setSortKey] = useState<string>('score_risco');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setPageTitle('⚠️ Clientes em queda');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    fetch(`/api/clientes-em-queda?bar_id=${selectedBar.id}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [selectedBar?.id]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  if (loading) return <main className="max-w-7xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  const NUMERICAS = new Set(['total_visitas', 'ticket_ult4', 'intervalo_ult4_dias', 'dias_inativo', 'score_risco', 'valor_anual_risco', 'variacao_ticket_pct']);
  const clientes = [...((data?.clientes || []) as any[])]
    .filter((c: any) => nivelFilter === 'todos' || c.nivel === nivelFilter)
    .sort((a: any, b: any) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = NUMERICAS.has(sortKey)
        ? (Number(av) || 0) - (Number(bv) || 0)
        : String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  const s = data?.stats || {};

  const exportar = () => {
    exportarCSV('clientes-em-queda', clientes as Record<string, unknown>[], [
      { key: 'cliente_nome', label: 'Cliente' },
      { key: 'cliente_fone_norm', label: 'Telefone' },
      { key: 'nivel', label: 'Nível' },
      { key: 'total_visitas', label: 'Visitas' },
      { key: 'ticket_ult4', label: 'Ticket últ.4', format: v => Number(v ?? 0).toFixed(2) },
      { key: 'variacao_ticket_pct', label: 'Var. ticket %' },
      { key: 'intervalo_ult4_dias', label: 'Intervalo (d)' },
      { key: 'dias_inativo', label: 'Dias inativo' },
      { key: 'score_risco', label: 'Risco' },
      { key: 'valor_anual_risco', label: 'Valor anual risco', format: v => Number(v ?? 0).toFixed(2) },
      { key: 'ultima_visita', label: 'Última visita' },
    ]);
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><AlertTriangle className="w-6 h-6 text-amber-600" /></h1>
        <p className="text-sm text-gray-500">
          VIP cujos sinais indicam churn iminente: ticket caindo &gt;20% OU intervalo entre visitas dobrando.
          Acione ANTES de virar &ldquo;dormindo&rdquo; (60d sem aparecer).
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Em risco</p>
          <p className="text-2xl font-bold text-amber-600">{s.total ?? 0}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-red-500">
          <p className="text-xs text-gray-500">Valor anual em risco</p>
          <p className="text-2xl font-bold text-red-600">{fmtBRL(s.valor_risco_total)}</p>
          <p className="text-[10px] text-gray-400">se virarem churn de vez</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Diamantes em risco</p>
          <p className="text-2xl font-bold text-cyan-600">{s.por_nivel?.diamante ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Ouros em risco</p>
          <p className="text-2xl font-bold text-yellow-600">{s.por_nivel?.ouro ?? 0}</p>
        </Card>
      </div>

      <Card className="p-3">
        <div className="flex gap-2 items-center justify-between flex-wrap">
          <div className="flex gap-2">
            {(['todos', 'diamante', 'ouro', 'prata'] as const).map(n => (
              <button key={n} onClick={() => setNivelFilter(n)}
                className={`px-3 py-1 text-xs rounded-md border ${nivelFilter === n ? 'bg-pink-600 text-white border-pink-600' : 'border-gray-300 dark:border-gray-700'}`}>
                {n}
              </button>
            ))}
          </div>
          <button onClick={exportar} disabled={clientes.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-700">
            <Download className="w-3.5 h-3.5" /> Exportar CSV ({clientes.length})
          </button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                {([
                  ['cliente_nome', 'Cliente', 'left'],
                  ['nivel', 'Nível', 'left'],
                  ['total_visitas', 'Visitas', 'right'],
                  ['ticket_ult4', 'Ticket ↘', 'right'],
                  ['intervalo_ult4_dias', 'Intervalo ↗', 'right'],
                  ['dias_inativo', 'Dias inativo', 'right'],
                  ['score_risco', 'Risco', 'right'],
                  ['valor_anual_risco', 'Valor anual', 'right'],
                ] as const).map(([key, label, align]) => (
                  <th key={key} onClick={() => toggleSort(key)}
                    className={`py-2 cursor-pointer select-none hover:text-gray-800 dark:hover:text-gray-200 ${align === 'right' ? 'text-right' : 'text-left'}`}>
                    <span className="inline-flex items-center gap-1">
                      {align === 'right' && sortKey === key && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                      {label}
                      {align === 'left' && sortKey === key && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                      {sortKey !== key && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                    </span>
                  </th>
                ))}
                <th className="text-right py-2">Tel</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c: any) => (
                <tr key={`${c.bar_id}-${c.cliente_fone_norm}`} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <td className="py-2">
                    <p className="font-medium">{c.cliente_nome || <span className="italic text-gray-400">sem nome</span>}</p>
                    <p className="text-[10px] text-gray-500">última: {fmtData(c.ultima_visita)}</p>
                  </td>
                  <td className="py-2">
                    <Badge className={corNivel[c.nivel] || 'bg-gray-200'}>{c.nivel}</Badge>
                  </td>
                  <td className="py-2 text-right tabular-nums">{c.total_visitas}</td>
                  <td className="py-2 text-right">
                    <p className="tabular-nums">{fmtBRL(Number(c.ticket_ult4))}</p>
                    <p className={`text-[10px] ${Number(c.variacao_ticket_pct) < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {Number(c.variacao_ticket_pct) > 0 ? '+' : ''}{c.variacao_ticket_pct}%
                    </p>
                  </td>
                  <td className="py-2 text-right">
                    <p className="tabular-nums text-xs"><Clock className="w-3 h-3 inline mr-1" />{c.intervalo_ult4_dias}d</p>
                    <p className={`text-[10px] ${Number(c.variacao_intervalo_pct) > 50 ? 'text-red-500' : 'text-gray-400'}`}>
                      antes: {c.intervalo_ant4_dias}d
                    </p>
                  </td>
                  <td className="py-2 text-right tabular-nums text-amber-600">{c.dias_inativo}d</td>
                  <td className="py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <div className="w-12 bg-gray-200 dark:bg-gray-700 rounded h-2 overflow-hidden">
                        <div className="bg-red-500 h-full" style={{ width: `${c.score_risco}%` }} />
                      </div>
                      <span className="text-xs tabular-nums">{c.score_risco}</span>
                    </div>
                  </td>
                  <td className="py-2 text-right tabular-nums font-semibold text-red-600">{fmtBRL(Number(c.valor_anual_risco))}</td>
                  <td className="py-2 text-right text-xs font-mono text-gray-500">{c.cliente_fone_norm}</td>
                </tr>
              ))}
              {clientes.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-gray-400">Nenhum cliente em queda. 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
