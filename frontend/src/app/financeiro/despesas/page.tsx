'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { TrendingDown, Banknote, Boxes, Gift, Receipt, HandCoins, CalendarSync } from 'lucide-react';
import { FluxoContaHub } from '@/app/financeiro/saidas-caixa/page';
import { VariacaoEstoqueTab } from './components/VariacaoEstoqueTab';
import { BonificacoesTab } from './components/BonificacoesTab';
import { ConsumacoesTab } from './components/ConsumacoesTab';
import { ImpostosTab } from './components/ImpostosTab';
import { AjusteViradaTab } from './components/AjusteViradaTab';
import { AutoToggle } from '@/components/financeiro/AutoToggle';

type AbaId = 'dinheiro' | 'variacao' | 'bonificacoes' | 'impostos' | 'consumacoes' | 'virada';

// Toggle de automação por aba. Bonificações e Saídas em dinheiro são sempre manuais → sem toggle.
const AUTO: Record<AbaId, { tipo: string; disponivel: boolean } | null> = {
  dinheiro: null,
  variacao: { tipo: 'variacao_estoque', disponivel: true },
  bonificacoes: null,
  consumacoes: { tipo: 'consumacao', disponivel: true },
  impostos: { tipo: 'imposto', disponivel: true },
  virada: { tipo: 'ajuste_virada', disponivel: true },
};

const ABAS: { id: AbaId; label: string; Icon: any; disponivel: boolean }[] = [
  { id: 'dinheiro', label: 'Dinheiro em Espécie', Icon: Banknote, disponivel: true },
  { id: 'variacao', label: 'Variação de Estoque', Icon: Boxes, disponivel: true },
  { id: 'bonificacoes', label: 'Bonificações', Icon: Gift, disponivel: true },
  { id: 'consumacoes', label: 'Consumações', Icon: HandCoins, disponivel: true },
  { id: 'impostos', label: 'Simulação Impostos', Icon: Receipt, disponivel: true },
  { id: 'virada', label: 'Ajuste Virada do Mês', Icon: CalendarSync, disponivel: true },
];

function DespesasInner() {
  const [aba, setAba] = useState<AbaId>('dinheiro');
  const { setPageTitle } = usePageTitle();
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    setPageTitle('📉 Despesas CA');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Deep-link `?aba=bonificacoes` (atalho fixado no grupo) → abre direto na aba.
  // Limpa o param depois p/ não prender a navegação naquela aba.
  useEffect(() => {
    const q = searchParams.get('aba');
    const validas: AbaId[] = ['dinheiro', 'variacao', 'bonificacoes', 'impostos', 'consumacoes', 'virada'];
    if (q && validas.includes(q as AbaId)) {
      setAba(q as AbaId);
      router.replace('/financeiro/despesas');
    }
  }, [searchParams, router]);

  return (
    <div className="p-4 md:p-6 mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-red-500/10 p-2.5"><TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" /></div>
          <div>
            <p className="text-sm text-muted-foreground">Lançamentos de despesa no Conta Azul feitos pelo Zykor.</p>
          </div>
        </div>
        {AUTO[aba] && <AutoToggle tipo={AUTO[aba]!.tipo} disponivel={AUTO[aba]!.disponivel} />}
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">
        {ABAS.map(({ id, label, Icon, disponivel }) => (
          <button
            key={id}
            onClick={() => disponivel && setAba(id)}
            disabled={!disponivel}
            title={disponivel ? undefined : 'Em breve'}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors ${
              aba === id ? 'border-primary text-primary font-medium'
              : disponivel ? 'border-transparent text-muted-foreground hover:text-foreground'
              : 'border-transparent text-muted-foreground/40 cursor-not-allowed'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
            {!disponivel && <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5 ml-0.5">em breve</span>}
          </button>
        ))}
      </div>

      {aba === 'dinheiro' && <FluxoContaHub only="saidas" />}
      {aba === 'variacao' && <VariacaoEstoqueTab />}
      {aba === 'bonificacoes' && <BonificacoesTab />}
      {aba === 'consumacoes' && <ConsumacoesTab />}
      {aba === 'impostos' && <ImpostosTab />}
      {aba === 'virada' && <AjusteViradaTab />}
    </div>
  );
}

export default function DespesasPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={null}>
        <DespesasInner />
      </Suspense>
    </ProtectedRoute>
  );
}
