'use client';

import { useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayCircle, Eye, Heart, MessageCircle, Share2, Bookmark, Clock, Hash, ExternalLink } from 'lucide-react';

const fmt = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('pt-BR').format(n));
const fmtData = (s: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—');

export default function ReelsPage() {
  const { selectedBar } = useBar();
  const [data, setData] = useState<any>(null);
  const [hashtags, setHashtags] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState<number>(365);

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/instagram/reels?bar_id=${selectedBar.id}&dias=${dias}`).then(r => r.json()),
      fetch(`/api/instagram/hashtags?bar_id=${selectedBar.id}&dias=${dias}`).then(r => r.json()),
    ]).then(([reels, htags]) => { setData(reels); setHashtags(htags); }).finally(() => setLoading(false));
  }, [selectedBar?.id, dias]);

  if (loading) return <main className="max-w-7xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  const reels = data?.reels || [];
  const t = data?.totais || { qtd: 0, reach: 0, views: 0, engajamento_medio_por_reel: 0, avg_watch_time_medio_ms: null };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><PlayCircle className="w-6 h-6 text-pink-600" /> Reels Analytics</h1>
          <p className="text-sm text-gray-500">Últimos {dias} dias.</p>
        </div>
        <select
          value={dias}
          onChange={e => setDias(parseInt(e.target.value, 10))}
          className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
        >
          <option value={30}>30 dias</option>
          <option value={90}>90 dias</option>
          <option value={180}>180 dias</option>
          <option value={365}>365 dias</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi rotulo="Reels publicados" valor={fmt(t.qtd)} icone={<PlayCircle className="w-4 h-4" />} />
        <Kpi rotulo="Views totais" valor={fmt(t.views)} icone={<Eye className="w-4 h-4" />} />
        <Kpi rotulo="Reach total" valor={fmt(t.reach)} icone={<Eye className="w-4 h-4" />} />
        <Kpi rotulo="Engaj. médio/reel" valor={fmt(t.engajamento_medio_por_reel)} icone={<Heart className="w-4 h-4" />} />
        <Kpi rotulo="Watch time médio" valor={t.avg_watch_time_medio_ms ? `${(t.avg_watch_time_medio_ms / 1000).toFixed(1)}s` : '—'} icone={<Clock className="w-4 h-4" />} />
      </div>

      {/* Top 10 Reels */}
      <Card className="p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><PlayCircle className="w-5 h-5" /> Top 10 Reels por views</h2>
        {reels.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">Sem reels coletados ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 border-b">
                <tr>
                  <th className="text-left py-2">#</th>
                  <th className="text-left py-2">Reel</th>
                  <th className="text-left py-2">Data</th>
                  <th className="text-right py-2">Views</th>
                  <th className="text-right py-2">Reach</th>
                  <th className="text-right py-2">Likes</th>
                  <th className="text-right py-2">Comments</th>
                  <th className="text-right py-2">Shares</th>
                  <th className="text-right py-2">Saves</th>
                  <th className="text-right py-2">V/R</th>
                  <th> </th>
                </tr>
              </thead>
              <tbody>
                {reels.slice(0, 10).map((r: any, idx: number) => (
                  <tr key={r.ig_media_id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                    <td className="py-3 text-gray-400">{idx + 1}</td>
                    <td className="py-3 max-w-md">
                      <a href={`/marketing/instagram/posts/${r.ig_media_id}`} className="flex items-center gap-3 group">
                        {(r.thumbnail_url || r.media_url) && (
                          <img src={r.thumbnail_url || r.media_url} alt="" className="w-12 h-16 rounded object-cover flex-shrink-0" />
                        )}
                        <p className="line-clamp-2 text-xs text-gray-700 dark:text-gray-300 group-hover:text-pink-600">{r.caption || <span className="text-gray-400 italic">sem legenda</span>}</p>
                      </a>
                    </td>
                    <td className="py-3 text-xs text-gray-500">{fmtData(r.timestamp_post)}</td>
                    <td className="py-3 text-right tabular-nums font-bold">{fmt(r.views)}</td>
                    <td className="py-3 text-right tabular-nums">{fmt(r.reach)}</td>
                    <td className="py-3 text-right tabular-nums">{fmt(r.likes)}</td>
                    <td className="py-3 text-right tabular-nums">{fmt(r.comments)}</td>
                    <td className="py-3 text-right tabular-nums">{fmt(r.shares)}</td>
                    <td className="py-3 text-right tabular-nums">{fmt(r.saves)}</td>
                    <td className="py-3 text-right tabular-nums text-xs text-gray-500">{r.views_por_reach.toFixed(1)}x</td>
                    <td className="py-3"><a href={r.permalink} target="_blank" rel="noreferrer" className="text-pink-600"><ExternalLink className="w-4 h-4" /></a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Hashtag Intelligence */}
      <Card className="p-6">
        <h2 className="font-semibold mb-1 flex items-center gap-2"><Hash className="w-5 h-5" /> Top hashtags por reach médio</h2>
        <p className="text-xs text-gray-500 mb-4">Considera posts dos últimos 60 dias. Filtra hashtags com 2+ usos.</p>
        {!hashtags?.hashtags?.length ? (
          <p className="text-sm text-gray-500 py-6 text-center">Sem hashtags suficientes pra analise.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {hashtags.hashtags.slice(0, 20).map((h: any) => (
              <div key={h.hashtag} className="flex items-center justify-between text-sm py-2 px-3 rounded bg-gray-50 dark:bg-gray-900/40">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-pink-600">{h.hashtag}</span>
                  <span className="text-xs text-gray-500">{h.usos} usos</span>
                </div>
                <div className="flex gap-4 text-xs">
                  <span><b>{fmt(h.reach_medio)}</b> reach/post</span>
                  <span className="text-gray-500"><b>{fmt(h.engaj_medio)}</b> engaj</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}

function Kpi({ rotulo, valor, icone }: { rotulo: string; valor: string; icone: React.ReactNode }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">{icone}{rotulo}</div>
      <div className="text-xl font-bold tabular-nums">{valor}</div>
    </Card>
  );
}
