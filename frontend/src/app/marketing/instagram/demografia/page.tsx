'use client';

import { useEffect, useState } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { GraficoDonut, GraficoBarra, GraficoBarraH } from '@/components/graficos/Charts';
import { Users, MapPin, UserCircle, TrendingUp } from 'lucide-react';

type Dash = {
  perfil?: { followers_count: number | null; ig_username: string };
  demografia?: {
    audience_city: Record<string, number> | null;
    audience_country: Record<string, number> | null;
    audience_gender_age: { gender?: Record<string, number>; age?: Record<string, number> } | null;
    engaged_audience: any | null;
  };
  reach_breakdown?: Record<string, number> | null;
};

const fmt = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('pt-BR').format(n));

const COLORS_PINK = ['#ec4899', '#db2777', '#be185d', '#9d174d', '#831843', '#500724'];
const COLORS_MULTI = ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

function ordena(obj: Record<string, number> | null | undefined, limit = 10) {
  if (!obj) return [];
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k, v]) => ({ name: k, value: v }));
}

const COUNTRY_NOMES: Record<string, string> = {
  BR: 'Brasil', US: 'Estados Unidos', PT: 'Portugal', AR: 'Argentina', UY: 'Uruguai',
  PY: 'Paraguai', CL: 'Chile', DE: 'Alemanha', FR: 'França', IT: 'Itália',
  ES: 'Espanha', GB: 'Reino Unido', JP: 'Japão', MX: 'México', CO: 'Colômbia',
  PE: 'Peru', CA: 'Canadá', AU: 'Austrália', NL: 'Holanda', BE: 'Bélgica',
  CH: 'Suíça', NO: 'Noruega', SE: 'Suécia', DK: 'Dinamarca', FI: 'Finlândia',
};

const TIPO_CONTEUDO: Record<string, string> = {
  AD: 'Anúncios',
  POST: 'Posts',
  REEL: 'Reels',
  STORY: 'Stories',
  CAROUSEL_CONTAINER: 'Carrossel',
  CAROUSEL_ITEM: 'Carrossel',
  IGTV: 'IGTV',
  ALBUM: 'Álbum',
};

export default function DemografiaPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPageTitle('📊 Demografia do Instagram');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    fetch(`/api/instagram/dashboard?bar_id=${selectedBar.id}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedBar?.id]);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <Skeleton className="h-16" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </main>
    );
  }

  const demo = data?.demografia;
  const cidades = ordena(demo?.audience_city, 15);
  const paises = ordena(demo?.audience_country, 10).map(p => ({
    ...p,
    name: COUNTRY_NOMES[p.name] || p.name,
  }));
  const idade = ordena(demo?.audience_gender_age?.age);
  const genero = ordena(demo?.audience_gender_age?.gender);
  // Reach por tipo de conteúdo: nomes amigáveis + junta CAROUSEL_CONTAINER/ITEM
  const reachBd = (() => {
    const raw = data?.reach_breakdown || {};
    const merged: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) {
      const label = TIPO_CONTEUDO[k] || k;
      merged[label] = (merged[label] || 0) + Number(v || 0);
    }
    return Object.entries(merged)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  })();

  const generoLabel: Record<string, string> = { F: 'Feminino', M: 'Masculino', U: 'Não informado' };

  if (!demo?.audience_city && !demo?.audience_country && !demo?.audience_gender_age) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-16 text-center">
        <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Sem dados demográficos ainda</h1>
        <p className="text-gray-500">
          Dispara uma sincronização em <code>/marketing/instagram</code> pra coletar.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <p className="text-sm text-gray-500">
          @{data?.perfil?.ig_username} — {fmt(data?.perfil?.followers_count)} seguidores
        </p>
      </div>

      {/* GÊNERO + IDADE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserCircle className="w-5 h-5 text-pink-600" />
            <h2 className="font-semibold">Distribuição por gênero</h2>
          </div>
          {genero.length > 0 ? (
            <GraficoDonut
              data={genero.map(g => ({ ...g, name: generoLabel[g.name] || g.name }))}
              nameKey="name"
              valueKey="value"
              height={250}
              formatV={(v) => fmt(v)}
              cores={COLORS_MULTI}
            />
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">Sem dado de gênero</p>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-pink-600" />
            <h2 className="font-semibold">Distribuição por idade</h2>
          </div>
          {idade.length > 0 ? (
            <GraficoBarra
              data={idade}
              xKey="name"
              valueKey="value"
              height={250}
              cor="#ec4899"
              formatV={(v) => fmt(v)}
            />
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">Sem dado de idade</p>
          )}
        </Card>
      </div>

      {/* CIDADES */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-pink-600" />
          <h2 className="font-semibold">Top 15 cidades</h2>
        </div>
        {cidades.length > 0 ? (
          <GraficoBarraH
            data={cidades}
            xKey="name"
            valueKey="value"
            height={400}
            cor="#ec4899"
            formatV={(v) => fmt(v)}
            maxItens={15}
          />
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">Sem dado de cidade</p>
        )}
      </Card>

      {/* PAÍSES + REACH BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Top 10 países</h2>
          {paises.length > 0 ? (
            <GraficoBarraH
              data={paises}
              xKey="name"
              valueKey="value"
              height={300}
              cor="#8b5cf6"
              formatV={(v) => fmt(v)}
            />
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">Sem dado de país</p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-1">Reach por tipo de conteúdo</h2>
          <p className="text-xs text-gray-500 mb-4">
            De onde vem o alcance: posts, reels, stories, anúncios.
          </p>
          {reachBd.length > 0 ? (
            <GraficoBarraH
              data={reachBd}
              xKey="name"
              valueKey="value"
              height={280}
              cor={COLORS_PINK[0]}
              formatV={(v) => fmt(v)}
            />
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">
              Sem breakdown ainda. Próxima sincronização vai trazer.
            </p>
          )}
        </Card>
      </div>
    </main>
  );
}
