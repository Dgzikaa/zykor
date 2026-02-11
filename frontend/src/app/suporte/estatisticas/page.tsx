'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Clock,
  Star,
  TrendingUp,
  CheckCircle2,
  XCircle,
  MessageSquare,
  BarChart3
} from 'lucide-react';
import Link from 'next/link';

interface Estatisticas {
  total: number;
  abertos: number;
  em_andamento: number;
  aguardando_cliente: number;
  resolvidos: number;
  fechados: number;
  cancelados: number;
  por_prioridade: {
    critica: number;
    alta: number;
    media: number;
    baixa: number;
  };
  por_categoria: {
    bug: number;
    melhoria: number;
    duvida: number;
    sugestao: number;
    urgente: number;
  };
  por_modulo: Record<string, number>;
  sla_violados: number;
  sla_em_risco: number;
  tempo_medio_primeira_resposta: number;
  tempo_medio_resolucao: number;
  avaliacao_media: number;
  total_avaliacoes: number;
  chamados_por_dia: Record<string, number>;
  periodo_dias: number;
}

export default function EstatisticasPage() {
  const [stats, setStats] = useState<Estatisticas | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('30');

  const barId = 3; // TODO: Pegar do contexto

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/suporte/estatisticas?bar_id=${barId}&periodo=${periodo}`);
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [periodo]);

  const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)} dias`;
  };

  if (loading || !stats) {
    return (
      <div className="container mx-auto py-6 px-4 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Carregando estatísticas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/suporte">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Estatísticas de Suporte</h1>
            <p className="text-sm text-muted-foreground">
              Visão geral dos últimos {stats.periodo_dias} dias
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="365">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchStats}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total de Chamados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.resolvidos}</p>
                <p className="text-sm text-muted-foreground">Resolvidos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatHours(stats.tempo_medio_primeira_resposta)}</p>
                <p className="text-sm text-muted-foreground">Tempo Médio 1ª Resposta</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatHours(stats.tempo_medio_resolucao)}</p>
                <p className="text-sm text-muted-foreground">Tempo Médio Resolução</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SLA e Avaliação */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={stats.sla_violados > 0 ? 'border-red-200 dark:border-red-800' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stats.sla_violados > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                <AlertTriangle className={`h-6 w-6 ${stats.sla_violados > 0 ? 'text-red-600' : 'text-gray-600'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.sla_violados}</p>
                <p className="text-sm text-muted-foreground">SLA Violados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={stats.sla_em_risco > 0 ? 'border-orange-200 dark:border-orange-800' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stats.sla_em_risco > 0 ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                <Clock className={`h-6 w-6 ${stats.sla_em_risco > 0 ? 'text-orange-600' : 'text-gray-600'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.sla_em_risco}</p>
                <p className="text-sm text-muted-foreground">Em Risco de SLA</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <Star className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-bold">{stats.avaliacao_media.toFixed(1)}</p>
                  <span className="text-sm text-muted-foreground">/5</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Avaliação Média ({stats.total_avaliacoes} aval.)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Por Status */}
        <Card>
          <CardHeader>
            <CardTitle>Por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span>Abertos</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${stats.total > 0 ? (stats.abertos / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="font-mono w-8 text-right">{stats.abertos}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>Em Andamento</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-500 rounded-full"
                      style={{ width: `${stats.total > 0 ? (stats.em_andamento / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="font-mono w-8 text-right">{stats.em_andamento}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>Aguardando</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${stats.total > 0 ? (stats.aguardando_cliente / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="font-mono w-8 text-right">{stats.aguardando_cliente}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>Resolvidos</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${stats.total > 0 ? (stats.resolvidos / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="font-mono w-8 text-right">{stats.resolvidos}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>Fechados</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gray-500 rounded-full"
                      style={{ width: `${stats.total > 0 ? (stats.fechados / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="font-mono w-8 text-right">{stats.fechados}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Por Prioridade */}
        <Card>
          <CardHeader>
            <CardTitle>Por Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-red-600">Crítica</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${stats.total > 0 ? (stats.por_prioridade.critica / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="font-mono w-8 text-right">{stats.por_prioridade.critica}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-orange-600">Alta</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 rounded-full"
                      style={{ width: `${stats.total > 0 ? (stats.por_prioridade.alta / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="font-mono w-8 text-right">{stats.por_prioridade.alta}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-blue-600">Média</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${stats.total > 0 ? (stats.por_prioridade.media / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="font-mono w-8 text-right">{stats.por_prioridade.media}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Baixa</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gray-500 rounded-full"
                      style={{ width: `${stats.total > 0 ? (stats.por_prioridade.baixa / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="font-mono w-8 text-right">{stats.por_prioridade.baixa}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Por Categoria */}
        <Card>
          <CardHeader>
            <CardTitle>Por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.por_categoria).map(([cat, count]) => (
                <div key={cat} className="flex justify-between items-center">
                  <span className="capitalize">{cat}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="font-mono w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Por Módulo */}
        <Card>
          <CardHeader>
            <CardTitle>Por Módulo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.por_modulo)
                .sort((a, b) => b[1] - a[1])
                .map(([modulo, count]) => (
                <div key={modulo} className="flex justify-between items-center">
                  <span className="capitalize">{modulo}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-teal-500 rounded-full"
                        style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="font-mono w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chamados por Dia */}
      <Card>
        <CardHeader>
          <CardTitle>Chamados por Dia (Últimos 7 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-2 h-32">
            {Object.entries(stats.chamados_por_dia).map(([dia, count]) => {
              const maxCount = Math.max(...Object.values(stats.chamados_por_dia), 1);
              const height = (count / maxCount) * 100;
              const diaFormatado = new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
              
              return (
                <div key={dia} className="flex flex-col items-center flex-1">
                  <span className="text-xs font-mono mb-1">{count}</span>
                  <div 
                    className="w-full bg-primary rounded-t transition-all"
                    style={{ height: `${Math.max(height, 5)}%` }}
                  />
                  <span className="text-xs text-muted-foreground mt-1 truncate w-full text-center">
                    {diaFormatado}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
