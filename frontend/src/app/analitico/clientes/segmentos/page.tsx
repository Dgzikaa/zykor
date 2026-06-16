'use client';

import { useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Download } from 'lucide-react';
import { exportarCSV } from '@/lib/utils/export-csv';

const fmtBRL = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const fmtData = (s: string | null) =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

// Ordem + cor + descrição de cada segmento (RFM)
const SEG: { nome: string; cor: string; desc: string }[] = [
  { nome: 'Campeões', cor: 'border-l-emerald-500', desc: 'Vêm sempre e gastam muito — cuide deles' },
  { nome: 'Leais', cor: 'border-l-green-500', desc: 'Frequentes e recentes' },
  { nome: 'Promissores', cor: 'border-l-teal-500', desc: 'Vieram 1-2x recente — fidelizar' },
  { nome: 'Novos', cor: 'border-l-blue-500', desc: 'Primeira visita recente' },
  { nome: 'Em risco', cor: 'border-l-amber-500', desc: 'Eram frequentes, sumindo — reativar JÁ' },
  { nome: 'Hibernando', cor: 'border-l-orange-500', desc: '2-6 meses sem vir' },
  { nome: 'Perdidos', cor: 'border-l-red-500', desc: '+6 meses sem vir' },
];

interface ResumoRow {
  segmento: string; clientes: number; valor_total: number;
  ticket_medio: number; recencia_media: number; frequencia_media: number;
}
interface ClienteRow {
  cliente_nome: string | null; cliente_fone_norm: string; segmento: string;
  frequencia: number; monetario: number; ticket_medio: number;
  recencia_dias: number; ultima_visita: string; primeira_visita: string;
}

export default function SegmentosRfmPage() {
  const { selectedBar } = useBar();
  const [resumo, setResumo] = useState<ResumoRow[]>([]);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [segSel, setSegSel] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    const url = `/api/analitico/clientes/rfm?bar_id=${selectedBar.id}${segSel ? `&segmento=${encodeURIComponent(segSel)}` : ''}`;
    fetch(url, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setResumo(d.resumo || []); setClientes(d.clientes || []); })
      .finally(() => setLoading(false));
  }, [selectedBar?.id, segSel]);

  const resumoMap = new Map(resumo.map(r => [r.segmento, r]));
  const totalClientes = resumo.reduce((s, r) => s + Number(r.clientes), 0);

  const exportar = () => {
    exportarCSV(`segmentos-${segSel || 'todos'}`, clientes as unknown as Record<string, unknown>[], [
      { key: 'cliente_nome', label: 'Cliente' },
      { key: 'cliente_fone_norm', label: 'Telefone' },
      { key: 'segmento', label: 'Segmento' },
      { key: 'frequencia', label: 'Visitas' },
      { key: 'recencia_dias', label: 'Dias sem vir' },
      { key: 'ticket_medio', label: 'Ticket médio', format: v => Number(v ?? 0).toFixed(2) },
      { key: 'monetario', label: 'Total gasto', format: v => Number(v ?? 0).toFixed(2) },
      { key: 'ultima_visita', label: 'Última visita' },
    ]);
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-violet-600" /> Segmentos de Clientes (RFM)
        </h1>
        <p className="text-sm text-gray-500">
          {totalClientes.toLocaleString('pt-BR')} clientes identificados, agrupados por Recência, Frequência e Valor.
          Clique num segmento pra ver a lista e exportar pra campanha.
        </p>
      </div>

      {loading && resumo.length === 0 ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {SEG.map(s => {
            const r = resumoMap.get(s.nome);
            const ativo = segSel === s.nome;
            return (
              <button
                key={s.nome}
                onClick={() => setSegSel(ativo ? null : s.nome)}
                className={`text-left rounded-lg border border-l-4 ${s.cor} bg-white dark:bg-gray-800 dark:border-gray-700 p-3 transition-all ${
                  ativo ? 'ring-2 ring-violet-400' : 'hover:shadow-md'
                }`}
                title={s.desc}
              >
                <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">{s.nome}</p>
                <p className="text-xl font-bold">{Number(r?.clientes || 0).toLocaleString('pt-BR')}</p>
                <p className="text-[10px] text-gray-500">{fmtBRL(Number(r?.valor_total || 0))}</p>
              </button>
            );
          })}
        </div>
      )}

      <Card className="p-3 flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm">
          {segSel
            ? <>Mostrando <strong>{segSel}</strong> — {SEG.find(x => x.nome === segSel)?.desc}</>
            : <>Top clientes por valor (todos os segmentos)</>}
          {segSel && <button onClick={() => setSegSel(null)} className="ml-2 text-xs text-violet-600 underline">limpar filtro</button>}
        </p>
        <button onClick={exportar} disabled={clientes.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-700">
          <Download className="w-3.5 h-3.5" /> Exportar CSV ({clientes.length})
        </button>
      </Card>

      <Card className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                <th className="text-left py-2">Cliente</th>
                <th className="text-left py-2">Segmento</th>
                <th className="text-right py-2">Visitas</th>
                <th className="text-right py-2">Dias sem vir</th>
                <th className="text-right py-2">Ticket médio</th>
                <th className="text-right py-2">Total gasto</th>
                <th className="text-right py-2">Tel</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map(c => (
                <tr key={c.cliente_fone_norm} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <td className="py-2">
                    <p className="font-medium">{c.cliente_nome || <span className="italic text-gray-400">sem nome</span>}</p>
                    <p className="text-[10px] text-gray-500">última: {fmtData(c.ultima_visita)}</p>
                  </td>
                  <td className="py-2 text-xs">{c.segmento}</td>
                  <td className="py-2 text-right tabular-nums">{c.frequencia}</td>
                  <td className="py-2 text-right tabular-nums text-amber-600">{c.recencia_dias}d</td>
                  <td className="py-2 text-right tabular-nums">{fmtBRL(Number(c.ticket_medio))}</td>
                  <td className="py-2 text-right tabular-nums font-semibold text-emerald-600">{fmtBRL(Number(c.monetario))}</td>
                  <td className="py-2 text-right text-xs font-mono text-gray-500">{c.cliente_fone_norm}</td>
                </tr>
              ))}
              {clientes.length === 0 && !loading && (
                <tr><td colSpan={7} className="py-8 text-center text-gray-400">Sem clientes neste filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
