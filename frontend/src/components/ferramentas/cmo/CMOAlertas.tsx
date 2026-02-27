'use client';

import { useState, useEffect } from 'react';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Bell, BellOff, CheckCircle, TrendingUp } from 'lucide-react';

interface Alerta {
  id: string;
  tipo_alerta: string;
  mensagem: string;
  valor_cmo: number;
  valor_meta: number;
  diferenca: number;
  percentual_diferenca: number;
  enviado: boolean;
  enviado_em: string | null;
  created_at: string;
  cmo_semanal: {
    ano: number;
    semana: number;
    data_inicio: string;
    cmo_total: number;
  };
}

export default function CMOAlertas() {
  const { selectedBar } = useBar();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [filtro, setFiltro] = useState<'todos' | 'pendentes' | 'enviados'>('todos');

  useEffect(() => {
    buscarAlertas();
  }, [selectedBar, filtro]);

  const buscarAlertas = async () => {
    if (!selectedBar?.id) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        bar_id: selectedBar.id.toString(),
      });

      if (filtro === 'pendentes') {
        params.append('nao_enviados', 'true');
      }

      const res = await fetch(`/api/cmo-semanal/alertas?${params}`);
      const json = await res.json();

      if (json.success) {
        setAlertas(json.data || []);
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao buscar alertas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const marcarComoEnviado = async (id: string) => {
    try {
      const res = await fetch('/api/cmo-semanal/alertas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      const json = await res.json();

      if (json.success) {
        toast({
          title: 'Sucesso',
          description: 'Alerta marcado como enviado',
        });
        buscarAlertas();
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar alerta',
        variant: 'destructive',
      });
    }
  };

  const verificarNovasAlertas = async () => {
    if (!selectedBar?.id) return;

    try {
      const res = await fetch('/api/cmo-semanal/verificar-alertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: selectedBar.id,
          ano: new Date().getFullYear(),
        }),
      });

      const json = await res.json();

      if (json.success) {
        toast({
          title: 'Verificação Concluída',
          description: `${json.alertas_criados} novo(s) alerta(s) criado(s)`,
        });
        buscarAlertas();
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao verificar alertas',
        variant: 'destructive',
      });
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(valor);
  };

  const alertasFiltrados = alertas.filter((a) => {
    if (filtro === 'pendentes') return !a.enviado;
    if (filtro === 'enviados') return a.enviado;
    return true;
  });

  const alertasPendentes = alertas.filter((a) => !a.enviado).length;

  return (
    <div className="space-y-6">
      {/* Header com botão */}
      <div className="flex items-center justify-end">
        <Button onClick={verificarNovasAlertas}>
          <AlertTriangle className="w-4 h-4 mr-2" />
          Verificar Novos Alertas
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{alertas.length}</div>
          </CardContent>
        </Card>

        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-700">
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{alertasPendentes}</div>
          </CardContent>
        </Card>

        <Card className="border-green-300 bg-green-50 dark:bg-green-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-700">
              Enviados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {alertas.length - alertasPendentes}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Button
              variant={filtro === 'todos' ? 'default' : 'outline'}
              onClick={() => setFiltro('todos')}
            >
              Todos
            </Button>
            <Button
              variant={filtro === 'pendentes' ? 'default' : 'outline'}
              onClick={() => setFiltro('pendentes')}
            >
              Pendentes ({alertasPendentes})
            </Button>
            <Button
              variant={filtro === 'enviados' ? 'default' : 'outline'}
              onClick={() => setFiltro('enviados')}
            >
              Enviados
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Alertas */}
      {loading ? (
        <Card>
          <CardContent className="py-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : alertasFiltrados.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BellOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum alerta encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {alertasFiltrados.map((alerta) => (
            <Card
              key={alerta.id}
              className={`${
                !alerta.enviado
                  ? 'border-red-300 bg-red-50 dark:bg-red-950/20'
                  : 'border-gray-200'
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <CardTitle className="text-lg">
                        CMO Acima da Meta - Semana {alerta.cmo_semanal.semana}/
                        {alerta.cmo_semanal.ano}
                      </CardTitle>
                    </div>
                    <CardDescription>
                      {new Date(alerta.cmo_semanal.data_inicio).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {alerta.enviado ? (
                      <Badge variant="outline" className="bg-green-100 text-green-700">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Enviado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-100 text-red-700">
                        <Bell className="w-3 h-3 mr-1" />
                        Pendente
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Valores */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border">
                      <div className="text-xs text-muted-foreground mb-1">CMO Real</div>
                      <div className="text-lg font-bold text-red-600">
                        {formatarMoeda(alerta.valor_cmo)}
                      </div>
                    </div>
                    <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border">
                      <div className="text-xs text-muted-foreground mb-1">Meta</div>
                      <div className="text-lg font-bold">
                        {formatarMoeda(alerta.valor_meta)}
                      </div>
                    </div>
                    <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border">
                      <div className="text-xs text-muted-foreground mb-1">Diferença</div>
                      <div className="text-lg font-bold text-red-600">
                        +{formatarMoeda(alerta.diferenca)}
                      </div>
                    </div>
                    <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border">
                      <div className="text-xs text-muted-foreground mb-1">Variação</div>
                      <div className="text-lg font-bold text-red-600 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        +{alerta.percentual_diferenca.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Mensagem */}
                  <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border">
                    <pre className="text-sm whitespace-pre-wrap font-sans">
                      {alerta.mensagem}
                    </pre>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="text-xs text-muted-foreground">
                      Criado em{' '}
                      {new Date(alerta.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {alerta.enviado && alerta.enviado_em && (
                        <>
                          {' • Enviado em '}
                          {new Date(alerta.enviado_em).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!alerta.enviado && (
                        <Button
                          size="sm"
                          onClick={() => marcarComoEnviado(alerta.id)}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Marcar como Enviado
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
