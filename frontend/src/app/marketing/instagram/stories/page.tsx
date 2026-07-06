'use client';

import { useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Camera, Eye, MessageCircle, UserPlus, TrendingUp, ExternalLink } from 'lucide-react';

const fmt = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('pt-BR').format(n));
const fmtData = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function StoriesPage() {
  const { selectedBar } = useBar();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState<number>(90);

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    fetch(`/api/instagram/stories?bar_id=${selectedBar.id}&dias=${dias}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [selectedBar?.id, dias]);

  if (loading) return <main className="max-w-7xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  const stories = data?.stories || [];
  const t = data?.totais || { reach: 0, replies: 0, follows_ganhos: 0, profile_visits: 0, qtd: 0 };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Camera className="w-6 h-6 text-pink-600" /> Stories</h1>
          <p className="text-sm text-gray-500">
            Últimos {dias} dias. <span className="text-amber-600">Meta só permite ler stories ativos (24h life), então só temos o que o sync capturou (roda a cada 2h).</span>
          </p>
        </div>
        <select
          value={dias}
          onChange={e => setDias(parseInt(e.target.value, 10))}
          className="w-full sm:w-auto px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
        >
          <option value={7}>7 dias</option>
          <option value={30}>30 dias</option>
          <option value={90}>90 dias</option>
          <option value={180}>180 dias</option>
          <option value={365}>365 dias</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi rotulo="Stories" valor={fmt(t.qtd)} icone={<Camera className="w-4 h-4" />} />
        <Kpi rotulo="Reach total" valor={fmt(t.reach)} icone={<Eye className="w-4 h-4" />} />
        <Kpi rotulo="Replies" valor={fmt(t.replies)} icone={<MessageCircle className="w-4 h-4" />} />
        <Kpi rotulo="Follows ganhos" valor={fmt(t.follows_ganhos)} icone={<UserPlus className="w-4 h-4" />} cor="text-emerald-600" />
        <Kpi rotulo="Profile visits" valor={fmt(t.profile_visits)} icone={<TrendingUp className="w-4 h-4" />} />
      </div>

      {stories.length === 0 ? (
        <Card className="p-12 text-center">
          <Camera className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Sem stories ativos coletados. Sync roda a cada 2h.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stories.map((s: any) => (
            <Card key={s.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <a href={s.permalink} target="_blank" rel="noreferrer" className="block">
                <div className="aspect-[9/16] bg-gray-100 dark:bg-gray-800 relative">
                  {(s.thumbnail_url || s.media_url) ? (
                    <img src={s.thumbnail_url || s.media_url} alt="" className="w-full h-full object-cover" />
                  ) : null}
                  <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Ver
                  </div>
                </div>
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <span className="text-gray-500 col-span-2">{fmtData(s.timestamp_post)}</span>
                  <Metric label="Reach" valor={s.reach} />
                  <Metric label="Replies" valor={s.replies} />
                  <Metric label="Exits" valor={s.exits} />
                  <Metric label="Taps fwd" valor={s.taps_forward} />
                  <Metric label="Visits" valor={s.profile_visits} />
                  <Metric label="Follows" valor={s.follows} cor="text-emerald-600" />
                </div>
              </a>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}

function Kpi({ rotulo, valor, icone, cor }: { rotulo: string; valor: string; icone: React.ReactNode; cor?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">{icone}{rotulo}</div>
      <div className={`text-xl font-bold tabular-nums ${cor ?? ''}`}>{valor}</div>
    </Card>
  );
}
function Metric({ label, valor, cor }: { label: string; valor: any; cor?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold tabular-nums ${cor ?? ''}`}>{fmt(valor)}</span>
    </div>
  );
}
