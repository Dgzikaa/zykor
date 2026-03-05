'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Shield, Search, Download, Filter } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { api } from '@/lib/api-client';

interface AuditLog {
  id: number;
  user_id: number;
  action: string;
  resource: string;
  resource_id?: string;
  changes?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export default function AuditoriaPage() {
  const { setPageTitle } = usePageTitle();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    resource: '',
    user_id: '',
  });

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    setPageTitle('🛡️ Auditoria');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.action) params.append('action', filters.action);
      if (filters.resource) params.append('resource', filters.resource);
      if (filters.user_id) params.append('user_id', filters.user_id);
      
      const data = await api.get(`/api/configuracoes/auditoria?${params.toString()}`);
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      LOGIN: 'bg-green-500',
      LOGOUT: 'bg-gray-500',
      CREATE: 'bg-blue-500',
      UPDATE: 'bg-yellow-500',
      DELETE: 'bg-red-500',
      LIST: 'bg-purple-500',
    };
    
    const actionType = action.split('_')[0];
    const color = colors[actionType] || 'bg-gray-500';
    
    return <Badge className={color}>{action}</Badge>;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('pt-BR');
  };

  return (
    <div className="min-h-[calc(100vh-8px)] bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-2 py-1 pb-6 max-w-[98vw]">
        <div className="space-y-4">
        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Ação</label>
                <Input
                  placeholder="Ex: LOGIN, CREATE_USUARIO"
                  value={filters.action}
                  onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Recurso</label>
                <Input
                  placeholder="Ex: usuarios, bares"
                  value={filters.resource}
                  onChange={(e) => setFilters({ ...filters, resource: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">ID do Usuário</label>
                <Input
                  placeholder="Ex: 123"
                  type="number"
                  value={filters.user_id}
                  onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={loadLogs} className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Buscar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFilters({ action: '', resource: '', user_id: '' });
                  loadLogs();
                }}
              >
                Limpar Filtros
              </Button>
              <Button variant="outline" className="ml-auto flex items-center gap-2">
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Logs de Auditoria</CardTitle>
            <CardDescription>
              {logs.length} registro(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
                <p className="mt-4 text-sm text-gray-500">Carregando logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhum log encontrado
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getActionBadge(log.action)}
                          <span className="text-sm font-medium">{log.resource}</span>
                          {log.resource_id && (
                            <span className="text-xs text-gray-500">
                              ID: {log.resource_id}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          <p>Usuário ID: {log.user_id}</p>
                          {log.ip_address && <p>IP: {log.ip_address}</p>}
                          {log.changes && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-blue-600 hover:text-blue-700">
                                Ver detalhes
                              </summary>
                              <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto">
                                {JSON.stringify(log.changes, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        {formatDate(log.created_at)}
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
    </div>
  );
}
