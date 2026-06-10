'use client';

import { ReactNode } from 'react';
import { DeltaBadge } from './DeltaBadge';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  /** valor de apoio (ex.: "vs média R$ 90k") */
  sub?: ReactNode;
  delta?: number | null;
  /** subir é ruim (custo/stockout/atraso) */
  inverso?: boolean;
  icon?: ReactNode;
  /** destaca o card (ex.: Resultado do evento) */
  destaque?: boolean;
  accent?: 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'slate';
}

const ACCENTS: Record<string, string> = {
  blue: 'border-l-blue-500',
  green: 'border-l-green-500',
  red: 'border-l-red-500',
  amber: 'border-l-amber-500',
  violet: 'border-l-violet-500',
  slate: 'border-l-slate-400',
};

export function KpiCard({
  label,
  value,
  sub,
  delta,
  inverso,
  icon,
  destaque,
  accent = 'slate',
}: KpiCardProps) {
  return (
    <div
      className={`rounded-lg border border-l-4 bg-white dark:bg-gray-800 dark:border-gray-700 p-3 flex flex-col gap-1 ${
        ACCENTS[accent]
      } ${destaque ? 'ring-1 ring-blue-200 dark:ring-blue-800' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </span>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <span
        className={`font-bold text-gray-900 dark:text-gray-100 ${
          destaque ? 'text-2xl' : 'text-lg'
        }`}
      >
        {value}
      </span>
      <div className="flex items-center justify-between gap-2 min-h-[16px]">
        {sub ? (
          <span className="text-[10px] text-gray-400">{sub}</span>
        ) : (
          <span />
        )}
        {delta !== undefined && <DeltaBadge delta={delta} inverso={inverso} />}
      </div>
    </div>
  );
}
