'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, TrendingUp, Beer, ChefHat, Tag, Users } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(n);
const fmtBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);

const ordenacoes = [
  { val: 'faturamento', label: 'Faturamento', cor: 'text-emerald-600' },
  { val: 'ticket_medio_comanda', label: 'Ticket médio', cor: 'text-pink-600' },
  { val: 'upsell_bebida_pct', label: 'Upsell bebida', cor: 'text-blue-600' },
  { val: 'desconto_pct', label: 'Desconto %', cor: 'text-amber-600' },
];

export default function GarconsPage() {
  const { selectedBar } = useBar();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState(30);
  const [ord, setOrd] = useState('faturamento');

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    fetch(`/api/garcons?bar_id=${selectedBar.id}&dias=${dias}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [selectedBar?.id, dias]);

  const sorted = useMemo(() => {
    const arr = [...(data?.garcons || [])];
    arr.sort((a: any, b: any) => Number(b[ord] || 0) - Number(a[ord] || 0));
    return arr;
  }, [data, ord]);

  if (loading) return <main className="max-w-7xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  const s = data?.stats || {};

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Trophy className="w-6 h-6 text-pink-600" /> Performance Garçom 360</h1>
          <p className="text-sm text-gray-500">
            Quem fatura mais, quem dá mais desconto, quem garante upsell. Dados ContaHub por usr_lancou.
          </p>
        </div>
        <div className="flex gap-2">
          <select value={dias} onChange={e => setDias(parseInt(e.target.value, 10))}
            className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
            <option value={7}>7d</option>
            <option value={30}>30d</option>
            <option value={90}>90d</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Garçons ativos</p>
          <p className="text-2xl font-bold">{s.qtd_garcons}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Faturamento total</p>
          <p className="text-2xl font-bold">{fmtBRL(s.fat_total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Comandas</p>
          <p className="text-2xl font-bold">{fmt(s.comandas_total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Ticket médio geral</p>
          <p className="text-2xl font-bold">{fmtBRL(s.ticket_medio_geral)}</p>
        </Card>
      </div>

      {/* Ordenacao */}
      <div className="flex gap-2 flex-wrap">
        {ordenacoes.map(o => (
          <button key={o.val} onClick={() => setOrd(o.val)}
            className={`px-3 py-1.5 text-xs rounded-md border ${ord === o.val ? 'bg-pink-600 text-white border-pink-600' : 'border-gray-300 dark:border-gray-700'}`}>
            ↓ {o.label}
          </button>
        ))}
      </div>

      {/* Ranking */}
      <div className="space-y-2">
        {sorted.map((g: any, i: number) => {
          const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
          return (
            <Card key={g.usr_lancou} className="p-4">
              <div className="flex items-center gap-4">
                <div className="text-2xl font-bold w-16 text-center text-gray-400">{medalha}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg">{g.usr_lancou}</p>
                  <p className="text-xs text-gray-500">{g.dias_trabalhados}d trabalhados · {fmt(g.qtd_comandas)} comandas · {fmt(g.itens_vendidos)} itens</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-xs flex-1">
                  <div>
                    <p className="text-gray-500 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Faturamento</p>
                    <p className="font-bold text-emerald-600 text-sm">{fmtBRL(Number(g.faturamento))}</p>
                  </div>
                  <div>
                    <p className="text-gray-500"><Users className="w-3 h-3 inline" /> Ticket</p>
                    <p className="font-bold">{fmtBRL(Number(g.ticket_medio_comanda))}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 flex items-center gap-1"><Beer className="w-3 h-3" /> Drinks</p>
                    <p className="font-bold">{g.share_drinks_pct}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Bebidas</p>
                    <p className="font-bold">{g.share_bebidas_pct}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500 flex items-center gap-1"><ChefHat className="w-3 h-3" /> Comida</p>
                    <p className="font-bold">{g.share_comida_pct}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500"><Tag className="w-3 h-3 inline" /> Desc</p>
                    <p className={`font-bold ${Number(g.desconto_pct) > 8 ? 'text-amber-600' : 'text-gray-700 dark:text-gray-300'}`}>{g.desconto_pct}%</p>
                  </div>
                </div>
                <div className="text-right shrink-0 min-w-[80px]">
                  <p className="text-[10px] text-gray-500">Upsell bebida</p>
                  <p className="text-xl font-bold text-blue-600">{g.upsell_bebida_pct}%</p>
                  <p className="text-[10px] text-gray-400">{g.comandas_com_bebida}/{g.comandas_com_bebida + g.comandas_sem_bebida}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
