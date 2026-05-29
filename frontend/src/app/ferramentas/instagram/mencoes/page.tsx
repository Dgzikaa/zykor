'use client';

import { useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AtSign, ExternalLink, ImageIcon, PlayCircle } from 'lucide-react';

type Mencao = {
  id: number;
  tipo_mencao: 'post_tag' | 'comment';
  autor_username: string;
  caption: string | null;
  texto_comment: string | null;
  media_type: string | null;
  permalink: string;
  thumbnail_url: string | null;
  media_url: string | null;
  timestamp_post: string;
};

const fmtData = (s: string | null) => {
  if (!s) return '';
  return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

export default function MencoesPage() {
  const { selectedBar } = useBar();
  const [mencoes, setMencoes] = useState<Mencao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    fetch(`/api/instagram/mencoes?bar_id=${selectedBar.id}`)
      .then(r => r.json())
      .then(j => setMencoes(j.mencoes || []))
      .finally(() => setLoading(false));
  }, [selectedBar?.id]);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-4">
        <Skeleton className="h-12 w-40" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <AtSign className="w-7 h-7 text-pink-600" /> Menções
        </h1>
        <p className="text-sm text-gray-500">Posts e comentários onde o bar foi marcado.</p>
      </div>

      {mencoes.length === 0 ? (
        <Card className="p-12 text-center">
          <AtSign className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Nenhuma menção coletada ainda.</p>
          <p className="text-xs text-gray-400 mt-1">Sincronizações rodam a cada 30min.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mencoes.map((m) => (
            <Card key={m.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <a href={m.permalink} target="_blank" rel="noreferrer" className="block">
                <div className="aspect-square bg-gray-100 dark:bg-gray-800 relative">
                  {m.thumbnail_url || m.media_url ? (
                    <img src={m.thumbnail_url || m.media_url!} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                  {m.media_type === 'VIDEO' && (
                    <PlayCircle className="absolute top-2 right-2 w-6 h-6 text-white drop-shadow-lg" />
                  )}
                  <span className="absolute top-2 left-2 text-[10px] bg-black/70 text-white px-2 py-0.5 rounded-full">
                    {m.tipo_mencao === 'post_tag' ? 'Marcado em post' : 'Comentário'}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">@{m.autor_username}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{fmtData(m.timestamp_post)}</p>
                  <p className="text-sm line-clamp-3">{m.caption || m.texto_comment || <span className="text-gray-400 italic">sem legenda</span>}</p>
                </div>
              </a>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
