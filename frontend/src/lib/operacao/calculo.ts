/**
 * Cadeia de cálculo do Plano Operacional.
 *
 * É a mesma da planilha "Plano Operacional Semanal - Ordinário", com DOIS erros dela
 * conscientemente não reproduzidos:
 *
 *  1. O público da planilha sai de `=C8/$FA$4` — referência TRAVADA no ticket de SEGUNDA
 *     em todos os dias, apesar de existir ticket por dia da semana logo abaixo. Na prática
 *     a sexta calculava com 103 em vez de 113, superestimando o público e escalando gente
 *     a mais. Aqui o ticket é o do dia da semana da data.
 *  2. A coluna "SÁBADO - NOITE" vinha datada com o domingo. Aqui a data é a data e o turno
 *     é campo próprio.
 *
 * Fonte única: usada pela rota que grava e pela tela que mostra a prévia enquanto digita.
 */

export type ParametrosOperacao = {
  giro: number;
  /** dia da semana (0=domingo … 6=sábado) -> ticket médio */
  ticket_por_dia_semana: Record<number, number>;
  /** funcao_id -> { nivel_servico, diaria, custo_fechado_dia } */
  por_funcao: Record<string, {
    nivel_servico: number | null;
    diaria: number | null;
    /** contrato de equipe: valor fechado do dia, em vez de diária por cabeça */
    custo_fechado_dia?: number | null;
  }>;
};

/** Dia da semana de uma data AAAA-MM-DD, sem armadilha de fuso. */
export function diaDaSemana(dataISO: string): number {
  const [a, m, d] = dataISO.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** Ticket que vale no dia — override do dia ganha do parâmetro (data especial, festival). */
export function ticketDoDia(dataISO: string, p: ParametrosOperacao, ticketManual?: number | null): number | null {
  if (ticketManual != null) return ticketManual;
  const t = p.ticket_por_dia_semana[diaDaSemana(dataISO)];
  return t == null ? null : t;
}

/** Público esperado = faturamento / ticket do dia. */
export function calcularPublico(
  faturamento: number | null | undefined,
  dataISO: string,
  p: ParametrosOperacao,
  ticketManual?: number | null,
): number | null {
  if (faturamento == null) return null;
  const ticket = ticketDoDia(dataISO, p, ticketManual);
  if (!ticket) return null;
  return faturamento / ticket;
}

/** Pico de lugares = público / giro. */
export function calcularPico(
  publico: number | null,
  p: ParametrosOperacao,
  giroManual?: number | null,
): number | null {
  if (publico == null) return null;
  const giro = giroManual ?? p.giro;
  if (!giro) return null;
  return publico / giro;
}

/**
 * Total de gente da função = teto(pico / nível de serviço).
 * Função sem nível de serviço cadastrado (Liderança, Produção) não tem total automático —
 * devolve null e a célula fica branca (manual) na tela.
 */
export function calcularTotalFuncao(
  pico: number | null,
  funcaoId: string,
  p: ParametrosOperacao,
): number | null {
  if (pico == null) return null;
  const nivel = p.por_funcao[funcaoId]?.nivel_servico;
  if (!nivel) return null;
  return Math.ceil(pico / nivel);
}

/** Freelas = o que falta pra fechar o total depois dos fixos da escala. Nunca negativo. */
export function calcularFreelas(total: number | null, fixos: number | null): number {
  return Math.max(0, (total ?? 0) - (fixos ?? 0));
}

/**
 * Custo = freelas × diária. O FIXO (CLT) não entra — a projeção é do CMO variável.
 *
 * Exceção: função com `custo_fechado_dia` é contratada como EQUIPE, não por cabeça —
 * é o caso da segurança, em que a semana de 03/08 pagou R$ 3.040 (R$ 760 por "diária"
 * contra os R$ 190 do parâmetro). Aí o dia que precisa de reforço custa o valor
 * fechado, independentemente de quantas pessoas faltam.
 */
export function calcularCusto(freelas: number, funcaoId: string, p: ParametrosOperacao): number {
  const cfg = p.por_funcao[funcaoId];
  if (cfg?.custo_fechado_dia != null) return freelas > 0 ? cfg.custo_fechado_dia : 0;
  const diaria = cfg?.diaria;
  if (!diaria) return 0;
  return freelas * diaria;
}

/**
 * Estado da célula, que vira a cor na tela:
 *   branco  = digitado à mão, sem automático por trás
 *   verde   = veio da fórmula
 *   amarelo = tinha automático, mas alguém sobrescreveu
 */
export function origemCelula(calculado: number | null, manual: number | null): 'branco' | 'verde' | 'amarelo' {
  if (manual != null && calculado != null) return 'amarelo';
  if (calculado != null) return 'verde';
  return 'branco';
}

/** Recalcula um dia inteiro. Devolve o que gravar em operacao_dia + por função. */
export function recalcularDia(args: {
  dataISO: string;
  faturamento: number | null;
  ticketManual?: number | null;
  giroManual?: number | null;
  publicoManual?: number | null;
  picoManual?: number | null;
  funcoes: Array<{ funcao_id: string; total_manual?: number | null; fixos_escala?: number | null; fixos_manual?: number | null }>;
  parametros: ParametrosOperacao;
}) {
  const { dataISO, faturamento, ticketManual, giroManual, publicoManual, picoManual, funcoes, parametros } = args;

  const publicoCalc = calcularPublico(faturamento, dataISO, parametros, ticketManual);
  const publico = publicoManual ?? publicoCalc;
  const picoCalc = calcularPico(publico, parametros, giroManual);
  const pico = picoManual ?? picoCalc;

  const linhas = funcoes.map(f => {
    const totalCalc = calcularTotalFuncao(pico, f.funcao_id, parametros);
    const total = f.total_manual ?? totalCalc;
    const fixos = f.fixos_manual ?? f.fixos_escala ?? 0;
    const freelas = calcularFreelas(total, fixos);
    return {
      funcao_id: f.funcao_id,
      total_calculado: totalCalc,
      total,
      fixos,
      freelas,
      custo: calcularCusto(freelas, f.funcao_id, parametros),
      origem: origemCelula(totalCalc, f.total_manual ?? null),
    };
  });

  return {
    publico_calculado: publicoCalc,
    pico_calculado: picoCalc,
    publico,
    pico,
    funcoes: linhas,
    custo_dia: linhas.reduce((s, l) => s + l.custo, 0),
  };
}
