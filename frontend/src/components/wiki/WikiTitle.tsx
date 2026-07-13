'use client';

import { useEffect } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';

/** Define o título do header (padrão do projeto) enquanto a wiki está montada. */
export function WikiTitle({ title = '📖 Wiki do Zykor' }: { title?: string }) {
  const { setPageTitle } = usePageTitle();
  useEffect(() => {
    setPageTitle(title);
    return () => setPageTitle('');
  }, [setPageTitle, title]);
  return null;
}
