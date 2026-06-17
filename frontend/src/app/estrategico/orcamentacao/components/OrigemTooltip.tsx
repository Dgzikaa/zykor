'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getOrigem } from './origem-info';

// Tooltip de CÁLCULO: no mouseover do nome da linha, mostra APENAS a fórmula/cálculo
// daquela linha (a proveniência fonte/tabela/campo foi removida a pedido do sócio).
// Usa Portal pra não ser cortado pelo overflow do container de scroll.

export function OrigemTooltip({
  nome,
  children,
  className,
}: {
  nome: string;
  children: React.ReactNode;
  className?: string;
}) {
  const o = getOrigem(nome);

  // Sem cálculo definido => não mostra tooltip nem ícone (só o conteúdo cru).
  if (!o.calculo) {
    return <span className={className}>{children}</span>;
  }

  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>
        <span className={cn('inline-flex items-center gap-1 cursor-help', className)}>
          {children}
          <Info className="w-2.5 h-2.5 flex-shrink-0 text-gray-400 opacity-50" />
        </span>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="right"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="z-[100] max-w-[320px] rounded-lg bg-gray-900 dark:bg-gray-950 border border-gray-700 shadow-xl px-3 py-2.5 animate-in fade-in-0 zoom-in-95"
        >
          <div className="text-[10px] font-bold uppercase tracking-wide text-purple-400">Cálculo</div>
          <div className="text-[11px] text-gray-200 leading-snug">{o.calculo}</div>

          <TooltipPrimitive.Arrow className="fill-gray-900 dark:fill-gray-950" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
