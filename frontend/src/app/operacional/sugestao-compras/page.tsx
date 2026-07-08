'use client';

import { useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SugestaoCompras } from '@/components/estoque/SugestaoCompras';
import { usePageTitle } from '@/contexts/PageTitleContext';

// Atalho direto; a versão principal vive nas abas de /operacional/contagem (Estoque).
export default function SugestaoComprasPage() {
  const { setPageTitle } = usePageTitle();
  useEffect(() => { setPageTitle('🛒 Sugestão de Compras'); return () => setPageTitle(''); }, [setPageTitle]);
  return (
    <ProtectedRoute>
      <div className="p-4 space-y-4">
        <SugestaoCompras />
      </div>
    </ProtectedRoute>
  );
}
