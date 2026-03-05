'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useToast } from '@/components/ui/toast';
import {
  Webhook,
  Plus,
  Trash2,
  Settings,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Copy,
  RefreshCw,
  Shield,
  Zap,
  Activity,
  Globe,
  Server,
  Key,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import PageHeader from '@/components/layouts/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface WebhookConfig {
  id?: string;
  webhookUrl: string;
  tipoWebhook: 'pix-pagamento' | 'boleto-pagamento';
  conta_corrente?: string;
  created_at?: string;
  updated_at?: string;
}

interface InterAuthResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  raw?: string;
}

export default function WebhooksPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const toast = useCallback((options: {
    title: string;
    description?: string;
    variant?: 'destructive';
  }) => {
    showToast({
      type: options.variant === 'destructive' ? 'error' : 'success',
      title: options.title,
      message: options.description,
      duration: 5000,
    });
  }, [showToast]);

  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [modalConfig, setModalConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigurando, setIsConfigurando] = useState(false);
  const [isTestandoAuth, setIsTestandoAuth] = useState(false);
  const [authResult, setAuthResult] = useState<InterAuthResponse | null>(null);
  const [novoWebhook, setNovoWebhook] = useState<WebhookConfig>({
    webhookUrl:
      'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/inter-webhook',
    tipoWebhook: 'pix-pagamento',
    conta_corrente: '',
  });

  useEffect(() => {
    setPageTitle('Configuração de Webhooks');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const carregarWebhooks = useCallback(async () => {
    setIsLoading(true);
    try {
      // Carregar webhook PIX
      const pixResponse = await fetch(
        `/api/financeiro/inter/webhook?bar_id=${selectedBar?.id}&tipoWebhook=pix-pagamento`
      );
      const pixData = await pixResponse.json();

      // Carregar webhook Boleto
      const boletoResponse = await fetch(
        `/api/financeiro/inter/webhook?bar_id=${selectedBar?.id}&tipoWebhook=boleto-pagamento`
      );
      const boletoData = await boletoResponse.json();

      const webhooksList: WebhookConfig[] = [];

      if (pixData.success && pixData.data) {
        webhooksList.push({
          ...pixData.data,
          tipoWebhook: 'pix-pagamento',
        });
      }

      if (boletoData.success && boletoData.data) {
        webhooksList.push({
          ...boletoData.data,
          tipoWebhook: 'boleto-pagamento',
        });
      }

      setWebhooks(webhooksList);
      console.log('📋 Webhooks carregados:', webhooksList);
    } catch (error) {
      console.error('❌ Erro ao carregar webhooks:', error);
      toast({
        title: 'Erro ao carregar webhooks',
        description: 'Tente novamente em alguns instantes',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    carregarWebhooks();
  }, [carregarWebhooks]);

  const testarAutenticacaoInter = async () => {
    setIsTestandoAuth(true);
    setAuthResult(null);

    try {
      console.log('🔐 Testando autenticação do Inter...');

      // Primeiro, buscar as credenciais do Inter
      const credenciaisResponse = await fetch(
        `/api/configuracoes/credenciais/inter?bar_id=${selectedBar?.id}`
      );
      const credenciaisData = await credenciaisResponse.json();

      if (!credenciaisData.success || !credenciaisData.data) {
        throw new Error('Credenciais do Inter não encontradas');
      }

      const credenciais = credenciaisData.data;
      console.log('✅ Credenciais encontradas:', {
        client_id: credenciais.client_id,
        client_secret: credenciais.client_secret ? '***' : 'não encontrado',
      });

      // Agora testar a autenticação com as credenciais
      const response = await fetch('/api/configuracoes/webhooks/inter-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bar_id: '3',
          client_id: credenciais.client_id,
          client_secret: credenciais.client_secret,
        }),
      });

      const data: InterAuthResponse = await response.json();
      setAuthResult(data);

      if (data.access_token) {
        toast({
          title: 'Autenticação bem-sucedida!',
          description: `Token obtido: ${data.access_token.substring(0, 20)}...`,
        });
        console.log('✅ Token do Inter:', {
          access_token: data.access_token.substring(0, 20) + '...',
          expires_in: data.expires_in,
          token_type: data.token_type,
        });
      } else if (data.error) {
        toast({
          title: 'Erro na autenticação',
          description: data.error,
          variant: 'destructive',
        });
      } else if (data.raw) {
        toast({
          title: 'Resposta inesperada',
          description: 'Verifique os logs para mais detalhes',
          variant: 'destructive',
        });
        console.log('📄 Resposta raw:', data.raw);
      }
    } catch (error) {
      console.error('❌ Erro ao testar autenticação:', error);
      toast({
        title: 'Erro ao testar autenticação',
        description: error instanceof Error ? error.message : 'Erro interno',
        variant: 'destructive',
      });
    } finally {
      setIsTestandoAuth(false);
    }
  };

  const configurarWebhook = async () => {
    if (!novoWebhook.webhookUrl || !novoWebhook.tipoWebhook) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    // Verificar se temos um token válido
    if (!authResult?.access_token) {
      toast({
        title: 'Token necessário',
        description:
          'Teste a autenticação do Inter primeiro para obter um token válido',
        variant: 'destructive',
      });
      return;
    }

    setIsConfigurando(true);
    try {
      console.log(
        '🔧 Configurando webhook com token:',
        authResult.access_token.substring(0, 20) + '...'
      );

      const response = await fetch('/api/financeiro/inter/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...novoWebhook,
          bar_id: '3',
          access_token: authResult.access_token, // Passar o token já obtido
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Webhook configurado!',
          description: `Webhook ${novoWebhook.tipoWebhook} configurado com sucesso`,
        });
        setModalConfig(false);
        carregarWebhooks();
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('❌ Erro ao configurar webhook:', error);
      toast({
        title: 'Erro ao configurar webhook',
        description:
          error instanceof Error ? error.message : 'Erro interno do servidor',
        variant: 'destructive',
      });
    } finally {
      setIsConfigurando(false);
    }
  };

  const copiarUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: 'URL copiada!',
      description: 'URL do webhook copiada para a área de transferência',
    });
  };

  const getStatusBadge = (webhook: WebhookConfig) => {
    if (webhook.webhookUrl) {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Ativo
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Não configurado
      </Badge>
    );
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'pix-pagamento':
        return 'PIX Pagamento';
      case 'boleto-pagamento':
        return 'Boleto Pagamento';
      default:
        return tipo;
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'pix-pagamento':
        return <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'boleto-pagamento':
        return (
          <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
        );
      default:
        return <Webhook className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getTipoDescription = (tipo: string) => {
    switch (tipo) {
      case 'pix-pagamento':
        return 'Receba notificações automáticas quando pagamentos PIX forem processados';
      case 'boleto-pagamento':
        return 'Receba notificações automáticas quando boletos forem pagos';
      default:
        return 'Receba notificações automáticas';
    }
  };

  // Métricas para sidebar
  const metricas = {
    total: webhooks.length,
    ativos: webhooks.filter(w => w.webhookUrl).length,
    pix: webhooks.filter(w => w.tipoWebhook === 'pix-pagamento' && w.webhookUrl)
      .length,
    boleto: webhooks.filter(
      w => w.tipoWebhook === 'boleto-pagamento' && w.webhookUrl
    ).length,
    naoConfigurados: 2 - webhooks.filter(w => w.webhookUrl).length,
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-6">
          <PageHeader
            title="Configuração de Webhooks"
            description="Configure webhooks para receber notificações automáticas do Inter"
          />

          <div className="flex gap-6">
            {/* Sidebar com Métricas */}
            <div className="w-80 flex-shrink-0">
              <Card className="card-dark border-0 shadow-lg sticky top-6">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">
                    Resumo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 dark:bg-gray-600 rounded-lg">
                        <Webhook className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Total
                      </span>
                    </div>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {metricas.total}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">
                        Ativos
                      </span>
                    </div>
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      {metricas.ativos}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        PIX
                      </span>
                    </div>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {metricas.pix}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">
                        Boleto
                      </span>
                    </div>
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      {metricas.boleto}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                        Não configurados
                      </span>
                    </div>
                    <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                      {metricas.naoConfigurados}
                    </span>
                  </div>

                  {/* Botões de Ação */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                    <Button
                      onClick={() => setModalConfig(true)}
                      className="w-full btn-primary"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Configurar Webhook
                    </Button>

                    <Button
                      onClick={testarAutenticacaoInter}
                      disabled={isTestandoAuth}
                      variant="outline"
                      className="w-full btn-outline"
                    >
                      <Key
                        className={`w-4 h-4 mr-2 ${isTestandoAuth ? 'animate-spin' : ''}`}
                      />
                      {isTestandoAuth ? 'Testando...' : 'Testar Auth Inter'}
                    </Button>

                    <Button
                      onClick={carregarWebhooks}
                      disabled={isLoading}
                      variant="outline"
                      className="w-full btn-outline"
                    >
                      <RefreshCw
                        className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
                      />
                      Atualizar
                    </Button>
                  </div>

                  {/* Resultado do Teste de Auth */}
                  {authResult && (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            Teste de Auth
                          </span>
                        </div>
                        {authResult.access_token ? (
                          <div className="space-y-1">
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              ✅ Token:{' '}
                              {authResult.access_token.substring(0, 20)}...
                            </p>
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              Tipo: {authResult.token_type}
                            </p>
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              Expira em: {authResult.expires_in}s
                            </p>
                          </div>
                        ) : authResult.error ? (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            ❌ {authResult.error}
                          </p>
                        ) : (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400">
                            ⚠️ Resposta inesperada
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Info Cards */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          Seguro
                        </span>
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        IPs validados pelo Inter
                      </p>
                    </div>

                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">
                          Automático
                        </span>
                      </div>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Atualização em tempo real
                      </p>
                    </div>

                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Server className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                          Confiável
                        </span>
                      </div>
                      <p className="text-xs text-purple-600 dark:text-purple-400">
                        99.9% uptime no Supabase
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Conteúdo Principal */}
            <div className="flex-1">
              <Card className="card-dark border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">
                    Webhooks Configurados
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400">
                    Gerencie as configurações de webhooks para PIX e Boleto
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="pix" className="w-full">
                    <TabsList className="tabs-list-dark h-12">
                      <TabsTrigger
                        value="pix"
                        className="tabs-trigger-dark text-base px-6"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        PIX Pagamento
                      </TabsTrigger>
                      <TabsTrigger
                        value="boleto"
                        className="tabs-trigger-dark text-base px-6"
                      >
                        <Activity className="w-4 h-4 mr-2" />
                        Boleto Pagamento
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="pix" className="mt-6">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-center">
                            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600 dark:text-blue-400" />
                            <p className="text-gray-600 dark:text-gray-400">
                              Carregando webhooks...
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {webhooks
                            .filter(w => w.tipoWebhook === 'pix-pagamento')
                            .map((webhook, index) => (
                            <div
                              key={index}
                              className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-6"
                            >
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                                        {getTipoLabel(webhook.tipoWebhook)}
                                      </h3>
                                      {getStatusBadge(webhook)}
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                      {getTipoDescription(webhook.tipoWebhook)}
                                    </p>
                                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                                      <p className="text-sm font-mono text-gray-900 dark:text-white break-all">
                                        {webhook.webhookUrl ||
                                          'Não configurado'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-4">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        copiarUrl(webhook.webhookUrl)
                                      }
                                      className="btn-outline"
                                    >
                                      <Copy className="w-4 h-4 mr-1" />
                                      Copiar
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        window.open(
                                          webhook.webhookUrl,
                                          '_blank'
                                        )
                                      }
                                      className="btn-outline"
                                    >
                                      <ExternalLink className="w-4 h-4 mr-1" />
                                      Testar
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}

                          {webhooks.filter(
                            w => w.tipoWebhook === 'pix-pagamento'
                          ).length === 0 && (
                            <div className="text-center py-16">
                              <div className="bg-gray-100 dark:bg-gray-700 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                                <Webhook className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                Nenhum webhook PIX configurado
                              </h3>
                              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                                Configure um webhook para receber notificações
                                automáticas de pagamentos PIX
                              </p>
                              <Button
                                onClick={() => setModalConfig(true)}
                                className="btn-primary"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Configurar Webhook PIX
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="boleto" className="mt-6">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-center">
                            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600 dark:text-green-400" />
                            <p className="text-gray-600 dark:text-gray-400">
                              Carregando webhooks...
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {webhooks
                            .filter(w => w.tipoWebhook === 'boleto-pagamento')
                            .map((webhook, index) => (
                            <div
                              key={index}
                              className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-6"
                            >
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                                        {getTipoLabel(webhook.tipoWebhook)}
                                      </h3>
                                      {getStatusBadge(webhook)}
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                      {getTipoDescription(webhook.tipoWebhook)}
                                    </p>
                                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                                      <p className="text-sm font-mono text-gray-900 dark:text-white break-all">
                                        {webhook.webhookUrl ||
                                          'Não configurado'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-4">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        copiarUrl(webhook.webhookUrl)
                                      }
                                      className="btn-outline"
                                    >
                                      <Copy className="w-4 h-4 mr-1" />
                                      Copiar
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        window.open(
                                          webhook.webhookUrl,
                                          '_blank'
                                        )
                                      }
                                      className="btn-outline"
                                    >
                                      <ExternalLink className="w-4 h-4 mr-1" />
                                      Testar
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}

                          {webhooks.filter(
                            w => w.tipoWebhook === 'boleto-pagamento'
                          ).length === 0 && (
                            <div className="text-center py-16">
                              <div className="bg-gray-100 dark:bg-gray-700 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                                <Webhook className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                Nenhum webhook Boleto configurado
                              </h3>
                              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                                Configure um webhook para receber notificações
                                automáticas de pagamentos de boleto
                              </p>
                              <Button
                                onClick={() => setModalConfig(true)}
                                className="btn-primary"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Configurar Webhook Boleto
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Modal de Configuração */}
        <Dialog open={modalConfig} onOpenChange={setModalConfig}>
          <DialogContent className="modal-dark max-w-md">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white text-xl">
                Configurar Webhook
              </DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                Configure um novo webhook para receber notificações do Inter
              </DialogDescription>
              {!authResult?.access_token && (
                <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-sm text-yellow-700 dark:text-yellow-300">
                      Teste a autenticação do Inter primeiro para obter um token
                      válido
                    </span>
                  </div>
                </div>
              )}
            </DialogHeader>

            <div className="space-y-6">
              <div>
                <Label
                  htmlFor="tipoWebhook"
                  className="text-gray-900 dark:text-white font-medium"
                >
                  Tipo de Webhook
                </Label>
                <Select
                  value={novoWebhook.tipoWebhook}
                  onValueChange={(
                    value: 'pix-pagamento' | 'boleto-pagamento'
                  ) =>
                    setNovoWebhook(prev => ({ ...prev, tipoWebhook: value }))
                  }
                >
                  <SelectTrigger className="select-dark h-12">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="pix-pagamento"
                      className="flex items-center gap-2"
                    >
                      <Zap className="w-4 h-4" />
                      PIX Pagamento
                    </SelectItem>
                    <SelectItem
                      value="boleto-pagamento"
                      className="flex items-center gap-2"
                    >
                      <Activity className="w-4 h-4" />
                      Boleto Pagamento
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label
                  htmlFor="webhookUrl"
                  className="text-gray-900 dark:text-white font-medium"
                >
                  URL do Webhook
                </Label>
                <Input
                  id="webhookUrl"
                  type="url"
                  value={novoWebhook.webhookUrl}
                  onChange={e =>
                    setNovoWebhook(prev => ({
                      ...prev,
                      webhookUrl: e.target.value,
                    }))
                  }
                  placeholder="https://exemplo.com/webhook"
                  className="input-dark h-12"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  URL que receberá as notificações do Inter
                </p>
              </div>

              <div>
                <Label
                  htmlFor="conta_corrente"
                  className="text-gray-900 dark:text-white font-medium"
                >
                  Conta Corrente (Opcional)
                </Label>
                <Input
                  id="conta_corrente"
                  type="text"
                  value={novoWebhook.conta_corrente || ''}
                  onChange={e =>
                    setNovoWebhook(prev => ({
                      ...prev,
                      conta_corrente: e.target.value,
                    }))
                  }
                  placeholder="123456789"
                  className="input-dark h-12"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Necessário apenas se a aplicação estiver associada a múltiplas
                  contas
                </p>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                variant="outline"
                onClick={() => setModalConfig(false)}
                className="btn-outline"
              >
                Cancelar
              </Button>
              <Button
                onClick={configurarWebhook}
                disabled={isConfigurando || !authResult?.access_token}
                className={
                  authResult?.access_token ? 'btn-primary' : 'btn-secondary'
                }
              >
                {isConfigurando ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Configurando...
                  </>
                ) : !authResult?.access_token ? (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    Token Necessário
                  </>
                ) : (
                  <>
                    <Settings className="w-4 h-4 mr-2" />
                    Configurar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
