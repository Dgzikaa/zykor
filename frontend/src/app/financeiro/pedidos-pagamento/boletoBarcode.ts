/**
 * Decodifica o código de barras de um boleto bancário (padrão Interleaved 2 of 5,
 * 44 dígitos) → linha digitável (47), valor e vencimento. Tudo determinístico, sem IA.
 *
 * Estrutura do código de barras (44 díg.):
 *   1-3  banco · 4 moeda · 5 DV geral · 6-9 fator vencimento · 10-19 valor · 20-44 campo livre
 */
export interface BoletoDecodificado {
  valido: boolean;
  linha_digitavel: string | null;   // 47 dígitos
  valor: number | null;
  vencimento: string | null;        // YYYY-MM-DD
  concessionaria: boolean;          // boleto de concessionária (44 díg. começando com 8) — estrutura diferente
}

/** Módulo 10 (linha digitável) — pesos 2,1,2,1… da direita p/ esquerda. */
function mod10(num: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]) * peso;
    if (d > 9) d = Math.floor(d / 10) + (d % 10);
    soma += d;
    peso = peso === 2 ? 1 : 2;
  }
  const r = soma % 10;
  return r === 0 ? 0 : 10 - r;
}

/** DV geral do código de barras (módulo 11) — valida a leitura da câmera. */
function dvBarcodeMod11(bc: string): number {
  const base = bc.slice(0, 4) + bc.slice(5); // 43 díg. (sem o DV na posição 5)
  let soma = 0;
  let peso = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += Number(base[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const r = soma % 11;
  const dv = 11 - r;
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

/** Fator de vencimento (4 díg.) → data. Trata o rollover Febraban de fev/2025. */
function fatorParaVencimento(fator: number): string | null {
  if (!fator) return null; // 0 = sem vencimento no código
  const base1997 = Date.UTC(1997, 9, 7); // 07/10/1997
  let ms = base1997 + fator * 86400000;
  // O fator reiniciou (1000) em 22/02/2025 — some 1 ciclo (9000 dias) se caiu muito no passado.
  if (ms < Date.now() - 365 * 86400000) ms += 9000 * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Recebe os dígitos lidos do código de barras. Aceita 44 (boleto bancário) e devolve
 * a linha digitável + valor + vencimento. Se o DV geral não bater, `valido=false`
 * (leitura suja da câmera — o scanner continua tentando).
 */
export function decodificarBoleto(digitos: string): BoletoDecodificado {
  const bc = (digitos || '').replace(/\D/g, '');
  const vazio: BoletoDecodificado = { valido: false, linha_digitavel: null, valor: null, vencimento: null, concessionaria: false };

  if (bc.length !== 44) return vazio;

  // Concessionária (água/luz) começa com 8 e tem outra estrutura — não montamos a linha aqui.
  if (bc[0] === '8') return { ...vazio, valido: true, concessionaria: true, linha_digitavel: bc };

  // Valida o DV geral (mod11) — rejeita leitura corrompida.
  if (dvBarcodeMod11(bc) !== Number(bc[4])) return vazio;

  const banco = bc.slice(0, 3);
  const moeda = bc.slice(3, 4);
  const dvGeral = bc.slice(4, 5);
  const fatorVenc = bc.slice(5, 9);
  const valorStr = bc.slice(9, 19);
  const campoLivre = bc.slice(19, 44); // 25 díg.

  const campo1 = banco + moeda + campoLivre.slice(0, 5);   // 9
  const campo2 = campoLivre.slice(5, 15);                   // 10
  const campo3 = campoLivre.slice(15, 25);                  // 10

  const linha =
    campo1 + mod10(campo1) +
    campo2 + mod10(campo2) +
    campo3 + mod10(campo3) +
    dvGeral + fatorVenc + valorStr;

  const valorNum = Number(valorStr) / 100;

  return {
    valido: true,
    linha_digitavel: linha,
    valor: valorNum > 0 ? Math.round(valorNum * 100) / 100 : null,
    vencimento: fatorParaVencimento(Number(fatorVenc)),
    concessionaria: false,
  };
}
