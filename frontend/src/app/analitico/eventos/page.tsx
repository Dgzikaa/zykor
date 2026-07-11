'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  ArrowLeftRight,
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  Target,
  Users,
} from 'lucide-react';
import { EventoResponse } from './components/types';
import { EventoContexto } from './components/EventoContexto';
import { TabVisaoGeral } from './components/TabVisaoGeral';
import { TabRelatorios } from './components/TabRelatorios';
import { TabPublico } from './components/TabPublico';
import { TabQualidade } from './components/TabQualidade';
import { TabPlanejado } from './components/TabPlanejado';

function ontem() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function EventosAnaliticoInner() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const router = useRouter();
  const searchParams = useSearchParams();

  const dataParam = searchParams.get('data');
  const [dataSelecionada, setDataSelecionada] = useState<string>(dataParam || ontem());
  const [granularidade, setGranularidade] = useState<'dia' | 'semana' | 'mes'>('dia');

  const barId = selectedBar?.id;

  // Cache via SWR: a chave inclui data + bar + granularidade; trocar re-busca.
  // bar_id continua na URL (a API lê o filtro por query param).
  const eventoEndpoint = barId
    ? `/api/analitico/evento?data=${dataSelecionada}&bar_id=${barId}&gran=${granularidade}`
    : null;
  const { data: eventoResp, isLoading: loading, error: swrErro } =
    useApiSWR<EventoResponse>(eventoEndpoint);
  const evento: EventoResponse | null = eventoResp?.success ? eventoResp : null;
  const erro: string | null = swrErro
    ? String(swrErro)
    : eventoResp && !eventoResp.success
      ? ((eventoResp as any).error || 'Falha ao carregar evento')
      : null;

  useEffect(() => {
    setPageTitle('📊 Análise de Eventos');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Sincroniza data vinda da URL (link do planejamento)
  useEffect(() => {
    if (dataParam && dataParam.length === 10 && dataParam !== dataSelecionada) {
      setDataSelecionada(dataParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataParam]);

  const handleDataChange = useCallback(
    (novaData: string) => {
      if (novaData && novaData.length === 10 && novaData !== dataSelecionada) {
        const dt = new Date(novaData + 'T00:00:00');
        if (!isNaN(dt.getTime())) {
          setDataSelecionada(novaData);
          router.replace(`/analitico/eventos?data=${novaData}`, { scroll: false });
        }
      }
    },
    [dataSelecionada, router]
  );

  const naoEncontrado = evento && evento.success && !evento.encontrado;

  return (
    <div className="min-h-[calc(100vh-8px)] bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-2 py-2 pb-8 max-w-[98vw] space-y-4">
        {/* Controles: data + granularidade + comparativo */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              {granularidade === 'mes' ? 'Mês' : granularidade === 'semana' ? 'Semana' : 'Data'}
            </label>
            {granularidade === 'mes' ? (
              <input
                type="month"
                value={dataSelecionada.slice(0, 7)}
                onChange={(e) =>
                  e.target.value && handleDataChange(`${e.target.value}-01`)
                }
                className="px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            ) : (
              <input
                type="date"
                value={dataSelecionada}
                onChange={(e) => handleDataChange(e.target.value)}
                title={granularidade === 'semana' ? 'Escolha qualquer dia da semana desejada' : undefined}
                className="px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            )}
            {/* Granularidade: dia / semana / mês */}
            <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden ml-2">
              {(['dia', 'semana', 'mes'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGranularidade(g)}
                  className={`px-3 py-1.5 text-xs capitalize transition-colors ${
                    granularidade === g
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {g === 'mes' ? 'mês' : g}
                </button>
              ))}
            </div>
          </div>

          <Link href="/analitico/eventos/comparativo">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeftRight className="w-4 h-4" />
              Comparativo
            </Button>
          </Link>
        </div>

        {/* Estado */}
        {!barId ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Selecione um bar para ver a análise.
          </div>
        ) : loading ? (
          <div className="space-y-4">
            <div className="h-24 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : erro ? (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
            Erro ao carregar: {erro}
          </div>
        ) : naoEncontrado ? (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {evento?.motivo || 'Nenhum evento encontrado para esta data.'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Escolha outra data ou verifique se o bar abriu neste dia.
            </p>
          </div>
        ) : evento && evento.evento ? (
          <>
            <EventoContexto data={evento} dataSelecionada={dataSelecionada} />

            <Tabs defaultValue="visao" className="w-full">
              <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-grid md:grid-cols-5">
                <TabsTrigger value="visao" className="gap-1.5">
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">Visão Geral</span>
                </TabsTrigger>
                <TabsTrigger value="planejado" className="gap-1.5">
                  <Target className="w-4 h-4" />
                  <span className="hidden sm:inline">Planejado vs Real</span>
                </TabsTrigger>
                <TabsTrigger value="relatorios" className="gap-1.5">
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Relatórios</span>
                </TabsTrigger>
                <TabsTrigger value="publico" className="gap-1.5">
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Público</span>
                </TabsTrigger>
                <TabsTrigger value="qualidade" className="gap-1.5">
                  <ClipboardList className="w-4 h-4" />
                  <span className="hidden sm:inline">Qualidade</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="visao" className="mt-4">
                <TabVisaoGeral data={evento} />
              </TabsContent>
              <TabsContent value="planejado" className="mt-4">
                <TabPlanejado data={evento} gran={granularidade} />
              </TabsContent>
              <TabsContent value="relatorios" className="mt-4">
                <TabRelatorios
                  data={evento}
                  dataSelecionada={dataSelecionada}
                  onDataChange={handleDataChange}
                  gran={granularidade}
                />
              </TabsContent>
              <TabsContent value="publico" className="mt-4">
                <TabPublico
                  data={evento}
                  dataSelecionada={dataSelecionada}
                  barId={barId}
                  gran={granularidade}
                />
              </TabsContent>
              <TabsContent value="qualidade" className="mt-4">
                <TabQualidade
                  data={evento}
                  dataSelecionada={dataSelecionada}
                  barId={barId}
                />
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function EventosAnaliticoPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-gray-400">Carregando…</div>
      }
    >
      <EventosAnaliticoInner />
    </Suspense>
  );
}
