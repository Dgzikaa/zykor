'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  Eye,
  Clock,
  Activity,
  Lock,
  Globe,
  Users,
  Database,
  RefreshCw,
  CheckCircle,
  XCircle,
  TrendingUp,
  Wifi,
  Server,
} from 'lucide-react';

interface SecurityMetrics {
  total_events: number;
  critical_events: number;
  warning_events: number;
  info_events: number;
  auth_events: number;
  access_events: number;
  injection_events: number;
  rate_limit_events: number;
  api_abuse_events: number;
  backup_events: number;
  system_events: number;
  unique_ips: number;
  failed_logins: number;
  blocked_ips: number;
}

interface SecurityEvent {
  id: string;
  level: string;
  category: string;
  event_type: string;
  message: string;
  ip_address?: string;
  user_id?: string;
  timestamp: string;
  details?: SecurityDetails;
}

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource: string;
  timestamp: string;
  ip_address?: string;
  details?: SecurityDetails;
}

interface ErrorInfo {
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  userAgent?: string;
  url?: string;
}

interface SecurityDetails {
  lastLogin?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  deviceType?: string;
  risk_score?: number;
}

export default function SecurityPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { setPageTitle } = usePageTitle();
  useEffect(() => {
    setPageTitle('🔒 Segurança');
    return () => setPageTitle('');
  }, [setPageTitle]);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false); // Novo estado para controlar requisições
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadSecurityData = useCallback(async () => {
    // Evitar requisições duplicadas
    if (isLoading) return;

    try {
      setIsLoading(true);
      setLoading(true);

      // Simular carregamento de dados (já que as APIs não existem ainda)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Dados mockados para demonstração
      setMetrics({
        total_events: 313,
        critical_events: 0,
        warning_events: 15,
        info_events: 298,
        auth_events: 4,
        access_events: 2,
        injection_events: 0,
        rate_limit_events: 0,
        api_abuse_events: 0,
        backup_events: 12,
        system_events: 295,
        unique_ips: 2,
        failed_logins: 0,
        blocked_ips: 0,
      });

      setEvents([]);
      setAuditLogs([]);

    } catch (error) {
      console.error('Erro ao carregar dados de segurança:', error);
      toast({
        title: '❌ Erro',
        description: 'Erro ao carregar dados de segurança',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  }, [isLoading, toast]);

  // Carregar dados iniciais
  useEffect(() => {
    loadSecurityData();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      // ✅ Otimizado: Reduzir frequência de verificação de segurança
      const interval = setInterval(() => {
        if (!loading) {
          loadSecurityData();
        }
      }, 30000); // 30 segundos

      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [autoRefresh, loadSecurityData, loading]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700';
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600';
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-600 dark:text-red-400 font-bold';
    if (score >= 50)
      return 'text-yellow-600 dark:text-yellow-400 font-semibold';
    if (score >= 20) return 'text-blue-600 dark:text-blue-400 font-medium';
    return 'text-green-600 dark:text-green-400 font-medium';
  };

  const getRiskScoreLabel = (score: number) => {
    if (score >= 80) return 'ALTO';
    if (score >= 50) return 'MÉDIO';
    if (score >= 20) return 'BAIXO';
    return 'MÍNIMO';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header Moderno */}
        <div className="relative">
          <div className="rounded-2xl p-8 text-white shadow-xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <Button
                  variant="ghost"
                  onClick={() => router.push('/configuracoes')}
                  className="text-white hover:bg-white/10 flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </Button>

                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                    <Shield className="w-8 h-8" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">
                      Dashboard de Segurança
                    </h1>
                    <p className="text-blue-100 mt-1">
                      Monitore eventos de segurança e auditoria em tempo real
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`border-white/20 text-white hover:bg-white/10 ${
                    autoRefresh ? 'bg-white/20' : 'bg-white/5'
                  }`}
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`}
                  />
                  Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadSecurityData}
                  disabled={isLoading}
                  className="border-white/20 text-white hover:bg-white/10 bg-white/5"
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
                  />
                  Atualizar
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="card-dark border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Total de Eventos
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {metrics?.total_events || 313}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Últimas 24 horas
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <Activity className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-dark border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Eventos Críticos
                  </p>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                    {metrics?.critical_events || 0}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    Últimas 24 horas
                  </p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
                  <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    IPs Únicos
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {metrics?.unique_ips || 2}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Últimas 24 horas
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                  <Globe className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Status do Sistema
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">
                        Offline
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    Sistema de cache
                  </p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
                  <Database className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Eventos por Categoria */}
          <Card className="card-dark border-0 shadow-lg">
            <CardHeader className="border-b border-gray-100 dark:border-gray-700 pb-4">
              <CardTitle className="flex items-center gap-3 text-gray-900 dark:text-white">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                Eventos por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 hover:shadow-md transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="font-medium text-blue-900 dark:text-blue-100">
                      Autenticação
                    </span>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 font-semibold">
                    {metrics?.auth_events || 4}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800 hover:shadow-md transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="font-medium text-green-900 dark:text-green-100">
                      Controle de Acesso
                    </span>
                  </div>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 font-semibold">
                    {metrics?.access_events || 2}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800 hover:shadow-md transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="font-medium text-red-900 dark:text-red-100">
                      SQL Injection
                    </span>
                  </div>
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100 font-semibold">
                    {metrics?.injection_events || 0}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-100 dark:border-yellow-800 hover:shadow-md transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="font-medium text-yellow-900 dark:text-yellow-100">
                      Rate Limiting
                    </span>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100 font-semibold">
                    {metrics?.rate_limit_events || 0}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800 hover:shadow-md transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="font-medium text-purple-900 dark:text-purple-100">
                      Sistema
                    </span>
                  </div>
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100 font-semibold">
                    {metrics?.system_events || 295}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estatísticas de Segurança */}
          <Card className="card-dark border-0 shadow-lg">
            <CardHeader className="border-b border-gray-100 dark:border-gray-700 pb-4">
              <CardTitle className="flex items-center gap-3 text-gray-900 dark:text-white">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                Estatísticas de Segurança
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600 hover:shadow-md transition-all duration-200">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      Login Falhados
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Últimas 24h
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {metrics?.failed_logins || 0}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                      <XCircle className="w-3 h-3" />
                      Tentativas
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600 hover:shadow-md transition-all duration-200">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      IPs Bloqueados
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Últimas 24h
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {metrics?.blocked_ips || 0}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                      <Shield className="w-3 h-3" />
                      Endereços
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600 hover:shadow-md transition-all duration-200">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      Abuso de API
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Últimas 24h
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {metrics?.api_abuse_events || 0}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                      <Server className="w-3 h-3" />
                      Requisições
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Eventos de Segurança */}
        <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
          <CardHeader className="border-b border-gray-100 dark:border-gray-700 pb-4">
            <CardTitle className="flex items-center gap-3 text-gray-900 dark:text-white">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              Eventos de Segurança Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {events.length === 0 ? (
                <div className="text-center py-12">
                  <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Sistema Seguro
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Nenhum evento de segurança encontrado
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    Os eventos aparecerão aqui quando forem registrados no
                    sistema
                  </p>
                </div>
              ) : (
                events.slice(0, 10).map(event => (
                  <div
                    key={event.id}
                    className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <Badge
                            className={getLevelColor(event.level)}
                            variant="outline"
                          >
                            {event.level.toUpperCase()}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-xs font-medium"
                          >
                            {event.category.toUpperCase()}
                          </Badge>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Risco:{' '}
                            <span
                              className={getRiskScoreColor(
                                event.details?.risk_score || 0
                              )}
                            >
                              {event.details?.risk_score || 'N/A'}/100 (
                              {getRiskScoreLabel(
                                event.details?.risk_score || 0
                              )}
                              )
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-20">
                              Evento:
                            </span>
                            <span className="text-sm text-gray-900 dark:text-white font-mono bg-white dark:bg-gray-800 px-3 py-1 rounded-lg border">
                              {event.event_type}
                            </span>
                          </div>

                          <div className="flex items-start gap-3">
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-20">
                              Descrição:
                            </span>
                            <span className="text-sm text-gray-900 dark:text-white">
                              {event.message}
                            </span>
                          </div>

                          {event.ip_address && (
                            <div className="flex items-start gap-3">
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-20">
                                IP:
                              </span>
                              <span className="text-sm text-gray-900 dark:text-white font-mono bg-white dark:bg-gray-800 px-3 py-1 rounded-lg border">
                                {event.ip_address}
                              </span>
                            </div>
                          )}

                          {event.details &&
                            Object.keys(event.details).length > 0 && (
                              <div className="flex items-start gap-3">
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-20">
                                  Detalhes:
                                </span>
                                <div className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-3 rounded-lg border font-mono max-w-md overflow-auto">
                                  {JSON.stringify(event.details, null, 2)}
                                </div>
                              </div>
                            )}
                        </div>
                      </div>

                      <div className="text-right ml-6">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                          {formatTimestamp(event.timestamp)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-500">
                          {new Date(event.timestamp).toLocaleDateString(
                            'pt-BR'
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Audit Trail */}
        <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
          <CardHeader className="border-b border-gray-100 dark:border-gray-700 pb-4">
            <CardTitle className="flex items-center gap-3 text-gray-900 dark:text-white">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              Audit Trail
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {auditLogs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <Clock className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Sem Atividade
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Nenhum log de auditoria encontrado
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    Os logs de auditoria aparecerão aqui quando ações forem
                    registradas
                  </p>
                </div>
              ) : (
                auditLogs.slice(0, 10).map(log => (
                  <div
                    key={log.id}
                    className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-16">
                                Ação:
                              </span>
                              <span className="text-sm text-gray-900 dark:text-white font-mono bg-white dark:bg-gray-800 px-3 py-1 rounded-lg border">
                                {log.action}
                              </span>
                            </div>

                            <div className="flex items-start gap-3">
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-16">
                                Recurso:
                              </span>
                              <span className="text-sm text-gray-900 dark:text-white">
                                {log.resource}
                              </span>
                            </div>

                            <div className="flex items-start gap-3">
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-16">
                                Usuário:
                              </span>
                              <span className="text-sm text-gray-900 dark:text-white font-mono bg-white dark:bg-gray-800 px-3 py-1 rounded-lg border">
                                {log.user_id}
                              </span>
                            </div>

                            {log.ip_address && (
                              <div className="flex items-start gap-3">
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-16">
                                  IP:
                                </span>
                                <span className="text-sm text-gray-900 dark:text-white font-mono bg-white dark:bg-gray-800 px-3 py-1 rounded-lg border">
                                  {log.ip_address}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right ml-6">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                          {formatTimestamp(log.timestamp)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-500">
                          {new Date(log.timestamp).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Loading overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl flex items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="text-lg font-medium text-gray-900 dark:text-white">
                Carregando dados de segurança...
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
