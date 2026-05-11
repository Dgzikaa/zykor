'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Repeat, TrendingUp } from 'lucide-react';
import { useBar } from '@/contexts/BarContext';

interface ApiData {
  periodo: { data_inicio: string; weeks: number; modo: 'aquisicao' | 'periodo' };
  cohorts: Array<{
    week_start: string;
    total_clientes: number;
    semanas: Array<{ week_offset: number; retained: number; pct: number }>;
  }>;
  media_por_offset: Array<{ week_offset: number; pct_medio: number }>;
}

interface Props { weeks?: number }

export function CohortTab({ weeks = 24 }: Props) {
  const { selectedBar } = useBar();
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    setError(null);
    // Sempre modo 'aquisicao' (clientes novos) — é o que faz mais sentido para retenção
    fetch(`/api/ferramentas/insights/cohort?bar_id=${selectedBar.id}&weeks=${weeks}&modo=aquisicao`)
      .then(r => r.json())
      .then(r => { if (r.success) setData(r); else setError(r.error || 'Erro'); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedBar?.id, weeks]);

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!data) return null;

  // KPIs simples: retenção média na semana 1, 4, 8, 12
  const retencaoEm = (offset: number) => data.media_por_offset.find(m => m.week_offset === offset)?.pct_medio ?? 0;

  // Total de clientes novos no período
  const totalNovos = data.cohorts.reduce((s, c) => s + c.total_clientes, 0);

  // Quantos cohorts são robustos (>5 clientes) — pra credibilidade
  const cohortsRobustos = data.cohorts.filter(c => c.total_clientes >= 5).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat className="w-5 h-5 text-purple-500" />
            Retenção de novos clientes
          </CardTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Calculado nos últimos {weeks} semanas. &quot;Cliente novo&quot; = primeira visita histórica caiu nesse período.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <RetCard
              label="Semana seguinte"
              titleHint="% dos novos que voltaram na 1ª semana após a primeira visita"
              value={retencaoEm(1)}
            />
            <RetCard
              label="Em 1 mês"
              titleHint="% dos novos que ainda visitaram entre a 4ª semana após a primeira"
              value={retencaoEm(4)}
            />
            <RetCard
              label="Em 2 meses"
              titleHint="% dos novos que visitaram na 8ª semana após a primeira"
              value={retencaoEm(8)}
            />
            <RetCard
              label="Em 3 meses"
              titleHint="% dos novos que visitaram na 12ª semana após a primeira"
              value={retencaoEm(12)}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Users className="w-4 h-4" /> <span>Clientes novos no período</span>
              </div>
              <p className="text-2xl font-bold mt-1">{totalNovos.toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <TrendingUp className="w-4 h-4" /> <span>Cohorts analisadas</span>
              </div>
              <p className="text-2xl font-bold mt-1">{data.cohorts.length}</p>
              <p className="text-xs text-gray-500 mt-1">{cohortsRobustos} com ≥5 clientes (robusta)</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Período</p>
              <p className="text-sm font-medium mt-1">{data.periodo.weeks} semanas (a partir de {data.periodo.data_inicio})</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Como ler</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2 text-gray-700 dark:text-gray-300">
          <p>
            <strong>Cliente novo</strong> = telefone normalizado cuja PRIMEIRA visita histórica caiu dentro do recorte
            de {weeks} semanas. Cada cohort é o grupo de clientes que estrearam na mesma semana.
          </p>
          <p>
            <strong>Semana seguinte (S+1)</strong> mostra a % desses novos que voltaram na semana imediatamente
            após. Se for baixa (&lt;15%), o bar está atraindo muito cliente que não vira recorrente.
          </p>
          <p>
            <strong>Em 1/2/3 meses</strong> mostra retenção de prazo mais longo. Em bar a retenção em 1 mês costuma
            ser baixa (&lt;20%) — o cliente médio não vai toda semana. O ideal é ver se a curva é estável ao longo do tempo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function RetCard({ label, value, titleHint }: { label: string; value: number; titleHint: string }) {
  const cor =
    value >= 30 ? 'text-green-600 dark:text-green-400'
    : value >= 15 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';
  return (
    <Card title={titleHint}>
      <CardContent className="p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`text-3xl font-bold mt-1 ${cor}`}>{value.toFixed(1)}%</p>
        <p className="text-xs text-gray-400 mt-1">retornaram</p>
      </CardContent>
    </Card>
  );
}
