'use client';

import { useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Crown, Users, Star, Filter, Download } from 'lucide-react';
import { exportarCSV } from '@/lib/utils/export-csv';

const fmt = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('pt-BR').format(n));
const fmtMoeda = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n));

const niveis = {
  diamante: { cor: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200', icone: '💎' },
  ouro:     { cor: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200', icone: '🥇' },
  prata:    { cor: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800 border-gray-300', icone: '🥈' },
  bronze:   { cor: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200', icone: '🥉' },
  sem_nivel:{ cor: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900 border-gray-200', icone: '○' },
} as const;

const segmentoLabel: Record<string, string> = {
  vip: '🏆 VIP', frequente: '⚡ Frequente', dormindo: '💤 Dormindo',
  novo: '🆕 Novo', casual: '🎲 Casual', perdido: '🚪 Perdido',
};

export default function ClubePage() {
  const { selectedBar } = useBar();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [nivel, setNivel] = useState<string>('');
  const [segmento, setSegmento] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  // Exporta a lista COMPLETA do filtro atual (não só os 200 visíveis) — busca com
  // limit alto e gera CSV pra disparo no Umbler.
  const exportar = async () => {
    if (!selectedBar?.id) return;
    setExporting(true);
    try {
      const params = new URLSearchParams({ bar_id: String(selectedBar.id), export: 'true' });
      if (nivel) params.set('nivel', nivel);
      if (segmento) params.set('segmento', segmento);
      const res = await fetch(`/api/crm/clube?${params}`);
      const json = await res.json();
      const rows = (json.membros || []) as Record<string, unknown>[];
      const sufixo = `${segmento ? '-' + segmento : ''}${nivel ? '-' + nivel : ''}`;
      exportarCSV(`clube${sufixo}`, rows, [
        { key: 'cliente_nome', label: 'Cliente' },
        { key: 'cliente_fone_norm', label: 'Telefone' },
        { key: 'nivel', label: 'Nível' },
        { key: 'segmento', label: 'Segmento' },
        { key: 'total_visitas', label: 'Visitas' },
        { key: 'valor_total_consumo', label: 'Gasto total', format: v => Number(v ?? 0).toFixed(2) },
        { key: 'ticket_medio_consumo', label: 'Ticket médio', format: v => Number(v ?? 0).toFixed(2) },
        { key: 'pontos_total', label: 'Pontos' },
        { key: 'dias_inativo', label: 'Dias inativo' },
      ]);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    const params = new URLSearchParams({ bar_id: String(selectedBar.id) });
    if (nivel) params.set('nivel', nivel);
    if (segmento) params.set('segmento', segmento);
    fetch(`/api/crm/clube?${params}`).then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [selectedBar?.id, nivel, segmento]);

  if (loading) return <main className="max-w-7xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  const porNivel = data?.por_nivel || {};
  const porSegmento = data?.por_segmento || {};
  const membros = data?.membros || [];

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Crown className="w-6 h-6 text-pink-600" /> Clube Ordi</h1>
        <p className="text-sm text-gray-500">Programa de fidelidade — níveis dinâmicos com base em visitas + gasto + recência.</p>
      </div>

      {/* Total */}
      <Card className="p-6 bg-gradient-to-r from-pink-500 to-purple-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase opacity-80">Total de clientes únicos cadastrados</p>
            <p className="text-4xl font-bold">{fmt(data?.total_membros)}</p>
          </div>
          <Users className="w-12 h-12 opacity-50" />
        </div>
      </Card>

      {/* Níveis */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(['diamante','ouro','prata','bronze','sem_nivel'] as const).map(n => {
          const meta = niveis[n];
          const v = porNivel[n] || { qtd: 0, gasto_total: 0 };
          return (
            <button
              key={n}
              onClick={() => setNivel(nivel === n ? '' : n)}
              className={`p-4 rounded-lg border-2 text-left transition-all hover:scale-[1.02] ${meta.bg} ${nivel === n ? 'ring-2 ring-pink-500' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-2xl">{meta.icone}</span>
                <span className={`text-xl font-bold ${meta.cor}`}>{fmt(v.qtd)}</span>
              </div>
              <p className={`text-sm font-semibold capitalize ${meta.cor}`}>{n.replace('_', ' ')}</p>
              <p className="text-xs text-gray-500">{fmtMoeda(v.gasto_total)} consumido</p>
            </button>
          );
        })}
      </div>

      {/* Segmentos */}
      <Card className="p-6">
        <h2 className="font-semibold mb-3">Por segmento de relacionamento</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {Object.entries(porSegmento).sort(([,a]: any, [,b]: any) => b.qtd - a.qtd).map(([s, v]: any) => (
            <button
              key={s}
              onClick={() => setSegmento(segmento === s ? '' : s)}
              className={`p-3 rounded border text-left hover:bg-gray-50 dark:hover:bg-gray-900 ${segmento === s ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20' : ''}`}
            >
              <p className="text-xs text-gray-500">{segmentoLabel[s] || s}</p>
              <p className="text-lg font-bold tabular-nums">{fmt(v.qtd)}</p>
              <p className="text-[10px] text-gray-400">{fmtMoeda(v.gasto_total)}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Lista */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Star className="w-5 h-5 text-pink-600" />
            Membros {nivel || segmento ? '(filtrado)' : ''}
          </h2>
          <div className="flex items-center gap-3">
            {(nivel || segmento) && (
              <button onClick={() => { setNivel(''); setSegmento(''); }} className="text-xs text-pink-600 hover:underline flex items-center gap-1">
                <Filter className="w-3 h-3" /> Limpar filtros
              </button>
            )}
            <button onClick={exportar} disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-700">
              <Download className="w-3.5 h-3.5" /> {exporting ? 'Exportando…' : `Exportar ${segmento || nivel ? 'filtro' : 'tudo'}`}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                <th className="text-left py-2">Cliente</th>
                <th className="text-left py-2">Telefone</th>
                <th className="text-left py-2">Nível</th>
                <th className="text-left py-2">Segmento</th>
                <th className="text-right py-2">Visitas</th>
                <th className="text-right py-2">Gasto total</th>
                <th className="text-right py-2">Ticket méd.</th>
                <th className="text-right py-2">Pontos</th>
                <th className="text-right py-2">Última visita</th>
              </tr>
            </thead>
            <tbody>
              {membros.map((m: any) => (
                <tr key={`${m.bar_id}-${m.cliente_fone_norm}`} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <td className="py-2">{m.cliente_nome || <span className="text-gray-400 italic">sem nome</span>}</td>
                  <td className="py-2 text-xs text-gray-500 font-mono">{m.cliente_fone_norm}</td>
                  <td className="py-2">
                    <span className={`text-xs ${niveis[m.nivel as keyof typeof niveis]?.cor ?? ''}`}>
                      {niveis[m.nivel as keyof typeof niveis]?.icone ?? ''} {m.nivel}
                    </span>
                  </td>
                  <td className="py-2 text-xs">{segmentoLabel[m.segmento] || m.segmento}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(m.total_visitas)}</td>
                  <td className="py-2 text-right tabular-nums font-semibold">{fmtMoeda(m.valor_total_consumo)}</td>
                  <td className="py-2 text-right tabular-nums">{fmtMoeda(m.ticket_medio_consumo)}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(m.pontos_total)}</td>
                  <td className="py-2 text-right text-xs text-gray-500">
                    {m.dias_inativo === 0 ? 'hoje' : `${m.dias_inativo}d atrás`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
