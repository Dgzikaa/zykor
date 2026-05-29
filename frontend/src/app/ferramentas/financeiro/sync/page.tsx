'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, CheckCircle2, XCircle } from 'lucide-react';

const fmtData = (s: string) => s ? new Date(s).toLocaleString('pt-BR') : '—';

export default function SyncContaAzulPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/financeiro/sync-saude')
      .then(r => r.json()).then(setData).finally(() => setLoading(false))
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <main className="max-w-5xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  const logs = data?.logs || [];
  const ultimaPorBar = data?.ultima_por_bar || {};

  return (
    <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Activity className="w-6 h-6 text-emerald-600" /> Saúde Sync ContaAzul</h1>
        <p className="text-sm text-gray-500">Status das últimas sincronizações do ContaAzul.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[3, 4].map(barId => {
          const u = ultimaPorBar[barId];
          const nome = barId === 3 ? 'Ordinário' : 'Deboche';
          const ok = u && new Date(u.criado_em).getTime() > Date.now() - 48 * 3600 * 1000;
          return (
            <Card key={barId} className={`p-4 border-l-4 ${ok ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">{nome}</h2>
                {ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
              </div>
              <p className="text-xs text-gray-500">Última sync</p>
              <p className="font-medium">{u ? fmtData(u.criado_em) : 'nunca'}</p>
              {u && (
                <p className="text-xs text-gray-500 mt-1">
                  {u.tipo_sync} · {u.itens_processados} itens · {u.status}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Histórico (últimos 30)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                <th className="text-left py-2">Bar</th>
                <th className="text-left py-2">Tipo</th>
                <th className="text-left py-2">Status</th>
                <th className="text-right py-2">Itens</th>
                <th className="text-right py-2">Duração</th>
                <th className="text-right py-2">Quando</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l: any) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-2">{l.bar_id === 3 ? 'Ord' : 'Deb'}</td>
                  <td className="py-2 text-xs">{l.tipo_sync}</td>
                  <td className="py-2">
                    <Badge variant={l.status === 'ok' ? 'default' : 'destructive'} className="text-[10px]">{l.status}</Badge>
                  </td>
                  <td className="py-2 text-right tabular-nums">{l.itens_processados ?? '—'}</td>
                  <td className="py-2 text-right text-xs text-gray-500">{l.duracao_ms ? `${(l.duracao_ms / 1000).toFixed(1)}s` : '—'}</td>
                  <td className="py-2 text-right text-xs text-gray-500">{fmtData(l.criado_em)}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-gray-400">Sem logs.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
