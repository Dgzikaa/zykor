'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ThumbsUp, ThumbsDown, Minus, Loader2 } from 'lucide-react';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/hooks/use-toast';

interface Props { dataInicio: string; dataFim: string }

interface ApiData {
  total_reviews_analisados: number;
  sentimento: { positivos: number; neutros: number; negativos: number };
  temas: Array<{
    tema: string;
    total: number;
    positivos: number;
    neutros: number;
    negativos: number;
    pct_positivo: number;
    pct_negativo: number;
    exemplos: string[];
  }>;
  processou_agora: number;
  erros?: string[];
}

export function ReviewsNLPTab({ dataInicio, dataFim }: Props) {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscar = useCallback(async (analisar = false) => {
    if (!selectedBar?.id) return;
    if (analisar) setProcessando(true); else setLoading(true);
    setError(null);
    try {
      const url = `/api/ferramentas/insights/reviews-nlp?bar_id=${selectedBar.id}&data_inicio=${dataInicio}&data_fim=${dataFim}${analisar ? '&analisar=true' : ''}`;
      const r = await fetch(url);
      const j = await r.json();
      if (!j.success) {
        setError(j.error || 'Erro');
        return;
      }
      setData(j);
      if (analisar) {
        toast({
          title: '✨ Análise concluída',
          description: `${j.processou_agora} reviews novos analisados. Total no período: ${j.total_reviews_analisados}.`,
        });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setProcessando(false);
    }
  }, [selectedBar?.id, dataInicio, dataFim, toast]);

  useEffect(() => { buscar(false); }, [buscar]);

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!data) return null;

  const totSent = data.sentimento.positivos + data.sentimento.neutros + data.sentimento.negativos;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium">
              <Sparkles className="w-4 h-4 inline mr-1 text-purple-500" />
              {data.total_reviews_analisados} reviews analisados no período
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Reviews novos (Google + Falaê) são analisados sob demanda. Cada review fica em cache — clique em &quot;Analisar novos&quot; para processar até 30 reviews ainda não vistos.
            </p>
          </div>
          <Button
            onClick={() => buscar(true)}
            disabled={processando}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {processando ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analisando…</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" />Analisar novos</>
            )}
          </Button>
        </CardContent>
      </Card>

      {totSent === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-gray-500">
            Nenhum review analisado no período. Clique em <strong>Analisar novos</strong> para processar reviews recentes.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <SentCard label="Positivos" value={data.sentimento.positivos} total={totSent} icon={ThumbsUp} cor="green" />
            <SentCard label="Neutros" value={data.sentimento.neutros} total={totSent} icon={Minus} cor="gray" />
            <SentCard label="Negativos" value={data.sentimento.negativos} total={totSent} icon={ThumbsDown} cor="red" />
          </div>

          <Card>
            <CardHeader><CardTitle>Top temas mencionados</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.temas.slice(0, 15).map(t => (
                <div key={t.tema} className="border-b border-gray-100 dark:border-gray-800 pb-3 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium capitalize">{t.tema}</span>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="secondary">{t.total}x</Badge>
                      {t.pct_positivo >= 60 && <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">😀 {t.pct_positivo.toFixed(0)}%</Badge>}
                      {t.pct_negativo >= 40 && <Badge variant="destructive">😡 {t.pct_negativo.toFixed(0)}%</Badge>}
                    </div>
                  </div>
                  <div className="flex h-2 rounded overflow-hidden bg-gray-200 dark:bg-gray-700">
                    {t.positivos > 0 && <div className="bg-green-500" style={{ width: `${(t.positivos / t.total) * 100}%` }} />}
                    {t.neutros > 0 && <div className="bg-gray-400" style={{ width: `${(t.neutros / t.total) * 100}%` }} />}
                    {t.negativos > 0 && <div className="bg-red-500" style={{ width: `${(t.negativos / t.total) * 100}%` }} />}
                  </div>
                  {t.exemplos.length > 0 && (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        Ver exemplos
                      </summary>
                      <ul className="mt-1 ml-4 space-y-1 text-gray-600 dark:text-gray-400">
                        {t.exemplos.map((ex, i) => (
                          <li key={i} className="italic">&quot;{ex}&quot;</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function SentCard({
  label, value, total, icon: Icon, cor,
}: {
  label: string; value: number; total: number; icon: any; cor: 'green' | 'gray' | 'red';
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const cores = {
    green: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
    gray: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
  };
  return (
    <Card className={`border ${cores[cor]}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4" />
          <span className="text-xs font-medium uppercase">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs opacity-70 mt-1">{pct.toFixed(1)}% do total</p>
      </CardContent>
    </Card>
  );
}
