'use client';

import { useEffect, useState, use as usePromise } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, MessageCircle, Heart, Eye, Share2, Bookmark, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type CommentNode = {
  ig_comment_id: string;
  autor_username: string;
  texto: string;
  like_count: number;
  timestamp_post: string;
  replies?: CommentNode[];
  sentimento?: string | null;
  categoria?: string | null;
};

const fmt = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('pt-BR').format(n));
const fmtData = (s: string | null) => {
  if (!s) return '';
  return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const sentimentoColor: Record<string, string> = {
  positivo: 'bg-emerald-100 text-emerald-800',
  neutro: 'bg-gray-100 text-gray-700',
  negativo: 'bg-red-100 text-red-800',
};

function Comment({ c, depth = 0 }: { c: CommentNode; depth?: number }) {
  return (
    <div className={`${depth > 0 ? 'ml-10 border-l-2 border-gray-200 dark:border-gray-700 pl-4' : ''}`}>
      <div className="flex items-start gap-3 py-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
          {c.autor_username?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">@{c.autor_username}</span>
            <span className="text-xs text-gray-400">{fmtData(c.timestamp_post)}</span>
            {c.sentimento && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${sentimentoColor[c.sentimento] ?? ''}`}>
                {c.sentimento}
              </span>
            )}
            {c.categoria && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-100 text-pink-800">
                {c.categoria}
              </span>
            )}
          </div>
          <p className="text-sm mt-1 whitespace-pre-line break-words">{c.texto}</p>
          {c.like_count > 0 && (
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
              <Heart className="w-3 h-3" /> {c.like_count}
            </div>
          )}
        </div>
      </div>
      {c.replies && c.replies.length > 0 && (
        <div>
          {c.replies.map((r) => <Comment key={r.ig_comment_id} c={r} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PostDetalhePage({ params }: PageProps) {
  const { id } = usePromise(params);
  const { selectedBar } = useBar();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedBar?.id || !id) return;
    setLoading(true);
    fetch(`/api/instagram/post-detalhe?bar_id=${selectedBar.id}&ig_media_id=${id}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [selectedBar?.id, id]);

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96" />
      </main>
    );
  }

  if (!data?.post) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-12 text-center">
        <p>Post não encontrado.</p>
      </main>
    );
  }

  const { post, insights_atual, comments, total_comments } = data;

  return (
    <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <Link href="/marketing/instagram" className="inline-flex items-center gap-2 text-sm text-pink-600 hover:underline">
        <ArrowLeft className="w-4 h-4" /> Voltar ao dashboard
      </Link>

      {/* HEADER POST */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
          {(post.thumbnail_url || post.media_url) && (
            <img
              src={post.thumbnail_url || post.media_url}
              alt=""
              className="w-full h-48 sm:w-48 rounded-lg object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center text-xs px-2 py-1 rounded bg-pink-100 text-pink-800">
                {post.media_product_type === 'REELS' ? 'Reel' :
                  post.media_type === 'CAROUSEL_ALBUM' ? 'Carrossel' :
                  post.media_type === 'VIDEO' ? 'Vídeo' : 'Foto'}
              </span>
              <span className="text-xs text-gray-500">{fmtData(post.timestamp_post)}</span>
              <a href={post.permalink} target="_blank" rel="noreferrer" className="text-pink-600 hover:text-pink-700">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <p className="text-sm whitespace-pre-line line-clamp-6">{post.caption ?? <span className="text-gray-400 italic">sem legenda</span>}</p>
          </div>
        </div>
      </Card>

      {/* MÉTRICAS */}
      {insights_atual && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <Metric icone={<Eye className="w-4 h-4" />} rotulo="Reach" valor={fmt(insights_atual.reach)} />
          <Metric icone={<Heart className="w-4 h-4" />} rotulo="Likes" valor={fmt(insights_atual.likes)} />
          <Metric icone={<MessageCircle className="w-4 h-4" />} rotulo="Comments" valor={fmt(insights_atual.comments)} />
          <Metric icone={<Share2 className="w-4 h-4" />} rotulo="Shares" valor={fmt(insights_atual.shares)} />
          <Metric icone={<Bookmark className="w-4 h-4" />} rotulo="Saves" valor={fmt(insights_atual.saved)} />
          <Metric icone={<Eye className="w-4 h-4" />} rotulo="Views" valor={fmt(insights_atual.video_views)} />
        </div>
      )}

      {/* COMMENTS */}
      <Card className="p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-pink-600" />
          Comentários ({total_comments})
        </h2>
        {!comments || comments.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            Sem comentários coletados ainda. Aguarda próximo sync (a cada 30min).
          </p>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {comments.map((c: CommentNode) => <Comment key={c.ig_comment_id} c={c} />)}
          </div>
        )}
      </Card>
    </main>
  );
}

function Metric({ icone, rotulo, valor }: { icone: React.ReactNode; rotulo: string; valor: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
        {icone}
        <span>{rotulo}</span>
      </div>
      <div className="text-lg font-bold tabular-nums">{valor}</div>
    </Card>
  );
}
