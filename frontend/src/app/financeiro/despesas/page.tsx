'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { TrendingDown } from 'lucide-react';
import { FluxoContaHub } from '@/app/financeiro/saidas-caixa/page';

function DespesasInner() {
  return (
    <div className="p-4 md:p-6 mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-red-500/10 p-2.5"><TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" /></div>
        <div>
          <h1 className="text-xl font-semibold">Despesas CA</h1>
          <p className="text-sm text-muted-foreground">Despesas lançadas no Conta Azul. Por ora: dinheiro que saiu do caixa (ContaHub).</p>
        </div>
      </div>

      <FluxoContaHub only="saidas" />
    </div>
  );
}

export default function DespesasPage() {
  return <ProtectedRoute><DespesasInner /></ProtectedRoute>;
}
