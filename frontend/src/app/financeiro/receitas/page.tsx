'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { TrendingUp, CreditCard, Banknote, Ticket, Music } from 'lucide-react';
import { StoneRecebiveisConteudo } from '@/app/financeiro/stone-recebiveis/page';
import { FluxoContaHub } from '@/app/financeiro/saidas-caixa/page';
import { SymplaRecebiveis, YuzerEmConstrucao } from './SymplaRecebiveis';

function ReceitasInner() {
  const [aba, setAba] = useState<'stone' | 'sympla' | 'yuzer' | 'dinheiro'>('stone');
  const tabs = [
    { id: 'stone', label: 'Stone', Icon: CreditCard },
    { id: 'sympla', label: 'Sympla', Icon: Ticket },
    { id: 'yuzer', label: 'Yuzer', Icon: Music },
    { id: 'dinheiro', label: 'Dinheiro (ContaHub)', Icon: Banknote },
  ] as const;

  return (
    <div className="p-4 md:p-6 mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-emerald-500/10 p-2.5"><TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" /></div>
        <div>
          <h1 className="text-xl font-semibold">Receitas CA</h1>
          <p className="text-sm text-muted-foreground">Receitas lançadas no Conta Azul — por origem.</p>
        </div>
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setAba(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors ${aba === id ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {aba === 'stone' && <StoneRecebiveisConteudo />}
      {aba === 'sympla' && <SymplaRecebiveis />}
      {aba === 'yuzer' && <YuzerEmConstrucao />}
      {aba === 'dinheiro' && <FluxoContaHub only="entradas" />}
    </div>
  );
}

export default function ReceitasPage() {
  return <ProtectedRoute><ReceitasInner /></ProtectedRoute>;
}
