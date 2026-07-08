'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';

interface CommandPaletteContextType {
  isOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
}

const CommandPaletteContext = createContext<
  CommandPaletteContextType | undefined
>(undefined);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openPalette = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleCommandPalette = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Command Palette (busca / Cmd+K) DESATIVADO — decisão do produto: não usamos mais.
  // Provider mantido inerte só p/ não quebrar consumidores antigos; sem atalho de teclado,
  // sem modal montado (removido do ClientOnlyLayoutParts) e sem scroll-lock.

  return (
    <CommandPaletteContext.Provider
      value={{ isOpen, openPalette, closePalette, togglePalette: toggleCommandPalette }}
    >
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (context === undefined) {
    throw new Error(
      'useCommandPalette must be used within a CommandPaletteProvider'
    );
  }
  return context;
}
