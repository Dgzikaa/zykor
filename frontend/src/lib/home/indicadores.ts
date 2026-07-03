/**
 * Catálogo de indicadores da HOME + régua de status (Orgulho da Casa / Pontos de Atenção).
 *
 * Puro e testável (sem React/Next). A home é vista por TODOS os cargos, então o catálogo
 * é DELIBERADAMENTE não-financeiro (nada de CMV/faturamento/ticket) — só experiência do
 * cliente, operação/qualidade e pessoas.
 *
 * Inteligência:
 *  - AMOSTRA MÍNIMA: NPS/Google só contam com base suficiente (ex.: NPS≥10 respostas,
 *    Google≥5 avaliações) — evita "NPS 100 de 1 resposta" virar orgulho.
 *  - DIREÇÃO + RÉGUA: cada indicador vira status (otimo/bom/neutro/atencao/critico).
 *  - ROTEAMENTO: bom sobe pro Orgulho; ruim cai em Pontos de Atenção.
 *  - RISCO-ONLY: no-show/stockout só aparecem quando ruins (ninguém se orgulha de
 *    "só 16% de no-show").
 *
 * Régua calibrada com os dados reais (gold.desempenho mensal, bares 3 e 4, jul/2026).
 * Ajustável: os cortes podem ser recalibrados por percentis históricos por bar (fase 2:
 * comparar com a própria média do bar / tendência mês a mês).
 */

export type StatusIndicador = 'otimo' | 'bom' | 'neutro' | 'atencao' | 'critico';
export type FormatoIndicador = 'nps' | 'estrelas' | 'percent' | 'nota10';

export interface LinhaDesempenho {
  nps_geral: number | null;
  nps_respostas: number | null;
  media_avaliacoes_google: number | null;
  google_reviews_total: number | null;
  reservas_quebra_pct: number | null;
  atrasos_cozinha_perc: number | null;
  atrasos_bar_perc: number | null;
  stockout_total_perc: number | null;
  nota_felicidade_equipe: number | null;
  retencao_1m: number | null;
}

export interface IndicadorCalculado {
  key: string;
  label: string;
  grupo: 'cliente' | 'operacao' | 'pessoas';
  status: StatusIndicador;
  valorTexto: string;
  detalhe?: string;
  /** Nome do ícone lucide-react (a home mapeia para componente). */
  icone: string;
}

export interface DestaquesHome {
  orgulho: IndicadorCalculado[];
  atencao: IndicadorCalculado[];
  /** "De olho": os indicadores mais fracos quando não há nada crítico (evita o falso "tudo em dia"). */
  monitorar: IndicadorCalculado[];
}

type Direcao = 'maior' | 'menor';

interface DefIndicador {
  key: string;
  label: string;
  grupo: 'cliente' | 'operacao' | 'pessoas';
  icone: string;
  direcao: Direcao;
  /** Cortes do melhor pro pior: [otimo, bom, neutro, atencao] (o 5º nível é o resto = crítico). */
  cortes: [number, number, number, number];
  formato: FormatoIndicador;
  /** Métrica de risco: só aparece em Pontos de Atenção (nunca no Orgulho). */
  apenasAtencao?: boolean;
  valor: (r: LinhaDesempenho) => number | null;
  amostraOk?: (r: LinhaDesempenho) => boolean;
  detalhe?: (r: LinhaDesempenho) => string | undefined;
}

const num = (v: number | null | undefined): number | null =>
  v == null || Number.isNaN(Number(v)) ? null : Number(v);

const CATALOGO: DefIndicador[] = [
  {
    key: 'nps', label: 'NPS do mês', grupo: 'cliente', icone: 'Smile', direcao: 'maior',
    cortes: [75, 55, 40, 25], formato: 'nps',
    valor: r => num(r.nps_geral),
    amostraOk: r => (num(r.nps_respostas) ?? 0) >= 10,
    detalhe: r => { const n = num(r.nps_respostas); return n ? `${n} respostas` : undefined; },
  },
  {
    key: 'google', label: 'Nota no Google', grupo: 'cliente', icone: 'Star', direcao: 'maior',
    cortes: [4.8, 4.5, 4.2, 3.8], formato: 'estrelas',
    valor: r => num(r.media_avaliacoes_google),
    amostraOk: r => (num(r.google_reviews_total) ?? 0) >= 5,
    detalhe: r => { const n = num(r.google_reviews_total); return n ? `${n} avaliações` : undefined; },
  },
  {
    key: 'pontualidade', label: 'Pontualidade cozinha/bar', grupo: 'operacao', icone: 'Timer', direcao: 'maior',
    cortes: [97, 92, 85, 75], formato: 'percent',
    valor: r => {
      const c = num(r.atrasos_cozinha_perc);
      const b = num(r.atrasos_bar_perc);
      if (c == null && b == null) return null;
      return 100 - Math.max(c ?? 0, b ?? 0);
    },
    detalhe: () => 'pedidos no horário',
  },
  {
    key: 'felicidade', label: 'Felicidade da equipe', grupo: 'pessoas', icone: 'Heart', direcao: 'maior',
    cortes: [8.5, 7.5, 6, 5], formato: 'nota10',
    valor: r => num(r.nota_felicidade_equipe),
  },
  {
    key: 'retencao', label: 'Retenção de clientes', grupo: 'pessoas', icone: 'Repeat', direcao: 'maior',
    cortes: [35, 28, 20, 12], formato: 'percent',
    valor: r => num(r.retencao_1m),
  },
  // --- Risco (só Pontos de Atenção / De olho) ---
  {
    key: 'no_show', label: 'No-show de reservas', grupo: 'cliente', icone: 'CalendarX2', direcao: 'menor',
    cortes: [10, 18, 25, 32], formato: 'percent', apenasAtencao: true,
    valor: r => num(r.reservas_quebra_pct),
  },
  {
    key: 'stockout', label: 'Ruptura de estoque', grupo: 'operacao', icone: 'PackageX', direcao: 'menor',
    cortes: [4, 7, 12, 20], formato: 'percent', apenasAtencao: true,
    valor: r => num(r.stockout_total_perc),
  },
];

function statusDe(v: number, direcao: Direcao, cortes: [number, number, number, number]): StatusIndicador {
  const [o, b, n, a] = cortes;
  if (direcao === 'maior') {
    if (v >= o) return 'otimo';
    if (v >= b) return 'bom';
    if (v >= n) return 'neutro';
    if (v >= a) return 'atencao';
    return 'critico';
  }
  if (v <= o) return 'otimo';
  if (v <= b) return 'bom';
  if (v <= n) return 'neutro';
  if (v <= a) return 'atencao';
  return 'critico';
}

function formata(v: number, f: FormatoIndicador): string {
  switch (f) {
    case 'nps': return String(Math.round(v));
    case 'estrelas':
    case 'nota10': return v.toFixed(1).replace('.', ',');
    case 'percent': return `${Math.round(v)}%`;
  }
}

const RANK: Record<StatusIndicador, number> = { otimo: 2, bom: 1, neutro: 0, atencao: -1, critico: -2 };

export function calcularDestaques(r: LinhaDesempenho | null | undefined): DestaquesHome {
  if (!r) return { orgulho: [], atencao: [], monitorar: [] };

  const calc: Array<IndicadorCalculado & { _rank: number; _apenasAtencao: boolean }> = [];
  for (const def of CATALOGO) {
    if (def.amostraOk && !def.amostraOk(r)) continue;
    const v = def.valor(r);
    if (v == null) continue;
    const status = statusDe(v, def.direcao, def.cortes);
    calc.push({
      key: def.key,
      label: def.label,
      grupo: def.grupo,
      icone: def.icone,
      status,
      valorTexto: formata(v, def.formato),
      detalhe: def.detalhe?.(r),
      _rank: RANK[status],
      _apenasAtencao: !!def.apenasAtencao,
    });
  }

  const limpar = (i: (typeof calc)[number]): IndicadorCalculado => ({
    key: i.key, label: i.label, grupo: i.grupo, icone: i.icone, status: i.status,
    valorTexto: i.valorTexto, detalhe: i.detalhe,
  });

  const orgulho = calc
    .filter(i => !i._apenasAtencao && (i.status === 'otimo' || i.status === 'bom'))
    .sort((a, b) => b._rank - a._rank)
    .slice(0, 4)
    .map(limpar);

  const atencao = calc
    .filter(i => i.status === 'atencao' || i.status === 'critico')
    .sort((a, b) => a._rank - b._rank) // crítico primeiro
    .slice(0, 3)
    .map(limpar);

  // "De olho": quando NÃO há nada crítico, mostra os indicadores mais fracos (neutros
  // ou métricas de risco ainda ok) em vez de um falso "tudo em dia". Nunca repete o
  // que já está em Orgulho/Atenção.
  const usadas = new Set([...orgulho, ...atencao].map(i => i.key));
  const monitorar = calc
    .filter(i => !usadas.has(i.key))
    .filter(i => i.status === 'neutro' || (i._apenasAtencao && i.status === 'bom'))
    .sort((a, b) => a._rank - b._rank)
    .slice(0, 2)
    .map(limpar);

  return { orgulho, atencao, monitorar };
}
