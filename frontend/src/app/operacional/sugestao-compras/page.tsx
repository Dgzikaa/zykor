'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SugestaoCompras } from '@/components/estoque/SugestaoCompras';
import { ShoppingCart } from 'lucide-react';

// Atalho direto; a versão principal vive nas abas de /operacional/contagem (Estoque).
export default function SugestaoComprasPage() {
  return (
    <ProtectedRoute>
      <div className="p-4 space-y-4">
        <h1 className="text-lg font-bold flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Sugestão de Compras</h1>
        <SugestaoCompras />
      </div>
    </ProtectedRoute>
  );
}
