/**
 * Modelo de período compartilhado da área Receitas.
 *
 * Dois eixos independentes (a reunião de marketing mistura os dois):
 *   - `granularidade`: como os dados são agrupados no gráfico (diário/semanal/mensal).
 *   - `preset` + `inicio`/`fim`: a janela de tempo (7d, 14d, mensal, trimestral,
 *     semestral, anual ou intervalo custom via calendário).
 *
 * Puro (sem React) de propósito: usável tanto no client quanto para montar
 * querystrings de API no server.
 */

export type Granularidade = 'dia' | 'semana' | 'mes';

export type PeriodoPreset =
  | '7d'
  | '14d'
  | 'mensal'
  | 'trimestral'
  | 'semestral'
  | 'anual'
  | 'custom';

export interface PeriodoValor {
  granularidade: Granularidade;
  preset: PeriodoPreset;
  /** Data inicial no formato YYYY-MM-DD (horário local). */
  inicio: string;
  /** Data final no formato YYYY-MM-DD (horário local). */
  fim: string;
}

export const GRANULARIDADE_OPCOES: { valor: Granularidade; label: string }[] = [
  { valor: 'dia', label: 'Diário' },
  { valor: 'semana', label: 'Semanal' },
  { valor: 'mes', label: 'Mensal' },
];

type PresetFixo = Exclude<PeriodoPreset, 'custom'>;

export const PRESET_OPCOES: { valor: PresetFixo; label: string; dias: number }[] = [
  { valor: '7d', label: '7 dias', dias: 7 },
  { valor: '14d', label: '14 dias', dias: 14 },
  { valor: 'mensal', label: 'Mensal', dias: 30 },
  { valor: 'trimestral', label: 'Trimestral', dias: 90 },
  { valor: 'semestral', label: 'Semestral', dias: 180 },
  { valor: 'anual', label: 'Anual', dias: 365 },
];

/** Formata um Date como YYYY-MM-DD respeitando o fuso local (não UTC). */
export function toISODate(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Janela rolante terminando em `hoje` (inclusive) para um preset fixo.
 * Ex.: preset '7d' → [hoje-6, hoje].
 */
export function calcularRange(preset: PresetFixo, hoje: Date = new Date()): { inicio: string; fim: string } {
  const opt = PRESET_OPCOES.find((p) => p.valor === preset);
  const dias = opt?.dias ?? 30;
  const fim = new Date(hoje);
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - (dias - 1));
  return { inicio: toISODate(inicio), fim: toISODate(fim) };
}

/** Valor inicial padrão do picker. */
export function periodoPadrao(
  granularidade: Granularidade = 'mes',
  preset: PresetFixo = 'trimestral',
): PeriodoValor {
  const { inicio, fim } = calcularRange(preset);
  return { granularidade, preset, inicio, fim };
}
