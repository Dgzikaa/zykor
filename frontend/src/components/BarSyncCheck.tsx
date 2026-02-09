'use client';

import { useEffect } from 'react';
import { useBar } from '@/contexts/BarContext';
import { useRouter } from 'next/navigation';
import { setBarCookie, getBarCookie } from '../lib/cookies';

/**
 * Componente silencioso que garante a sincronização do bar entre Cliente e Servidor via cookies.
 * Deve ser incluído em páginas RSC que dependem do bar_id no servidor.
 */
export function BarSyncCheck() {
  const { selectedBar, isLoading } = useBar();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && selectedBar) {
      const currentCookie = getBarCookie();
      
      // Só sincroniza e refresca se o cookie for diferente do bar selecionado no contexto
      if (currentCookie !== selectedBar.id) {
        console.log(`🔄 BarSyncCheck: Sincronizando cookie (${currentCookie} -> ${selectedBar.id}) e atualizando servidor...`);
        setBarCookie(selectedBar.id);
        
        // Pequeno delay para garantir que o cookie foi escrito antes do refresh
        const timer = setTimeout(() => {
          router.refresh();
        }, 100);
        
        return () => clearTimeout(timer);
      }
    }
  }, [selectedBar?.id, isLoading, router]);

  // Retorna null para não interferir no layout da página
  return null;
}
