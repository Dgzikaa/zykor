'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { 
  Loader2, RefreshCw, CheckCircle, XCircle, Clock, Activity, 
  Database, Zap, Server, AlertTriangle, ArrowLeft 
} from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';
import Link from 'next/link';

interface HealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: string; message: string; latency_ms?: number };
    cron_jobs: { status: string; message: string };
    edge_functions: { status: string; message: string };
    disk_usage: { status: string; message: string };
  };
  metrics: {
    total_eventos: number;
    eventos_ultimos_7_dias: number;
    alertas_abertos: number;
    ultima_sincronizacao_nibo: string | null;
    ultima_sincronizacao_contahub: string | null;
    database_size_mb: number;
  };
  response_time_ms: number;
}

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  last_run?: string;
  last_status?: string;
}

interface CronExecution {
  runid: number;
  jobid: number;
  jobname: string;
  status: string;
  start_time: string;
  end_time: string;
  return_message: string;
}

export default function MonitoramentoPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [executions, setExecutions] = useState<CronExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      // Fetch health check
      const healthRes = await fetch('/api/health');
      const healthData = await healthRes.json();
      setHealth(healthData);

      // Fetch cron jobs - using direct API call
      const cronRes = await fetch('/api/monitoramento/cron-jobs');
      if (cronRes.ok) {
        const cronData = await cronRes.json();
        setCronJobs(cronData.jobs || []);
        setExecutions(cronData.executions || []);
      }

    } catch (error: any) {
      toast.error('Erro ao carregar dados de monitoramento', {
        description: error.message,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh a cada 30 segundos
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
      case 'succeeded':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">✓ OK</Badge>;
      case 'degraded':
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">⚠ Aviso</Badge>;
      case 'unhealthy':
      case 'error':
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">✕ Erro</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // Função segura para formatar datas
  const formatarData = (data: string | null | undefined, formatStr: string = 'dd/MM/yyyy'): string => {
    if (!data) return '-';
    try {
      const parsed = parseISO(data);
      if (isNaN(parsed.getTime())) return '-';
      return format(parsed, formatStr, { locale: ptBR });
    } catch {
      return '-';
    }
  };

  // Função segura para formatDistanceToNow
  const formatarDistancia = (data: string | null | undefined): string => {
    if (!data) return 'Nunca';
    try {
      const parsed = parseISO(data);
      if (isNaN(parsed.getTime())) return 'Nunca';
      return formatDistanceToNow(parsed, { addSuffix: true, locale: ptBR });
    } catch {
      return 'Nunca';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingState
          title="Carregando monitoramento..."
          subtitle="Verificando status do sistema"
          icon={<Activity className="w-4 h-4" />}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/configuracoes">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Activity className="h-6 w-6 text-blue-600" />
                Monitoramento do Sistema
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Status em tempo real dos serviços e cron jobs
              </p>
            </div>
          </div>
          <Button onClick={fetchData} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Atualizar
          </Button>
        </div>

        {/* Status Geral */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Status Geral</CardTitle>
            </CardHeader>
            <CardContent>
              {health && getStatusBadge(health.status)}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Latência: {health?.response_time_ms}ms
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Banco de Dados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-500" />
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {health?.metrics.database_size_mb || 0} MB
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Latência: {health?.checks.database.latency_ms || 0}ms
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Eventos Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {health?.metrics.total_eventos || 0}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Últimos 7 dias: {health?.metrics.eventos_ultimos_7_dias || 0}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Alertas Abertos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${(health?.metrics.alertas_abertos || 0) > 0 ? 'text-red-500' : 'text-green-500'}`} />
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {health?.metrics.alertas_abertos || 0}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Uptime: {formatUptime(health?.uptime || 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs para diferentes seções */}
        <Tabs defaultValue="health" className="w-full">
          <TabsList className="bg-gray-100 dark:bg-gray-700 mb-4">
            <TabsTrigger value="health" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600">
              <Server className="h-4 w-4 mr-2" /> Health Checks
            </TabsTrigger>
            <TabsTrigger value="cron" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600">
              <Clock className="h-4 w-4 mr-2" /> Cron Jobs
            </TabsTrigger>
            <TabsTrigger value="executions" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600">
              <Activity className="h-4 w-4 mr-2" /> Execuções Recentes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="health">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Status dos Componentes</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Verificação em tempo real de todos os serviços
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {health?.checks && Object.entries(health.checks).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white capitalize">
                          {key.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{value.message}</p>
                      </div>
                      {getStatusBadge(value.status)}
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">Últimas Sincronizações</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Nibo</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatarDistancia(health?.metrics.ultima_sincronizacao_nibo)}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">ContaHub</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatarDistancia(health?.metrics.ultima_sincronizacao_contahub)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cron">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Cron Jobs Configurados</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  {cronJobs.length} jobs ativos no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cronJobs.map((job) => (
                        <TableRow key={job.jobid}>
                          <TableCell className="font-mono text-sm">{job.jobid}</TableCell>
                          <TableCell className="font-medium text-gray-900 dark:text-white">{job.jobname}</TableCell>
                          <TableCell className="font-mono text-sm text-gray-600 dark:text-gray-400">{job.schedule}</TableCell>
                          <TableCell>
                            {job.active ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Ativo</Badge>
                            ) : (
                              <Badge variant="secondary">Inativo</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="executions">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Execuções Recentes</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Últimas 50 execuções de cron jobs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Fim</TableHead>
                        <TableHead>Mensagem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {executions.map((exec) => (
                        <TableRow key={exec.runid}>
                          <TableCell className="font-medium text-gray-900 dark:text-white">{exec.jobname || `Job ${exec.jobid}`}</TableCell>
                          <TableCell>{getStatusBadge(exec.status)}</TableCell>
                          <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                            {formatarData(exec.start_time, 'dd/MM HH:mm:ss')}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                            {formatarData(exec.end_time, 'dd/MM HH:mm:ss')}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-gray-600 dark:text-gray-400">
                            {exec.return_message || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
