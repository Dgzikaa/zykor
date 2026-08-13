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

/** Folha de um mês 'AAAA-MM'. Devolve null quando não dá pra saber. */
export type FolhaDoMes = (chaveMes: string) => number | null;

/**
 * Folha rateada pelos dias de calendário entre `de` e `ate` (ambos inclusive).
 *
 * São dias de CALENDÁRIO, não dias de operação: a folha corre no mês inteiro, o bar
 * abrindo ou não. É o que faz a soma das semanas fechar com o mês.
 *
 * A folha é resolvida POR MÊS (e não um número só) porque ela muda: no bar 3 saiu de
 * R$ 170.721 em janeiro para R$ 198.990 em julho. Uma constante fica velha em semanas.
 */
export function cmoFixoDoPeriodo(de: string, ate: string, folha: FolhaDoMes | number | null | undefined): number {
  const resolver: FolhaDoMes = typeof folha === 'function' ? folha : () => (folha ?? null);
  const [a1, m1, d1] = de.split('-').map(Number);
  const fim = Date.parse(`${ate}T00:00:00Z`);
  let cur = Date.UTC(a1, m1 - 1, d1);
  if (!Number.isFinite(fim) || !Number.isFinite(cur) || fim < cur) return 0;

  let total = 0;
  // trava de sanidade: período maior que ~2 anos é erro de chamada, não caso de uso
  for (let i = 0; cur <= fim && i < 800; i++, cur += MS_DIA) {
    const dt = new Date(cur);
    const ano = dt.getUTCFullYear();
    const mes = dt.getUTCMonth() + 1;
    const v = resolver(`${ano}-${String(mes).padStart(2, '0')}`);
    if (v) total += v / diasNoMes(ano, mes);
  }
  return total;
}

/**
 * De onde saiu a folha de um mês. Vira rótulo na tela — quem olha um CMO precisa saber se
 * o número é o que já foi pago ou uma projeção.
 */
export type OrigemFolha = 'manual' | 'realizado' | 'projecao' | 'sem_dado';

/**
 * Monta o resolvedor da folha a partir do que o financeiro tem.
 *
 * - **override** preenchido no parâmetro ganha sempre (caso excepcional: financeiro errado);
 * - **mês já fechado** usa o realizado (`gold.cmo_produtividade_mensal.cmo_fixo_operacao`);
 * - **mês em curso ou futuro** usa a média dos 3 últimos fechados. O mês corrente NÃO pode
 *   usar o próprio realizado: em 13/08 o agosto tinha R$ 50.509 lançados de uma folha que
 *   vai fechar perto de R$ 200.000, e o CMO apareceria como um quarto do que é.
 */
export function montarFolhaDoMes(args: {
  meses: Array<{ mes: string; cmo_fixo_operacao: number | string | null }>;
  override?: number | null;
  hojeISO: string;
}): { folha: FolhaDoMes; origem: (chaveMes: string) => OrigemFolha; projecao: number | null } {
  const { meses, override, hojeISO } = args;
  const mesCorrente = hojeISO.slice(0, 7);

  const realizado = new Map<string, number>();
  meses.forEach(m => {
    const chave = String(m.mes).slice(0, 7);
    const v = Number(m.cmo_fixo_operacao || 0);
    if (v > 0) realizado.set(chave, v);
  });

  const fechados = [...realizado.entries()]
    .filter(([chave]) => chave < mesCorrente)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 3)
    .map(([, v]) => v);
  const projecao = fechados.length ? fechados.reduce((s, v) => s + v, 0) / fechados.length : null;

  const origem = (chaveMes: string): OrigemFolha => {
    if (override != null) return 'manual';
    if (chaveMes < mesCorrente && realizado.has(chaveMes)) return 'realizado';
    return projecao != null ? 'projecao' : 'sem_dado';
  };

  const folha: FolhaDoMes = (chaveMes) => {
    if (override != null) return override;
    if (chaveMes < mesCorrente && realizado.has(chaveMes)) return realizado.get(chaveMes)!;
    return projecao;
  };

  return { folha, origem, projecao };
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
