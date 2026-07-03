'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { TrendingDown, CreditCard, Banknote, Info } from 'lucide-react';
import { FluxoContaHub } from '@/app/financeiro/saidas-caixa/page';

function StoneTaxaNota() {
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
      <Info className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        A <b>taxa de maquininha da Stone</b> (TAXA MAQUININHA) é lançada <b>automaticamente junto com os recebíveis</b>,
        como um par que se compensa (despesa + Outras Receitas) — o caixa fica no líquido. Ela aparece dentro de{' '}
        <b>Receitas CA › Stone</b>. Uma view de despesa própria pra ela entra numa próxima etapa.
      </div>
    </div>
  );
}

function DespesasInner() {
  const [aba, setAba] = useState<'stone' | 'dinheiro'>('stone');
  const tabs = [
    { id: 'stone', label: 'Stone', Icon: CreditCard },
    { id: 'dinheiro', label: 'Dinheiro (ContaHub)', Icon: Banknote },
  ] as const;

  return (
    <div className="p-4 md:p-6 mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-red-500/10 p-2.5"><TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" /></div>
        <div>
          <h1 className="text-xl font-semibold">Despesas CA</h1>
          <p className="text-sm text-muted-foreground">Despesas lançadas no Conta Azul — por origem.</p>
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setAba(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${aba === id ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {aba === 'stone' && <StoneTaxaNota />}
      {aba === 'dinheiro' && <FluxoContaHub only="saidas" />}
    </div>
  );
}

export default function DespesasPage() {
  return <ProtectedRoute><DespesasInner /></ProtectedRoute>;
}
