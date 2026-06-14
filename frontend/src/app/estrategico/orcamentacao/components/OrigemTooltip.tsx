'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getOrigem, type OrigemCampo } from './origem-info';

// Tooltip de PROVENIÊNCIA: no mouseover do nome da linha, mostra de onde vem o
// dado (fonte / tabela / campo) de cada coluna (Plan./Proj./Real.) e o cálculo.
// Usa Portal pra não ser cortado pelo overflow do container de scroll.

function CampoBloco({ rotulo, cor, campo }: { rotulo: string; cor: string; campo?: OrigemCampo }) {
  if (!campo) return null;
  return (
    <div className="mb-1.5 last:mb-0">
      <div className={cn('text-[10px] font-bold uppercase tracking-wide', cor)}>{rotulo}</div>
      <div className="text-[11px] text-gray-200 leading-snug">
        <span className="text-gray-400">Fonte:</span> {campo.fonte}
      </div>
      {campo.tabela && (
        <div className="text-[10px] text-gray-300 leading-snug font-mono">
          <span className="text-gray-500 font-sans">Tabela:</span> {campo.tabela}
        </div>
      )}
      {campo.campo && (
        <div className="text-[10px] text-gray-300 leading-snug font-mono">
          <span className="text-gray-500 font-sans">Campo:</span> {campo.campo}
        </div>
      )}
      {campo.obs && <div className="text-[10px] text-gray-400 italic leading-snug">{campo.obs}</div>}
    </div>
  );
}

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
          <div className="text-xs font-bold text-white mb-0.5">{o.titulo}</div>
          {o.descricao && <div className="text-[11px] text-gray-300 mb-2 leading-snug">{o.descricao}</div>}

          <CampoBloco rotulo="Planejado" cor="text-blue-400" campo={o.planejado} />
          <CampoBloco rotulo="Projetado" cor="text-green-400" campo={o.projetado} />
          <CampoBloco rotulo="Realizado" cor="text-amber-400" campo={o.realizado} />

          {o.calculo && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <div className="text-[10px] font-bold uppercase tracking-wide text-purple-400">Cálculo</div>
              <div className="text-[11px] text-gray-200 leading-snug">{o.calculo}</div>
            </div>
          )}

          <TooltipPrimitive.Arrow className="fill-gray-900 dark:fill-gray-950" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
