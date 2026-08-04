'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Barra de filtros padrão das telas de lista (aba Produção - CMV).
 *
 * Pedido do Isaías (04/08/2026): "consegue colocar esses tipos de filtros em toda parte da aba
 * de CMV?" — cada tela tinha inventado a sua (ou não tinha nenhuma), então busca ficava num
 * lugar em cada página e ordem alfabética não existia. Aqui ficam as peças; a tela só escolhe
 * quais usar e com quais campos.
 *
 * Regra de ouro do PADROES-DEV: um jeito canônico. Tela nova de lista usa ESTES componentes.
 */

/** Wrapper: linha de filtros que quebra em telas estreitas (mobile). */
export function FiltroBarra({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>;
}

/** Campo de busca com lupa. Ocupa o espaço que sobra na linha. */
export function BuscaInput({
  value, onChange, placeholder = 'Buscar…', className,
}: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative flex-1 min-w-[180px]', className)}>
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" />
    </div>
  );
}

/**
 * Grupo segmentado (ex.: Todos | Comprar | Não comprar, ou A–Z | Maior valor).
 * `cor` acompanha a identidade da tela (emerald em compras, violet em produção…).
 */
export function SegFiltro<T extends string>({
  value, onChange, options, cor = 'emerald', title, className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string])[];
  cor?: 'emerald' | 'violet' | 'indigo' | 'blue' | 'rose' | 'amber';
  title?: string;
  className?: string;
}) {
  const ativo = {
    emerald: 'bg-emerald-600 text-white', violet: 'bg-violet-600 text-white', indigo: 'bg-indigo-600 text-white',
    blue: 'bg-blue-600 text-white', rose: 'bg-rose-600 text-white', amber: 'bg-amber-600 text-white',
  }[cor];
  return (
    <div title={title} className={cn('inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs', className)}>
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={cn('px-3 py-1.5 whitespace-nowrap', value === v ? ativo : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800')}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Ordem da lista — o padrão é A–Z; a tela acrescenta as ordens que fizerem sentido nela. */
export function OrdemFiltro<T extends string>({
  value, onChange, options, cor, title = 'Ordem da lista', className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string])[];
  cor?: 'emerald' | 'violet' | 'indigo' | 'blue' | 'rose' | 'amber';
  title?: string;
  className?: string;
}) {
  return <SegFiltro value={value} onChange={onChange} options={options} cor={cor} title={title} className={className} />;
}

/** Chip liga/desliga (ex.: Só Curva A, Só Proteínas). */
export function ChipFiltro({
  ativo, onClick, children, cor = 'indigo', title,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  cor?: 'indigo' | 'rose' | 'emerald' | 'amber' | 'violet';
  title?: string;
}) {
  const cores = {
    indigo: 'text-indigo-600 border-indigo-300 ring-indigo-400 bg-indigo-50 dark:bg-indigo-900/20',
    rose: 'text-rose-600 border-rose-300 ring-rose-400 bg-rose-50 dark:bg-rose-900/20',
    emerald: 'text-emerald-600 border-emerald-300 ring-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
    amber: 'text-amber-600 border-amber-300 ring-amber-400 bg-amber-50 dark:bg-amber-900/20',
    violet: 'text-violet-600 border-violet-300 ring-violet-400 bg-violet-50 dark:bg-violet-900/20',
  }[cor];
  const [texto, borda, ring, fundo, fundoDark] = cores.split(' ');
  return (
    <button type="button" onClick={onClick} title={title}
      className={cn('text-xs rounded-full border px-3 py-1 whitespace-nowrap', texto, borda,
        ativo ? `ring-1 ${ring} ${fundo} ${fundoDark}` : 'bg-transparent')}>
      {children}
    </button>
  );
}

/**
 * Select de valor único (ex.: seção do VMarket, categoria, área). '' = todos.
 * `options` aceita string (valor = rótulo) ou {value,label} quando o valor guardado é um
 * código feio (ex.: área 'CozinhaFin' que a tela mostra como "Cozinha - Finalização").
 */
export function SelectFiltro({
  value, onChange, options, todos, className, title,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly (string | { value: string; label: string })[];
  todos: string;
  className?: string;
  title?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} title={title}
      className={cn('text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1.5 cursor-pointer max-w-[220px]', className)}>
      <option value="" className="text-gray-900">{todos}</option>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return <option key={v} value={v} className="text-gray-900">{l}</option>;
      })}
    </select>
  );
}

/**
 * Comparador de nome pt-BR: acento e Ç caem no lugar certo ("Açaí" antes de "Alho") e
 * maiúscula/minúscula não separa a lista. É o A–Z de TODAS as telas — não usar `a > b`.
 */
export const cmpNome = (a?: string | null, b?: string | null) =>
  (a || '').localeCompare(b || '', 'pt-BR', { sensitivity: 'base' });

/** Ordena por um campo de texto do objeto, sem mutar o array original. */
export const ordenarPorNome = <T,>(arr: T[], get: (x: T) => string | null | undefined) =>
  [...arr].sort((a, b) => cmpNome(get(a), get(b)));

/** Valores distintos de um campo, já em A–Z — alimenta o SelectFiltro. */
export const opcoesDe = <T,>(arr: T[], get: (x: T) => string | null | undefined) =>
  Array.from(new Set(arr.map((x) => get(x)).filter(Boolean) as string[])).sort(cmpNome);
