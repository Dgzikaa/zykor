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
  const [mostrarComparativo, setMostrarComparativo] = useState(false);

  return (
    <div className="space-y-2">
      <DreTab barId={barId} anoInicial={anoAtual} />

      <div className="mt-3 mb-1 flex items-center justify-end px-1">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setMostrarComparativo(v => !v)}>
          {mostrarComparativo ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {mostrarComparativo ? 'Ocultar comparativo' : 'Mostrar comparativo'}
        </Button>
      </div>

      {mostrarComparativo && <DreTab barId={barId} anoInicial={anoAtual - 1} />}
    </div>
  );
}
