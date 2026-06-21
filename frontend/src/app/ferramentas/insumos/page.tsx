'use client';

import { useEffect } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { CadastroInsumos } from '@/components/estoque/CadastroInsumos';

export default function InsumosPage() {
  const { setPageTitle } = usePageTitle();
  useEffect(() => { setPageTitle('Insumos'); }, [setPageTitle]);
  return (
    <div className="p-6">
      <CadastroInsumos />
    </div>
  );
}
