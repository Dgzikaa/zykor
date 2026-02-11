'use client';

import dynamic from 'next/dynamic';

// Componentes carregados apenas no cliente (ssr: false) - reduzem bundle inicial
const CommandPaletteWrapper = dynamic(
  () => import('@/components/CommandPaletteWrapper').then((m) => ({ default: m.CommandPaletteWrapper })),
  { ssr: false }
);
const AuthSync = dynamic(() => import('@/components/AuthSync'), { ssr: false });
const VersionChecker = dynamic(
  () => import('@/components/VersionChecker').then((m) => ({ default: m.VersionChecker })),
  { ssr: false }
);

export function ClientOnlyLayoutParts() {
  return (
    <>
      <CommandPaletteWrapper />
      <AuthSync />
      <VersionChecker />
    </>
  );
}
