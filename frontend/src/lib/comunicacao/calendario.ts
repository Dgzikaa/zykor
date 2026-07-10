/**
 * Calendário de Comunicação — categorias (cor) dos posts programados. Compartilhado API + UI.
 */
export type CategoriaPost = 'datas_importantes' | 'reels' | 'postado' | 'programacao' | 'design' | 'evento' | 'outro';

export const CATEGORIAS: Record<CategoriaPost, { label: string; cor: string }> = {
  datas_importantes: { label: 'Datas importantes', cor: 'teal' },
  reels:             { label: 'Reels',             cor: 'purple' },
  postado:           { label: 'Postado',           cor: 'emerald' },
  programacao:       { label: 'Programação',       cor: 'amber' },
  design:            { label: 'Design',            cor: 'pink' },
  evento:            { label: 'Evento',            cor: 'blue' },
  outro:             { label: 'Outro',             cor: 'gray' },
};

export const CATEGORIA_KEYS = Object.keys(CATEGORIAS) as CategoriaPost[];

// classes estáticas por cor (Tailwind não monta por interpolação) — chip do post
export const COR_CHIP: Record<string, string> = {
  teal:    'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-200 dark:border-teal-800',
  purple:  'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-800',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800',
  amber:   'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800',
  pink:    'bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-800',
  blue:    'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800',
  gray:    'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
};
export const COR_DOT: Record<string, string> = {
  teal: 'bg-teal-500', purple: 'bg-purple-500', emerald: 'bg-emerald-500',
  amber: 'bg-amber-500', pink: 'bg-pink-500', blue: 'bg-blue-500', gray: 'bg-gray-400',
};

export const catLabel = (c: string) => CATEGORIAS[c as CategoriaPost]?.label ?? c;
export const catCor = (c: string) => CATEGORIAS[c as CategoriaPost]?.cor ?? 'gray';
