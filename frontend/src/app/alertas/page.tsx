'use client';

import { useEffect, useState } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { 
  useInsightsNotifications, 
  getAlertIcon, 
  getAlertBadgeClass,
  formatarTempoRelativo,
  InsightAlerta 
} from '@/hooks/useInsightsNotifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  RefreshCcw, 
  CheckCircle, 
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Send,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { toast } from 'sonner';

export default function AlertasPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const { 
    alertas, 
    loading, 
    lastUpdate, 
    estatisticas,
    fetchAlertas,
    marcarComoLido,
    marcarTodosComoLidos
  } = useInsightsNotifications();
  
  const [filtro, setFiltro] = useState<'todos' | 'critico' | 'erro' | 'aviso' | 'info' | 'sucesso'>('todos');
  const [enviandoDiscord, setEnviandoDiscord] = useState(false);

  useEffect(() => {
    setPageTitle('🔔 Central de Alertas');
  }, [setPageTitle]);

  // Filtrar alertas
  const alertasFiltrados = alertas.filter(alerta => {
    if (filtro === 'todos') return true;
    return alerta.tipo === filtro;
  });

  // Enviar para Discord
  const handleEnviarDiscord = async () => {
    if (!selectedBar?.id) return;
    
    setEnviandoDiscord(true);
    try {
      const response = await fetch('/api/alertas-inteligentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'processar_pendentes',
          barId: selectedBar.id,
          enviarDiscord: true
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Alertas enviados para o Discord!');
      } else {
        toast.error('Erro ao enviar para Discord');
      }
    } catch {
      toast.error('Erro ao enviar para Discord');
    } finally {
      setEnviandoDiscord(false);
    }
  };

  const getIconByTipo = (tipo: string) => {
    switch (tipo) {
      case 'critico':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'erro':
        return <TrendingDown className="w-5 h-5 text-orange-500" />;
      case 'aviso':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'sucesso':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      default:
        return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        
        {/* Header */}
        <motion.div 
          className="mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Central de Alertas
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Insights inteligentes do seu negócio
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnviarDiscord}
                disabled={enviandoDiscord || alertas.length === 0}
                className="text-purple-600 border-purple-300 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-700 dark:hover:bg-purple-900/20"
              >
                <Send className="w-4 h-4 mr-2" />
                {enviandoDiscord ? 'Enviando...' : 'Enviar Discord'}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={marcarTodosComoLidos}
                disabled={estatisticas.naoLidos === 0}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Marcar lidos
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchAlertas}
                disabled={loading}
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          
          {lastUpdate && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Última atualização: {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </motion.div>

        {/* Estatísticas */}
        <motion.div 
          className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {[
            { label: 'Total', value: estatisticas.total, color: 'bg-gray-100 dark:bg-gray-800', textColor: 'text-gray-600 dark:text-gray-400', filter: 'todos' },
            { label: 'Críticos', value: estatisticas.criticos, color: 'bg-red-100 dark:bg-red-900/30', textColor: 'text-red-600 dark:text-red-400', filter: 'critico' },
            { label: 'Erros', value: estatisticas.erros, color: 'bg-orange-100 dark:bg-orange-900/30', textColor: 'text-orange-600 dark:text-orange-400', filter: 'erro' },
            { label: 'Avisos', value: estatisticas.avisos, color: 'bg-yellow-100 dark:bg-yellow-900/30', textColor: 'text-yellow-600 dark:text-yellow-400', filter: 'aviso' },
            { label: 'Não lidos', value: estatisticas.naoLidos, color: 'bg-blue-100 dark:bg-blue-900/30', textColor: 'text-blue-600 dark:text-blue-400', filter: 'todos' },
          ].map((stat, index) => (
            <motion.button
              key={stat.label}
              onClick={() => setFiltro(stat.filter as any)}
              className={`p-3 rounded-xl ${stat.color} ${filtro === stat.filter ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-900' : ''} transition-all hover:scale-105`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <div className={`text-2xl font-bold ${stat.textColor}`}>
                {stat.value}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {stat.label}
              </div>
            </motion.button>
          ))}
        </motion.div>

        {/* Lista de Alertas */}
        <div className="space-y-4">
          {loading && alertas.length === 0 ? (
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="py-12 text-center">
                <RefreshCcw className="w-8 h-8 mx-auto mb-4 animate-spin text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400">Analisando dados...</p>
              </CardContent>
            </Card>
          ) : alertasFiltrados.length === 0 ? (
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="py-12 text-center">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Tudo certo! 🎉
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {filtro === 'todos' 
                    ? 'Não há alertas no momento.' 
                    : `Não há alertas do tipo "${filtro}".`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <AnimatePresence>
              {alertasFiltrados.map((alerta, index) => (
                <motion.div
                  key={alerta.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card 
                    className={`bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all ${
                      !alerta.lido ? 'border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Ícone */}
                        <div className={`p-2 rounded-lg ${getAlertBadgeClass(alerta.tipo)}`}>
                          {getIconByTipo(alerta.tipo)}
                        </div>
                        
                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline" className={getAlertBadgeClass(alerta.tipo)}>
                              {alerta.tipo.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {alerta.categoria}
                            </Badge>
                            {!alerta.lido && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                            )}
                          </div>
                          
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                            {alerta.titulo}
                          </h3>
                          
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {alerta.mensagem}
                          </p>
                          
                          {/* Ações Sugeridas */}
                          {alerta.acoes_sugeridas && alerta.acoes_sugeridas.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                Sugestões:
                              </p>
                              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                {alerta.acoes_sugeridas.map((acao, i) => (
                                  <li key={i} className="flex items-center gap-2">
                                    <ArrowRight className="w-3 h-3 text-gray-400" />
                                    {acao}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Dados extras */}
                          {alerta.dados && Object.keys(alerta.dados).length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {Object.entries(alerta.dados).slice(0, 4).map(([key, value]) => (
                                <span 
                                  key={key}
                                  className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
                                >
                                  {key}: {typeof value === 'number' 
                                    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                    : String(value)}
                                </span>
                              ))}
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 dark:text-gray-500">
                              {formatarTempoRelativo(alerta.created_at)}
                            </span>
                            
                            <div className="flex items-center gap-2">
                              {!alerta.lido && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => marcarComoLido(alerta.id)}
                                  className="text-xs"
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Marcar lido
                                </Button>
                              )}
                              
                              {/* Link para página de contexto/destino */}
                              {alerta.url && (
                                <Link href={alerta.url}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => marcarComoLido(alerta.id)}
                                  >
                                    <ExternalLink className="w-3 h-3 mr-1" />
                                    Ir para {alerta.categoria}
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
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Dica */}
        <motion.div
          className="mt-8 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200 dark:border-purple-800"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <div>
              <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
                💡 Dica: Alertas inteligentes
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400">
                Os alertas são gerados automaticamente analisando faturamento, metas, checklists e outros indicadores.
                Você também pode recebê-los no Discord clicando em "Enviar Discord".
              </p>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
