/**
 * Painel do Líder — o que cada área enxerga.
 *
 * Pedido da Mafê (22/08/2026): *"e se tivesse um painel de liderança operacional? Seria
 * praticamente um filtro, mas que se eu entrasse nele eu veria todos os indicadores que têm a ver
 * com a minha área especificamente. NPS dos drinks, tempo de saída, stockouts (...) se a Andréia
 * entrar no painel dela, teria lá NPS atendimento, CMO, pesquisa da felicidade, avaliação do
 * Google (...) o Renato vê tempo de entrega e indicadores dos cumins, o Luan a recepção"*.
 *
 * A área NÃO é escolhida no cadastro do painel: sai da CADEIRA do organograma de quem está
 * logado (ver project_organograma_manda_cargo_area_e_lideranca). Quem ocupa cadeira sem área —
 * Gerente Operacional, sócio — cai no seletor e enxerga todas.
 *
 * Este arquivo é só o DE-PARA. Os números vêm das mesmas fontes das telas que já existem; o
 * painel é recorte, não indicador novo. Se um número diverge da tela detalhada, é bug — não
 * "outra metodologia".
 */

/** Área do organograma (hr.areas.nome) — o nome é a chave, é ele que aparece no cadastro. */
export type AreaOperacional =
  | 'Bar' | 'Cozinha' | 'Atendimento' | 'Cumins' | 'Fila' | 'Limpeza/Infra';

export const AREAS: AreaOperacional[] = [
  'Bar', 'Cozinha', 'Atendimento', 'Cumins', 'Fila', 'Limpeza/Infra',
];

/**
 * Dimensão do NPS que pertence a cada área. O encaixe é natural porque a pesquisa do Falae já
 * pergunta por frente de trabalho — conferido no bar 3 (90 dias): Drinks 200 respostas, Cardápio
 * e Comida 198, Atendimento/Tempo de entrega/Entrada e saída/Limpeza 220 cada.
 *
 * Ambiente, Música e Custo-benefício ficam de fora de propósito: são da CASA, não de uma área.
 * Empurrar pra alguém seria cobrar de quem não decide.
 */
export const NPS_DA_AREA: Record<AreaOperacional, string> = {
  Bar: 'Drinks',
  Cozinha: 'Comida',
  Atendimento: 'Atendimento',
  Cumins: 'Tempo de espera',
  Fila: 'Entrada/Saída',
  'Limpeza/Infra': 'Limpeza',
};

/**
 * Setor da Pesquisa da Felicidade → área do organograma. A planilha da felicidade nasceu antes do
 * organograma e usa outros nomes (GARÇONS, CUMIM, ASG, RECEPÇÃO). Sem este de-para o painel do
 * Atendimento ficaria sem felicidade só por causa do rótulo.
 */
export const SETOR_FELICIDADE: Record<AreaOperacional, string[]> = {
  Bar: ['BAR'],
  Cozinha: ['COZINHA'],
  Atendimento: ['GARÇONS', 'GARCONS', 'ATENDIMENTO'],
  Cumins: ['CUMIM', 'CUMINS'],
  Fila: ['RECEPÇÃO', 'RECEPCAO', 'FILA'],
  'Limpeza/Infra': ['ASG', 'LIMPEZA'],
};

/** Qual tempo de produção do ContaHub é responsabilidade da área (segundos, por evento). */
export const TEMPO_DA_AREA: Partial<Record<AreaOperacional, { campo: 't_bar' | 't_coz'; rotulo: string }>> = {
  Bar: { campo: 't_bar', rotulo: 'Tempo de saída do bar' },
  Cozinha: { campo: 't_coz', rotulo: 'Tempo de saída da cozinha' },
  // Cumins não tem tempo próprio no ContaHub — o que mede a entrega deles é o NPS "Tempo de
  // espera", que já está no NPS_DA_AREA. Melhor não ter o card do que ter um card com o tempo
  // de outra área dentro.
};

/** Stockout é da frente que repõe: bebida é do Bar, comida é da Cozinha. */
export const STOCKOUT_DA_AREA: Partial<Record<AreaOperacional, 'bebida' | 'comida'>> = {
  Bar: 'bebida',
  Cozinha: 'comida',
};

/** Atraso de pedido no ContaHub só existe pro bar hoje (atrasinho_bar / atrasao_bar). */
export const TEM_ATRASO_PEDIDO: AreaOperacional[] = ['Bar'];

/**
 * Dimensão do Google que pertence a cada área. O Google JÁ coleta nota por dimensão
 * (`rating_service` / `rating_food` / `rating_atmosphere`), então não há inferência nenhuma aqui —
 * é a nota que o cliente deu naquele campo. Cobertura no bar 3 (90 dias): 1.989 notas de serviço e
 * 1.899 de comida em 2.124 reviews.
 *
 * `ambiente` NÃO entra: é da casa, não de uma área — mesma régua do NPS. E Bar, Cumins e Fila não
 * têm dimensão própria no Google; pra elas a tela mostra a nota geral da casa, dizendo que é geral.
 */
export const GOOGLE_DA_AREA: Partial<Record<AreaOperacional, { campo: 'atendimento' | 'comida'; rotulo: string }>> = {
  Atendimento: { campo: 'atendimento', rotulo: 'Google · atendimento' },
  Cozinha: { campo: 'comida', rotulo: 'Google · comida' },
};

/** Régua do Google (1 a 5). O padrão da casa é ~4,9, então 4,5 já é sinal amarelo. */
export function corGoogle(nota: number | null | undefined): 'bom' | 'atencao' | 'ruim' | 'vazio' {
  if (nota == null) return 'vazio';
  if (nota >= 4.7) return 'bom';
  if (nota >= 4.3) return 'atencao';
  return 'ruim';
}

/** Régua do NPS por nota média (escala 1-5 do Falae). 3 é o meio; quem gostou dá 4 ou 5. */
export function corNota(nota: number | null | undefined): 'bom' | 'atencao' | 'ruim' | 'vazio' {
  if (nota == null) return 'vazio';
  if (nota >= 4.5) return 'bom';
  if (nota >= 4.0) return 'atencao';
  return 'ruim';
}

/** Régua da Pesquisa da Felicidade (% favorável − % desfavorável, escala −100 a 100). */
export function corFelicidade(pct: number | null | undefined): 'bom' | 'atencao' | 'ruim' | 'vazio' {
  if (pct == null) return 'vazio';
  if (pct >= 75) return 'bom';
  if (pct >= 50) return 'atencao';
  return 'ruim';
}

export const CORES: Record<'bom' | 'atencao' | 'ruim' | 'vazio', string> = {
  bom: 'text-emerald-600 dark:text-emerald-400',
  atencao: 'text-amber-600 dark:text-amber-400',
  ruim: 'text-rose-600 dark:text-rose-400',
  vazio: 'text-gray-400',
};

/** Segundos → "8min 12s" / "45s". O ContaHub devolve tempo de produção em segundos. */
export function fmtTempo(seg: number | null | undefined): string {
  if (seg == null || !Number.isFinite(seg) || seg <= 0) return '—';
  const s = Math.round(seg);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}min ${r}s` : `${m}min`;
}
