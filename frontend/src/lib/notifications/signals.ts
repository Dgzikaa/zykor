/**
 * Catálogo de SINAIS do construtor de alertas no-code.
 *
 * Um "sinal" é uma métrica curada que o admin pode usar numa condição
 * (sinal + operador + limite + alvo). A UI do construtor renderiza esses campos;
 * o motor de avaliação (server) sabe como calcular cada sinal e dispara pelo
 * dispatchNotification quando a condição bate (com cooldown, ver system.alert_conditions).
 *
 * TS puro (sem imports server-only) — usado nos dois lados.
 * Pra adicionar um sinal: (1) acrescente aqui; (2) implemente o cálculo no motor.
 */
import type { CategoriaEvento, Severidade } from './catalog';

export type Operador = 'lt' | 'lte' | 'gt' | 'gte' | 'eq';

export const OPERADORES: Record<Operador, { label: string; simbolo: string }> = {
  lt: { label: 'menor que', simbolo: '<' },
  lte: { label: 'menor ou igual a', simbolo: '≤' },
  gt: { label: 'maior que', simbolo: '>' },
  gte: { label: 'maior ou igual a', simbolo: '≥' },
  eq: { label: 'igual a', simbolo: '=' },
};

export interface AlertSignal {
  /** código estável — gravado em system.alert_conditions.signal_key */
  key: string;
  label: string;
  descricao: string;
  categoria: CategoriaEvento;
  /** unidade do valor comparado (só rótulo): 'un', 'R$', '%', 'kg'... */
  unidade?: string;
  /** operadores que fazem sentido pra este sinal */
  operadores: Operador[];
  /** false = comparação embutida (ex: < mínimo cadastrado), esconde o campo "limite" */
  usaLimite: boolean;
  /** se precisa apontar um alvo específico (ex: UM insumo); ausente = varre todos */
  requerAlvo?: { tipo: 'insumo' | 'produto'; label: string };
  severidadeSugerida: Severidade;
  /** como é avaliado. v1: todos por cron (com cooldown). */
  modo: 'cron';
  /** false = o motor ainda não sabe calcular este sinal (UI mostra "em breve"). */
  implementado: boolean;
}

export const ALERT_SIGNALS: AlertSignal[] = [
  {
    key: 'estoque_insumo_min',
    label: 'Estoque de insumo abaixo do mínimo',
    descricao:
      'Qualquer insumo (curva A) cujo estoque atual esteja abaixo do mínimo cadastrado. Avalia todos os insumos.',
    categoria: 'estoque',
    unidade: 'un',
    operadores: ['lt'],
    usaLimite: false, // usa o mínimo do cadastro (última contagem por insumo)
    severidadeSugerida: 'alerta',
    modo: 'cron',
    implementado: true,
  },
  {
    key: 'estoque_insumo',
    label: 'Estoque de UM insumo abaixo de X',
    descricao: 'O estoque (última contagem) de um insumo específico cruza um limite que você define.',
    categoria: 'estoque',
    unidade: 'un',
    operadores: ['lt', 'lte'],
    usaLimite: true,
    requerAlvo: { tipo: 'insumo', label: 'Insumo' },
    severidadeSugerida: 'alerta',
    modo: 'cron',
    implementado: true,
  },
  {
    key: 'stockout_dia',
    label: 'Stockout do dia (%)',
    descricao: 'O % de produtos em ruptura (sem estoque p/ vender) no último cálculo do dia cruza um limite.',
    categoria: 'estoque',
    unidade: '%',
    operadores: ['gt', 'gte'],
    usaLimite: true,
    severidadeSugerida: 'alerta',
    modo: 'cron',
    implementado: true,
  },
  {
    key: 'desvio_consumo',
    label: 'Desvio de consumo (R$, últimos 7 dias)',
    descricao: 'O total de desvio de consumo (real − teórico, só as perdas) dos últimos 7 dias cruza um limite.',
    categoria: 'estoque',
    unidade: 'R$',
    operadores: ['gt', 'gte'],
    usaLimite: true,
    severidadeSugerida: 'alerta',
    modo: 'cron',
    implementado: true,
  },
  {
    key: 'producao_nao_executada',
    label: 'Produção planejada não executada',
    descricao:
      'Produção planejada pra hoje que ainda não foi registrada. Dispara automático por produção (bom rodar no fim do dia).',
    categoria: 'operacional',
    operadores: ['gt'],
    usaLimite: false,
    severidadeSugerida: 'alerta',
    modo: 'cron',
    implementado: true,
  },
  {
    key: 'rendimento_fora_esperado',
    label: 'Rendimento de produção fora do esperado (%)',
    descricao:
      'Uma produção de hoje teve rendimento real desviando do esperado acima de X%. Dispara por produção.',
    categoria: 'operacional',
    unidade: '%',
    operadores: ['gt', 'gte'],
    usaLimite: true,
    severidadeSugerida: 'alerta',
    modo: 'cron',
    implementado: true,
  },
  {
    key: 'insumo_sem_contagem',
    label: 'Insumo (curva A) sem contagem há X dias',
    descricao: 'Insumo de curva A cuja última contagem é mais antiga que X dias. Dispara por insumo.',
    categoria: 'estoque',
    unidade: 'dias',
    operadores: ['gt', 'gte'],
    usaLimite: true,
    severidadeSugerida: 'alerta',
    modo: 'cron',
    implementado: true,
  },
  {
    key: 'avaliacao_google',
    label: 'Avaliação Google abaixo de X',
    descricao: 'A média de avaliações do Google (última semana calculada) cruza um limite.',
    categoria: 'nps',
    operadores: ['lt', 'lte'],
    usaLimite: true,
    severidadeSugerida: 'alerta',
    modo: 'cron',
    implementado: true,
  },
  {
    key: 'lancamento_vencido',
    label: 'Lançamentos vencidos (despesas, 60 dias)',
    descricao:
      'Total de despesas vencidas/atrasadas no Conta Azul (últimos 60 dias de competência) cruza um limite.',
    categoria: 'financeiro',
    unidade: 'lançamentos',
    operadores: ['gt', 'gte'],
    usaLimite: true,
    severidadeSugerida: 'alerta',
    modo: 'cron',
    implementado: true,
  },
  {
    key: 'faturamento_abaixo_meta',
    label: 'Faturamento do dia abaixo da meta',
    descricao:
      'O faturamento do último dia ficou abaixo da meta cadastrada para aquele dia da semana (Orçamentação). Dispara automático.',
    categoria: 'financeiro',
    unidade: 'R$',
    operadores: ['lt'],
    usaLimite: false,
    severidadeSugerida: 'alerta',
    modo: 'cron',
    implementado: true,
  },
  {
    key: 'cmv_alto',
    label: 'CMV acima de X%',
    descricao: 'O CMV% da última semana calculada passou do limite que você define (ex: > 30%).',
    categoria: 'financeiro',
    unidade: '%',
    operadores: ['gt', 'gte'],
    usaLimite: true,
    severidadeSugerida: 'alerta',
    modo: 'cron',
    implementado: true,
  },
  {
    key: 'caixa_apertado',
    label: 'Caixa apertado (menor saldo previsto < X)',
    descricao:
      'O menor saldo diário projetado (fluxo de caixa, cenário base, próximos 30 dias) fica abaixo do limite.',
    categoria: 'financeiro',
    unidade: 'R$',
    operadores: ['lt', 'lte'],
    usaLimite: true,
    severidadeSugerida: 'critico',
    modo: 'cron',
    implementado: true,
  },
  {
    key: 'pipeline_parado',
    label: 'Pipeline de dados parado',
    descricao: 'Algum pipeline (sync/cron) está atrasado ou sem dados além do SLA. Dispara automático por pipeline.',
    categoria: 'sistema',
    operadores: ['gt'],
    usaLimite: false, // condição embutida (atrasado / sem dados)
    severidadeSugerida: 'critico',
    modo: 'cron',
    implementado: true,
  },
  {
    key: 'faturamento_dia',
    label: 'Faturamento do dia',
    descricao: 'O faturamento líquido do último dia operacional cruza um limite (ex: abaixo de R$ X).',
    categoria: 'financeiro',
    unidade: 'R$',
    operadores: ['lt', 'lte', 'gt', 'gte'],
    usaLimite: true,
    severidadeSugerida: 'alerta',
    modo: 'cron',
    implementado: true,
  },
  {
    key: 'nps_semana',
    label: 'NPS (última medição)',
    descricao: 'O NPS mais recente do bar cruza um limite (ex: abaixo de X).',
    categoria: 'nps',
    unidade: '',
    operadores: ['lt', 'lte'],
    usaLimite: true,
    severidadeSugerida: 'alerta',
    modo: 'cron',
    implementado: true,
  },
];

const SIGNALS_BY_KEY = new Map(ALERT_SIGNALS.map((s) => [s.key, s]));

export function getSignal(key: string): AlertSignal | undefined {
  return SIGNALS_BY_KEY.get(key);
}

/** Compara um valor contra o limite pelo operador. */
export function compara(valor: number, operador: Operador, limite: number): boolean {
  switch (operador) {
    case 'lt':
      return valor < limite;
    case 'lte':
      return valor <= limite;
    case 'gt':
      return valor > limite;
    case 'gte':
      return valor >= limite;
    case 'eq':
      return valor === limite;
    default:
      return false;
  }
}
