'use client';

import { useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingDown, TrendingUp, AlertCircle, Calendar } from 'lucide-react';

const fmtBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const fmtData = (s: string) => s ? new Date(s + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

export default function ContasPage() {
  const { selectedBar } = useBar();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState<'DESPESA' | 'RECEITA'>('DESPESA');

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    fetch(`/api/financeiro/contas?bar_id=${selectedBar.id}&tipo=${tipo}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [selectedBar?.id, tipo]);

  if (loading) return <main className="max-w-7xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  const contas = data?.contas || [];
  const s = data?.stats || {};
  const atrasados = contas.filter((c: any) => c.status_traduzido === 'ATRASADO');
  const proximos7 = contas.filter((c: any) => c.status_traduzido === 'EM_ABERTO' && c.dias_pra_vencer >= 0 && c.dias_pra_vencer <= 7);
  const futuro = contas.filter((c: any) => c.status_traduzido === 'EM_ABERTO' && c.dias_pra_vencer > 7);

  const Icone = tipo === 'DESPESA' ? TrendingDown : TrendingUp;
  const cor = tipo === 'DESPESA' ? 'text-red-600' : 'text-emerald-600';

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Icone className={`w-6 h-6 ${cor}`} /> Contas a {tipo === 'DESPESA' ? 'Pagar' : 'Receber'}</h1>
          <p className="text-sm text-gray-500">Lançamentos ContaAzul EM_ABERTO ou ATRASADO. Últimos 60d + próximos 90d.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTipo('DESPESA')} className={`px-3 py-2 text-sm rounded ${tipo === 'DESPESA' ? 'bg-red-600 text-white' : 'border border-gray-300 dark:border-gray-700'}`}>
            A Pagar
          </button>
          <button onClick={() => setTipo('RECEITA')} className={`px-3 py-2 text-sm rounded ${tipo === 'RECEITA' ? 'bg-emerald-600 text-white' : 'border border-gray-300 dark:border-gray-700'}`}>
            A Receber
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Total em aberto</p>
          <p className={`text-2xl font-bold ${cor}`}>{fmtBRL(s.total_em_aberto ?? 0)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-red-500">
          <p className="text-xs text-gray-500">Atrasados</p>
          <p className="text-2xl font-bold text-red-600">{s.atrasados_qtd ?? 0}</p>
          <p className="text-[10px] text-gray-400">{fmtBRL(s.atrasados_valor ?? 0)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-l-amber-500">
          <p className="text-xs text-gray-500">Próximos 7 dias</p>
          <p className="text-2xl font-bold text-amber-600">{s.proximos_7d_qtd ?? 0}</p>
          <p className="text-[10px] text-gray-400">{fmtBRL(s.proximos_7d_valor ?? 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Futuro (8d+)</p>
          <p className="text-2xl font-bold">{futuro.length}</p>
        </Card>
      </div>

      {atrasados.length > 0 && (
        <Card className="p-4 border-l-4 border-l-red-500">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-600" /> 🚨 Atrasados</h2>
          <TabelaContas linhas={atrasados.slice(0, 30)} />
        </Card>
      )}

      {proximos7.length > 0 && (
        <Card className="p-4 border-l-4 border-l-amber-500">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-amber-600" /> 📅 Próximos 7 dias</h2>
          <TabelaContas linhas={proximos7.slice(0, 30)} />
        </Card>
      )}

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Futuro</h2>
        <TabelaContas linhas={futuro.slice(0, 50)} />
      </Card>
    </main>
  );
}

function TabelaContas({ linhas }: { linhas: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-gray-500 border-b">
          <tr>
            <th className="text-left py-2">Vencimento</th>
            <th className="text-left py-2">Descrição</th>
            <th className="text-left py-2">Categoria</th>
            <th className="text-left py-2">Pessoa</th>
            <th className="text-right py-2">Valor em aberto</th>
            <th className="text-right py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((c, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/30">
              <td className="py-2">
                {fmtData(c.data_vencimento)}
                <span className={`block text-[10px] ${c.dias_pra_vencer < 0 ? 'text-red-500 font-semibold' : c.dias_pra_vencer <= 7 ? 'text-amber-500' : 'text-gray-400'}`}>
                  {c.dias_pra_vencer < 0 ? `${Math.abs(c.dias_pra_vencer)}d atraso` : c.dias_pra_vencer === 0 ? 'hoje' : `em ${c.dias_pra_vencer}d`}
                </span>
              </td>
              <td className="py-2 max-w-xs truncate" title={c.descricao}>{c.descricao || <span className="italic text-gray-400">—</span>}</td>
              <td className="py-2 text-xs text-gray-500">{c.categoria_nome || '—'}</td>
              <td className="py-2 text-xs text-gray-500">{c.pessoa_nome || '—'}</td>
              <td className="py-2 text-right tabular-nums font-semibold">{fmtBRL(Number(c.valor_nao_pago))}</td>
              <td className="py-2 text-right">
                <Badge variant={c.status_traduzido === 'ATRASADO' ? 'destructive' : 'outline'} className="text-[10px]">
                  {c.status_traduzido}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
