'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell } from '@/components/layout/PageShell';
import { useBar } from '@/contexts/BarContext';
import { BarChart3, DollarSign, Store, Music, Boxes, Users, HeartHandshake } from 'lucide-react';
import { SecaoArtistico } from './secoes/Artistico';
import { SecaoVendas } from './secoes/Vendas';
import { SecaoFinanceiro } from './secoes/Financeiro';
import { SecaoCmv } from './secoes/Cmv';
import { SecaoRh } from './secoes/Rh';
import { SecaoCrm } from './secoes/Crm';
import { SecaoVisaoGeral } from './secoes/VisaoGeral';

const SECOES = [
  { key: 'visao', label: 'Visão Geral', icon: BarChart3 },
  { key: 'financeiro', label: 'Financeiro', icon: DollarSign },
  { key: 'vendas', label: 'Vendas & Salão', icon: Store },
  { key: 'artistico', label: 'Artístico', icon: Music },
  { key: 'cmv', label: 'CMV & Produção', icon: Boxes },
  { key: 'rh', label: 'Equipe', icon: Users },
  { key: 'crm', label: 'Clientes', icon: HeartHandshake },
] as const;

export default function GraficosPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  const [aba, setAba] = useState<string>('visao');
  const [periodo, setPeriodo] = useState(12);

  return (
    <PageShell width="wide">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl"><BarChart3 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gráficos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Painel visual de tudo que o Zykor enxerga · {selectedBar?.nome || ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {[6, 12, 24].map((m) => (
            <button key={m} onClick={() => setPeriodo(m)} className={`px-2.5 h-8 rounded-md text-sm border transition ${periodo === m ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-300' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>{m}m</button>
          ))}
        </div>
      </div>

      <Tabs value={aba} onValueChange={setAba} className="mt-3">
        <TabsList className="flex-wrap h-auto">
          {SECOES.map((s) => (
            <TabsTrigger key={s.key} value={s.key}><s.icon className="w-4 h-4 mr-1.5" />{s.label}</TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4">
          {!barId ? (
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-20 text-center text-[hsl(var(--muted-foreground))]">Selecione um bar.</div>
          ) : (
            <>
              <TabsContent value="visao"><SecaoVisaoGeral barId={barId} periodo={periodo} /></TabsContent>
              <TabsContent value="financeiro"><SecaoFinanceiro barId={barId} periodo={periodo} /></TabsContent>
              <TabsContent value="vendas"><SecaoVendas barId={barId} periodo={periodo} /></TabsContent>
              <TabsContent value="artistico"><SecaoArtistico barId={barId} periodo={periodo} /></TabsContent>
              <TabsContent value="cmv"><SecaoCmv barId={barId} periodo={periodo} /></TabsContent>
              <TabsContent value="rh"><SecaoRh barId={barId} periodo={periodo} /></TabsContent>
              <TabsContent value="crm"><SecaoCrm barId={barId} periodo={periodo} /></TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </PageShell>
  );
}
