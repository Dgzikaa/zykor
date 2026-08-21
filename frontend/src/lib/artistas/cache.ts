/**
 * Cachê do artista a partir da negociação salva no cadastro (21/08/2026, Gonza).
 *
 * "Breno — 15% do fat. Doze — 8.000 ou 15% do fat. E aí ele já calcula o cachê automaticamente
 *  com base no faturamento/bilheteria etc."
 *
 * A regra vive aqui, pura, porque ela é usada em dois lugares que NÃO podem discordar: a prévia
 * na tela e o valor que vira pedido de pagamento no servidor. Um cachê que aparece R$ 8.000 na
 * tela e sai R$ 7.980 no PIX é um problema com o artista, não um bug de arredondamento.
 */

export type TipoAcordo = 'fixo' | 'percentual' | 'maior' | 'menor' | 'fixo_mais_percentual';
export type BaseCalculo = 'total' | 'entrada' | 'bar';

export interface Negociacao {
  tipo_acordo?: TipoAcordo | null;
  /** Valor fixo combinado (R$). */
  cachet_combinado?: number | null;
  /** Percentual sobre a base (ex.: 15 = 15%). */
  percentual_sociedade?: number | null;
  base_calculo?: BaseCalculo | null;
}

/** O que a noite faturou, já separado. Em eventos_base, total = entrada + bar. */
export interface BasesEvento {
  total: number;
  entrada: number;
  bar: number;
}

export interface CacheCalculado {
  /** null = não dá pra calcular (falta negociação ou falta a base). */
  valor: number | null;
  /** Por que deu esse valor — vai pra tela E pro snapshot do lançamento. */
  formula: string;
  /** Quanto valia a base usada. */
  base_valor: number | null;
  base_calculo: BaseCalculo;
  /** Motivo de não ter calculado, pra tela explicar em vez de mostrar "—". */
  motivo?: string;
}

export const ROTULO_BASE: Record<BaseCalculo, string> = {
  total: 'faturamento total',
  entrada: 'bilheteria/couvert',
  bar: 'faturamento do bar',
};

export const ROTULO_ACORDO: Record<TipoAcordo, string> = {
  fixo: 'Valor fixo',
  percentual: '% do faturamento',
  maior: 'Fixo ou %, o que for maior',
  menor: 'Fixo ou %, o que for menor',
  fixo_mais_percentual: 'Fixo + %',
};

/** Centavos, sempre — o valor vira PIX. */
const brl = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => `${String(v).replace('.', ',')}%`;

export function calcularCache(n: Negociacao | null | undefined, bases: BasesEvento): CacheCalculado {
  const base_calculo: BaseCalculo = (n?.base_calculo as BaseCalculo) || 'total';
  const vazio = (motivo: string): CacheCalculado =>
    ({ valor: null, formula: '', base_valor: null, base_calculo, motivo });

  if (!n?.tipo_acordo) return vazio('Sem negociação cadastrada');

  const fixo = Number(n.cachet_combinado ?? 0) || 0;
  const percentual = Number(n.percentual_sociedade ?? 0) || 0;
  const base = Number(bases?.[base_calculo] ?? 0) || 0;

  const precisaFixo = n.tipo_acordo !== 'percentual';
  const precisaPct = n.tipo_acordo !== 'fixo';
  if (precisaFixo && fixo <= 0) return vazio('Falta o valor fixo na negociação');
  if (precisaPct && percentual <= 0) return vazio('Falta o percentual na negociação');
  // Base zerada não é "cachê zero": é noite sem faturamento apurado ainda. Pagar 0 seria pior
  // que não pagar — e num acordo só de % o número ainda vai mudar quando o ETL fechar o dia.
  if (precisaPct && base <= 0) return vazio(`Sem ${ROTULO_BASE[base_calculo]} apurado no dia`);

  const doPct = brl((base * percentual) / 100);
  const rotuloPct = `${pct(percentual)} de ${ROTULO_BASE[base_calculo]} (${fmt(base)}) = ${fmt(doPct)}`;

  switch (n.tipo_acordo) {
    case 'fixo':
      return { valor: brl(fixo), formula: `Valor fixo ${fmt(fixo)}`, base_valor: base, base_calculo };

    case 'percentual':
      return { valor: doPct, formula: rotuloPct, base_valor: base, base_calculo };

    case 'maior': {
      const valor = Math.max(fixo, doPct);
      return {
        valor: brl(valor), base_valor: base, base_calculo,
        formula: `Maior entre fixo ${fmt(fixo)} e ${rotuloPct} → ${fmt(valor)}`,
      };
    }

    case 'menor': {
      const valor = Math.min(fixo, doPct);
      return {
        valor: brl(valor), base_valor: base, base_calculo,
        formula: `Menor entre fixo ${fmt(fixo)} e ${rotuloPct} → ${fmt(valor)}`,
      };
    }

    case 'fixo_mais_percentual': {
      const valor = brl(fixo + doPct);
      return {
        valor, base_valor: base, base_calculo,
        formula: `Fixo ${fmt(fixo)} + ${rotuloPct} → ${fmt(valor)}`,
      };
    }

    default:
      return vazio('Tipo de acordo desconhecido');
  }
}

/** Resumo curto da negociação, pra mostrar no cadastro/lista ("8.000 ou 15% do fat"). */
export function resumoNegociacao(n: Negociacao | null | undefined): string {
  if (!n?.tipo_acordo) return 'Sem negociação';
  const base = ROTULO_BASE[(n.base_calculo as BaseCalculo) || 'total'];
  const fixo = Number(n.cachet_combinado ?? 0) || 0;
  const p = Number(n.percentual_sociedade ?? 0) || 0;
  switch (n.tipo_acordo) {
    case 'fixo': return fmt(fixo);
    case 'percentual': return `${pct(p)} do ${base}`;
    case 'maior': return `${fmt(fixo)} ou ${pct(p)} do ${base} (o maior)`;
    case 'menor': return `${fmt(fixo)} ou ${pct(p)} do ${base} (o menor)`;
    case 'fixo_mais_percentual': return `${fmt(fixo)} + ${pct(p)} do ${base}`;
    default: return 'Sem negociação';
  }
}
