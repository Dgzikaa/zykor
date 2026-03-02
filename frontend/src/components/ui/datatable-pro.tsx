'use client';

import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface Column<T> {
  key: keyof T | string;
  header: React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
}

interface DataTableProProps<T> {
  columns: Column<T>[];
  data: T[];
  className?: string;
  dense?: boolean;
  stickyHeader?: boolean;
  toolbarTitle?: string;
  searchable?: boolean;
  initialVisibleColumns?: string[];
  selectableRows?: boolean;
  onSelectionChange?: (rows: T[]) => void;
  actions?: React.ReactNode;
}

export function DataTablePro<T extends Record<string, any>>({
  columns,
  data,
  className,
  dense = false,
  stickyHeader = true,
  toolbarTitle,
  searchable = true,
  initialVisibleColumns,
  selectableRows = false,
  onSelectionChange,
  actions,
}: DataTableProProps<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [visibleCols, setVisibleCols] = useState<string[]>(
    initialVisibleColumns ?? columns.map(c => String(c.key))
  );
  const [selectedIdxs, setSelectedIdxs] = useState<Set<number>>(new Set());

  const visibleColumns = useMemo(
    () => columns.filter(c => visibleCols.includes(String(c.key))),
    [columns, visibleCols]
  );

  const filtered = useMemo(() => {
    if (!query) return data;
    const q = query.toLowerCase();
    return data.filter(row =>
      columns.some(col => String(row[col.key as keyof T] ?? '').toLowerCase().includes(q))
    );
  }, [data, query, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const sortedCopy = [...filtered].sort((a, b) => {
      const av = a[sortKey as keyof T];
      const bv = b[sortKey as keyof T];
      if (av == null && bv == null) return 0;
      if (av == null) return -1;
      if (bv == null) return 1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return av - bv;
      }
      return String(av).localeCompare(String(bv));
    });
    return sortDir === 'asc' ? sortedCopy : sortedCopy.reverse();
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: string, sortable?: boolean) => {
    if (!sortable) return;
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    }
  };

  const allSelected = selectableRows && sorted.length > 0 && sorted.every((_, i) => selectedIdxs.has(i));
  const toggleSelectAll = () => {
    if (!selectableRows) return;
    const next = new Set<number>();
    if (!allSelected) {
      sorted.forEach((_, i) => next.add(i));
    }
    setSelectedIdxs(next);
    onSelectionChange?.(Array.from(next).map(i => sorted[i]));
  };

  const toggleRow = (idx: number) => {
    if (!selectableRows) return;
    const next = new Set(selectedIdxs);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedIdxs(next);
    onSelectionChange?.(Array.from(next).map(i => sorted[i]));
  };

  return (
    <div className={cn('bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 p-3 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-3">
          {toolbarTitle && (
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{toolbarTitle}</h3>
          )}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {searchable && (
            <input
              placeholder="Pesquisar..."
              aria-label="Pesquisar na tabela"
              className="bg-[hsl(var(--background))] border border-[hsl(var(--input))] text-[hsl(var(--foreground))] px-3 py-2 text-sm rounded-md"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          )}
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full">
          <thead className={cn('bg-[hsl(var(--muted))]/60', stickyHeader && 'sticky top-0 z-10')}>
            <tr className="border-b border-[hsl(var(--border))]">
              {selectableRows && (
                <th className="px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                </th>
              )}
              {visibleColumns.map((col, idx) => (
                <th
                  key={String(col.key) + idx}
                  className={cn(
                    'px-4 py-3 text-left text-[hsl(var(--muted-foreground))] text-xs font-medium uppercase tracking-wider select-none',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                    col.sortable && 'cursor-pointer hover:text-[hsl(var(--foreground))]'
                  )}
                  style={{ width: col.width }}
                  scope="col"
                  onClick={() => toggleSort(String(col.key), col.sortable)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {sortKey === String(col.key) && (
                      <span className="text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, rIdx) => (
              <tr key={rIdx} className={cn('border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/30')}>
                {selectableRows && (
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIdxs.has(rIdx)}
                      onChange={() => toggleRow(rIdx)}
                    />
                  </td>
                )}
                {visibleColumns.map((col, cIdx) => (
                  <td
                    key={String(col.key) + cIdx}
                    className={cn(
                      'px-4 py-4 align-middle text-sm',
                      col.align === 'center' && 'text-center',
                      col.align === 'right' && 'text-right'
                    )}
                  >
                    {col.render ? col.render(row) : String(row[col.key as keyof T] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={(selectableRows ? 1 : 0) + visibleColumns.length} className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]">
                  Nenhum dado encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTablePro;


