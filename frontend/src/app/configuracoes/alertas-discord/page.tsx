'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell, 
  Save, 
  Send, 
  CheckCircle, 
  XCircle,
  RefreshCcw,
  Clock,
  AlertTriangle,
  TrendingUp,
  Package,
  Users,
  Sparkles,
  Settings,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';

interface WebhookConfig {
  id?: number;
  tipo: string;
  webhook_url: string;
  ativo: boolean;
  descricao: string;
}

interface AlertaConfig {
  tipo: string;
  label: string;
  descricao: string;
  icon: React.ReactNode;
  ativo: boolean;
}

export default function AlertasDiscordPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookAtivo, setWebhookAtivo] = useState(true);
  
  const [alertasConfig, setAlertasConfig] = useState<AlertaConfig[]>([
    { tipo: 'faturamento', label: 'Faturamento', descricao: 'Alertas de meta não batida ou superada', icon: <TrendingUp className="w-4 h-4" />, ativo: true },
    { tipo: 'cmv', label: 'CMV', descricao: 'Alertas de CMV acima do limite', icon: <AlertTriangle className="w-4 h-4" />, ativo: true },
    { tipo: 'clientes', label: 'Clientes', descricao: 'Variações significativas no fluxo', icon: <Users className="w-4 h-4" />, ativo: true },
    { tipo: 'estoque', label: 'Estoque', descricao: 'Anomalias e alertas de contagem', icon: <Package className="w-4 h-4" />, ativo: true },
    { tipo: 'insights', label: 'Insights IA', descricao: 'Insights gerados pela IA', icon: <Sparkles className="w-4 h-4" />, ativo: true }
  ]);

  const [horarioRelatorio, setHorarioRelatorio] = useState('07:00');
  const [relatorioMatinalAtivo, setRelatorioMatinalAtivo] = useState(true);

  useEffect(() => {
    setPageTitle('🔔 Alertas Discord');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    loadConfig();
  }, [selectedBar?.id]);

  const loadConfig = async () => {
    if (!selectedBar?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/configuracoes/discord/webhook?bar_id=${selectedBar.id}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setWebhookUrl(result.data.webhook_url || '');
        setWebhookAtivo(result.data.ativo ?? true);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedBar?.id) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/configuracoes/discord/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: selectedBar.id,
          tipo: 'alertas',
          webhook_url: webhookUrl,
          ativo: webhookAtivo
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Configuração salva com sucesso!');
      } else {
        toast.error(result.error || 'Erro ao salvar');
      }
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!webhookUrl) {
      toast.error('Configure a URL do webhook primeiro');
      return;
    }
    
    setTesting('webhook');
    try {
      const response = await fetch('/api/configuracoes/discord/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook_url: webhookUrl })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Mensagem de teste enviada! Verifique o Discord.');
      } else {
        toast.error(result.error || 'Erro ao enviar teste');
      }
    } catch (error) {
      toast.error('Erro ao testar webhook');
    } finally {
      setTesting(null);
    }
  };

  const handleTestAnalise = async () => {
    if (!selectedBar?.id) return;
    
    setTesting('analise');
    try {
      const response = await fetch('/api/alertas-inteligentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analisar',
          barId: selectedBar.id,
          enviarDiscord: true
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(`Análise enviada! ${result.resultado?.alertas?.length || 0} alertas detectados.`);
      } else {
        toast.error(result.error || 'Erro na análise');
      }
    } catch (error) {
      toast.error('Erro ao executar análise');
    } finally {
      setTesting(null);
    }
  };

  const toggleAlerta = (tipo: string) => {
    setAlertasConfig(prev => 
      prev.map(a => a.tipo === tipo ? { ...a, ativo: !a.ativo } : a)
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <RefreshCcw className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-[#5865F2] rounded-xl shadow-lg">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Alertas Discord
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Configure alertas inteligentes via Discord
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="webhook" className="space-y-6">
          <TabsList className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <TabsTrigger value="webhook" className="data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900/30">
              <Settings className="w-4 h-4 mr-2" />
              Webhook
            </TabsTrigger>
            <TabsTrigger value="alertas" className="data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900/30">
              <Bell className="w-4 h-4 mr-2" />
              Tipos de Alerta
            </TabsTrigger>
            <TabsTrigger value="automacao" className="data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900/30">
              <Clock className="w-4 h-4 mr-2" />
              Automação
            </TabsTrigger>
          </TabsList>

          {/* Tab Webhook */}
          <TabsContent value="webhook">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                  <div className="p-2 bg-[#5865F2] rounded-lg">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                  </div>
                  Configuração do Webhook
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Configure o webhook do Discord para receber alertas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300">URL do Webhook</Label>
                  <Input
                    placeholder="https://discord.com/api/webhooks/..."
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600"
                  />
                  <p className="text-xs text-gray-500">
                    Crie um webhook em: Servidor → Configurações → Integrações → Webhooks → Novo Webhook
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Webhook Ativo</p>
                    <p className="text-sm text-gray-500">Receber alertas neste canal</p>
                  </div>
                  <Switch
                    checked={webhookAtivo}
                    onCheckedChange={setWebhookAtivo}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {saving ? (
                      <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Salvar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleTest}
                    disabled={testing === 'webhook' || !webhookUrl}
                    className="border-[#5865F2] text-[#5865F2] hover:bg-[#5865F2]/10"
                  >
                    {testing === 'webhook' ? (
                      <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Testar Webhook
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Tipos de Alerta */}
          <TabsContent value="alertas">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Tipos de Alerta</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Escolha quais alertas deseja receber
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {alertasConfig.map((alerta) => (
                  <div 
                    key={alerta.tipo}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                        {alerta.icon}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{alerta.label}</p>
                        <p className="text-sm text-gray-500">{alerta.descricao}</p>
                      </div>
                    </div>
                    <Switch
                      checked={alerta.ativo}
                      onCheckedChange={() => toggleAlerta(alerta.tipo)}
                    />
                  </div>
                ))}

                <div className="pt-4">
                  <Button
                    onClick={handleTestAnalise}
                    disabled={testing === 'analise'}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                  >
                    {testing === 'analise' ? (
                      <>
                        <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Executar Análise Agora e Enviar para Discord
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Automação */}
          <TabsContent value="automacao">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Automação</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Configure envio automático de relatórios
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Relatório Matinal</p>
                    <p className="text-sm text-gray-500">Resumo diário enviado automaticamente</p>
                  </div>
                  <Switch
                    checked={relatorioMatinalAtivo}
                    onCheckedChange={setRelatorioMatinalAtivo}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300">Horário do Relatório</Label>
                  <Input
                    type="time"
                    value={horarioRelatorio}
                    onChange={(e) => setHorarioRelatorio(e.target.value)}
                    className="w-32 bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600"
                  />
                  <p className="text-xs text-gray-500">
                    O relatório será enviado diariamente neste horário
                  </p>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                    📊 O que inclui o relatório matinal:
                  </h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Faturamento de ontem vs meta</li>
                    <li>• Progresso mensal da meta</li>
                    <li>• Quantidade de clientes</li>
                    <li>• Alertas pendentes</li>
                    <li>• Status geral (verde/amarelo/vermelho)</li>
                  </ul>
                </div>

                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {saving ? (
                    <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Salvar Configurações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
