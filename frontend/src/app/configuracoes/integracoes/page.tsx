'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowLeft,
  Database,
  Zap,
  MessageSquare,
  CreditCard,
  BarChart3,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBar } from '@/contexts/BarContext';
// import NiboIntegrationCard from '@/components/configuracoes/NiboIntegrationCard'; // DESATIVADO - Migrado para Conta Azul
import ContaAzulIntegrationCard from '@/components/configuracoes/ContaAzulIntegrationCard';
import ContaHubResyncSemanalCard from '@/components/configuracoes/ContaHubResyncSemanalCard';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  enabled: boolean;
  config?: Record<string, any>;
}

export default function IntegracoesPage() {
  const router = useRouter();
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'contahub',
      name: 'ContaHub',
      description: 'IntegraÃ§Ã£o com sistema ContaHub para dados financeiros',
      icon: Database,
      status: 'connected',
      lastSync: '2024-01-15T10:30:00Z',
      enabled: true,
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      description: 'NotificaÃ§Ãµes e mensagens via WhatsApp',
      icon: MessageSquare,
      status: 'connected',
      lastSync: '2024-01-15T09:45:00Z',
      enabled: true,
    },
    {
      id: 'sympla',
      name: 'Sympla',
      description: 'IntegraÃ§Ã£o com Sympla para eventos e ingressos',
      icon: Zap,
      status: 'connected',
      lastSync: '2024-01-15T08:20:00Z',
      enabled: true,
    },
    {
      id: 'yuzer',
      name: 'Yuzer',
      description: 'Sistema de ingressos e controle de acesso',
      icon: CreditCard,
      status: 'disconnected',
      enabled: false,
    },
    {
      id: 'getin',
      name: 'GetIn',
      description: 'Sistema de reservas e gestÃ£o de mesas',
      icon: BarChart3,
      status: 'error',
      lastSync: '2024-01-14T15:30:00Z',
      enabled: true,
    },
  ]);

  useEffect(() => {
    // Simular carregamento
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700';
      case 'disconnected':
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4" />;
      case 'disconnected':
        return <XCircle className="w-4 h-4" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <XCircle className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Conectado';
      case 'disconnected':
        return 'Desconectado';
      case 'error':
        return 'Erro';
      default:
        return 'Desconhecido';
    }
  };

  const handleToggleIntegration = async (integrationId: string, enabled: boolean) => {
    try {
      setIntegrations(prev => 
        prev.map(integration => 
          integration.id === integrationId 
            ? { ...integration, enabled, status: enabled ? 'connected' : 'disconnected' }
            : integration
        )
      );

      toast({
        title: enabled ? 'âœ… IntegraÃ§Ã£o ativada' : 'âš ï¸ IntegraÃ§Ã£o desativada',
        description: `A integraÃ§Ã£o foi ${enabled ? 'ativada' : 'desativada'} com sucesso.`,
      });
    } catch (error) {
      toast({
        title: 'âŒ Erro',
        description: 'Erro ao alterar status da integraÃ§Ã£o',
        variant: 'destructive',
      });
    }
  };

  const handleTestIntegration = async (integrationId: string) => {
    try {
      toast({
        title: 'ðŸ”„ Testando integraÃ§Ã£o...',
        description: 'Verificando conexÃ£o com o serviÃ§o.',
      });

      // Simular teste
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast({
        title: 'âœ… Teste concluÃ­do',
        description: 'IntegraÃ§Ã£o funcionando corretamente.',
      });
    } catch (error) {
      toast({
        title: 'âŒ Teste falhou',
        description: 'Erro ao testar a integraÃ§Ã£o',
        variant: 'destructive',
      });
    }
  };

  const formatLastSync = (dateString?: string) => {
    if (!dateString) return 'Nunca';
    
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Carregando integraÃ§Ãµes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="card-dark p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => router.push('/configuracoes')}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  IntegraÃ§Ãµes
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Gerencie todas as integraÃ§Ãµes com sistemas externos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                {integrations.filter(i => i.status === 'connected').length} ativas
              </Badge>
            </div>
          </div>
        </div>


        {/* Integracoes Financeiras */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Integracoes Financeiras
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ContaAzulIntegrationCard selectedBar={selectedBar} />
            {/* <NiboIntegrationCard selectedBar={selectedBar} /> */}
            {/* NIBO DESATIVADO - Sistema migrado para Conta Azul */}
          </div>
        </div>
        {/* Lista de IntegraÃ§Ãµes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {integrations.map((integration) => (
            <Card key={integration.id} className="card-dark shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                      <integration.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                        {integration.name}
                      </CardTitle>
                      <CardDescription className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {integration.description}
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge 
                      className={`${getStatusColor(integration.status)} border text-xs font-medium`}
                      variant="outline"
                    >
                      <div className="flex items-center gap-1">
                        {getStatusIcon(integration.status)}
                        {getStatusText(integration.status)}
                      </div>
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="space-y-4">
                  {/* Status e Ãºltima sincronizaÃ§Ã£o */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Ãšltima sincronizaÃ§Ã£o
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {formatLastSync(integration.lastSync)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {integration.enabled ? 'Ativo' : 'Inativo'}
                      </span>
                      <Switch
                        checked={integration.enabled}
                        onCheckedChange={(checked) => handleToggleIntegration(integration.id, checked)}
                      />
                    </div>
                  </div>

                  {/* AÃ§Ãµes */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestIntegration(integration.id)}
                      disabled={!integration.enabled}
                      className="flex-1"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Testar ConexÃ£o
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/configuracoes/integracoes/${integration.id}`)}
                      className="flex-1"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Configurar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ContaHub Re-Sync Semanal */}
        <div className="mt-8">
          <ContaHubResyncSemanalCard />
        </div>

        {/* EstatÃ­sticas */}
        <div className="mt-8">
          <Card className="card-dark">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                EstatÃ­sticas das IntegraÃ§Ãµes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {integrations.filter(i => i.status === 'connected').length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Conectadas</div>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {integrations.filter(i => i.status === 'error').length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Com Erro</div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                    {integrations.filter(i => i.status === 'disconnected').length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Desconectadas</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
