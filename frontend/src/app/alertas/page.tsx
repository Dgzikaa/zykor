'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePageTitle } from '@/contexts/PageTitleContext';
import {
  useNotifications,
  corSeveridade,
  bordaSeveridade,
  emojiSeveridade,
  formatarTempo,
  type Severidade,
} from '@/hooks/useNotifications';
import { rotuloAcaoAlerta } from '@/lib/notifications/catalog';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  CheckCircle,
  RefreshCcw,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Só os graves aparecem aqui (a Central de Alertas). O resto vive no sino.
const SEVERIDADES_ALERTA: Severidade[] = ['alerta', 'critico'];

type Filtro = 'todos' | 'critico' | 'alerta' | 'nao_resolvidos';

export default function AlertasPage() {
  const { setPageTitle } = usePageTitle();
  const {
    notificacoes,
    naoLidas,
    loading,
    recarregar,
    marcarLida,
    marcarTodasLidas,
  } = useNotifications({ severidades: SEVERIDADES_ALERTA, limit: 50 });

  const [filtro, setFiltro] = useState<Filtro>('todos');
  const trackedRef = useRef(false);

  useEffect(() => {
    setPageTitle('🚨 Central de Alertas');
  }, [setPageTitle]);

  // Atribuição: registra a origem (ex: ?source=whatsapp) uma vez, e limpa a URL
  // pra não recontar em refresh.
  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    try {
      const params = new URLSearchParams(window.location.search);
      const source = params.get('source');
      if (!source) return;
      api
        .post('/api/alertas/click', { source })
        .catch(() => {});
      params.delete('source');
      const query = params.toString();
      window.history.replaceState(
        {},
        '',
        window.location.pathname + (query ? `?${query}` : '')
      );
    } catch {
      /* noop */
    }
  }, []);

  const alertasFiltrados = useMemo(() => {
    switch (filtro) {
      case 'critico':
        return notificacoes.filter((a) => a.severidade === 'critico');
      case 'alerta':
        return notificacoes.filter((a) => a.severidade === 'alerta');
      case 'nao_resolvidos':
        return notificacoes.filter((a) => !a.lida);
      default:
        return notificacoes;
    }
  }, [notificacoes, filtro]);

  const stats = useMemo(() => {
    const criticos = notificacoes.filter((a) => a.severidade === 'critico').length;
    const alertas = notificacoes.filter((a) => a.severidade === 'alerta').length;
    return { total: notificacoes.length, criticos, alertas, naoResolvidos: naoLidas };
  }, [notificacoes, naoLidas]);

  const abas: Array<{ key: Filtro; label: string; value: number; ativo: string }> = [
    { key: 'todos', label: 'Todos', value: stats.total, ativo: 'ring-blue-500' },
    { key: 'critico', label: 'Críticos', value: stats.criticos, ativo: 'ring-red-500' },
    { key: 'alerta', label: 'Alertas', value: stats.alertas, ativo: 'ring-amber-500' },
    {
      key: 'nao_resolvidos',
      label: 'Não resolvidos',
      value: stats.naoResolvidos,
      ativo: 'ring-blue-500',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-lg">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Situações que precisam de ação
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={marcarTodasLidas}
              disabled={stats.naoResolvidos === 0}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Resolver todos
            </Button>
            <Button variant="ghost" size="sm" onClick={recarregar} disabled={loading}>
              <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Abas / stats */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {abas.map((aba) => (
            <button
              key={aba.key}
              onClick={() => setFiltro(aba.key)}
              className={`p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all hover:scale-[1.02] ${
                filtro === aba.key ? `ring-2 ring-offset-2 dark:ring-offset-gray-900 ${aba.ativo}` : ''
              }`}
            >
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {aba.value}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">{aba.label}</div>
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="space-y-3">
          {loading && notificacoes.length === 0 ? (
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="py-12 text-center">
                <RefreshCcw className="w-8 h-8 mx-auto mb-4 animate-spin text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400">Carregando alertas...</p>
              </CardContent>
            </Card>
          ) : alertasFiltrados.length === 0 ? (
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="py-12 text-center">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Tudo sob controle 🎉
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {filtro === 'todos'
                    ? 'Nenhum alerta no momento.'
                    : 'Nenhum alerta nesse filtro.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <AnimatePresence initial={false}>
              {alertasFiltrados.map((alerta) => {
                const acao = rotuloAcaoAlerta(alerta.event_key, alerta.categoria);
                return (
                  <motion.div
                    key={alerta.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -80 }}
                  >
                    <Card
                      className={`bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 border-l-4 ${bordaSeveridade(
                        alerta.severidade
                      )} ${alerta.lida ? 'opacity-60' : 'hover:shadow-md'} transition-all`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="text-xl leading-none mt-0.5">
                            {emojiSeveridade(alerta.severidade)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge
                                variant="outline"
                                className={`text-xs font-semibold ${corSeveridade(alerta.severidade)}`}
                              >
                                {alerta.severidade === 'critico' ? (
                                  <ShieldAlert className="w-3 h-3 mr-1" />
                                ) : (
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                )}
                                {alerta.severidade.toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="text-xs capitalize">
                                {alerta.categoria}
                              </Badge>
                              {alerta.lida && (
                                <span className="text-xs text-green-600 dark:text-green-400 inline-flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" /> resolvido
                                </span>
                              )}
                            </div>

                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {alerta.titulo}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 mb-3">
                              {alerta.mensagem}
                            </p>

                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-xs text-gray-500">
                                {formatarTempo(alerta.criada_em)}
                              </span>
                              <div className="flex items-center gap-2">
                                {!alerta.lida && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => marcarLida(alerta.id)}
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Resolver
                                  </Button>
                                )}
                                {alerta.url && (
                                  <Link href={alerta.url}>
                                    <Button
                                      size="sm"
                                      className="text-xs"
                                      onClick={() => marcarLida(alerta.id)}
                                    >
                                      <ExternalLink className="w-3 h-3 mr-1" />
                                      {acao}
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
