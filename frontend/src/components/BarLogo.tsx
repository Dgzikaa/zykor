'use client';

import { corDoBar, iniciaisBar } from '@/lib/bar-theme';

/**
 * Logo do bar (ou inicial na cor do bar como fallback). Usado no seletor do header
 * e no seletor do menu lateral.
 */
export function BarLogo({
  id,
  nome,
  logo,
  size = 20,
}: {
  id: number;
  nome: string;
  logo?: string | null;
  size?: number;
}) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={nome}
        style={{ height: size, width: size }}
        className="flex-shrink-0 rounded object-contain"
      />
    );
  }
  return (
    <span
      style={{ height: size, width: size, background: corDoBar(id) }}
      className="flex flex-shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
    >
      {iniciaisBar(nome)}
    </span>
  );
}
