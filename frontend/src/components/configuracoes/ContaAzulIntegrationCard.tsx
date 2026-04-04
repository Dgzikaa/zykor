'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useBar } from '@/contexts/BarContext';
import {
  Wallet,
  CheckCircle,
  AlertCircle,
  Database,
  RefreshCw,
  Eye,
  EyeOff,
  Key,
  Users,
  FolderTree,
  Building2,
  CreditCard,
  Loader2,
  ExternalLink,
  Unlink,
} from 'lucide-react';

interface ContaAzulStatus {
  connected: boolean;
  has_credentials: boolean;
  needs_refresh: boolean;
  expires_at: string | null;
  stats: {
    lancamentos: number;
    categorias: number;
    centros_custo: number;
    pessoas: number;
    contas_financeiras: number;
  };
  last_sync: {
    data: string;
    status: string;
    registros: number;
  } | null;
}

interface Bar {
  id: number;
  nome: string;
}

interface ContaAzulIntegrationCardProps {
  selectedBar?: Bar | null;
}

export default function ContaAzulIntegrationCard({
  selectedBar,
}: ContaAzulIntegrationCardProps) {
  const { toast } = useToast();
  const { selectedBar: barContext } = useBar();
  const [status, setStatus] = useState<ContaAzulStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const barId = selectedBar?.id || barContext?.id;

  const loadStatus = useCallback(async () => {
    if (!barId) return;

    try {
      setLoading(true);
      const response = await fetch('/api/financeiro/contaazul/status?bar_id=' + barId);
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Erro ao carregar status Conta Azul:', error);
    } finally {
      setLoading(false);
    }
  }, [barId]);

  useEffect(() => {
    if (barId) {
      loadStatus();
    }
  }, [barId, loadStatus]);

  useEffect(() => {
    if (!barId || !status?.connected) return;

    const interval = setInterval(() => {
      loadStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [barId, status?.connected, loadStatus]);

  const handleSaveCredentials = async () => {
    if (!clientId || !clientSecret) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSavingCredentials(true);
      const response = await fetch('/api/financeiro/contaazul/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: barId, client_id: clientId, client_secret: clientSecret }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({ title: 'Sucesso', description: 'Credenciais salvas com sucesso!' });
        setShowCredentialsDialog(false);
        setClientId('');
        setClientSecret('');
        await loadStatus();
      } else {
        toast({ title: 'Erro', description: data.error || 'Erro ao salvar credenciais', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Erro ao salvar credenciais:', error);
      toast({ title: 'Erro', description: 'Erro interno', variant: 'destructive' });
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleConnect = () => {
    window.location.href = '/api/financeiro/contaazul/oauth/authorize?bar_id=' + barId;
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await fetch('/api/financeiro/contaazul/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: barId, sync_mode: 'full_sync' }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({ title: 'Sucesso', description: 'Sincronizacao concluida! ' + (data.stats?.lancamentos || 0) + ' lancamentos processados.' });
        await loadStatus();
      } else {
        toast({ title: 'Erro', description: data.error || 'Erro ao sincronizar', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      toast({ title: 'Erro', description: 'Erro interno', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Conta Azul</CardTitle>
              <CardDescription>Sistema de Gestao Financeira</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">Carregando status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <Wallet className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Conta Azul</CardTitle>
                <CardDescription>Sistema de Gestao Financeira</CardDescription>
              </div>
            </div>
            {status?.connected ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Conectado
              </Badge>
            ) : status?.has_credentials ? (
              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                <AlertCircle className="h-3 w-3 mr-1" />
                Nao Conectado
              </Badge>
            ) : (
              <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                <AlertCircle className="h-3 w-3 mr-1" />
                Sem Credenciais
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!status?.has_credentials && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Configure as credenciais do app OAuth do Conta Azul para comecar.
              </p>
              <Button onClick={() => setShowCredentialsDialog(true)} className="w-full">
                <Key className="h-4 w-4 mr-2" />
                Configurar Credenciais
              </Button>
            </div>
          )}

          {status?.has_credentials && !status?.connected && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Credenciais configuradas. Clique para autorizar o acesso ao Conta Azul.
              </p>
              <Button onClick={handleConnect} className="w-full bg-blue-600 hover:bg-blue-700">
                <ExternalLink className="h-4 w-4 mr-2" />
                Conectar Conta Azul
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCredentialsDialog(true)}>
                <Key className="h-4 w-4 mr-2" />
                Editar Credenciais
              </Button>
            </div>
          )}

          {status?.connected && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <Database className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Lancamentos</p>
                    <p className="font-semibold">{status.stats.lancamentos}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <FolderTree className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Categorias</p>
                    <p className="font-semibold">{status.stats.categorias}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <Building2 className="h-4 w-4 text-purple-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Centros Custo</p>
                    <p className="font-semibold">{status.stats.centros_custo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <Users className="h-4 w-4 text-orange-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fornecedores</p>
                    <p className="font-semibold">{status.stats.pessoas}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <CreditCard className="h-4 w-4 text-cyan-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Contas</p>
                    <p className="font-semibold">{status.stats.contas_financeiras}</p>
                  </div>
                </div>
              </div>

              {status.last_sync && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Ultimo sync</p>
                  <p className="text-sm font-medium">{formatDate(status.last_sync.data)}</p>
                  <p className="text-xs text-muted-foreground">{status.last_sync.registros} registros - {status.last_sync.status}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSync} disabled={syncing} className="flex-1">
                  {syncing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                </Button>
                <Button variant="outline" size="icon" onClick={() => setShowCredentialsDialog(true)}>
                  <Key className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credenciais Conta Azul</DialogTitle>
            <DialogDescription>
              Insira as credenciais do app OAuth criado no portal do Conta Azul.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="client-id">Client ID</Label>
              <Input
                id="client-id"
                placeholder="Seu Client ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-secret">Client Secret</Label>
              <div className="relative">
                <Input
                  id="client-secret"
                  type={showSecret ? 'text' : 'password'}
                  placeholder="Seu Client Secret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCredentialsDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCredentials} disabled={savingCredentials}>
              {savingCredentials ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}