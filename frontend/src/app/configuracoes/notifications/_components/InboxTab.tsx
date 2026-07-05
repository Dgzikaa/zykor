'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useNotifications,
  bordaSeveridade,
  emojiSeveridade,
  formatarTempo,
  type NotificacaoUI,
} from '@/hooks/useNotifications';
import { CATEGORIAS, type CategoriaEvento } from '@/lib/notifications/catalog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Trash2, Check, Inbox, Circle, CircleDot } from 'lucide-react';

const CATEGORIA_KEYS = Object.keys(CATEGORIAS) as CategoriaEvento[];

export default function InboxTab() {
  const router = useRouter();
  const [categoria, setCategoria] = useState<string | undefined>(undefined);
  const [apenasNaoLidas, setApenasNaoLidas] = useState(false);

  const {
    notificacoes,
    naoLidas,
    estatisticas,
    loading,
    marcarLida,
    marcarTodasLidas,
    excluir,
  } = useNotifications({ limit: 50, categoria, apenasNaoLidas });

  const abrir = (n: NotificacaoUI) => {
    if (!n.lida) marcarLida(n.id);
    if (n.url) router.push(n.url);
  };

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Não lidas" value={naoLidas} accent="text-blue-600 dark:text-blue-400" />
        <StatCard label="Últimos 7 dias" value={estatisticas?.total ?? 0} />
        <StatCard
          label="Alertas"
          value={
            (estatisticas?.porSeveridade?.alerta ?? 0) +
            (estatisticas?.porSeveridade?.critico ?? 0)
          }
          accent="text-amber-600 dark:text-amber-400"
        />
        <StatCard
          label="Concluídas"
          value={estatisticas?.porSeveridade?.sucesso ?? 0}
          accent="text-green-600 dark:text-green-400"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCategoria(undefined)}
          className={chip(!categoria)}
        >
          Todas
        </button>
        {CATEGORIA_KEYS.map((k) => (
          <button key={k} onClick={() => setCategoria(k)} className={chip(categoria === k)}>
            {CATEGORIAS[k].emoji} {CATEGORIAS[k].label}
          </button>
        ))}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => setApenasNaoLidas((v) => !v)}
        >
          {apenasNaoLidas ? (
            <CircleDot className="w-4 h-4" />
          ) : (
            <Circle className="w-4 h-4" />
          )}
          Só não lidas
        </Button>
        {naoLidas > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => marcarTodasLidas()}>
            <Check className="w-4 h-4" /> Marcar todas
          </Button>
        )}
      </div>

      {/* Lista */}
      {notificacoes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-muted-foreground">
              {loading ? 'Carregando...' : 'Nenhuma notificação por aqui.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notificacoes.map((n) => {
            const cat = CATEGORIAS[n.categoria as CategoriaEvento] ?? {
              label: n.categoria,
              emoji: '🔔',
            };
            return (
              <div
                key={n.id}
                className={`group flex gap-3 rounded-lg border-l-4 ${bordaSeveridade(
                  n.severidade
                )} bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 px-4 py-3 transition-colors ${
                  n.url ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''
                } ${n.lida ? 'opacity-70' : ''}`}
                onClick={() => abrir(n)}
              >
                <div className="text-lg leading-none pt-0.5">{emojiSeveridade(n.severidade)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {cat.emoji} {cat.label}
                    </span>
                    {!n.lida && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {formatarTempo(n.criada_em)}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                    {n.titulo}
                  </h4>
                  <p className="text-xs text-muted-foreground">{n.mensagem}</p>
                </div>
                <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!n.lida && (
                    <button
                      className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-green-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        marcarLida(n.id);
                      }}
                      aria-label="Marcar como lida"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      excluir(n.id);
                    }}
                    aria-label="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className={`text-2xl font-bold ${accent ?? 'text-gray-900 dark:text-white'}`}>
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function chip(active: boolean): string {
  return `text-xs px-2.5 py-1 rounded-full border transition-colors ${
    active
      ? 'bg-blue-500 text-white border-blue-500'
      : 'bg-transparent text-muted-foreground border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
  }`;
}
