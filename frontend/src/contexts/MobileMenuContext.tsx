'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface MobileMenuCtx {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const Ctx = createContext<MobileMenuCtx | null>(null);

/**
 * Estado do menu lateral mobile (drawer), compartilhado entre o hambúrguer do
 * MinimalHeader (topo) e o botão "Menu" da BottomNavigation (rodapé) — ambos
 * abrem/fecham o MESMO drawer.
 */
export function MobileMenuProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  return <Ctx.Provider value={{ isOpen, open, close, toggle }}>{children}</Ctx.Provider>;
}

export function useMobileMenu(): MobileMenuCtx {
  const c = useContext(Ctx);
  // fallback no-op se usado fora do provider (não quebra a UI)
  return c ?? { isOpen: false, open: () => {}, close: () => {}, toggle: () => {} };
}
