'use client';

/**
 * Contas pagadoras do bar — quais contas do Conta Azul podem pagar e qual é a sugerida.
 *
 * Antes isso só existia como coluna no banco, marcada na unha por SQL na configuração de cada
 * bar. Bar que passava batido (o 6/PREFS, descoberto em 03/08/2026) só revelava o problema na
 * hora de lançar a fatura de cartão: seletor de conta vazio + "Complete antes de lançar: conta
 * pagadora", sem dizer que faltava configuração. Aqui o estado fica visível e editável.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useApiSWR } from '@/hooks/useApiSWR';
import { api } from '@/lib/api-client';
import { Landmark, AlertTriangle, Star, Loader2 } from 'lucide-react';

interface ContaPagadora {
  contaazul_id: string;
  nome: string;
  banco: string | null;
  tipo: string | null;
  pagadora: boolean;
  pagadora_padrao: boolean;
}
interface Resp {
  bar_id: number;
  contas_financeiras: ContaPagadora[];
  sem_pagadora: boolean;
  sem_padrao: boolean;
}

export default function ContasPagadorasCard({ barId }: { barId: number | null | undefined }) {
  const { toast } = useToast();
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const { data, isLoading, mutate } = useApiSWR<Resp>(
    barId ? `/api/financeiro/contaazul/contas-financeiras/pagadoras?bar_id=${barId}` : null,
  );
  const contas = data?.contas_financeiras || [];

  const salvar = async (conta: ContaPagadora, patch: { pagadora?: boolean; pagadora_padrao?: boolean }) => {
    if (!barId) return;
    setSalvandoId(conta.contaazul_id);
    try {
      await api.patch('/api/financeiro/contaazul/contas-financeiras/pagadoras', {
        bar_id: barId,
        contaazul_id: conta.contaazul_id,
        ...patch,
      });
      await mutate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Tente de novo';
      toast({ title: 'Não deu pra salvar', description: msg, variant: 'destructive' });
    } finally {
      setSalvandoId(null);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="w-4 h-4" />
          Contas pagadoras
        </CardTitle>
        <CardDescription>
          Quais contas deste bar podem pagar, e qual é a sugerida por padrão. Usado nos Pedidos de
          Pagamento e no lançamento da fatura de cartão. Contas de investimento devem ficar de fora.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando contas…
          </p>
        )}

        {!isLoading && !contas.length && (
          <p className="text-sm text-muted-foreground">
            Nenhuma conta financeira sincronizada para este bar. Rode o sync do Conta Azul acima primeiro.
          </p>
        )}

        {!isLoading && !!contas.length && data?.sem_padrao && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Este bar não tem <b>conta padrão</b>. Sem ela, lançar fatura de cartão falha com
              &quot;Complete antes de lançar: conta pagadora&quot;. Marque a estrela na conta corrente do bar.
            </span>
          </div>
        )}

        <div className="divide-y">
          {contas.map((c) => (
            <div key={c.contaazul_id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{c.nome}</span>
                  {c.pagadora_padrao && (
                    <Badge variant="secondary" className="shrink-0">
                      padrão
                    </Badge>
                  )}
                </div>
                {(c.banco || c.tipo) && (
                  <p className="text-xs text-muted-foreground truncate">
                    {[c.banco, c.tipo].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={c.pagadora}
                    disabled={salvandoId === c.contaazul_id}
                    onCheckedChange={(v) => salvar(c, { pagadora: v })}
                  />
                  <span className="text-muted-foreground">pode pagar</span>
                </label>

                <Button
                  variant={c.pagadora_padrao ? 'default' : 'outline'}
                  size="sm"
                  disabled={salvandoId === c.contaazul_id || c.pagadora_padrao}
                  onClick={() => salvar(c, { pagadora_padrao: true })}
                  title={c.pagadora_padrao ? 'Já é a conta padrão' : 'Tornar a conta padrão deste bar'}
                >
                  <Star className={`w-4 h-4 ${c.pagadora_padrao ? 'fill-current' : ''}`} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
