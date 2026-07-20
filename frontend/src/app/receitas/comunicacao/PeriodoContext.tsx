'use client';

/**
 * Período compartilhado entre as abas de Comunicação.
 *
 * O layout das abas (layout.tsx) fica montado durante a navegação entre elas,
 * então o estado aqui persiste ao trocar de aba (Visão geral → Feed → Anúncios).
 * Antes cada aba tinha seu próprio state com default diferente e "resetava" o
 * range ao navegar. Também persiste em sessionStorage pra sobreviver a reload.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { periodoPadrao, type PeriodoValor } from '@/lib/receitas/periodo';

const STORAGE_KEY = 'comunicacao:periodo';

interface Ctx {
  periodo: PeriodoValor;
  setPeriodo: (p: PeriodoValor) => void;
}

const PeriodoContext = createContext<Ctx | null>(null);

export function ComunicacaoPeriodoProvider({ children }: { children: React.ReactNode }) {
  const [periodo, setPeriodo] = useState<PeriodoValor>(() => periodoPadrao('mes', 'trimestral'));

  // Hidrata do sessionStorage no client (efeito evita mismatch de SSR).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setPeriodo(JSON.parse(raw));
    } catch {
      /* storage indisponível — segue com o default */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(periodo));
    } catch {
      /* ignora */
    }
  }, [periodo]);

  return <PeriodoContext.Provider value={{ periodo, setPeriodo }}>{children}</PeriodoContext.Provider>;
}

export function useComunicacaoPeriodo(): Ctx {
  const ctx = useContext(PeriodoContext);
  if (!ctx) throw new Error('useComunicacaoPeriodo deve ser usado dentro de <ComunicacaoPeriodoProvider>');
  return ctx;
}
