/**
 * Identidade visual por bar — sotaque de cor na navegação (menu lateral + seletor).
 * Sutil de propósito: o resto do sistema permanece neutro/profissional.
 */
const CORES_POR_BAR: Record<number, string> = {
  3: '#14401E', // Ordinário — verde-floresta escuro (cor do logo)
  4: '#E8590C', // Deboche — laranja (cor do logo)
};

const COR_PADRAO = '#0d9488'; // teal Zykor (fallback / sem bar)

/** Cor de destaque (hex) do bar. Fallback no teal Zykor. */
export function corDoBar(barId?: number | null): string {
  return (barId != null && CORES_POR_BAR[barId]) || COR_PADRAO;
}

/** Iniciais do nome do bar (fallback quando não há logo). */
export function iniciaisBar(nome?: string | null): string {
  return (nome || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('') || '?';
}
