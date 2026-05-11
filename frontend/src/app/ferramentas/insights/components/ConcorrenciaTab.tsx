'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useBar } from '@/contexts/BarContext';

interface Props { dataInicio: string; dataFim: string }

interface ApiData {
  resumo: {
    total_eventos_concorrentes: number;
    dias_com_evento: number;
    dias_sem_evento: number;
    dias_com_evento_alto: number;
    media_fat_com_evento: number;
    media_fat_sem_evento: number;
    media_fat_com_evento_alto: number;
    impacto_pct: number;
    impacto_alto_pct: number;
  };
  eventos: Array<{
    id: number;
    nome: string;
    local_nome: string;
    data_evento: string;
    horario_inicio: string | null;
    tipo: string | null;
    impacto: string | null;
    fonte: string | null;
    status: string | null;
    verificado: boolean | null;
  }>;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const fmtData = (d: string) => {
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
};

export function ConcorrenciaTab({ dataInicio, dataFim }: Props) {
  const { selectedBar } = useBar();
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBar) return;
    setLoading(true);
    setError(null);
    fetch(`/api/ferramentas/insights/concorrencia?bar_id=${selectedBar.id}&data_inicio=${dataInicio}&data_fim=${dataFim}`)
      .then(r => r.json())
      .then(r => { if (r.success) setData(r); else setError(r.error || 'Erro'); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedBar?.id, dataInicio, dataFim]);

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Eventos concorrentes" value={String(data.resumo.total_eventos_concorrentes)} />
        <KpiCard label="Dias com evento" value={`${data.resumo.dias_com_evento} de ${data.resumo.dias_com_evento + data.resumo.dias_sem_evento}`} />
        <KpiCard
          label="Receita média com evento"
          value={fmtBRL(data.resumo.media_fat_com_evento)}
          delta={data.resumo.impacto_pct}
        />
        <KpiCard
          label="Receita média sem evento"
          value={fmtBRL(data.resumo.media_fat_sem_evento)}
        />
      </div>

      {data.resumo.media_fat_sem_evento > 0 && (
        <Card>
          <CardHeader><CardTitle>Impacto da concorrência na receita</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Em dias com evento concorrente, a receita média foi{' '}
              <span className={`font-bold ${data.resumo.impacto_pct < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {data.resumo.impacto_pct >= 0 ? '+' : ''}{data.resumo.impacto_pct.toFixed(1)}%
              </span>{' '}
              em relação a dias sem competidor.
              {data.resumo.dias_com_evento_alto > 0 && (
                <>
                  {' '}Em dias com evento de <Badge variant="secondary">impacto alto</Badge>: {' '}
                  <span className={`font-bold ${data.resumo.impacto_alto_pct < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {data.resumo.impacto_alto_pct >= 0 ? '+' : ''}{data.resumo.impacto_alto_pct.toFixed(1)}%
                  </span>.
                </>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Eventos no período</CardTitle></CardHeader>
        <CardContent>
          {data.eventos.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum evento concorrente cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left py-2 px-2">Data</th>
                    <th className="text-left py-2 px-2">Evento</th>
                    <th className="text-left py-2 px-2">Local</th>
                    <th className="text-left py-2 px-2">Tipo</th>
                    <th className="text-left py-2 px-2">Impacto</th>
                    <th className="text-left py-2 px-2">Fonte</th>
                  </tr>
                </thead>
                <tbody>
                  {data.eventos.map(ev => (
                    <tr key={ev.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 px-2 whitespace-nowrap">{fmtData(ev.data_evento)}</td>
                      <td className="py-2 px-2">{ev.nome}</td>
                      <td className="py-2 px-2 text-gray-600 dark:text-gray-400">{ev.local_nome}</td>
                      <td className="py-2 px-2">{ev.tipo ?? '—'}</td>
                      <td className="py-2 px-2">
                        {ev.impacto ? (
                          <Badge variant={ev.impacto.toLowerCase() === 'alto' ? 'destructive' : ev.impacto.toLowerCase() === 'medio' ? 'default' : 'secondary'}>
                            {ev.impacto}
                          </Badge>
                        ) : '—'}
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-500">{ev.fonte ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        {delta !== undefined && (
          <p className={`text-xs mt-1 ${delta < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% vs sem evento
          </p>
        )}
      </CardContent>
    </Card>
  );
}
