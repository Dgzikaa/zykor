'use client';

import { useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UserX, AlertTriangle, TrendingDown, Download, CheckCircle } from 'lucide-react';
import { exportarCSV } from '@/lib/utils/export-csv';

const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(n);
const fmtData = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('pt-BR');
const fmtMoeda = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

export default function NoShowPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const hoje = new Date();

  useEffect(() => {
    setPageTitle('🚫 No-Show Reservas');
    return () => setPageTitle('');
  }, [setPageTitle]);
  const [mesAno, setMesAno] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`);
  const [listaMes, setListaMes] = useState<any>(null);
  const [loadingMes, setLoadingMes] = useState(false);

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    fetch(`/api/noshow?bar_id=${selectedBar.id}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [selectedBar?.id]);

  useEffect(() => {
    if (!selectedBar?.id) return;
    const inicio = `${mesAno}-01`;
    const [y, m] = mesAno.split('-').map(Number);
    const fim = `${mesAno}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    setLoadingMes(true);
    fetch(`/api/noshow/lista?bar_id=${selectedBar.id}&inicio=${inicio}&fim=${fim}`)
      .then(r => r.json()).then(setListaMes).finally(() => setLoadingMes(false));
  }, [selectedBar?.id, mesAno]);

  if (loading) return <main className="max-w-7xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  const r = data?.resumo || {};
  const reincidentes = data?.reincidentes || [];
  const noshowPct = Number(r.noshow_pct ?? 0);

  const noshowsMes = listaMes?.noshows || [];
  const exportarMes = () => {
    exportarCSV(`no-show-${mesAno}`, noshowsMes as Record<string, unknown>[], [
      { key: 'reservation_date', label: 'Data' },
      { key: 'reservation_time', label: 'Hora' },
      { key: 'customer_name', label: 'Cliente' },
      { key: 'customer_phone', label: 'Telefone' },
      { key: 'customer_email', label: 'E-mail' },
      { key: 'people', label: 'Pessoas' },
      { key: 'compareceu', label: 'Foi ao bar' },
      { key: 'valor_dia', label: 'Consumo no dia' },
    ]);
  };

  const exportar = () => {
    exportarCSV('no-show-reincidentes', reincidentes as Record<string, unknown>[], [
      { key: 'customer_name', label: 'Cliente' },
      { key: 'customer_phone', label: 'Telefone' },
      { key: 'reservas_totais', label: 'Total reservas' },
      { key: 'no_shows', label: 'No-shows' },
      { key: 'compareceu', label: 'Compareceu' },
      { key: 'noshow_pct', label: '% No-show' },
      { key: 'ultima', label: 'Última reserva' },
    ]);
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><UserX className="w-6 h-6 text-red-600" /></h1>
        <p className="text-sm text-gray-500">
          Quem reservou e não apareceu. Últimos 90d resumo, últimos 365d reincidentes.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Reservas válidas</p>
          <p className="text-2xl font-bold">{fmt(r.reservas_validas ?? 0)}</p>
          <p className="text-[10px] text-gray-400">90 dias</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-red-500">
          <p className="text-xs text-gray-500">% No-Show</p>
          <p className={`text-2xl font-bold ${noshowPct > 15 ? 'text-red-600' : noshowPct > 8 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {noshowPct.toFixed(1)}%
          </p>
          <p className="text-[10px] text-gray-400">benchmark ≤8%</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Faltaram</p>
          <p className="text-2xl font-bold text-red-600">{fmt(r.no_shows ?? 0)}</p>
          <p className="text-[10px] text-gray-400">{fmt(r.pessoas_no_show ?? 0)} pessoas</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Reincidentes (≥2 faltas/ano)</p>
          <p className="text-2xl font-bold text-amber-600">{reincidentes.length}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h2 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" /> Top reincidentes (1 ano)
          </h2>
          <button onClick={exportar} disabled={reincidentes.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-700">
            <Download className="w-3.5 h-3.5" /> Exportar ({reincidentes.length})
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Quem aparece aqui devia ter restrição: ou cobrar antecipado, ou bloquear nova reserva, ou ligar pra confirmar 2h antes.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                <th className="text-left py-2">Cliente</th>
                <th className="text-left py-2">Telefone</th>
                <th className="text-right py-2">Total reservas</th>
                <th className="text-right py-2">No-shows</th>
                <th className="text-right py-2">Compareceu</th>
                <th className="text-right py-2">% No-show</th>
                <th className="text-right py-2">Última reserva</th>
              </tr>
            </thead>
            <tbody>
              {reincidentes.map((c: any, i: number) => (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <td className="py-2 font-medium">{c.customer_name || <span className="italic text-gray-400">sem nome</span>}</td>
                  <td className="py-2 text-xs font-mono text-gray-500">{c.customer_phone || '—'}</td>
                  <td className="py-2 text-right tabular-nums">{c.reservas_totais}</td>
                  <td className="py-2 text-right tabular-nums text-red-600 font-semibold">{c.no_shows}</td>
                  <td className="py-2 text-right tabular-nums text-emerald-600">{c.compareceu}</td>
                  <td className="py-2 text-right">
                    <span className={`tabular-nums font-semibold ${Number(c.noshow_pct) >= 50 ? 'text-red-600' : 'text-amber-600'}`}>
                      {c.noshow_pct}%
                    </span>
                  </td>
                  <td className="py-2 text-right text-xs text-gray-500">{fmtData(c.ultima)}</td>
                </tr>
              ))}
              {reincidentes.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-gray-400">Nenhum reincidente. 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <UserX className="w-4 h-4 text-red-600" /> No-shows do mês
            </h2>
            <p className="text-xs text-gray-500">Todos os no-shows do mês escolhido (reserva a reserva) — exporte e acione.</p>
            <p className="text-xs text-gray-500">&ldquo;Foi ao bar&rdquo; = cliente marcado como no-show mas que consumiu no bar na mesma data (provável erro de operação).</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="month" value={mesAno} max={`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`}
              onChange={e => setMesAno(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900" />
            <button onClick={exportarMes} disabled={noshowsMes.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-700">
              <Download className="w-3.5 h-3.5" /> Exportar ({noshowsMes.length})
            </button>
          </div>
        </div>
        {loadingMes ? (
          <Skeleton className="h-40" />
        ) : noshowsMes.length === 0 ? (
          <p className="py-6 text-center text-gray-400 text-sm">Nenhum no-show neste mês. 🎉</p>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-2">
              {listaMes?.total ?? 0} no-shows · {fmt(listaMes?.pessoas ?? 0)} pessoas
              {Number(listaMes?.compareceram ?? 0) > 0 && (
                <span className="ml-1 text-emerald-600 font-medium">
                  · {listaMes.compareceram} foram ao bar mesmo assim (provável erro de operação)
                </span>
              )}
            </p>
            <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 border-b sticky top-0 bg-white dark:bg-gray-950">
                  <tr>
                    <th className="text-left py-2">Data</th>
                    <th className="text-left py-2">Hora</th>
                    <th className="text-left py-2">Cliente</th>
                    <th className="text-left py-2">Telefone</th>
                    <th className="text-right py-2">Pessoas</th>
                    <th className="text-left py-2">Foi ao bar?</th>
                  </tr>
                </thead>
                <tbody>
                  {noshowsMes.map((n: any, i: number) => (
                    <tr key={i} className={`border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/30 ${n.compareceu ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : ''}`}>
                      <td className="py-2">{n.reservation_date ? fmtData(n.reservation_date) : '—'}</td>
                      <td className="py-2 text-xs text-gray-500">{n.reservation_time || '—'}</td>
                      <td className="py-2 font-medium">{n.customer_name || <span className="italic text-gray-400">sem nome</span>}</td>
                      <td className="py-2 text-xs font-mono text-gray-500">{n.customer_phone || '—'}</td>
                      <td className="py-2 text-right tabular-nums">{n.people ?? '—'}</td>
                      <td className="py-2">
                        {n.compareceu ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                            <CheckCircle className="w-3.5 h-3.5" /> Foi ao bar
                            {n.valor_dia != null && (
                              <span className="text-xs text-gray-500">({fmtMoeda(Number(n.valor_dia))})</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </main>
  );
}
