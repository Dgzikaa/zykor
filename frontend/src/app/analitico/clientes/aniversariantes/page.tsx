'use client';

import { useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Cake, Crown, Phone, TrendingUp, Calendar, Download } from 'lucide-react';
import { exportarCSV } from '@/lib/utils/export-csv';

const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(n);
const fmtBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const fmtData = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

const corNivel: Record<string, string> = {
  diamante: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  ouro: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
  prata: 'bg-gray-400/15 text-gray-700 dark:text-gray-300',
  bronze: 'bg-orange-700/15 text-orange-700 dark:text-orange-300',
};

export default function AniversariantesPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState(30);

  useEffect(() => {
    setPageTitle('🎂 Aniversariantes');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    fetch(`/api/aniversariantes?bar_id=${selectedBar.id}&dias=${dias}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [selectedBar?.id, dias]);

  if (loading) return <main className="max-w-7xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  const list = data?.aniversariantes || [];
  const s = data?.stats || {};

  const proximos7 = list.filter((a: any) => {
    const d = new Date(a.proximo_aniver + 'T00:00:00');
    return d <= new Date(Date.now() + 7 * 86400000);
  });

  const exportar = () => {
    exportarCSV('aniversariantes', list as Record<string, unknown>[], [
      { key: 'proximo_aniver', label: 'Aniversário' },
      { key: 'cliente_nome', label: 'Cliente' },
      { key: 'cliente_fone_norm', label: 'Telefone' },
      { key: 'idade', label: 'Idade' },
      { key: 'nivel', label: 'Nível' },
      { key: 'total_visitas', label: 'Visitas' },
      { key: 'ultima_visita', label: 'Última visita' },
      { key: 'dias_inativo', label: 'Dias inativo' },
      { key: 'valor_total_consumo', label: 'Gasto histórico', format: v => Number(v ?? 0).toFixed(2) },
      { key: 'ticket_medio_consumo', label: 'Ticket médio', format: v => Number(v ?? 0).toFixed(2) },
    ]);
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Cake className="w-6 h-6 text-pink-600" /> Aniversariantes</h1>
          <p className="text-sm text-gray-500">
            Clientes recorrentes (≥2 visitas) fazendo aniversário. Mande WhatsApp ou voucher.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportar} disabled={list.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-700">
            <Download className="w-4 h-4" /> Exportar ({list.length})
          </button>
          <select value={dias} onChange={e => setDias(parseInt(e.target.value, 10))}
            className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
            <option value={7}>Próximos 7d</option>
            <option value={30}>Próximos 30d</option>
            <option value={90}>Próximos 90d</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-gray-500">Total</p><p className="text-2xl font-bold">{fmt(s.total ?? 0)}</p></Card>
        <Card className="p-4 border-l-4 border-l-pink-500"><p className="text-xs text-gray-500">Esta semana</p><p className="text-2xl font-bold text-pink-600">{fmt(s.esta_semana ?? 0)}</p></Card>
        <Card className="p-4"><p className="text-xs text-gray-500">VIPs (Ouro+Diamante)</p><p className="text-2xl font-bold text-yellow-600">{fmt(s.vips ?? 0)}</p></Card>
        <Card className="p-4"><p className="text-xs text-gray-500">Gasto histórico total</p><p className="text-2xl font-bold">{fmtBRL(s.gasto_total ?? 0)}</p></Card>
      </div>

      {proximos7.length > 0 && (
        <Card className="p-4 border-l-4 border-l-pink-500">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-pink-600" /> 🎂 Próximos 7 dias — acionar agora</h2>
          <div className="space-y-2">
            {proximos7.map((a: any) => (
              <div key={a.cliente_fone_norm} className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-800 rounded-md">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="text-center min-w-[60px]">
                    <p className="text-xs text-gray-500">{fmtData(a.proximo_aniver)}</p>
                    <p className="text-xs font-bold text-pink-600">{a.idade} anos</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{a.cliente_nome || <span className="italic text-gray-400">sem nome</span>}</p>
                    <p className="text-[10px] text-gray-500 font-mono">{a.cliente_fone_norm}</p>
                  </div>
                  {a.nivel && <Badge className={corNivel[a.nivel] || 'bg-gray-200'}>{a.nivel}</Badge>}
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs text-gray-500">{a.total_visitas} visitas</p>
                  <p className="text-sm font-semibold">{fmtBRL(Number(a.valor_total_consumo))}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Próximos {dias} dias</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                <th className="text-left py-2">Data</th>
                <th className="text-left py-2">Cliente</th>
                <th className="text-left py-2">Telefone</th>
                <th className="text-right py-2">Idade</th>
                <th className="text-left py-2">Nível</th>
                <th className="text-right py-2">Visitas</th>
                <th className="text-left py-2">Última visita</th>
                <th className="text-right py-2">Gasto histórico</th>
                <th className="text-right py-2">Ticket méd.</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a: any) => (
                <tr key={a.cliente_fone_norm} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <td className="py-2 text-pink-600 font-medium">{fmtData(a.proximo_aniver)}</td>
                  <td className="py-2">{a.cliente_nome || <span className="italic text-gray-400">sem nome</span>}</td>
                  <td className="py-2 text-xs font-mono text-gray-500">{a.cliente_fone_norm}</td>
                  <td className="py-2 text-right">{a.idade}</td>
                  <td className="py-2">{a.nivel ? <Badge className={`${corNivel[a.nivel]} text-[10px]`}>{a.nivel}</Badge> : <span className="text-xs text-gray-400">—</span>}</td>
                  <td className="py-2 text-right tabular-nums">{a.total_visitas}</td>
                  <td className="py-2 text-xs text-gray-500">
                    {a.ultima_visita ? fmtData(a.ultima_visita) : '—'}
                    {a.dias_inativo != null && <span className="text-gray-400"> ({a.dias_inativo}d)</span>}
                  </td>
                  <td className="py-2 text-right tabular-nums">{fmtBRL(Number(a.valor_total_consumo))}</td>
                  <td className="py-2 text-right tabular-nums text-xs">{fmtBRL(Number(a.ticket_medio_consumo))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
