'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  MessageCircle, 
  Save, 
  RefreshCcw, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
  Phone,
  Shield,
  Zap,
  Settings
} from 'lucide-react';

interface WhatsAppConfig {
  id?: string;
  phone_number_id: string;
  access_token: string;
  api_version: string;
  rate_limit_per_minute: number;
  template_prefix: string;
  idioma: string;
  max_retry_attempts: number;
  retry_delay_seconds: number;
  ativo: boolean;
  configurado?: boolean;
}

interface TesteResult {
  success: boolean;
  mensagem?: string;
  error?: string;
  dados_telefone?: {
    id: string;
    display_phone_number: string;
    verified_name: string;
    quality_rating: string;
  };
}

export default function WhatsAppConfigPage() {
  const [config, setConfig] = useState<WhatsAppConfig>({
    phone_number_id: '',
    access_token: '',
    api_version: 'v18.0',
    rate_limit_per_minute: 80,
    template_prefix: 'DBO',
    idioma: 'pt_BR',
    max_retry_attempts: 3,
    retry_delay_seconds: 60,
    ativo: true
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testeResult, setTesteResult] = useState<TesteResult | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [configurado, setConfigurado] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/crm/whatsapp-config');
      const result = await response.json();

      if (result.success && result.data) {
        setConfig(prev => ({
          ...prev,
          ...result.data,
          // Manter o token em branco se for mascarado
          access_token: result.data.access_token?.startsWith('***') ? '' : (result.data.access_token || '')
        }));
        setConfigurado(result.configurado);
      }
    } catch (error) {
      console.error('Erro ao carregar config:', error);
    } finally {
      setLoading(false);
    }
  };

  const salvarConfig = async () => {
    if (!config.phone_number_id || !config.access_token) {
      alert('Phone Number ID e Access Token são obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/crm/whatsapp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const result = await response.json();

      if (result.success) {
        alert(result.mensagem);
        setConfigurado(true);
        fetchConfig();
      } else {
        alert(`Erro: ${result.error}`);
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const testarConexao = async () => {
    if (!config.phone_number_id || !config.access_token) {
      alert('Preencha Phone Number ID e Access Token para testar');
      return;
    }

    setTesting(true);
    setTesteResult(null);

    try {
      const response = await fetch('/api/crm/whatsapp-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: config.phone_number_id,
          access_token: config.access_token,
          api_version: config.api_version
        })
      });

      const result = await response.json();
      setTesteResult(result);
    } catch (error) {
      console.error('Erro ao testar:', error);
      setTesteResult({ success: false, error: 'Erro de conexão' });
    } finally {
      setTesting(false);
    }
  };

  const getQualityBadge = (quality: string) => {
    switch (quality?.toUpperCase()) {
      case 'GREEN':
        return <Badge className="bg-green-600">🟢 Alta Qualidade</Badge>;
      case 'YELLOW':
        return <Badge className="bg-yellow-600">🟡 Qualidade Média</Badge>;
      case 'RED':
        return <Badge className="bg-red-600">🔴 Baixa Qualidade</Badge>;
      default:
        return <Badge className="bg-gray-500">{quality || 'N/A'}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <RefreshCcw className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <MessageCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Configuração WhatsApp
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Configure a integração com WhatsApp Business API
              </p>
            </div>
          </div>
          
          {configurado ? (
            <Badge className="bg-green-600">
              <CheckCircle className="w-3 h-3 mr-1" />
              Configurado
            </Badge>
          ) : (
            <Badge className="bg-orange-500">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Não Configurado
            </Badge>
          )}
        </div>

        {/* Instruções */}
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mb-6">
          <CardContent className="p-6">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
              📋 Como obter as credenciais:
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <li>Acesse o <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Meta for Developers</a></li>
              <li>Vá em seu App → WhatsApp → Configuração da API</li>
              <li>Copie o <strong>Phone Number ID</strong> (número de telefone)</li>
              <li>Gere um <strong>Access Token</strong> permanente ou temporário</li>
              <li>Cole as credenciais abaixo e teste a conexão</li>
            </ol>
            <a 
              href="https://developers.facebook.com/apps" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-blue-700 dark:text-blue-300 font-medium hover:underline"
            >
              Abrir Meta for Developers
              <ExternalLink className="w-4 h-4" />
            </a>
          </CardContent>
        </Card>

        {/* Form de Configuração */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Credenciais da API
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Informações necessárias para conectar ao WhatsApp Business API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Phone Number ID */}
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                Phone Number ID *
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={config.phone_number_id}
                    onChange={(e) => setConfig(prev => ({ ...prev, phone_number_id: e.target.value }))}
                    placeholder="123456789012345"
                    className="pl-10 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Encontrado em: App → WhatsApp → Configuração da API → ID do número de telefone
              </p>
            </div>

            {/* Access Token */}
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                Access Token *
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type={showToken ? 'text' : 'password'}
                    value={config.access_token}
                    onChange={(e) => setConfig(prev => ({ ...prev, access_token: e.target.value }))}
                    placeholder="EAAG..."
                    className="pl-10 pr-10 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Token de acesso permanente ou temporário da API
              </p>
            </div>

            {/* Versão da API */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                  Versão da API
                </label>
                <Select 
                  value={config.api_version} 
                  onValueChange={(value) => setConfig(prev => ({ ...prev, api_version: value }))}
                >
                  <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="v18.0">v18.0 (Recomendado)</SelectItem>
                    <SelectItem value="v19.0">v19.0</SelectItem>
                    <SelectItem value="v20.0">v20.0</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                  Rate Limit (msgs/min)
                </label>
                <Input
                  type="number"
                  value={config.rate_limit_per_minute}
                  onChange={(e) => setConfig(prev => ({ ...prev, rate_limit_per_minute: parseInt(e.target.value) || 80 }))}
                  min={1}
                  max={200}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
              </div>
            </div>

            {/* Botão de Teste */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={testarConexao}
                disabled={testing || !config.phone_number_id || !config.access_token}
                variant="outline"
                className="bg-white dark:bg-gray-700"
              >
                {testing ? (
                  <>
                    <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                    Testando...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Testar Conexão
                  </>
                )}
              </Button>

              <Button
                onClick={salvarConfig}
                disabled={saving || !config.phone_number_id || !config.access_token}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {saving ? (
                  <>
                    <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Configuração
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resultado do Teste */}
        {testeResult && (
          <Card className={`mb-6 ${
            testeResult.success 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                {testeResult.success ? (
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 mt-1" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 mt-1" />
                )}
                
                <div className="flex-1">
                  <h3 className={`font-semibold mb-2 ${
                    testeResult.success 
                      ? 'text-green-900 dark:text-green-100'
                      : 'text-red-900 dark:text-red-100'
                  }`}>
                    {testeResult.success ? 'Conexão Estabelecida!' : 'Erro na Conexão'}
                  </h3>

                  {testeResult.success && testeResult.dados_telefone && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-green-700 dark:text-green-300">Telefone:</span>
                        <span className="font-mono text-green-900 dark:text-green-100">
                          {testeResult.dados_telefone.display_phone_number}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-700 dark:text-green-300">Nome Verificado:</span>
                        <span className="font-medium text-green-900 dark:text-green-100">
                          {testeResult.dados_telefone.verified_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-700 dark:text-green-300">Qualidade:</span>
                        {getQualityBadge(testeResult.dados_telefone.quality_rating)}
                      </div>
                    </div>
                  )}

                  {!testeResult.success && (
                    <p className="text-red-800 dark:text-red-200 text-sm">
                      {testeResult.error}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Configurações Avançadas */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configurações Avançadas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                  Prefixo dos Cupons
                </label>
                <Input
                  value={config.template_prefix}
                  onChange={(e) => setConfig(prev => ({ ...prev, template_prefix: e.target.value.toUpperCase() }))}
                  placeholder="DBO"
                  maxLength={5}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                  Idioma
                </label>
                <Select 
                  value={config.idioma} 
                  onValueChange={(value) => setConfig(prev => ({ ...prev, idioma: value }))}
                >
                  <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt_BR">Português (Brasil)</SelectItem>
                    <SelectItem value="en_US">English (US)</SelectItem>
                    <SelectItem value="es_ES">Español</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                  Tentativas de Reenvio
                </label>
                <Input
                  type="number"
                  value={config.max_retry_attempts}
                  onChange={(e) => setConfig(prev => ({ ...prev, max_retry_attempts: parseInt(e.target.value) || 3 }))}
                  min={0}
                  max={10}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                  Delay entre Reenvios (seg)
                </label>
                <Input
                  type="number"
                  value={config.retry_delay_seconds}
                  onChange={(e) => setConfig(prev => ({ ...prev, retry_delay_seconds: parseInt(e.target.value) || 60 }))}
                  min={10}
                  max={300}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info sobre limites */}
        <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 mt-6">
          <CardContent className="p-6">
            <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Limites do WhatsApp Business
            </h3>
            <ul className="space-y-2 text-sm text-yellow-800 dark:text-yellow-200">
              <li>• <strong>Mensagens proativas:</strong> Requerem templates aprovados pelo WhatsApp</li>
              <li>• <strong>Rate limit:</strong> Varia conforme qualidade da conta (80-1000 msgs/min)</li>
              <li>• <strong>Custo:</strong> ~R$0,30 por mensagem (pode variar)</li>
              <li>• <strong>Opt-in:</strong> Clientes devem ter concordado em receber mensagens</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
