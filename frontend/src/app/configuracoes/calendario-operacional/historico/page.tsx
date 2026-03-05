'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, ArrowLeft, Calendar, User, Clock, FileEdit } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';

export default function CalendarioHistoricoPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const [historico, setHistorico] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPageTitle('Histórico - Calendário Operacional');
    carregarHistorico();
    return () => setPageTitle('');
  }, [setPageTitle]);

  const carregarHistorico = async () => {
    try {
      const response = await fetch(`/api/ferramentas/calendario-operacional/historico?limit=100&bar_id=${selectedBar?.id}`);
      if (!response.ok) throw new Error('Erro ao carregar histórico');
      const result = await response.json();
      setHistorico(result.data.historico);
      setStats(result.data.stats);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  const getTipoAcaoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      'create': 'Criado',
      'update': 'Atualizado',
      'delete': 'Removido',
      'bulk_update': 'Ação em Lote'
    };
    return labels[tipo] || tipo;
  };

  const getTipoAcaoCor = (tipo: string) => {
    const cores: Record<string, string> = {
      'create': 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-300',
      'update': 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-300',
      'delete': 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-300',
      'bulk_update': 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-300'
    };
    return cores[tipo] || 'bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border-gray-300';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        <Link href="/extras/calendario-operacional">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Calendário
          </Button>
        </Link>

        <Card className="card-dark mb-6">
          <CardHeader>
            <CardTitle className="card-title-dark flex items-center gap-2">
              <History className="w-6 h-6" />
              Histórico de Mudanças
            </CardTitle>
            <CardDescription className="card-description-dark">
              Todas as alterações feitas no calendário operacional
            </CardDescription>
          </CardHeader>

          {stats && (
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total de Mudanças</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.total_mudancas}
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="text-sm text-green-700 dark:text-green-400">Criações</div>
                  <div className="text-2xl font-bold text-green-900 dark:text-green-300">
                    {stats.por_tipo.create}
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="text-sm text-blue-700 dark:text-blue-400">Atualizações</div>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">
                    {stats.por_tipo.update}
                  </div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="text-sm text-purple-700 dark:text-purple-400">Ações em Lote</div>
                  <div className="text-2xl font-bold text-purple-900 dark:text-purple-300">
                    {stats.por_tipo.bulk_update}
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <Card className="card-dark">
          <CardHeader>
            <CardTitle className="card-title-dark text-lg">Últimas 100 Alterações</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-400">Carregando histórico...</p>
              </div>
            ) : historico.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Nenhuma alteração registrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {historico.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getTipoAcaoCor(item.tipo_acao)}>
                          {getTipoAcaoLabel(item.tipo_acao)}
                        </Badge>
                        {item.tipo_acao === 'bulk_update' && (
                          <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900 border-purple-300">
                            {item.qtd_dias_afetados} {item.qtd_dias_afetados === 1 ? 'dia' : 'dias'}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="w-3 h-3" />
                        {new Date(item.criado_em).toLocaleString('pt-BR')}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
                          <Calendar className="w-4 h-4" />
                          <span className="font-semibold">
                            {new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR', { 
                              day: '2-digit', 
                              month: 'long', 
                              year: 'numeric' 
                            })}
                          </span>
                        </div>
                        {item.usuario_nome && (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <User className="w-4 h-4" />
                            <span>{item.usuario_nome}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        {item.status_anterior !== item.status_novo && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 dark:text-gray-400">Status:</span>
                            {item.status_anterior && (
                              <Badge variant="outline" className="bg-gray-100 dark:bg-gray-700">
                                {item.status_anterior}
                              </Badge>
                            )}
                            <span>→</span>
                            <Badge variant="outline" className={
                              item.status_novo === 'aberto' 
                                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400'
                                : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-400'
                            }>
                              {item.status_novo || 'Removido'}
                            </Badge>
                          </div>
                        )}
                        {item.motivo_novo && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            <FileEdit className="w-3 h-3 inline mr-1" />
                            {item.motivo_novo}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

