'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Filter, Check } from 'lucide-react';
import { Input } from './input';
import { cn } from '@/lib/utils';

export type ColAlign = 'left' | 'center' | 'right';

/**
 * Cabeçalho de coluna com filtro tipo Excel (checkboxes de valores distintos + contagem).
 * O popover é renderizado em portal (position: fixed) pra NÃO ser cortado pelo overflow da
 * tabela. Mesmo padrão da tela de Insumos, extraído p/ reuso.
 */
export function ColumnFilterHeader({
  label, title, align = 'left', options, selected, onChange, className,
}: {
  label: string;
  title?: string;
  align?: ColAlign;
  options: { value: string; count: number }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);
  const active = selected.size > 0;

  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 268)), top: r.bottom + 4 });
    setQ(''); setOpen(true);
  };

  React.useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onAway = () => setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onAway);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('resize', onAway); };
  }, [open]);

  const shown = q ? options.filter(o => o.value.toLowerCase().includes(q.toLowerCase())) : options;
  const toggle = (v: string) => { const n = new Set(selected); if (n.has(v)) n.delete(v); else n.add(v); onChange(n); };
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <th className={cn(alignCls, 'font-medium px-2', className)} title={title}>
      <button ref={btnRef} type="button" onClick={() => (open ? setOpen(false) : openMenu())}
        className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-emerald-600 dark:text-emerald-400')}>
        <span>{label}</span>
        <Filter className={cn('w-3 h-3', active ? 'fill-emerald-500 text-emerald-500' : 'text-muted-foreground/50')} />
        {active && <span className="text-[10px] rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1 leading-4">{selected.size}</span>}
      </button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} style={{ position: 'fixed', left: pos.left, top: pos.top, width: 256 }}
          className="z-[60] rounded-lg border border-[hsl(var(--border))] bg-popover shadow-xl p-2 normal-case">
          <Input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Filtrar valores…" className="h-8 text-xs" />
          <div className="flex items-center justify-between px-1 py-1.5 text-[11px] text-muted-foreground">
            <button type="button" className="hover:text-emerald-600" onClick={() => onChange(new Set(options.map(o => o.value)))}>Todos</button>
            <span>{selected.size ? `${selected.size} sel.` : `${options.length} valores`}</span>
            <button type="button" className="hover:text-red-600" onClick={() => onChange(new Set())}>Limpar</button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {shown.length === 0 ? <div className="px-2 py-3 text-center text-xs text-muted-foreground">Nada</div>
              : shown.map(o => {
                const on = selected.has(o.value);
                return (
                  <button key={o.value} type="button" onClick={() => toggle(o.value)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted/60 rounded">
                    <span className={cn('w-4 h-4 shrink-0 rounded border flex items-center justify-center', on ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-[hsl(var(--border))]')}>{on && <Check className="w-3 h-3" />}</span>
                    <span className="flex-1 truncate text-foreground/90">{o.value}</span>
                    <span className="text-muted-foreground tabular-nums">{o.count}</span>
                  </button>
                );
              })}
          </div>
        </div>, document.body)}
    </th>
  );
}

export type FilterCol<T> = { id: string; get: (row: T) => string };

/**
 * Estado + cálculo dos filtros de coluna (estilo Excel): opções de cada coluna respeitam os
 * OUTROS filtros já aplicados, e `view` é a lista final. Passe um `cols` estável (constante
 * de módulo ou useMemo) pra não recalcular à toa.
 */
export function useColumnFilters<T>(rows: T[], cols: FilterCol<T>[]) {
  const [colFilter, setColFilter] = React.useState<Record<string, Set<string>>>({});
  const setCol = React.useCallback((id: string, next: Set<string>) => {
    setColFilter(prev => { const n = { ...prev }; if (next.size) n[id] = next; else delete n[id]; return n; });
  }, []);
  const clearAll = React.useCallback(() => setColFilter({}), []);
  const anyCol = Object.keys(colFilter).length > 0;

  const optionsByCol = React.useMemo(() => {
    const out: Record<string, { value: string; count: number }[]> = {};
    for (const c of cols) {
      const filtered = rows.filter(r => cols.every(o => {
        if (o.id === c.id) return true;
        const sel = colFilter[o.id]; if (!sel || !sel.size) return true; return sel.has(o.get(r));
      }));
      const m = new Map<string, number>();
      for (const r of filtered) { const v = c.get(r); m.set(v, (m.get(v) || 0) + 1); }
      out[c.id] = Array.from(m, ([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value, 'pt-BR', { numeric: true }));
    }
    return out;
  }, [rows, cols, colFilter]);

  const view = React.useMemo(() => rows.filter(r => cols.every(c => {
    const sel = colFilter[c.id]; if (!sel || !sel.size) return true; return sel.has(c.get(r));
  })), [rows, cols, colFilter]);

  return { colFilter, setCol, clearAll, anyCol, optionsByCol, view };
}
