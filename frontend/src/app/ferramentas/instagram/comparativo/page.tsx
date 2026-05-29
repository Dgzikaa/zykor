'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { GitCompare, TrendingUp, Users, MessageCircle, Eye, Heart } from 'lucide-react';

type Bar = {
  bar_id: number;
  ig_username: string | null;
  name: string | null;
  profile_picture_url: string | null;
  followers_atual: number;
  crescimento_wow: number;
  crescimento_mom: number;
  engagement_rate_30d: string;
  posts_30d: number;
  reach_30d: number;
  impressions_30d: number;
  profile_views_30d: number;
  accounts_engaged_30d: number;
  total_interactions_30d: number;
  likes_total_30d: number;
  comments_total_30d: number;
};

const fmt = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('pt-BR').format(n));

export default function ComparativoPage() {
  const [bares, setBares] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/instagram/comparativo?bar_ids=3,4')
      .then(r => r.json())
      .then(j => setBares(j.bares || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <main className="max-w-7xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GitCompare className="w-6 h-6 text-pink-600" /> Comparativo entre bares
        </h1>
        <p className="text-sm text-gray-500">Período: últimos 30 dias.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {bares.map((b) => (
          <Card key={b.bar_id} className="p-6">
            <div className="flex items-center gap-3 mb-4">
              {b.profile_picture_url ? (
                <img src={b.profile_picture_url} alt="" className="w-12 h-12 rounded-full" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-500" />
              )}
              <div>
                <h2 className="font-bold">{b.name || b.ig_username}</h2>
                <p className="text-sm text-gray-500">@{b.ig_username}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <Row icone={<Users className="w-4 h-4" />} rotulo="Seguidores" valor={fmt(b.followers_atual)} />
              <Row icone={<TrendingUp className="w-4 h-4" />} rotulo="Crescimento 7d"
                valor={b.crescimento_wow >= 0 ? `+${fmt(b.crescimento_wow)}` : fmt(b.crescimento_wow)}
                cor={b.crescimento_wow >= 0 ? 'text-emerald-600' : 'text-red-600'} />
              <Row icone={<TrendingUp className="w-4 h-4" />} rotulo="Crescimento 30d"
                valor={b.crescimento_mom >= 0 ? `+${fmt(b.crescimento_mom)}` : fmt(b.crescimento_mom)}
                cor={b.crescimento_mom >= 0 ? 'text-emerald-600' : 'text-red-600'} />
              <Row icone={<Heart className="w-4 h-4" />} rotulo="ER % (30d)" valor={`${b.engagement_rate_30d}%`} />
              <Row icone={<Eye className="w-4 h-4" />} rotulo="Reach 30d" valor={fmt(b.reach_30d)} />
              <Row icone={<Eye className="w-4 h-4" />} rotulo="Views 30d" valor={fmt(b.impressions_30d)} />
              <Row icone={<MessageCircle className="w-4 h-4" />} rotulo="Posts 30d" valor={fmt(b.posts_30d)} />
              <Row icone={<MessageCircle className="w-4 h-4" />} rotulo="Profile views" valor={fmt(b.profile_views_30d)} />
              <Row icone={<Heart className="w-4 h-4" />} rotulo="Likes 30d" valor={fmt(b.likes_total_30d)} />
              <Row icone={<MessageCircle className="w-4 h-4" />} rotulo="Comments 30d" valor={fmt(b.comments_total_30d)} />
            </div>
          </Card>
        ))}
      </div>

      {/* Quem ganha */}
      {bares.length >= 2 && (
        <Card className="p-6 bg-pink-50 dark:bg-pink-900/10 border-pink-200 dark:border-pink-800">
          <h3 className="font-semibold mb-3">🏆 Quem lidera</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Lider rotulo="Mais followers" lider={vencedor(bares, b => b.followers_atual)} />
            <Lider rotulo="Mais cresceu (30d)" lider={vencedor(bares, b => b.crescimento_mom)} />
            <Lider rotulo="Maior ER %" lider={vencedor(bares, b => parseFloat(b.engagement_rate_30d))} />
            <Lider rotulo="Mais reach" lider={vencedor(bares, b => b.reach_30d)} />
          </div>
        </Card>
      )}
    </main>
  );
}

function Row({ icone, rotulo, valor, cor }: { icone: React.ReactNode; rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 py-1.5">
      <span className="flex items-center gap-1.5 text-gray-500">{icone}{rotulo}</span>
      <span className={`font-semibold tabular-nums ${cor ?? ''}`}>{valor}</span>
    </div>
  );
}

function Lider({ rotulo, lider }: { rotulo: string; lider: Bar | null }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{rotulo}</p>
      <p className="font-semibold">{lider?.ig_username ? `@${lider.ig_username}` : '—'}</p>
    </div>
  );
}

function vencedor(bares: Bar[], score: (b: Bar) => number): Bar | null {
  return bares.reduce<Bar | null>((acc, b) => (acc === null || score(b) > score(acc) ? b : acc), null);
}
