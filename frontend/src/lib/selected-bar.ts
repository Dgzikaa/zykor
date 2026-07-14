/**
 * Bar selecionado DA ABA (isolamento por-aba).
 *
 * `sessionStorage` é a VERDADE da aba: cada aba do navegador tem o seu, então uma aba no Ordinário
 * e outra no Deboche não se atropelam. `localStorage` é só FALLBACK (último bar usado globalmente,
 * pra semear uma aba nova antes de o BarContext inicializar).
 *
 * NUNCA ler `localStorage.getItem('sgb_selected_bar_id')` direto pra mandar o bar ao servidor —
 * localStorage é COMPARTILHADO entre abas e causava lançamento no bar errado quando o financeiro
 * tinha Ordinário numa aba e Deboche em outra (bug 14/07/2026). Use sempre este helper.
 */
const SELECTED_BAR_KEY = 'sgb_selected_bar_id';

export function getSelectedBarId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(SELECTED_BAR_KEY) || localStorage.getItem(SELECTED_BAR_KEY);
  } catch {
    return null;
  }
}

/** Fixa o bar DESTA aba (sessionStorage) + hint global p/ abas novas (localStorage). */
export function setSelectedBarId(barId: number | string): void {
  if (typeof window === 'undefined') return;
  const v = String(barId);
  try { sessionStorage.setItem(SELECTED_BAR_KEY, v); } catch { /* ignore */ }
  try { localStorage.setItem(SELECTED_BAR_KEY, v); } catch { /* ignore */ }
}
