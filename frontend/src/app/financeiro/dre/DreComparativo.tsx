'use client';

import { useState } from 'react';
import { DreTab } from '../../estrategico/orcamentacao/components/DreTab';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

/**
 * DRE principal (ano corrente) + comparativo (ano anterior, ocultável).
 * Cada DreTab tem seu próprio seletor de ano.
 */
export function DreComparativo({ barId, anoAtual }: { barId: number; anoAtual: number }) {
  const [mostrarComparativo, setMostrarComparativo] = useState(true);

  return (
    <div className="space-y-2">
      <DreTab barId={barId} anoInicial={anoAtual} />

      <div className="mt-6 mb-1 border-t-4 border-dashed border-gray-300 dark:border-gray-700 pt-4 flex items-center justify-between gap-2 px-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Comparativo — outro ano
        </p>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setMostrarComparativo(v => !v)}>
          {mostrarComparativo ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {mostrarComparativo ? 'Ocultar comparativo' : 'Mostrar comparativo'}
        </Button>
      </div>

      {mostrarComparativo && <DreTab barId={barId} anoInicial={anoAtual - 1} />}
    </div>
  );
}
