'use client';

/**
 * Feed (Comunicação) — performance dos posts de feed (carrossel/imagem). Ranqueia por
 * engajamento (bons × ruins) e compara os formatos. Fonte: /api/instagram/feed.
 */

import { useEffect, useState } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { Loader2, Images, Image as ImageIcon, Video, Heart, MessageCircle, Bookmark, Share2, Eye, TrendingUp, ExternalLink } from 'lucide-react';
import { PeriodRangePicker } from '@/components/receitas/PeriodRangePicker';
import { useComunicacaoPeriodo } from '../PeriodoContext';

type Post = {
  ig_media_id: string; formato: string; caption: string; permalink: string; thumbnail: string | null;
  timestamp_post: string; reach: number; likes: number; comments: number; shares: number; saves: number;
  engajamento: number; taxa_engajamento: number;
};
type Formato = { formato: string; qtd: number; alcance_medio: number; engajamento_medio: number; taxa_media: number };

const fmtN = (v: number) => (v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtPct = (v: number) => `${((v || 0) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const fmtData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
const snippet = (c: string) => { const t = (c || '').replace(/\s+/g, ' ').trim(); return t.length > 90 ? t.slice(0, 90) + '…' : (t || '(sem legenda)'); };

export default function FeedComunicacaoPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  // Período compartilhado entre as abas de Comunicação (não reseta ao navegar).
  const { periodo, setPeriodo } = useComunicacaoPeriodo();
  const [ordem, setOrdem] = useState<'melhores' | 'piores'>('melhores');

  useEffect(() => { setPageTitle('📸 Feed — performance dos posts'); return () => setPageTitle(''); }, [setPageTitle]);

  // Cache via SWR: chave inclui bar (BarContext) + range; trocar re-busca.
  const { data: resp, isLoading } = useApiSWR<any>(
    barId ? `/api/instagram/feed?bar_id=${barId}&inicio=${periodo.inicio}&fim=${periodo.fim}` : null,
  );
  const posts: Post[] = resp?.success ? (resp.posts || []) : [];
  const formatos: Formato[] = resp?.success ? (resp.formatos || []) : [];
  const totais: any = resp?.success ? (resp.totais || null) : null;
  const loading = isLoading;

  const lista = ordem === 'melhores' ? posts : [...posts].reverse();
  const melhorFormato = formatos[0]?.formato;

  return (
    <div className="mx-auto max-w-[1400px] px-3 sm:px-6 py-4 space-y-4">
      {/* filtros — período compartilhado com as outras abas de Comunicação */}
      <div className="flex items-center gap-2 overflow-x-auto">
        <PeriodRangePicker value={periodo} onChange={setPeriodo} mostrarGranularidade={false} className="!flex-nowrap w-max" />
        {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />}
      </div>

      {!barId ? (
        <div className="py-20 text-center text-sm text-gray-400">Selecione um bar.</div>
      ) : loading && !posts.length ? (
        <div className="py-20 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : !posts.length ? (
        <div className="py-20 text-center text-sm text-gray-400">Sem posts de feed coletados no período.</div>
      ) : (
        <>
          {/* resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { l: 'Posts', v: fmtN(totais?.qtd || 0) },
              { l: 'Média de interações', v: fmtN(totais?.engajamento_medio || 0) },
              { l: 'Taxa de engajamento', v: fmtPct(totais && totais.alcance_medio > 0 ? totais.engajamento_medio / totais.alcance_medio : 0) },
              { l: 'Alcance médio', v: fmtN(totais?.alcance_medio || 0) },
              { l: 'Melhor formato', v: melhorFormato || '—' },
            ].map((c) => (
              <div key={c.l} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
                <div className="text-[11px] uppercase tracking-wide text-gray-400">{c.l}</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{c.v}</div>
              </div>
            ))}
          </div>

          {/* comparação de formato */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Formatos — qual rende mais</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {formatos.map((f) => {
                const melhor = f.formato === melhorFormato;
                const Icone = f.formato === 'Reels' || f.formato === 'Vídeo' ? Video : f.formato === 'Carrossel' ? Images : ImageIcon;
                return (
                  <div key={f.formato} className={`rounded-xl border p-4 ${melhor ? 'border-pink-300 dark:border-pink-800 bg-pink-50/50 dark:bg-pink-900/10' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white"><Icone className="w-4 h-4 text-pink-500" />{f.formato}</div>
                      {melhor && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-pink-600"><TrendingUp className="w-3.5 h-3.5" />melhor</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                      <div><div className="text-lg font-bold text-gray-900 dark:text-white">{fmtN(f.engajamento_medio)}</div><div className="text-[10px] text-gray-400 uppercase">Média interações</div></div>
                      <div><div className="text-lg font-bold text-gray-900 dark:text-white">{fmtN(f.alcance_medio)}</div><div className="text-[10px] text-gray-400 uppercase">Alcance médio</div></div>
                      <div><div className="text-lg font-bold text-gray-900 dark:text-white">{fmtPct(f.taxa_media)}</div><div className="text-[10px] text-gray-400 uppercase">Taxa engaj.</div></div>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-2">{f.qtd} post(s)</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ranking dos posts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Posts por performance</h3>
              <div className="flex items-center gap-1 text-xs">
                <button onClick={() => setOrdem('melhores')} className={`px-2.5 py-1 rounded-full border ${ordem === 'melhores' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>🔥 Melhores</button>
                <button onClick={() => setOrdem('piores')} className={`px-2.5 py-1 rounded-full border ${ordem === 'piores' ? 'bg-rose-600 text-white border-rose-600' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>🥶 Piores</button>
              </div>
            </div>
            <div className="space-y-2">
              {lista.slice(0, 30).map((p, i) => (
                <div key={p.ig_media_id} className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2.5">
                  <div className="w-6 text-center text-sm font-bold text-gray-400 shrink-0">{ordem === 'melhores' ? i + 1 : ''}</div>
                  {p.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbnail} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-gray-700 shrink-0" />
                  ) : <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${p.formato === 'Carrossel' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>{p.formato}</span>
                      <span className="text-[10px] text-gray-400">{fmtData(p.timestamp_post)}</span>
                      <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-pink-600"><ExternalLink className="w-3.5 h-3.5" /></a>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-300 truncate">{snippet(p.caption)}</div>
                  </div>
                  <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 shrink-0 tabular-nums">
                    <span className="inline-flex items-center gap-1" title="Alcance"><Eye className="w-3.5 h-3.5" />{fmtN(p.reach)}</span>
                    <span className="inline-flex items-center gap-1" title="Curtidas"><Heart className="w-3.5 h-3.5" />{fmtN(p.likes)}</span>
                    <span className="inline-flex items-center gap-1" title="Comentários"><MessageCircle className="w-3.5 h-3.5" />{fmtN(p.comments)}</span>
                    <span className="inline-flex items-center gap-1" title="Compartilhamentos"><Share2 className="w-3.5 h-3.5" />{fmtN(p.shares)}</span>
                    <span className="inline-flex items-center gap-1" title="Salvos"><Bookmark className="w-3.5 h-3.5" />{fmtN(p.saves)}</span>
                  </div>
                  <div className="text-right shrink-0 w-16">
                    <div className="font-bold text-gray-900 dark:text-white text-sm">{fmtN(p.engajamento)}</div>
                    <div className="text-[10px] text-gray-400">{fmtPct(p.taxa_engajamento)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
