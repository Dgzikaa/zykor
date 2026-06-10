'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLGPD, ConsentType } from '@/hooks/useLGPD';
import { useToast } from '@/hooks/use-toast';

interface UserData {
  id: string;
  email: string;
  nome: string;
  telefone?: string;
  data_nascimento?: string;
  cpf?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  preferencias_privacidade?: Record<string, boolean>;
  lastLogin?: string;
  createdAt?: string;
  loginCount?: number;
}

export default function PrivacidePage() {
  const {
    settings,
    hasConsent,
    grantConsent,
    revokeConsent,
    exerciseRights,
    isLoading,
  } = useLGPD();

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('consents');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Carregar dados do usuário
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const data = await exerciseRights.accessData();
        setUserData(data as UserData);
      } catch {
        console.error('Erro ao carregar dados do usuário');
      }
    };

    if (activeTab === 'data') {
      loadUserData();
    }
  }, [activeTab, exerciseRights]);

  const handleConsentChange = async (type: ConsentType, granted: boolean) => {
    try {
      if (granted) {
        await grantConsent(type);
      } else {
        await revokeConsent(type);
      }

      toast({
        title: 'Preferência atualizada',
        description: `Cookie ${type} ${granted ? 'ativado' : 'desativado'} com sucesso.`,
      });
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a preferência.',
        variant: 'destructive',
      });
    }
  };

  const handleDataPortability = async () => {
    try {
      setLoadingAction('portability');
      const blob = await exerciseRights.portabilityData();

      // Download do arquivo
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meus-dados-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Download iniciado',
        description: 'Seus dados foram baixados com sucesso.',
      });
    } catch {
      toast({
        title: 'Erro no download',
        description: 'Não foi possível baixar seus dados.',
        variant: 'destructive',
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDataDeletion = async () => {
    if (
      !confirm(
        '⚠️ ATENÇÃO: Esta ação irá EXCLUIR PERMANENTEMENTE todos os seus dados. Esta ação é IRREVERSÍVEL. Deseja continuar?'
      )
    ) {
      return;
    }

    if (
      !confirm(
        'Confirme novamente: Você tem CERTEZA que deseja excluir todos os seus dados? Esta ação não pode ser desfeita.'
      )
    ) {
      return;
    }

    try {
      setLoadingAction('deletion');
      await exerciseRights.deleteData();

      toast({
        title: 'Dados excluídos',
        description: 'Todos os seus dados foram removidos permanentemente.',
      });

      // A página será recarregada automaticamente pelo hook
    } catch {
      toast({
        title: 'Erro na exclusão',
        description: 'Não foi possível excluir seus dados.',
        variant: 'destructive',
      });
      setLoadingAction(null);
    }
  };

  const cookieInfo = [
    {
      type: 'essential' as ConsentType,
      name: 'Essenciais',
      description: 'Necessários para funcionamento básico',
      icon: '🔒',
      color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
      required: true,
    },
    {
      type: 'analytics' as ConsentType,
      name: 'Analytics',
      description: 'Análise de uso e performance',
      icon: '📊',
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
      required: false,
    },
    {
      type: 'marketing' as ConsentType,
      name: 'Marketing',
      description: 'Anúncios personalizados',
      icon: '📢',
      color:
        'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
      required: false,
    },
    {
      type: 'preferences' as ConsentType,
      name: 'Preferências',
      description: 'Configurações pessoais',
      icon: '⚙️',
      color:
        'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      required: false,
    },
    {
      type: 'functional' as ConsentType,
      name: 'Funcionais',
      description: 'Recursos extras e melhorias',
      icon: '🔧',
      color:
        'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300',
      required: false,
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-6">
          <Card className="card-dark">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 bg-gray-200 dark:bg-gray-700 rounded"
                    ></div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <Card className="card-dark">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🔒</span>
              </div>
              <div>
                <CardTitle className="card-title-dark">
                  Centro de Privacidade
                </CardTitle>
                <p className="card-description-dark">
                  Gerencie seus dados e privacidade conforme a LGPD
                </p>
              </div>
              <Badge className="ml-auto bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                LGPD Compliant
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Abas principais */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full max-w-2xl mx-auto">
            <TabsTrigger value="consents">🍪 Cookies</TabsTrigger>
            <TabsTrigger value="rights">⚖️ Direitos</TabsTrigger>
            <TabsTrigger value="data">📄 Meus Dados</TabsTrigger>
            <TabsTrigger value="audit">📋 Histórico</TabsTrigger>
          </TabsList>

          {/* Aba Consentimentos */}
          <TabsContent value="consents" className="space-y-6">
            <Card className="card-dark">
              <CardHeader>
                <CardTitle className="card-title-dark">
                  Gerenciar Cookies
                </CardTitle>
                <p className="card-description-dark">
                  Controle quais cookies e tecnologias similares podem ser
                  utilizados
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {cookieInfo.map(cookie => (
                  <div
                    key={cookie.type}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-2xl">{cookie.icon}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {cookie.name}
                            </h3>
                            {cookie.required && (
                              <Badge className="text-xs bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                                Obrigatório
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {cookie.description}
                          </p>
                        </div>
                      </div>

                      <Switch
                        checked={hasConsent(cookie.type)}
                        disabled={cookie.required}
                        onCheckedChange={checked =>
                          handleConsentChange(cookie.type, checked)
                        }
                      />
                    </div>
                  </div>
                ))}

                <Alert>
                  <AlertDescription>
                    <strong>Importante:</strong> Cookies essenciais são
                    obrigatórios para o funcionamento do site e não podem ser
                    desabilitados. Outros cookies podem ser ativados/desativados
                    conforme sua preferência.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Direitos LGPD */}
          <TabsContent value="rights" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Portabilidade de Dados */}
              <Card className="card-dark">
                <CardHeader>
                  <CardTitle className="card-title-dark flex items-center gap-2">
                    📤 Portabilidade de Dados
                  </CardTitle>
                  <p className="card-description-dark">
                    Baixe todos os seus dados em formato estruturado
                  </p>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleDataPortability}
                    disabled={loadingAction === 'portability'}
                    className="w-full"
                  >
                    {loadingAction === 'portability'
                      ? 'Preparando...'
                      : 'Baixar Meus Dados'}
                  </Button>
                </CardContent>
              </Card>

              {/* Direito ao Esquecimento */}
              <Card className="card-dark">
                <CardHeader>
                  <CardTitle className="card-title-dark flex items-center gap-2">
                    🗑️ Direito ao Esquecimento
                  </CardTitle>
                  <p className="card-description-dark">
                    Solicite a exclusão permanente dos seus dados
                  </p>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleDataDeletion}
                    disabled={loadingAction === 'deletion'}
                    variant="destructive"
                    className="w-full"
                  >
                    {loadingAction === 'deletion'
                      ? 'Excluindo...'
                      : 'Excluir Meus Dados'}
                  </Button>
                </CardContent>
              </Card>

              {/* Retificação */}
              <Card className="card-dark">
                <CardHeader>
                  <CardTitle className="card-title-dark flex items-center gap-2">
                    ✏️ Retificação de Dados
                  </CardTitle>
                  <p className="card-description-dark">
                    Corrija informações incorretas em seu perfil
                  </p>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    Ir para Minha Conta
                  </Button>
                </CardContent>
              </Card>

              {/* Restrição de Processamento */}
              <Card className="card-dark">
                <CardHeader>
                  <CardTitle className="card-title-dark flex items-center gap-2">
                    ⏸️ Limitação de Tratamento
                  </CardTitle>
                  <p className="card-description-dark">
                    Restrinja o processamento dos seus dados
                  </p>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    Entrar em Contato
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Informações de contato do DPO */}
            <Card className="card-dark">
              <CardHeader>
                <CardTitle className="card-title-dark">
                  📞 Contato - Encarregado de Proteção de Dados (DPO)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <strong>Email:</strong>
                    <br />
                    <a
                      href="mailto:privacy@seusite.com"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      privacy@seusite.com
                    </a>
                  </div>
                  <div>
                    <strong>Telefone:</strong>
                    <br />
                    <a
                      href="tel:+5511999999999"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      (11) 99999-9999
                    </a>
                  </div>
                  <div>
                    <strong>Endereço:</strong>
                    <br />
                    <span className="text-gray-600 dark:text-gray-400">
                      Rua Exemplo, 123
                      <br />
                      São Paulo - SP
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Meus Dados */}
          <TabsContent value="data" className="space-y-6">
            <Card className="card-dark">
              <CardHeader>
                <CardTitle className="card-title-dark">
                  📄 Resumo dos Seus Dados
                </CardTitle>
                <p className="card-description-dark">
                  Visualize quais informações temos sobre você
                </p>
              </CardHeader>
              <CardContent>
                {userData ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Dados Pessoais
                        </div>
                        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                          • Nome: {userData.nome || 'Não informado'}
                          <br />• Email: {userData.email || 'Não informado'}
                          <br />• Telefone:{' '}
                          {userData.telefone || 'Não informado'}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Dados de Uso
                        </div>
                        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded border text-sm">
                          • Último login: {userData.lastLogin || 'Nunca'}
                          <br />• Conta criada:{' '}
                          {userData.createdAt || 'Não informado'}
                          <br />• Total de acessos: {userData.loginCount || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">
                      Carregando seus dados...
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Histórico */}
          <TabsContent value="audit" className="space-y-6">
            <Card className="card-dark">
              <CardHeader>
                <CardTitle className="card-title-dark">
                  📋 Histórico de Consentimentos
                </CardTitle>
                <p className="card-description-dark">
                  Veja o histórico das suas decisões sobre privacidade
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(settings.consents).map(([type, consent]) => (
                    <div
                      key={type}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded border"
                    >
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white capitalize">
                          {type}
                        </span>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(consent.timestamp).toLocaleString('pt-BR')}
                        </div>
                      </div>
                      <Badge
                        className={
                          consent.granted
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                        }
                      >
                        {consent.granted ? 'Aceito' : 'Rejeitado'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
