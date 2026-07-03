'use client';

import { cn } from '@/lib/utils';

/**
 * StatCard — cartão de indicador do design-system Zykor (linguagem da home:
 * neutro, respiro, número grande com tabular-nums, cor só com significado).
 * Suporta clique + estado ativo (ex.: KPIs que filtram a tabela) e hint.
 *
 *   <StatCard label="CMV médio" value="28,4%" tone="good" />
 *   <StatCard label="Sem ficha" value={12} active={flag==='x'} onClick={...} />
 */
export function StatCard({
  label, value, hint, tone = 'default', active, onClick, valueClassName, className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'muted';
  active?: boolean;
  onClick?: () => void;
  valueClassName?: string;
  className?: string;
}) {
  const toneColor = {
    default: 'text-neutral-900 dark:text-white',
    good: 'text-emerald-600 dark:text-emerald-400',
    warn: 'text-amber-600 dark:text-amber-400',
    bad: 'text-rose-600 dark:text-rose-400',
    muted: 'text-neutral-400 dark:text-neutral-500',
  }[tone];

  const clickable = !!onClick;
  const Comp = clickable ? 'button' : 'div';

  return (
    <Comp
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group relative flex flex-col gap-1 rounded-2xl border bg-white dark:bg-neutral-900 px-4 py-3.5 text-left transition-all',
        active
          ? 'border-teal-400 ring-1 ring-teal-400/40 dark:border-teal-500'
          : 'border-neutral-200 dark:border-neutral-800',
        clickable && !active && 'hover:border-neutral-300 dark:hover:border-neutral-700 hover:-translate-y-0.5 hover:shadow-sm',
        className,
      )}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}{active && <span className="text-teal-500"> · filtrando</span>}
      </span>
      <span className={cn('text-2xl font-extrabold tracking-tight tabular-nums leading-none', toneColor, valueClassName)}>
        {value}
      </span>
      {hint && <span className="text-[11px] text-neutral-400">{hint}</span>}
    </Comp>
  );
}
