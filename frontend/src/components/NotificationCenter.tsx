'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  useNotifications,
  getColorByType,
  getColorByPriority,
  formatarTempo,
} from '@/hooks/useNotifications';
import {
  useInsightsNotifications,
  getAlertBadgeClass,
  formatarTempoRelativo,
} from '@/hooks/useInsightsNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Bell,
  CheckCircle,
  XCircle,
  Info,
  Clock,
  User,
  Trash2,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  TrendingDown,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

// Interfaces para tipagem
interface NotificacaoAcao {
  action: 'redirect' | 'download' | 'callback';
  url?: string;
  label?: string;
  callback?: string;
}

interface Notificacao {
  id: string;
  titulo?: string;
  mensagem?: string;
  tipo?: string;
  prioridade?: string;
  status?: string;
  criada_em?: string;
  acoes?: NotificacaoAcao[];
}

// Type guard
function isNotificacaoAcao(obj: unknown): obj is NotificacaoAcao {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'action' in obj &&
    typeof (obj as NotificacaoAcao).action === 'string'
  );
}

// =====================================================
// NOTIFICATION CENTER COMPONENT
// =====================================================

export function NotificationCenter() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [filtroTab, setFiltroTab] = useState<
    'todas' | 'nao_lidas' | 'insights'
  >('todas');
  const [configuracoes, setConfiguracoes] = useState({
    autoRefresh: false, // ✅ Desabilitado por padrão para melhor performance
    showBadge: true,
    playSound: false,
    refreshInterval: 300000, // ✅ 5 minutos (só ativa se usuário habilitar)
  });

  // =====================================================
  // HOOKS E REFS
  // =====================================================

  const {
    notificacoes,
    estatisticas,
    loading,
    carregarNotificacoes,
    marcarComoLida,
    marcarTodasComoLidas,
    excluirNotificacao,
    recarregar,
  } = useNotifications();

  // Hook para Insights Inteligentes
  const {
    alertas: insightsAlertas,
    loading: insightsLoading,
    estatisticas: insightsStats,
    fetchAlertas: fetchInsights,
    marcarComoLido: marcarInsightComoLido,
    marcarTodosComoLidos: marcarTodosInsightsComoLidos,
  } = useInsightsNotifications();

  const hasInitializedRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // =====================================================
  // CARREGAMENTO INICIAL (APENAS UMA VEZ)
  // =====================================================

  useEffect(() => {
    if (!hasInitializedRef.current) {
      // Carregar notificações iniciais
      carregarNotificacoes({ apenas_nao_lidas: false, limit: 20 });

      hasInitializedRef.current = true;
    }

    // Cleanup ao desmontar
    return () => {
      const currentInterval = intervalRef.current;
      if (currentInterval) {
        clearInterval(currentInterval);
      }
    };
  }, [carregarNotificacoes]); // Adicionar carregarNotificacoes como dependência

  // =====================================================
  // POLLING AUTOMÁTICO
  // =====================================================

  useEffect(() => {
    // ✅ Só ativar polling se autoRefresh estiver habilitado
    if (!configuracoes.autoRefresh) return;

    const interval = setInterval(() => {
      if (!loading && !isOpen) { // ✅ Só atualizar se modal estiver fechado
        carregarNotificacoes();
      }
    }, configuracoes.refreshInterval); // ✅ Usar configuração dinâmica

    // Armazenar o intervalo no ref
    intervalRef.current = interval;

    return () => {
      clearInterval(interval);
      intervalRef.current = null;
    };
  }, [configuracoes.autoRefresh, configuracoes.refreshInterval, loading, isOpen, carregarNotificacoes]); // ✅ Dependencies otimizadas

  // ✅ useEffect duplicado removido - já existe polling otimizado acima

  // =====================================================
  // FILTRAR NOTIFICAÇÕES
  // =====================================================

  const notificacoesFiltradas = notificacoes.filter(notificacao => {
    // Verificar se a notificação tem dados válidos
    if (!notificacao || !notificacao.id) return false;

    if (filtroTab === 'nao_lidas') {
      return ['pendente', 'enviada'].includes(notificacao.status || '');
    }
    if (filtroTab === 'insights') {
      return false; // Insights são mostrados separadamente
    }
    return true; // todas
  });
  
  // Insights não lidos para exibição
  const insightsNaoLidos = insightsAlertas.filter(a => !a.lido);

  // =====================================================
  // HANDLERS
  // =====================================================

  const handleMarcarComoLida = async (notificacaoId: string) => {
    try {
      if (!notificacaoId) return;
      await marcarComoLida(notificacaoId);
    } catch (error) {
      // Erro silencioso
    }
  };

  const handleMarcarTodasComoLidas = async () => {
    try {
      await marcarTodasComoLidas();
    } catch (error) {
      // Erro silencioso
    }
  };

  const handleExcluirNotificacao = async (notificacaoId: string) => {
    try {
      if (!notificacaoId) return;
      await excluirNotificacao(notificacaoId);
    } catch (error) {
      // Erro silencioso
    }
  };

  const handleAcaoNotificacao = (acao: NotificacaoAcao) => {
    try {
      if (!acao) return;

      if (acao.action === 'redirect' && acao.url) {
        router.push(acao.url);
        setIsOpen(false);
      } else if (acao.action === 'download' && acao.url) {
        window.open(acao.url, '_blank');
      }
    } catch (error) {
      // Erro silencioso
    }
  };

  const handleRefreshManual = () => {
    carregarNotificacoes({ apenas_nao_lidas: false, limit: 20 });
  };

  const handleToggleAutoRefresh = (enabled: boolean) => {
    setConfiguracoes(prev => ({ ...prev, autoRefresh: enabled }));
  };

  const handleChangeInterval = (interval: number) => {
    setConfiguracoes(prev => ({ ...prev, refreshInterval: interval }));
  };

  // =====================================================
  // CONTADORES
  // =====================================================

  const totalNaoLidas = (estatisticas?.nao_lidas || 0) + insightsStats.naoLidos;
  const totalImportantes = estatisticas?.alta_prioridade || 0;
  const totalInsights = insightsAlertas.length;

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="relative rounded-[4px] hover:text-gray-500 text-gray-500 h-8 p-2 py-2">
          <Bell className="h-4 w-4" />
          {/* Badge de notificações */}
          {configuracoes.showBadge && totalNaoLidas > 0 && (
            <Badge
              variant={insightsStats.criticos > 0 ? "destructive" : "default"}
              className={`absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs ${
                insightsStats.criticos > 0 
                  ? 'bg-red-500 animate-pulse' 
                  : insightsStats.naoLidos > 0 
                    ? 'bg-purple-500' 
                    : 'bg-blue-500'
              }`}
            >
              {totalNaoLidas > 99 ? '99+' : totalNaoLidas}
            </Badge>
          )}
          {/* Indicador de insight quando não há badge numérico */}
          {configuracoes.showBadge && totalNaoLidas === 0 && insightsAlertas.length > 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="card-dark w-[calc(100vw-1.5rem)] sm:w-96 max-w-[24rem] p-0" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="card-title-dark flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notificações
              </CardTitle>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshManual}
                  disabled={loading}
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Estatísticas Rápidas */}
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span>📬 {totalNaoLidas} não lidas</span>
              <span>✨ {totalInsights} insights</span>
              <span>📊 {notificacoes.length + totalInsights} total</span>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Tabs de Filtro */}
            <Tabs
              value={filtroTab}
              onValueChange={(value: string) =>
                setFiltroTab(value as 'todas' | 'nao_lidas' | 'insights')
              }
            >
              <TabsList className="tabs-list-dark w-full rounded-none">
                <TabsTrigger value="todas" className="tabs-trigger-dark">
                  Todas ({notificacoes.length + insightsAlertas.length})
                </TabsTrigger>
                <TabsTrigger value="nao_lidas" className="tabs-trigger-dark">
                  Não Lidas ({totalNaoLidas})
                </TabsTrigger>
                <TabsTrigger value="insights" className="tabs-trigger-dark">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Insights ({totalInsights})
                </TabsTrigger>
              </TabsList>

              {/* Lista de Notificações */}
              <ScrollArea className="h-96">
                <div className="p-4 space-y-3">
                  {/* Tab de Insights */}
                  {filtroTab === 'insights' ? (
                    <>
                      {insightsLoading && insightsAlertas.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                          <span className="ml-2 text-sm text-gray-500">
                            Analisando dados...
                          </span>
                        </div>
                      ) : insightsAlertas.length === 0 ? (
                        <div className="text-center py-8">
                          <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                          <p className="text-gray-500 dark:text-gray-400">
                            Tudo certo! Nenhum alerta.
                          </p>
                        </div>
                      ) : (
                        insightsAlertas.map(alerta => (
                          <Card
                            key={alerta.id}
                            className={`card-dark p-3 space-y-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                              !alerta.lido ? 'border-l-4 border-l-purple-500' : ''
                            }`}
                            onClick={() => {
                              marcarInsightComoLido(alerta.id);
                              if (alerta.url) {
                                router.push(alerta.url);
                                setIsOpen(false);
                              }
                            }}
                          >
                            {/* Header do Insight */}
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={`${getAlertBadgeClass(alerta.tipo)} text-xs`}
                                >
                                  {alerta.tipo === 'critico' ? '🚨' : alerta.tipo === 'erro' ? '⚠️' : alerta.tipo === 'aviso' ? '⚡' : 'ℹ️'} {alerta.tipo.toUpperCase()}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                >
                                  {alerta.categoria}
                                </Badge>
                              </div>
                              {!alerta.lido && (
                                <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                              )}
                            </div>

                            {/* Conteúdo do Insight */}
                            <div className="space-y-1">
                              <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                                {alerta.titulo}
                              </h4>
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 break-words">
                                {alerta.mensagem}
                              </p>
                              <div className="flex items-center justify-between pt-1">
                                <p className="text-xs text-gray-500 dark:text-gray-500">
                                  {formatarTempoRelativo(alerta.created_at)}
                                </p>
                                {alerta.url && (
                                  <span className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                    Ver detalhes <ArrowRight className="w-3 h-3" />
                                  </span>
                                )}
                              </div>
                            </div>
                          </Card>
                        ))
                      )}
                      
                      {/* Link para página completa */}
                      {insightsAlertas.length > 0 && (
                        <Button
                          variant="ghost"
                          className="w-full text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                          onClick={() => {
                            router.push('/alertas');
                            setIsOpen(false);
                          }}
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Ver todos os alertas
                        </Button>
                      )}
                    </>
                  ) : loading && notificacoes.length === 0 && insightsAlertas.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                      <span className="ml-2 text-sm text-gray-500">
                        Carregando...
                      </span>
                    </div>
                  ) : (
                    <>
                      {/* Mostrar Insights nas abas Todas e Não Lidas também */}
                      {filtroTab === 'nao_lidas' ? (
                        // Aba Não Lidas: mostrar insights não lidos
                        insightsNaoLidos.length === 0 && notificacoesFiltradas.length === 0 ? (
                          <div className="text-center py-8">
                            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                            <p className="text-gray-500 dark:text-gray-400">
                              Todas as notificações foram lidas
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Insights não lidos */}
                            {insightsNaoLidos.map(alerta => (
                              <Card
                                key={alerta.id}
                                className={`card-dark p-3 space-y-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-l-4 border-l-purple-500 mb-3`}
                                onClick={() => {
                                  marcarInsightComoLido(alerta.id);
                                  if (alerta.url) {
                                    router.push(alerta.url);
                                    setIsOpen(false);
                                  }
                                }}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={`${getAlertBadgeClass(alerta.tipo)} text-xs`}>
                                      {alerta.tipo === 'critico' ? '🚨' : alerta.tipo === 'erro' ? '⚠️' : alerta.tipo === 'aviso' ? '⚡' : 'ℹ️'} {alerta.tipo.toUpperCase()}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                      {alerta.categoria}
                                    </Badge>
                                  </div>
                                  <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                                </div>
                                <div className="space-y-1">
                                  <h4 className="font-medium text-sm text-gray-900 dark:text-white">{alerta.titulo}</h4>
                                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 break-words">{alerta.mensagem}</p>
                                  <div className="flex items-center justify-between pt-1">
                                    <p className="text-xs text-gray-500">{formatarTempoRelativo(alerta.created_at)}</p>
                                    {alerta.url && (
                                      <span className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                        Ver detalhes <ArrowRight className="w-3 h-3" />
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </Card>
                            ))}
                            {/* Notificações não lidas do banco */}
                            {notificacoesFiltradas.map(notificacao => (
                              <Card
                                key={notificacao.id}
                                className="card-dark p-3 space-y-2 mb-3"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className={`${getColorByType(notificacao.tipo || 'info')} text-xs`}
                                    >
                                      {(notificacao.tipo || 'INFO').toUpperCase()}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={`${getColorByPriority(notificacao.prioridade || 'media')} text-xs`}
                                    >
                                      {(notificacao.prioridade || 'MEDIA').toUpperCase()}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {['pendente', 'enviada'].includes(notificacao.status || '') && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleMarcarComoLida(notificacao.id)}
                                        className="h-6 w-6 p-0"
                                      >
                                        <CheckCircle className="h-3 w-3" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleExcluirNotificacao(notificacao.id)}
                                      className="h-6 w-6 p-0"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                                    {notificacao.titulo || 'Notificação sem título'}
                                  </h4>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    {notificacao.mensagem || 'Sem mensagem'}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-500">
                                    {notificacao.criada_em ? formatarTempo(notificacao.criada_em) : 'Sem data'}
                                  </p>
                                </div>
                              </Card>
                            ))}
                          </>
                        )
                      ) : filtroTab === 'todas' ? (
                        // Aba Todas: mostrar tudo
                        insightsAlertas.length === 0 && notificacoesFiltradas.length === 0 ? (
                          <div className="text-center py-8">
                            <Info className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                            <p className="text-gray-500 dark:text-gray-400">
                              Nenhuma notificação
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Insights primeiro */}
                            {insightsAlertas.map(alerta => (
                              <Card
                                key={alerta.id}
                                className={`card-dark p-3 space-y-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors mb-3 ${
                                  !alerta.lido ? 'border-l-4 border-l-purple-500' : ''
                                }`}
                                onClick={() => {
                                  marcarInsightComoLido(alerta.id);
                                  if (alerta.url) {
                                    router.push(alerta.url);
                                    setIsOpen(false);
                                  }
                                }}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={`${getAlertBadgeClass(alerta.tipo)} text-xs`}>
                                      {alerta.tipo === 'critico' ? '🚨' : alerta.tipo === 'erro' ? '⚠️' : alerta.tipo === 'aviso' ? '⚡' : 'ℹ️'} {alerta.tipo.toUpperCase()}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                      {alerta.categoria}
                                    </Badge>
                                  </div>
                                  {!alerta.lido && <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />}
                                </div>
                                <div className="space-y-1">
                                  <h4 className="font-medium text-sm text-gray-900 dark:text-white">{alerta.titulo}</h4>
                                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 break-words">{alerta.mensagem}</p>
                                  <div className="flex items-center justify-between pt-1">
                                    <p className="text-xs text-gray-500">{formatarTempoRelativo(alerta.created_at)}</p>
                                    {alerta.url && (
                                      <span className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                        Ver detalhes <ArrowRight className="w-3 h-3" />
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </Card>
                            ))}
                            {/* Depois notificações do banco */}
                            {notificacoesFiltradas.map(notificacao => (
                      <Card
                        key={notificacao.id}
                        className="card-dark p-3 space-y-2"
                      >
                        {/* Header da Notificação */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`${getColorByType(notificacao.tipo || 'info')} text-xs`}
                            >
                              {(notificacao.tipo || 'INFO').toUpperCase()}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`${getColorByPriority(notificacao.prioridade || 'media')} text-xs`}
                            >
                              {(
                                notificacao.prioridade || 'MEDIA'
                              ).toUpperCase()}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-1">
                            {['pendente', 'enviada'].includes(
                              notificacao.status || ''
                            ) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleMarcarComoLida(notificacao.id)
                                }
                                className="h-6 w-6 p-0"
                              >
                                <CheckCircle className="h-3 w-3" />
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleExcluirNotificacao(notificacao.id)
                              }
                              className="h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Conteúdo da Notificação */}
                        <div className="space-y-1">
                          <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                            {notificacao.titulo || 'Notificação sem título'}
                          </h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {notificacao.mensagem || 'Sem mensagem'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            {notificacao.criada_em
                              ? formatarTempo(notificacao.criada_em)
                              : 'Sem data'}
                          </p>
                        </div>

                        {/* Ações da Notificação */}
                        <div className="flex flex-wrap gap-2 pt-2">
                          {/* Botão Ver Detalhes - sempre presente */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              router.push(`/notificacoes/${notificacao.id}`);
                              setIsOpen(false);
                            }}
                            className="h-7 text-xs px-3"
                            leftIcon={<Info className="h-3 w-3" />}
                          >
                            Ver Detalhes
                          </Button>
                          
                          {/* Ações específicas da notificação */}
                          {notificacao.acoes &&
                            Array.isArray(notificacao.acoes) &&
                            notificacao.acoes.length > 0 &&
                            notificacao.acoes.map((acao, index) => (
                              <Button
                                key={index}
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAcaoNotificacao(acao)}
                                className="h-7 text-xs px-3"
                                leftIcon={<ExternalLink className="h-3 w-3" />}
                              >
                                {acao.label || 'Ir'}
                              </Button>
                            ))}
                        </div>
                      </Card>
                            ))}
                          </>
                        )
                      ) : null}
                    </>
                  )}
                </div>
              </ScrollArea>
            </Tabs>

            {/* Footer com Ações Rápidas */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3">
              {/* Ações Rápidas */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarcarTodasComoLidas}
                  disabled={totalNaoLidas === 0}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Marcar todas como lidas
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/usuarios/notifications')}
                >
                  Ver todas
                </Button>
              </div>

              {/* Configurações Rápidas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Atualização automática
                  </span>
                  <Switch
                    checked={configuracoes.autoRefresh}
                    onCheckedChange={handleToggleAutoRefresh}
                  />
                </div>

                {configuracoes.autoRefresh && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      Intervalo:
                    </span>
                    <select
                      value={configuracoes.refreshInterval}
                      onChange={e =>
                        handleChangeInterval(parseInt(e.target.value))
                      }
                      className="input-dark text-xs h-6 px-2 py-0"
                    >
                      <option value={15000}>15s</option>
                      <option value={30000}>30s</option>
                      <option value={60000}>1min</option>
                      <option value={300000}>5min</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
