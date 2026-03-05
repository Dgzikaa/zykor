'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Plug, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface IntegracaoItem {
  id: string;
  nome: string;
  ativo: boolean;
  configurado: boolean;
  origem: string | null;
  atualizadoEm: string | null;
  campos: Record<string, unknown>;
}

export default function AdministracaoIntegracoesPage() {
  const { selectedBar } = useBar();
  const [loading, setLoading] = useState(false);
  const [integracoes, setIntegracoes] = useState<IntegracaoItem[]>([]);

  const carregarIntegracoes = async () => {
    if (!selectedBar?.id) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/configuracoes/administracao/integracoes?bar_id=${selectedBar.id}`
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Erro ao carregar integrações');
      }

      setIntegracoes(result.integracoes || []);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível carregar integrações');
    } finally {
      setLoading(false);
    }
  };

  const testarConexoes = async () => {
    if (!selectedBar?.id) return;
    try {
      const response = await fetch(
        `/api/configuracoes/integracoes/status?bar_id=${selectedBar.id}`
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Falha ao testar conexões');
      }
      toast.success('Teste executado. Status atualizado.');
      await carregarIntegracoes();
    } catch (error) {
      toast.error('Falha ao testar conexões');
    }
  };

  useEffect(() => {
    carregarIntegracoes();
  }, [selectedBar?.id]);

  const resumo = useMemo(() => {
    const configuradas = integracoes.filter((i) => i.configurado).length;
    const ativas = integracoes.filter((i) => i.ativo).length;
    return { total: integracoes.length, configuradas, ativas };
  }, [integracoes]);

  return (
    <div className="space-y-4">
      <Card className="card-dark">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Integrações por bar {selectedBar ? `- ${selectedBar.nome}` : ''}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={testarConexoes}>
              <Plug className="w-4 h-4 mr-2" />
              Testar conexões
            </Button>
            <Button variant="outline" size="sm" onClick={carregarIntegracoes}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex gap-3 text-sm">
          <Badge variant="outline">Total: {resumo.total}</Badge>
          <Badge variant="outline">Configuradas: {resumo.configuradas}</Badge>
          <Badge variant="outline">Ativas: {resumo.ativas}</Badge>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {integracoes.map((item) => (
          <Card key={item.id} className="card-dark">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{item.nome}</CardTitle>
                <div className="flex items-center gap-2">
                  {item.configurado ? (
                    <Badge variant="outline" className="text-green-600">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Configurada
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-600">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Não configurada
                    </Badge>
                  )}
                  {item.ativo && <Badge>Ativa</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xs text-muted-foreground">
                Origem: {item.origem || 'não definida'}
              </div>
              {item.atualizadoEm && (
                <div className="text-xs text-muted-foreground">
                  Atualizada em: {new Date(item.atualizadoEm).toLocaleString('pt-BR')}
                </div>
              )}
              <div className="rounded-md border border-border p-2 bg-muted/30">
                <pre className="text-[11px] whitespace-pre-wrap break-all">
                  {JSON.stringify(item.campos, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
