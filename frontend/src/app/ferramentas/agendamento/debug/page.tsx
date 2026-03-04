'use client';

import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SelectWithSearch } from '@/components/ui/select-with-search';
import { RefreshCw } from 'lucide-react';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';

interface InterCredencial {
  id: number;
  nome: string;
  conta_corrente?: string | null;
}

export default function AgendamentoDebugPage() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const [loadingCredenciais, setLoadingCredenciais] = useState(false);
  const [loadingDiagnostico, setLoadingDiagnostico] = useState(false);
  const [credenciais, setCredenciais] = useState<InterCredencial[]>([]);
  const [credencialSelecionadaId, setCredencialSelecionadaId] = useState('');
  const [resultado, setResultado] = useState<any>(null);

  const barId = selectedBar?.id;

  const toast = (title: string, message?: string, isError?: boolean) => {
    showToast({
      type: isError ? 'error' : 'success',
      title,
      message,
    });
  };

  const carregarCredenciais = async () => {
    if (!barId) return;
    setLoadingCredenciais(true);
    try {
      const res = await fetch(`/api/financeiro/inter/credenciais?bar_id=${barId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Erro ao carregar credenciais');
      const lista = (data.credenciais || []) as InterCredencial[];
      setCredenciais(lista);
      if (!credencialSelecionadaId && lista.length > 0) {
        setCredencialSelecionadaId(String(lista[0].id));
      }
    } catch (error) {
      toast(
        'Erro ao carregar credenciais',
        error instanceof Error ? error.message : 'Erro desconhecido',
        true
      );
    } finally {
      setLoadingCredenciais(false);
    }
  };

  const rodarDiagnostico = async () => {
    if (!barId) {
      toast('Nenhum bar selecionado', 'Selecione um bar no topo.', true);
      return;
    }
    if (!credencialSelecionadaId) {
      toast('Credencial obrigatória', 'Selecione uma credencial Inter.', true);
      return;
    }
    setLoadingDiagnostico(true);
    setResultado(null);
    try {
      const res = await fetch('/api/financeiro/inter/debug-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: barId,
          inter_credencial_id: Number(credencialSelecionadaId),
        }),
      });
      const data = await res.json();
      setResultado(data);
      if (data.success) {
        toast('Diagnóstico concluído', 'Veja o resultado detalhado abaixo.');
      } else {
        toast('Diagnóstico falhou', data.error || 'Erro desconhecido', true);
      }
    } catch (error) {
      toast(
        'Erro ao executar diagnóstico',
        error instanceof Error ? error.message : 'Erro desconhecido',
        true
      );
    } finally {
      setLoadingDiagnostico(false);
    }
  };

  useEffect(() => {
    carregarCredenciais();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barId]);

  return (
    <ProtectedRoute requiredModule="financeiro">
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-5xl">
          <Card className="card-dark border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">
                Diagnóstico Inter (Agendamento)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">Bar ativo</Label>
                  <div className="mt-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    {selectedBar?.nome || 'Nenhum bar selecionado'}
                  </div>
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">Credencial Inter</Label>
                  <SelectWithSearch
                    value={credencialSelecionadaId}
                    onValueChange={(value) => setCredencialSelecionadaId(value || '')}
                    placeholder={loadingCredenciais ? 'Carregando...' : 'Selecione a credencial'}
                    options={credenciais.map((cred) => ({
                      value: String(cred.id),
                      label: `${cred.nome}${cred.conta_corrente ? ` (${cred.conta_corrente})` : ''}`,
                    }))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={carregarCredenciais} disabled={loadingCredenciais}>
                  {loadingCredenciais ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    'Recarregar credenciais'
                  )}
                </Button>
                <Button onClick={rodarDiagnostico} className="btn-primary" disabled={loadingDiagnostico}>
                  {loadingDiagnostico ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Executando diagnóstico...
                    </>
                  ) : (
                    'Rodar diagnóstico'
                  )}
                </Button>
              </div>

              <div>
                <Label className="text-gray-700 dark:text-gray-300">Resultado</Label>
                <pre className="mt-1 p-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-gray-100 overflow-auto max-h-[60vh]">
                  {resultado ? JSON.stringify(resultado, null, 2) : 'Sem resultado ainda.'}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}

