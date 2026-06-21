'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EstoqueContagem } from '@/components/estoque/EstoqueContagem';
import { SugestaoCompras } from '@/components/estoque/SugestaoCompras';
import { CadastroInsumos } from '@/components/estoque/CadastroInsumos';
import { Boxes } from 'lucide-react';

type Aba = 'contagem' | 'compras' | 'cadastro';

export default function EstoqueHubPage() {
  const [aba, setAba] = useState<Aba>('contagem');
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-3 py-5">
        <div className="flex items-center gap-2 mb-4">
          <Boxes className="w-5 h-5" /><h1 className="text-xl font-bold">Estoque</h1>
        </div>
        <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)} className="mb-4">
          <TabsList>
            <TabsTrigger value="contagem">Contagem</TabsTrigger>
            <TabsTrigger value="compras">Pedido de Compra</TabsTrigger>
            <TabsTrigger value="cadastro">Cadastro de Insumos</TabsTrigger>
          </TabsList>
        </Tabs>

        {aba === 'contagem' && <EstoqueContagem />}
        {aba === 'compras' && <SugestaoCompras />}
        {aba === 'cadastro' && <CadastroInsumos />}
      </div>
    </ProtectedRoute>
  );
}
