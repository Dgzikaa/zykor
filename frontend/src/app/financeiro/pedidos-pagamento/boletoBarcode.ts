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
 * Valida uma LINHA DIGITÁVEL (ou código de barras) pelos dígitos verificadores — pega
 * leitura truncada/errada da IA ANTES de mandar pro Inter (que recusaria).
 *  - 44 díg. (código de barras): valida o DV geral (mod11).
 *  - 47 díg. (linha bancária): valida os 3 DVs de campo (mod10) + o DV geral (mod11).
 *  - 48 díg. (convênio/tributo): só o tamanho (estrutura de arrecadação é outra).
 * Qualquer outro tamanho (ex.: 46 = 1 dígito perdido na leitura) → inválido.
 */
export function linhaDigitavelValida(digitos: string): boolean {
  const d = (digitos || '').replace(/\D/g, '');
  if (d.length === 44) return decodificarBoleto(d).valido;
  if (d.length === 48) return true; // arrecadação — não validamos o DV aqui
  if (d.length !== 47) return false;
  // 3 campos com DV mod10
  if (mod10(d.slice(0, 9)) !== Number(d[9])) return false;
  if (mod10(d.slice(10, 20)) !== Number(d[20])) return false;
  if (mod10(d.slice(21, 31)) !== Number(d[31])) return false;
  // DV geral (mod11) — reconstrói o código de barras (44) a partir da linha
  const dvGeral = d[32];
  const banco = d.slice(0, 3), moeda = d.slice(3, 4);
  const fator = d.slice(33, 37), valor = d.slice(37, 47);
  const campoLivre = d.slice(4, 9) + d.slice(10, 20) + d.slice(21, 31); // 25
  const bc = banco + moeda + dvGeral + fator + valor + campoLivre; // 44
  return dvBarcodeMod11(bc) === Number(dvGeral);
}

/**
 * Aceita QUALQUER formato que saia de um leitor/câmera e devolve valor + vencimento +
 * linha digitável:
 *   44 díg. → código de barras (câmera/ITF)
 *   47 díg. → linha digitável bancária (o que a maioria dos leitores USB de boleto entrega)
 *   48 díg. → linha digitável de arrecadação/concessionária (água, luz, tributo)
 */
export function decodificarDigitos(digitos: string): BoletoDecodificado {
  const d = (digitos || '').replace(/\D/g, '');
  if (d.length === 44) return decodificarBoleto(d);
  if (d.length === 47) return decodificarLinhaBancaria(d);
  if (d.length === 48) return decodificarArrecadacao(d);
  return { valido: false, linha_digitavel: null, valor: null, vencimento: null, concessionaria: false };
}

/**
 * ASSINATURA DO CEDENTE — como reconhecer "boleto do mesmo fornecedor".
 *
 * O código de barras NÃO carrega nome nem CNPJ do beneficiário (não existe campo pra isso nos
 * 44 díg.). O que dá pra fazer é reconhecer o EMISSOR: o campo livre (25 díg.) é montado pelo
 * banco com agência + conta + carteira/convênio do cedente + o "nosso número" do título. Entre
 * dois boletos do MESMO cedente, só o nosso número muda — o resto repete. Então comparando
 * posição a posição contra o histórico de boletos já pagos dá pra dizer "esse é da Ambev" e
 * puxar fornecedor/CNPJ/categoria de lá.
 *
 * Na arrecadação (concessionária) é melhor ainda: os díg. 16-19 são o código da empresa/órgão
 * atribuído pela Febraban → chave EXATA (a CEB é sempre a CEB).
 */
/**
 * Onde ficam agência/conta/convênio do cedente dentro do campo livre (25 díg.), por banco.
 * Cada layout é do manual do próprio banco; o que sobra do campo livre é o "nosso número"
 * (muda a cada título) e por isso fica de fora da chave.
 *
 * NÃO tentar heurística genérica aqui: contar dígitos iguais posição-a-posição parece funcionar
 * mas os zeros à esquerda do nosso número inflam o placar e cedentes DIFERENTES casam (testado).
 * Banco fora desta lista → sem chave → não sugerimos nada (o operador preenche, como hoje).
 */
const LAYOUT_CEDENTE: Record<string, Array<[number, number]>> = {
  '341': [[12, 21]],           // Itaú: carteira(3) nossoNum(8) DAC(1) [agência(4) conta(5)] DAC(1) 000
  '237': [[0, 4], [17, 24]],   // Bradesco: [agência(4)] carteira(2) nossoNum(11) [conta(7)] 0
  '033': [[1, 10]],            // Santander: 9 [conta(9)] nossoNum(13) …
  '001': [[0, 7]],             // BB: convênio nos primeiros dígitos
  '104': [[0, 6]],             // Caixa: [código do beneficiário(6)] DV nossoNum…
  '756': [[1, 10]],            // Sicoob: carteira(1) [cliente(9)] nossoNum(7) …
  '748': [[11, 22]],           // Sicredi: tipo(2) nossoNum(9) [agência(4) posto(2) conta(5)]
};

export interface AssinaturaCedente {
  banco: string;
  /** Identifica o EMISSOR (não o título). null = banco sem layout conhecido → não dá pra afirmar. */
  chave: string | null;
}

/**
 * Assinatura do cedente a partir de qualquer formato lido (44/47/48).
 * Boleto bancário: banco + agência/conta/convênio extraídos do campo livre.
 * Arrecadação: díg. 16-19 são o código da empresa/órgão pela Febraban → chave exata e estável.
 */
export function assinaturaCedente(digitos: string): AssinaturaCedente | null {
  const d = (digitos || '').replace(/\D/g, '');
  let banco: string;
  let campoLivre: string;

  if (d.length === 47) {
    banco = d.slice(0, 3);
    campoLivre = d.slice(4, 9) + d.slice(10, 20) + d.slice(21, 31);
  } else if (d.length === 44) {
    banco = d.slice(0, 3);
    campoLivre = d.slice(19, 44);
  } else if (d.length === 48) {
    const bc = d.slice(0, 11) + d.slice(12, 23) + d.slice(24, 35) + d.slice(36, 47);
    return { banco: '8', chave: `ARR:${bc[1]}:${bc.slice(15, 19)}` };
  } else {
    return null;
  }

  if (banco === '' || campoLivre.length !== 25) return null;
  if (d.length === 44 && d[0] === '8') return { banco: '8', chave: `ARR:${d[1]}:${d.slice(15, 19)}` };

  const faixas = LAYOUT_CEDENTE[banco];
  if (!faixas) return { banco, chave: null };
  const chave = faixas.map(([i, f]) => campoLivre.slice(i, f)).join('');
  // Guarda contra casar por zeros: chave quase toda zerada não identifica ninguém.
  const naoZero = chave.split('').filter((c) => c !== '0').length;
  return { banco, chave: naoZero >= 4 ? `${banco}:${chave}` : null };
}

/** Mesmo emissor? Só afirma quando os dois lados têm chave conhecida e idêntica. */
export function mesmoCedente(a: AssinaturaCedente | null, b: AssinaturaCedente | null): boolean {
  return !!a?.chave && !!b?.chave && a.chave === b.chave;
}

/** Linha digitável bancária (47): fator de vencimento nos díg. 34-37, valor nos 38-47. */
function decodificarLinhaBancaria(d: string): BoletoDecodificado {
  const valorNum = Number(d.slice(37, 47)) / 100;
  return {
    valido: linhaDigitavelValida(d),
    linha_digitavel: d,
    valor: valorNum > 0 ? Math.round(valorNum * 100) / 100 : null,
    vencimento: fatorParaVencimento(Number(d.slice(33, 37))),
    concessionaria: false,
  };
}

/**
 * Arrecadação/concessionária (48 = 4 blocos de 11 díg. + DV). Tirando os DVs sobra o código
 * de barras (44), cujos díg. 5-15 são o valor. Não tem fator de vencimento padronizado —
 * a data fica pro operador conferir.
 */
function decodificarArrecadacao(d: string): BoletoDecodificado {
  const bc = d.slice(0, 11) + d.slice(12, 23) + d.slice(24, 35) + d.slice(36, 47); // 44
  const valorNum = Number(bc.slice(4, 15)) / 100;
  return {
    valido: bc[0] === '8',
    linha_digitavel: d,
    valor: valorNum > 0 ? Math.round(valorNum * 100) / 100 : null,
    vencimento: null,
    concessionaria: true,
  };
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
