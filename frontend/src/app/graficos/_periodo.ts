/**
 * Helpers do seletor de período do hub de Gráficos.
 *
 * `mesRef` = 'YYYY-MM' quando o usuário escolhe a VISÃO MENSAL (zoom no mês — detalhe
 * semana a semana / dia a dia dentro do mês). `null` = visão do ANO / janela de N meses
 * (comportamento padrão). Toda seção recebe `mesRef` além de `periodo`; quando `mesRef`
 * é null ela se comporta exatamente como antes.
 */

const p2 = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM' -> { ano, mes(1-12), de:'YYYY-MM-01', ate:'YYYY-MM-<último dia>' } */
export function mesBounds(mesRef: string) {
  const [a, m] = mesRef.split('-').map(Number);
  const ultimoDia = new Date(a, m, 0).getDate(); // dia 0 do mês seguinte = último dia deste mês
  return { ano: a, mes: m, de: `${a}-${p2(m)}-01`, ate: `${a}-${p2(m)}-${p2(ultimoDia)}` };
}

/** A data ('YYYY-MM-...' ou Date-ish) cai no mês selecionado? */
export function noMes(dateStr: unknown, mesRef: string): boolean {
  return String(dateStr ?? '').slice(0, 7) === mesRef;
}

/** Rótulo curto do mês: 'jul/26'. */
export function mesLabelCurto(mesRef: string): string {
  const [a, m] = mesRef.split('-').map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
}

/** Últimos N meses (default 18) como opções {value:'YYYY-MM', label:'jul/26'}, do mais recente ao mais antigo. */
export function mesesRecentes(n = 18): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ value: `${d.getFullYear()}-${p2(d.getMonth() + 1)}`, label: mesLabelCurto(`${d.getFullYear()}-${p2(d.getMonth() + 1)}`) });
  }
  return out;
}
