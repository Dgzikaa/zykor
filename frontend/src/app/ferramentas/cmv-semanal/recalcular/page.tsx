'use client';

import { useState } from 'react';
import { useBarContext } from '@/contexts/BarContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface RecalculoResultado {
  success: boolean;
  message: string;
  total_cmvs: number;
  recalculados: number;
  erros: number;
  detalhes?: {
    recalculados: Array<{
      id: string;
      semana: string;
      cmv_antigo: number;
      cmv_novo: number;
      diferenca: number;
    }>;
    erros: Array<{
      id: string;
      semana: string;
      erro: string;
    }>;
  };
}

export default function RecalcularCMVPage() {
  const { selectedBar } = useBarContext();
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<RecalculoResultado | null>(null);

  const handleRecalcular = async () => {
    if (!selectedBar) {
      alert('Selecione um bar primeiro');
      return;
    }

    if (!confirm('⚠️ ATENÇÃO: Isso vai recalcular TODOS os CMVs históricos com a fórmula correta (bonificações SOMAM). Deseja continuar?')) {
      return;
    }

    setLoading(true);
    setResultado(null);

    try {
      const response = await fetch('/api/cmv-semanal/recalcular-todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: selectedBar.id })
      });

      const data = await response.json();
      setResultado(data);

    } catch (error: any) {
      console.error('Erro ao recalcular:', error);
      setResultado({
        success: false,
        message: 'Erro ao recalcular CMVs',
        total_cmvs: 0,
        recalculados: 0,
        erros: 1
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Recalcular Todos os CMVs
          </CardTitle>
          <CardDescription>
            Recalcula todos os CMVs históricos com a fórmula correta (bonificações SOMAM ao invés de subtrair)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Aviso Importante */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Importante</AlertTitle>
            <AlertDescription>
              <div className="space-y-2 mt-2">
                <p><strong>Correção aplicada:</strong></p>
                <p className="text-sm">
                  <span className="line-through text-red-600">CMV = Estoque + Compras - Estoque Final - Consumos - Bonificações</span>
                </p>
                <p className="text-sm text-green-600 font-semibold">
                  ✅ CMV = Estoque + Compras - Estoque Final - Consumos + Bonificações
                </p>
                <p className="text-sm text-muted-foreground mt-3">
                  Este processo pode levar alguns minutos dependendo da quantidade de registros.
                </p>
              </div>
            </AlertDescription>
          </Alert>

          {/* Botão de Recálculo */}
          <div className="flex justify-center">
            <Button
              onClick={handleRecalcular}
              disabled={loading || !selectedBar}
              size="lg"
              className="w-full max-w-md"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recalculando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recalcular Todos os CMVs
                </>
              )}
            </Button>
          </div>

          {/* Resultado */}
          {resultado && (
            <Alert variant={resultado.success ? "default" : "destructive"}>
              {resultado.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {resultado.success ? 'Recálculo Concluído' : 'Erro no Recálculo'}
              </AlertTitle>
              <AlertDescription>
                <div className="space-y-2 mt-2">
                  <p>{resultado.message}</p>
                  <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                    <div className="bg-muted p-3 rounded">
                      <div className="font-semibold">Total</div>
                      <div className="text-2xl">{resultado.total_cmvs}</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
                      <div className="font-semibold text-green-700 dark:text-green-400">Recalculados</div>
                      <div className="text-2xl text-green-700 dark:text-green-400">{resultado.recalculados}</div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded">
                      <div className="font-semibold text-red-700 dark:text-red-400">Erros</div>
                      <div className="text-2xl text-red-700 dark:text-red-400">{resultado.erros}</div>
                    </div>
                  </div>

                  {/* Detalhes dos recalculados */}
                  {resultado.detalhes?.recalculados && resultado.detalhes.recalculados.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">Primeiros 10 recalculados:</h4>
                      <div className="space-y-1 text-xs">
                        {resultado.detalhes.recalculados.map((item) => (
                          <div key={item.id} className="flex justify-between items-center bg-muted p-2 rounded">
                            <span className="font-mono">{item.semana}</span>
                            <span className="text-muted-foreground">
                              {item.cmv_antigo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} 
                              {' → '}
                              {item.cmv_novo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <span className={item.diferenca >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {item.diferenca >= 0 ? '+' : ''}
                              {item.diferenca.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Erros */}
                  {resultado.detalhes?.erros && resultado.detalhes.erros.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2 text-red-600">Erros encontrados:</h4>
                      <div className="space-y-1 text-xs">
                        {resultado.detalhes.erros.map((item) => (
                          <div key={item.id} className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                            <span className="font-mono">{item.semana}</span>: {item.erro}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
