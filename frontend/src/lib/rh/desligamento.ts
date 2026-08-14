/**
 * Regras do desligamento (ata de 13/08/2026).
 *
 * A escolha é em cascata, e cada ramo fecha possibilidades:
 *
 *   Pelo funcionário ──┬── sem aviso prévio
 *                      └── com aviso prévio ──┬── −2h/dia
 *                                             └── −7 dias
 *   Pela empresa ──────┬── com justa causa            (não tem aviso prévio)
 *                      └── sem justa causa ──┬── sem aviso prévio
 *                                            └── com aviso prévio ──┬── −2h/dia
 *                                                                   └── −7 dias
 *
 * Carta de demissão só existe quando parte do funcionário — pela empresa não se anexa nada.
 */

export type Iniciativa = 'funcionario' | 'empresa';
export type AvisoPrevio = 'sem' | 'trabalhado';
export type Modalidade = '2h_dia' | '7_dias';

export const LABEL_INICIATIVA: Record<Iniciativa, string> = {
  funcionario: 'Pelo funcionário',
  empresa: 'Pela empresa',
};
export const LABEL_MODALIDADE: Record<Modalidade, string> = {
  '2h_dia': '2h a menos por dia',
  '7_dias': '7 dias a menos',
};

export interface FormDesligamento {
  iniciativa: Iniciativa;
  justa_causa: boolean;
  aviso_previo: AvisoPrevio;
  modalidade: Modalidade | null;
  data_comunicacao: string;
  data_desligamento?: string | null;
}

/**
 * Último dia de trabalho sugerido: um mês após a comunicação, menos 7 dias quando a escolha for
 * "7 dias a menos". Bate com os dois casos reais da ata — Jheydi comunicou 29/07 e sai 29/08 (com
 * −2h/dia, que encurta a jornada e não o calendário); Alexandre comunicou 29/07 e sai 22/08.
 *
 * É SUGESTÃO: a data fica editável, porque feriado, acordo e data de pagamento mexem nisso e não é
 * papel do sistema decidir sozinho um prazo que tem efeito rescisório.
 */
export function fimDoAviso(dataComunicacao: string, aviso: AvisoPrevio, modalidade: Modalidade | null): string {
  const d = new Date(`${String(dataComunicacao).slice(0, 10)}T00:00:00`);
  if (aviso === 'sem') return d.toISOString().slice(0, 10);

  const dia = d.getDate();
  d.setMonth(d.getMonth() + 1);
  // 31/01 + 1 mês viraria 03/03 no JS; segura no último dia do mês.
  if (d.getDate() !== dia) d.setDate(0);
  if (modalidade === '7_dias') d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

/** Devolve a mensagem de erro (pt-BR) ou null quando o preenchimento é coerente. */
export function validaDesligamento(f: FormDesligamento): string | null {
  if (!f.data_comunicacao) return 'Informe a data da comunicação.';
  if (f.iniciativa === 'funcionario' && f.justa_causa) {
    return 'Justa causa é uma decisão da empresa — não se aplica a pedido de demissão.';
  }
  if (f.justa_causa && f.aviso_previo !== 'sem') {
    return 'Demissão por justa causa não tem aviso prévio.';
  }
  if (f.aviso_previo === 'trabalhado' && !f.modalidade) {
    return 'Escolha a redução do aviso prévio: 2h a menos por dia ou 7 dias a menos.';
  }
  if (f.aviso_previo === 'sem' && f.modalidade) {
    return 'Sem aviso prévio não há redução de jornada.';
  }
  if (f.data_desligamento && f.data_desligamento < f.data_comunicacao) {
    return 'O último dia não pode ser antes da comunicação.';
  }
  return null;
}

/** Voluntário quando parte do funcionário; involuntário quando parte da empresa. */
export function tipoDesligamento(iniciativa: Iniciativa): 'Voluntário' | 'Involuntário' {
  return iniciativa === 'funcionario' ? 'Voluntário' : 'Involuntário';
}

/** Texto curto para o histórico e para a linha da ata. */
export function resumoDesligamento(f: FormDesligamento): string {
  const partes = [LABEL_INICIATIVA[f.iniciativa]];
  if (f.iniciativa === 'empresa') partes.push(f.justa_causa ? 'com justa causa' : 'sem justa causa');
  partes.push(f.aviso_previo === 'sem'
    ? 'sem aviso prévio'
    : `aviso prévio trabalhado (${f.modalidade ? LABEL_MODALIDADE[f.modalidade] : '—'})`);
  return partes.join(' · ');
}
