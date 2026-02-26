/**
 * 📊 Tendency Calculator - Cálculo de Tendências
 * 
 * Módulo compartilhado para cálculo de tendências, médias móveis,
 * e análises estatísticas de séries temporais.
 */

export interface TendenciaResultado {
  tendencia: 'crescimento' | 'queda' | 'estavel';
  percentual: number;
  confianca: 'alta' | 'media' | 'baixa';
  descricao: string;
}

export interface MediaMovel {
  data: string;
  valor: number;
  mediaMovel: number;
}

/**
 * Calcular tendência de uma série temporal
 */
export function calcularTendencia(
  valores: number[],
  limiarEstavel: number = 5
): TendenciaResultado {
  if (valores.length < 2) {
    return {
      tendencia: 'estavel',
      percentual: 0,
      confianca: 'baixa',
      descricao: 'Dados insuficientes para calcular tendência',
    };
  }
  
  const primeiraMetade = valores.slice(0, Math.floor(valores.length / 2));
  const segundaMetade = valores.slice(Math.floor(valores.length / 2));
  
  const mediaPrimeira = calcularMedia(primeiraMetade);
  const mediaSegunda = calcularMedia(segundaMetade);
  
  const percentual = mediaPrimeira > 0 
    ? ((mediaSegunda - mediaPrimeira) / mediaPrimeira) * 100 
    : 0;
  
  let tendencia: 'crescimento' | 'queda' | 'estavel';
  
  if (Math.abs(percentual) < limiarEstavel) {
    tendencia = 'estavel';
  } else if (percentual > 0) {
    tendencia = 'crescimento';
  } else {
    tendencia = 'queda';
  }
  
  const confianca = calcularConfianca(valores);
  
  const descricao = gerarDescricaoTendencia(tendencia, percentual);
  
  return {
    tendencia,
    percentual,
    confianca,
    descricao,
  };
}

/**
 * Calcular média de valores
 */
export function calcularMedia(valores: number[]): number {
  if (valores.length === 0) return 0;
  const soma = valores.reduce((acc, val) => acc + val, 0);
  return soma / valores.length;
}

/**
 * Calcular mediana de valores
 */
export function calcularMediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  
  if (ordenados.length % 2 === 0) {
    return (ordenados[meio - 1] + ordenados[meio]) / 2;
  }
  
  return ordenados[meio];
}

/**
 * Calcular desvio padrão
 */
export function calcularDesvioPadrao(valores: number[]): number {
  if (valores.length === 0) return 0;
  
  const media = calcularMedia(valores);
  const somaQuadrados = valores.reduce((acc, val) => acc + Math.pow(val - media, 2), 0);
  
  return Math.sqrt(somaQuadrados / valores.length);
}

/**
 * Calcular coeficiente de variação (CV)
 */
export function calcularCoeficienteVariacao(valores: number[]): number {
  const media = calcularMedia(valores);
  if (media === 0) return 0;
  
  const desvioPadrao = calcularDesvioPadrao(valores);
  return (desvioPadrao / media) * 100;
}

/**
 * Calcular confiança da tendência baseada na consistência dos dados
 */
function calcularConfianca(valores: number[]): 'alta' | 'media' | 'baixa' {
  if (valores.length < 4) return 'baixa';
  
  const cv = calcularCoeficienteVariacao(valores);
  
  if (cv < 20) return 'alta';
  if (cv < 40) return 'media';
  return 'baixa';
}

/**
 * Gerar descrição textual da tendência
 */
function gerarDescricaoTendencia(
  tendencia: 'crescimento' | 'queda' | 'estavel',
  percentual: number
): string {
  const absPercentual = Math.abs(percentual);
  
  if (tendencia === 'estavel') {
    return 'Mantendo-se estável';
  }
  
  if (tendencia === 'crescimento') {
    if (absPercentual > 20) return 'Crescimento forte';
    if (absPercentual > 10) return 'Crescimento moderado';
    return 'Crescimento leve';
  }
  
  if (absPercentual > 20) return 'Queda forte';
  if (absPercentual > 10) return 'Queda moderada';
  return 'Queda leve';
}

/**
 * Calcular média móvel simples
 */
export function calcularMediaMovel(
  valores: Array<{ data: string; valor: number }>,
  janela: number = 3
): MediaMovel[] {
  const resultado: MediaMovel[] = [];
  
  for (let i = 0; i < valores.length; i++) {
    const inicio = Math.max(0, i - janela + 1);
    const fim = i + 1;
    const valoresJanela = valores.slice(inicio, fim).map(v => v.valor);
    const mediaMovel = calcularMedia(valoresJanela);
    
    resultado.push({
      data: valores[i].data,
      valor: valores[i].valor,
      mediaMovel,
    });
  }
  
  return resultado;
}

/**
 * Detectar outliers (valores atípicos) usando método IQR
 */
export function detectarOutliers(valores: number[]): {
  outliers: number[];
  limiteInferior: number;
  limiteSuperior: number;
} {
  if (valores.length < 4) {
    return {
      outliers: [],
      limiteInferior: 0,
      limiteSuperior: 0,
    };
  }
  
  const ordenados = [...valores].sort((a, b) => a - b);
  const q1Index = Math.floor(ordenados.length * 0.25);
  const q3Index = Math.floor(ordenados.length * 0.75);
  
  const q1 = ordenados[q1Index];
  const q3 = ordenados[q3Index];
  const iqr = q3 - q1;
  
  const limiteInferior = q1 - 1.5 * iqr;
  const limiteSuperior = q3 + 1.5 * iqr;
  
  const outliers = valores.filter(v => v < limiteInferior || v > limiteSuperior);
  
  return {
    outliers,
    limiteInferior,
    limiteSuperior,
  };
}

/**
 * Calcular taxa de crescimento entre dois valores
 */
export function calcularTaxaCrescimento(
  valorInicial: number,
  valorFinal: number
): number {
  if (valorInicial === 0) return 0;
  return ((valorFinal - valorInicial) / valorInicial) * 100;
}

/**
 * Calcular crescimento acumulado de uma série
 */
export function calcularCrescimentoAcumulado(valores: number[]): number {
  if (valores.length < 2) return 0;
  return calcularTaxaCrescimento(valores[0], valores[valores.length - 1]);
}

/**
 * Prever próximo valor usando média móvel exponencial
 */
export function preverProximoValor(
  valores: number[],
  alpha: number = 0.3
): number {
  if (valores.length === 0) return 0;
  if (valores.length === 1) return valores[0];
  
  let ema = valores[0];
  
  for (let i = 1; i < valores.length; i++) {
    ema = alpha * valores[i] + (1 - alpha) * ema;
  }
  
  return ema;
}

/**
 * Comparar dois períodos e gerar insights
 */
export function compararPeriodos(
  periodo1: number[],
  periodo2: number[]
): {
  variacaoMedia: number;
  variacaoMediana: number;
  variacaoDesvioPadrao: number;
  melhorPeriodo: 1 | 2 | 'empate';
  descricao: string;
} {
  const media1 = calcularMedia(periodo1);
  const media2 = calcularMedia(periodo2);
  const mediana1 = calcularMediana(periodo1);
  const mediana2 = calcularMediana(periodo2);
  const desvio1 = calcularDesvioPadrao(periodo1);
  const desvio2 = calcularDesvioPadrao(periodo2);
  
  const variacaoMedia = calcularTaxaCrescimento(media1, media2);
  const variacaoMediana = calcularTaxaCrescimento(mediana1, mediana2);
  const variacaoDesvioPadrao = calcularTaxaCrescimento(desvio1, desvio2);
  
  let melhorPeriodo: 1 | 2 | 'empate';
  
  if (Math.abs(variacaoMedia) < 5) {
    melhorPeriodo = 'empate';
  } else if (variacaoMedia > 0) {
    melhorPeriodo = 2;
  } else {
    melhorPeriodo = 1;
  }
  
  let descricao: string;
  
  if (melhorPeriodo === 'empate') {
    descricao = 'Períodos com desempenho similar';
  } else if (melhorPeriodo === 2) {
    descricao = `Segundo período ${Math.abs(variacaoMedia).toFixed(1)}% melhor`;
  } else {
    descricao = `Primeiro período ${Math.abs(variacaoMedia).toFixed(1)}% melhor`;
  }
  
  return {
    variacaoMedia,
    variacaoMediana,
    variacaoDesvioPadrao,
    melhorPeriodo,
    descricao,
  };
}
