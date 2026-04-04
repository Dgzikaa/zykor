'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, RefreshCw, Copy, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ContaHubResyncSemanalCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sqlGenerated, setSqlGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerateSQL = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/configuracoes/contahub/setup-resync-semanal', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar SQL');
      }

      const data = await response.json();
      setSqlGenerated(data.summary.sql_to_execute);

      toast({
        title: 'SQL Gerado',
        description: 'Copie o SQL e execute no Supabase SQL Editor',
      });
    } catch (error) {
      console.error('Erro ao gerar SQL:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao gerar SQL de configuração',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopySQL = () => {
    if (sqlGenerated) {
      navigator.clipboard.writeText(sqlGenerated);
      setCopied(true);
      toast({
        title: 'SQL Copiado',
        description: 'Cole no Supabase SQL Editor e execute',
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTestManual = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/contahub/resync-semanal-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: 3,
          dias_anteriores: 7
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao executar re-sync manual');
      }

      const data = await response.json();

      toast({
        title: 'Re-Sync Iniciado',
        description: `Re-sincronizando últimos 7 dias. Isso pode levar alguns minutos.`,
      });
    } catch (error) {
      console.error('Erro ao executar re-sync:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao executar re-sincronização manual',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <RefreshCw className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Re-Sync Semanal ContaHub</CardTitle>
              <CardDescription>
                Atualiza dados da semana anterior toda segunda-feira
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
            <Calendar className="h-3 w-3 mr-1" />
            Segundas 06:00
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Explicação do Problema */}
        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-blue-900">Por que precisamos disso?</h4>
              <p className="text-sm text-gray-600">
                Cancelamentos e estornos podem ser lançados dias depois da operação. 
                Por exemplo: um cancelamento do dia 28/03 pode aparecer no sistema apenas no dia 30/03.
              </p>
              <p className="text-sm text-gray-600">
                Como rodamos a sincronização sempre 1 dia depois (D+1), esses lançamentos tardios 
                nunca seriam capturados, deixando os dados desatualizados.
              </p>
            </div>
          </div>
        </div>

        {/* Solução */}
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-green-900">Solução Implementada</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>Toda <strong>segunda-feira às 06:00</strong> (horário de Brasília)</li>
                <li>Re-sincroniza os <strong>últimos 7 dias</strong> automaticamente</li>
                <li>Captura cancelamentos, estornos e ajustes tardios</li>
                <li>Usa UPSERT para atualizar dados existentes</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Exemplo */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-gray-900">Exemplo Prático</h4>
              <p className="text-sm text-gray-600">
                <strong>Segunda 30/03/2026:</strong> O cronjob irá re-sincronizar automaticamente 
                os dias 23/03, 24/03, 25/03, 26/03, 27/03, 28/03 e 29/03.
              </p>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleGenerateSQL}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Settings className="h-4 w-4 mr-2" />
                Gerar SQL de Configuração
              </>
            )}
          </Button>

          <Button
            onClick={handleTestManual}
            disabled={loading}
            variant="outline"
            className="flex-1"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Testar Manualmente
              </>
            )}
          </Button>
        </div>

        {/* SQL Gerado */}
        {sqlGenerated && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900">SQL Gerado:</h4>
              <Button
                onClick={handleCopySQL}
                size="sm"
                variant="ghost"
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar SQL
                  </>
                )}
              </Button>
            </div>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto max-h-96">
              {sqlGenerated}
            </pre>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800">
                <strong>Próximos passos:</strong>
              </p>
              <ol className="text-xs text-yellow-700 mt-1 space-y-1 list-decimal list-inside">
                <li>Copie o SQL acima</li>
                <li>Acesse o Supabase Dashboard → SQL Editor</li>
                <li>Cole e execute o SQL</li>
                <li>Verifique se os cronjobs foram criados na última query</li>
              </ol>
            </div>
          </div>
        )}

        {/* Informações Técnicas */}
        <div className="text-xs text-gray-500 space-y-1 pt-2 border-t">
          <p><strong>Cronjobs criados:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><code>contahub-resync-semanal-ordinario</code> - Segundas 06:00 BRT (bar_id=3)</li>
            <li><code>contahub-resync-semanal-deboche</code> - Segundas 06:15 BRT (bar_id=4)</li>
          </ul>
          <p className="mt-2"><strong>Edge Function:</strong> <code>contahub-resync-semanal</code></p>
        </div>
      </CardContent>
    </Card>
  );
}
