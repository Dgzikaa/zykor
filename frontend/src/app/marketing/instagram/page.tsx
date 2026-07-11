'use client';

import { useEffect, useState } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import {
  Instagram,
  Users,
  Eye,
  MousePointerClick,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  PlayCircle,
  Image as ImageIcon,
  Layers,
} from 'lucide-react';
import { GraficoLinha } from '@/components/graficos/Charts';
import { useToast } from '@/hooks/use-toast';

type DashboardData = {
  success: boolean;
  conectado: boolean;
  mensagem?: string;
  perfil?: {
    ig_username: string;
    name: string | null;
    biography: string | null;
    profile_picture_url: string | null;
    account_type: string | null;
    followers_count: number | null;
    follows_count: number | null;
    media_count: number | null;
    token_expira_em: string | null;
    sincronizado_em: string | null;
  };
  hoje?: {
    reach: number | null;
    profile_views: number | null;
    website_clicks: number | null;
    followers_diff: number;
    data: string | null;
  };
  ultimos_7_dias?: { reach: number; profile_views: number; website_clicks: number };
  evolucao_followers?: { data: string; followers: number | null }[];
  online_followers_heatmap?: Record<string, number> | null;
  top_posts?: any[];
  ultima_sync?: any;
};

const fmtNum = (n: number | null | undefined) => {
  if (n == null) return '—';
  if (n >= 1000) return new Intl.NumberFormat('pt-BR').format(n);
  return String(n);
};

const fmtDateBr = (s: string | null | undefined) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return s;
  }
};

const fmtDateOnly = (s: string | null | undefined) => {
  if (!s) return '—';
  try {
    return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch {
    return s;
  }
};

const mediaIcon = (mediaType: string, productType?: string) => {
  if (productType === 'REELS' || mediaType === 'VIDEO') return <PlayCircle className="w-4 h-4" />;
  if (mediaType === 'CAROUSEL_ALBUM') return <Layers className="w-4 h-4" />;
  return <ImageIcon className="w-4 h-4" />;
};

export default function InstagramDashboardPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const { toast } = useToast();
  const [sincronizando, setSincronizando] = useState(false);

  // Cache via SWR: a chave inclui o bar; trocar re-busca. mutate() = refetch pós-sync.
  const { data, isLoading, mutate } = useApiSWR<DashboardData>(
    selectedBar?.id ? `/api/instagram/dashboard?bar_id=${selectedBar.id}` : null
  );
  // Skeleton enquanto o bar ainda não carregou OU a 1ª busca está em voo.
  const loading = !selectedBar?.id || isLoading;

  useEffect(() => {
    setPageTitle('📸 Instagram');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const sincronizar = async () => {
    if (!selectedBar?.id) return;
    setSincronizando(true);
    try {
      const r = await fetch(`/api/instagram/sync-agora?bar_id=${selectedBar.id}`, {
        method: 'POST',
      });
      const j = await r.json();
      if (j?.success) {
        toast({ title: 'Sincronizado!', description: 'Dados atualizados.' });
        await mutate();
      } else {
        toast({ title: 'Erro', description: j?.erro || 'Falha ao sincronizar', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message ?? 'Erro de rede', variant: 'destructive' });
    } finally {
      setSincronizando(false);
    }
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <Skeleton className="h-24" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </main>
    );
  }

  if (!data?.conectado || !data.perfil) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-12 text-center">
        <Instagram className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Instagram não conectado</h1>
        <p className="text-gray-500 mb-6">
          {data?.mensagem || `Conecte o Instagram do ${selectedBar?.nome ?? 'bar selecionado'} pra ver as métricas.`}
        </p>
        <a
          href="/configuracoes/administracao/integracoes"
          className="inline-flex items-center justify-center rounded-md bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700 transition-colors"
        >
          Ir para Integrações
        </a>
      </main>
    );
  }

  const p = data.perfil;
  const hoje = data.hoje ?? { reach: null, profile_views: null, website_clicks: null, followers_diff: 0, data: null };
  const dias7 = data.ultimos_7_dias ?? { reach: 0, profile_views: 0, website_clicks: 0 };
  const evolucao = data.evolucao_followers ?? [];
  // enriquece cada dia com o ganho/perda de seguidores vs o dia anterior (pro tooltip)
  const evolucaoComDiff = evolucao.map((p, i) => {
    const anterior = i > 0 ? evolucao[i - 1].followers : null;
    const diff = p.followers != null && anterior != null ? p.followers - anterior : null;
    return { ...p, diff, dataLabel: fmtDateOnly(p.data) };
  });
  const topPosts = data.top_posts ?? [];

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* HEADER PERFIL */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
          {p.profile_picture_url ? (
            <img
              src={p.profile_picture_url}
              alt={p.ig_username}
              className="w-24 h-24 rounded-full object-cover border-4 border-pink-500"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
              <Instagram className="w-10 h-10 text-gray-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{p.name || p.ig_username}</h1>
              <a
                href={`https://instagram.com/${p.ig_username}`}
                target="_blank"
                rel="noreferrer"
                className="text-pink-600 hover:text-pink-700"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <p className="text-sm text-gray-500 mb-2">@{p.ig_username} · {p.account_type}</p>
            {p.biography && <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 whitespace-pre-line">{p.biography}</p>}
            <div className="flex flex-wrap gap-4 text-sm">
              <span><b className="text-lg">{fmtNum(p.followers_count)}</b> seguidores</span>
              <span><b className="text-lg">{fmtNum(p.media_count)}</b> posts</span>
              <span><b className="text-lg">{fmtNum(p.follows_count)}</b> seguindo</span>
            </div>
          </div>
          <div className="flex flex-row flex-wrap sm:flex-col items-start sm:items-end gap-x-3 gap-y-1 sm:gap-2 text-xs text-gray-500 w-full sm:w-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={sincronizar}
              disabled={sincronizando}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${sincronizando ? 'animate-spin' : ''}`} />
              {sincronizando ? 'Sincronizando…' : 'Sincronizar agora'}
            </Button>
            <span>Última: {fmtDateBr(p.sincronizado_em)}</span>
            {p.token_expira_em && (
              <span className={new Date(p.token_expira_em).getTime() - Date.now() < 7 * 86400000 ? 'text-amber-600' : ''}>
                Token expira: {fmtDateOnly(p.token_expira_em.split('T')[0])}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* CARDS HOJE (D-1) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icone={<Eye className="w-5 h-5" />}
          rotulo="Reach (D-1)"
          valor={fmtNum(hoje.reach)}
          extra={`7 dias: ${fmtNum(dias7.reach)}`}
        />
        <KpiCard
          icone={<TrendingUp className="w-5 h-5" />}
          rotulo="Profile views (D-1)"
          valor={fmtNum(hoje.profile_views)}
          extra={`7 dias: ${fmtNum(dias7.profile_views)}`}
        />
        <KpiCard
          icone={<MousePointerClick className="w-5 h-5" />}
          rotulo="Cliques no link"
          valor={fmtNum(hoje.website_clicks)}
          extra={`7 dias: ${fmtNum(dias7.website_clicks)}`}
        />
        <KpiCard
          icone={<Users className="w-5 h-5" />}
          rotulo="Saldo seguidores (D-1)"
          valor={hoje.followers_diff >= 0 ? `+${hoje.followers_diff}` : String(hoje.followers_diff)}
          valorCor={hoje.followers_diff >= 0 ? 'text-emerald-600' : 'text-red-600'}
        />
      </div>

      {/* GRÁFICO EVOLUÇÃO FOLLOWERS */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Evolução de seguidores (30 dias)</h2>
        {evolucao.length > 1 ? (
          <GraficoLinha
            data={evolucaoComDiff}
            xKey="dataLabel"
            series={[{ key: 'followers', nome: 'Seguidores', cor: '#ec4899' }]}
            height={250}
            formatV={fmtNum}
            tooltipFormatter={(params: any) => {
              const idx = params?.[0]?.dataIndex ?? 0;
              const row = evolucaoComDiff[idx];
              if (!row) return '';
              const diff = row.diff;
              const diffHtml =
                diff != null
                  ? `<div style="color:${diff > 0 ? '#059669' : diff < 0 ? '#dc2626' : '#6b7280'}">${diff > 0 ? `+${fmtNum(diff)}` : fmtNum(diff)} no dia</div>`
                  : '';
              return `<div style="font-weight:500;margin-bottom:4px">${fmtDateOnly(row.data)}</div><div><b>${fmtNum(row.followers)}</b> seguidores</div>${diffHtml}`;
            }}
          />
        ) : (
          <p className="text-sm text-gray-500 py-8 text-center">
            Aguardando histórico de pelo menos 2 dias pra plotar evolução.
          </p>
        )}
      </Card>

      {/* TOP POSTS */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-1">Top posts dos últimos 30 dias</h2>
        <p className="text-xs text-gray-500 mb-4">Ordenado por reach (com fallback pra engajamento).</p>
        {topPosts.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            Sem posts coletados ainda ou métricas indisponíveis.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 border-b">
                <tr>
                  <th className="text-left py-2">#</th>
                  <th className="text-left py-2">Post</th>
                  <th className="text-left py-2">Tipo</th>
                  <th className="text-left py-2">Data</th>
                  <th className="text-right py-2">Reach</th>
                  <th className="text-right py-2">Likes</th>
                  <th className="text-right py-2">Comments</th>
                  <th className="text-right py-2">Saves</th>
                  <th className="text-right py-2">Engaj.</th>
                  <th className="text-right py-2"> </th>
                </tr>
              </thead>
              <tbody>
                {topPosts.map((post, idx) => (
                  <tr key={post.ig_media_id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                    <td className="py-3 text-gray-400">{idx + 1}</td>
                    <td className="py-3 max-w-md">
                      <Link
                        href={`/marketing/instagram/posts/${post.ig_media_id}`}
                        className="flex items-center gap-3 group"
                      >
                        {(post.thumbnail_url || post.media_url) && (
                          <img
                            src={post.thumbnail_url || post.media_url}
                            alt=""
                            className="w-12 h-12 rounded object-cover flex-shrink-0"
                          />
                        )}
                        <p className="line-clamp-2 text-xs text-gray-700 dark:text-gray-300 group-hover:text-pink-600 transition-colors">
                          {post.caption || <span className="text-gray-400 italic">sem legenda</span>}
                        </p>
                      </Link>
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                        {mediaIcon(post.media_type, post.media_product_type)}
                        {post.media_product_type === 'REELS' ? 'Reel' : post.media_type === 'CAROUSEL_ALBUM' ? 'Carousel' : post.media_type === 'VIDEO' ? 'Vídeo' : 'Foto'}
                      </span>
                    </td>
                    <td className="py-3 text-xs text-gray-500">
                      {post.timestamp && new Date(post.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="py-3 text-right tabular-nums">{fmtNum(post.metricas.reach)}</td>
                    <td className="py-3 text-right tabular-nums">{fmtNum(post.metricas.likes)}</td>
                    <td className="py-3 text-right tabular-nums">{fmtNum(post.metricas.comments)}</td>
                    <td className="py-3 text-right tabular-nums">{fmtNum(post.metricas.saved)}</td>
                    <td className="py-3 text-right tabular-nums font-semibold">{fmtNum(post.metricas.engajamento)}</td>
                    <td className="py-3 text-right">
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-pink-600 hover:text-pink-700"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* STATUS SYNC */}
      {data.ultima_sync && (
        <Card className="p-4 text-xs text-gray-500 flex justify-between">
          <span>
            Última sincronização: <b>{fmtDateBr(data.ultima_sync.iniciado_em)}</b>{' '}
            ({data.ultima_sync.status}, {data.ultima_sync.duracao_ms}ms,{' '}
            {data.ultima_sync.itens_processados} posts processados)
          </span>
          {data.ultima_sync.erro_mensagem && (
            <span className="text-red-600">{data.ultima_sync.erro_mensagem.slice(0, 100)}</span>
          )}
        </Card>
      )}
    </main>
  );
}

function KpiCard({
  icone,
  rotulo,
  valor,
  valorCor,
  extra,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
  valorCor?: string;
  extra?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
        {icone}
        <span>{rotulo}</span>
      </div>
      <div className={`text-2xl font-bold tabular-nums ${valorCor ?? ''}`}>{valor}</div>
      {extra && <div className="text-xs text-gray-400 mt-1">{extra}</div>}
    </Card>
  );
}

