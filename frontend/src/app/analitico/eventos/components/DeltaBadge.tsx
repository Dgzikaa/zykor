'use client';

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

interface DeltaBadgeProps {
  /** Variação percentual vs baseline. null = sem base de comparação */
  delta?: number | null;
  /** Quando true, subir é ruim (ex.: custo, stockout, atrasos) */
  inverso?: boolean;
  /** Texto extra após o percentual (ex.: "vs média 4") */
  sufixo?: string;
  className?: string;
}

/**
 * Badge de variação vs baseline (média das últimas 4 datas equivalentes).
 * Verde = bom, vermelho = ruim, respeitando `inverso` para métricas de custo.
 */
export function DeltaBadge({ delta, inverso = false, sufixo, className = '' }: DeltaBadgeProps) {
  if (delta === null || delta === undefined || !isFinite(delta)) {
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] text-gray-400 ${className}`}>
        <Minus className="w-3 h-3" /> s/ base
      </span>
    );
  }

  const arredondado = Math.round(delta * 10) / 10;
  const subiu = arredondado > 0;
  const neutro = Math.abs(arredondado) < 0.05;
  // "bom" = subiu quando não-inverso, ou caiu quando inverso
  const bom = neutro ? null : inverso ? !subiu : subiu;

  const cor =
    bom === null
      ? 'text-gray-400'
      : bom
        ? 'text-green-600 dark:text-green-400'
        : 'text-red-600 dark:text-red-400';

  const Icon = neutro ? Minus : subiu ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${cor} ${className}`}>
      <Icon className="w-3 h-3" />
      {subiu ? '+' : ''}
      {arredondado}%{sufixo ? ` ${sufixo}` : ''}
    </span>
  );
}
