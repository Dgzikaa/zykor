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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, CheckCircle, Check, Trash2, Settings, Inbox } from 'lucide-react';

function categoriaLabel(cat: string): { label: string; emoji: string } {
  const c = CATEGORIAS[cat as CategoriaEvento];
  return c ?? { label: cat, emoji: '🔔' };
}

export function NotificationCenter() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'todas' | 'nao_lidas'>('todas');

  const {
    notificacoes,
    naoLidas,
    loading,
    marcarLida,
    marcarTodasLidas,
    excluir,
  } = useNotifications({ limit: 30 });

  const lista = tab === 'nao_lidas' ? notificacoes.filter((n) => !n.lida) : notificacoes;

  const abrir = (n: NotificacaoUI) => {
    if (!n.lida) marcarLida(n.id);
    if (n.url) {
      router.push(n.url);
      setIsOpen(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="relative rounded-[4px] hover:text-gray-500 text-gray-500 h-8 p-2 py-2"
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4" />
          {naoLidas > 0 && (
            <Badge
              variant="default"
              className="absolute -top-2 -right-2 h-5 min-w-5 px-1 flex items-center justify-center p-0 text-xs bg-blue-500"
            >
              {naoLidas > 99 ? '99+' : naoLidas}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="card-dark w-[calc(100vw-1.5rem)] sm:w-96 max-w-[24rem] p-0"
        align="end"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
            <Bell className="h-4 w-4" /> Notificações
          </div>
          <div className="flex items-center gap-1">
            {naoLidas > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => marcarTodasLidas()}
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Ler tudo
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => {
                router.push('/configuracoes/notifications');
                setIsOpen(false);
              }}
              aria-label="Configurar notificações"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'todas' | 'nao_lidas')}>
          <TabsList className="tabs-list-dark w-full rounded-none grid grid-cols-2">
            <TabsTrigger value="todas" className="tabs-trigger-dark">
              Todas
            </TabsTrigger>
            <TabsTrigger value="nao_lidas" className="tabs-trigger-dark">
              Não lidas {naoLidas > 0 && `(${naoLidas})`}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-96">
            <div className="p-3 space-y-2">
              {lista.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Inbox className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {loading
                      ? 'Carregando...'
                      : tab === 'nao_lidas'
                        ? 'Tudo em dia! Nenhuma não lida.'
                        : 'Nenhuma notificação ainda.'}
                  </p>
                </div>
              ) : (
                lista.map((n) => {
                  const cat = categoriaLabel(n.categoria);
                  return (
                    <div
                      key={n.id}
                      className={`group rounded-md border-l-4 ${bordaSeveridade(
                        n.severidade
                      )} bg-gray-50 dark:bg-gray-800/50 px-3 py-2 ${
                        n.url ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800' : ''
                      } ${!n.lida ? '' : 'opacity-70'}`}
                      onClick={() => abrir(n)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs">{emojiSeveridade(n.severidade)}</span>
                          <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 truncate">
                            {cat.emoji} {cat.label}
                          </span>
                          {!n.lida && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!n.lida && (
                            <button
                              className="h-6 w-6 flex items-center justify-center text-gray-400 hover:text-green-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                marcarLida(n.id);
                              }}
                              aria-label="Marcar como lida"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            className="h-6 w-6 flex items-center justify-center text-gray-400 hover:text-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              excluir(n.id);
                            }}
                            aria-label="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                        {n.titulo}
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                        {n.mensagem}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                        {formatarTempo(n.criada_em)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </Tabs>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-sm"
            onClick={() => {
              router.push('/configuracoes/notifications');
              setIsOpen(false);
            }}
          >
            Ver todas e configurar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
