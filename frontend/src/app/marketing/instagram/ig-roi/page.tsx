'use client';

import { useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, DollarSign, ExternalLink, Heart, Eye } from 'lucide-react';

const fmt = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('pt-BR').format(n));
const fmtBRL = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n));
const fmtData = (s: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');

export default function IgRoiPage() {
  const { selectedBar } = useBar();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState(180);
  const [order, setOrder] = useState<'variacao' | 'data' | 'reach'>('variacao');

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    fetch(`/api/instagram/ig-roi?bar_id=${selectedBar.id}&dias=${dias}&order=${order}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [selectedBar?.id, dias, order]);

  if (loading) return <main className="max-w-7xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  const posts = data?.posts || [];
  const s = data?.stats || {};

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="w-6 h-6 text-pink-600" /> IG ROI por post</h1>
          <p className="text-sm text-gray-500">
            Cada post comparado com a média de faturamento dos 7 dias anteriores. Mostra qual conteúdo realmente moveu o caixa.
          </p>
        </div>
        <div className="flex gap-2">
          <select value={dias} onChange={e => setDias(parseInt(e.target.value, 10))}
            className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
            <option value={30}>30d</option>
            <option value={90}>90d</option>
            <option value={180}>180d</option>
            <option value={365}>365d</option>
          </select>
          <select value={order} onChange={e => setOrder(e.target.value as any)}
            className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
            <option value="variacao">Maior impacto</option>
            <option value="data">Mais recente</option>
            <option value="reach">Maior reach</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Posts analisados</p>
          <p className="text-2xl font-bold">{fmt(s.total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">% acima do baseline</p>
          <p className="text-2xl font-bold text-emerald-600">{s.pct_eficazes}%</p>
          <p className="text-[10px] text-gray-400">{s.acima_baseline} de {s.com_fat_d1}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Variação média D+1</p>
          <p className={`text-2xl font-bold ${s.variacao_media_pct > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {s.variacao_media_pct > 0 ? '+' : ''}{s.variacao_media_pct}%
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Metodologia</p>
          <p className="text-xs text-gray-600 mt-1">D+1 = dia seguinte ao post. Baseline = média dos 7 dias antes do post.</p>
        </Card>
      </div>

      {/* Lista */}
      <Card className="p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Posts ordenados</h2>
        {posts.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">Sem dados.</p>}
        <div className="space-y-2">
          {posts.map((p: any) => {
            const variacao = Number(p.variacao_d1_pct);
            const positivo = variacao > 0;
            const corVariacao = positivo ? 'text-emerald-600' : 'text-red-600';
            const corBg = positivo ? 'border-l-emerald-500' : 'border-l-red-400';
            return (
              <div key={p.ig_media_id} className={`flex gap-3 p-3 border border-gray-200 dark:border-gray-800 border-l-4 ${corBg} rounded-md`}>
                {(p.thumbnail_url || p.media_url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail_url || p.media_url} alt="" className="w-20 h-20 rounded object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{p.media_product_type || p.media_type}</Badge>
                    <span className="text-xs text-gray-500">{fmtData(p.data_post)}</span>
                    {p.permalink && (
                      <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-pink-600 hover:underline flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> ver post
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{p.caption_preview || <span className="italic">sem legenda</span>}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {fmt(p.like_count)}</span>
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> reach {fmt(p.reach)}</span>
                    {p.views && <span>views {fmt(p.views)}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-gray-400">D+1 vs baseline</p>
                  <p className={`text-xl font-bold ${corVariacao}`}>
                    {variacao != null && !isNaN(variacao) ? `${positivo ? '+' : ''}${variacao}%` : '—'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">D+1: <strong>{fmtBRL(Number(p.fat_d1))}</strong></p>
                  <p className="text-[10px] text-gray-400">baseline {fmtBRL(Number(p.fat_baseline_7d_pre))}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </main>
  );
}
