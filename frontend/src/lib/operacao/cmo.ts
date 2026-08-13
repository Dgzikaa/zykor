/**
 * CMO Fixo — a folha CLT que entra no CMO% junto com o custo de freela.
 *
 * Até 13/08/2026 existiam DUAS constantes digitadas e independentes no parâmetro:
 * 59.000 na semana e 172.000 no mês. 172/59 = 2,9 — não são 4,3 semanas, então as duas
 * visões mediam réguas diferentes: toda semana estourava (25–28%) e o mês passava (19%),
 * com o mesmo teto. O Cadu fechou: "é pra ser igual. sempre 20%", e o semanal estava
 * errado porque era digitado à mão.
 *
 * Agora existe UM valor — a folha do mês — e qualquer período sai dela rateado POR DIA.
 * Dia a dia (e não período ÷ 30) porque a semana atravessa o mês: 27/07–02/08 tem 5 dias
 * de julho e 2 de agosto, e cada um pesa contra o mês a que pertence. Como efeito colateral
 * bom, a soma dos dias de um mês devolve exatamente a folha daquele mês.
 */

const MS_DIA = 86_400_000;

/** Dias do mês de uma data (mes é 1–12). */
function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Folha rateada pelos dias de calendário entre `de` e `ate` (ambos inclusive).
 *
 * São dias de CALENDÁRIO, não dias de operação: a folha corre no mês inteiro, o bar
 * abrindo ou não. É o que faz a soma das semanas fechar com o mês.
 */
export function cmoFixoDoPeriodo(de: string, ate: string, folhaMensal: number | null | undefined): number {
  if (!folhaMensal) return 0;
  const [a1, m1, d1] = de.split('-').map(Number);
  const fim = Date.parse(`${ate}T00:00:00Z`);
  let cur = Date.UTC(a1, m1 - 1, d1);
  if (!Number.isFinite(fim) || !Number.isFinite(cur) || fim < cur) return 0;

  let total = 0;
  // trava de sanidade: período maior que ~2 anos é erro de chamada, não caso de uso
  for (let i = 0; cur <= fim && i < 800; i++, cur += MS_DIA) {
    const dt = new Date(cur);
    total += folhaMensal / diasNoMes(dt.getUTCFullYear(), dt.getUTCMonth() + 1);
  }
  return total;
}

/** Interseção de dois períodos em dias de calendário — usada no recorte semana × mês. */
export function interseccao(
  aDe: string, aAte: string, bDe: string, bAte: string,
): { de: string; ate: string; dias: number } | null {
  const de = aDe > bDe ? aDe : bDe;
  const ate = aAte < bAte ? aAte : bAte;
  if (de > ate) return null;
  const dias = Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / MS_DIA) + 1;
  return { de, ate, dias };
}
