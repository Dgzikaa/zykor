import { cn } from '@/lib/utils';

// Cartão disciplinar estilo futebol: amarelo = advertência/aviso, vermelho = grave.
export type Cartoes = { amarelo: number; vermelho: number };

export function CartaoIcon({ cor, className }: { cor: 'amarelo' | 'vermelho'; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block w-[9px] h-[13px] rounded-[2px] shadow-sm ring-1 ring-black/10',
        cor === 'vermelho' ? 'bg-red-600' : 'bg-yellow-400',
        className,
      )}
    />
  );
}

/** Placar compacto de cartões (mostra a cor + a contagem quando > 1). Some quando zerado. */
export function CartoesBadge({ amarelo = 0, vermelho = 0, className }: Partial<Cartoes> & { className?: string }) {
  if (!amarelo && !vermelho) return null;
  return (
    <span
      className={cn('inline-flex items-center gap-1 shrink-0', className)}
      title={`${vermelho} cartão(ões) vermelho(s), ${amarelo} amarelo(s)`}
    >
      {vermelho > 0 && (
        <span className="inline-flex items-center gap-0.5">
          <CartaoIcon cor="vermelho" />
          {vermelho > 1 && <span className="text-[10px] font-bold leading-none text-red-600 dark:text-red-400 tabular-nums">{vermelho}</span>}
        </span>
      )}
      {amarelo > 0 && (
        <span className="inline-flex items-center gap-0.5">
          <CartaoIcon cor="amarelo" />
          {amarelo > 1 && <span className="text-[10px] font-bold leading-none text-yellow-600 dark:text-yellow-500 tabular-nums">{amarelo}</span>}
        </span>
      )}
    </span>
  );
}
