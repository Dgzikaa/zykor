/**
 * CMO FIXO — o cálculo do custo mensal de cada pessoa da folha.
 *
 * Substitui a planilha "CMO" (aba ORDINAS). As fórmulas abaixo NÃO são invenção: cada uma foi
 * conferida contra os números da planilha, pessoa por pessoa, e o Gonza mandou as que não davam
 * pra deduzir só olhando o resultado (provisão, sindical, tempo de casa e estimativa).
 *
 * Fica em lib/ porque a tela, a API e o recibo têm que dizer o MESMO número — cada cópia da
 * fórmula é uma chance de divergirem no mês que ninguém está olhando.
 *
 * Referências da planilha (coluna → nome aqui):
 *   G salário · H estimativa · J ad. noturno · K DSR · L tempo de casa · M produtividade
 *   N desc. VT · O INSS · P IR · Q líquido · R INSS empresa · S FGTS · T VT · W provisão
 *   X sindical · Y adicionais · Z aviso prévio · AA custo-empresa · AB dias
 *
 * Conferido contra a planilha (diferença máxima de 1 centavo, de arredondamento):
 *   Lucia CLT 31d  → líquido 3.771,68 · provisão 1.160,81 · INSS 382,85 · custo 6.938,24
 *   Nayara CLT 31d → líquido 1.765,74 · provisão 560,45 · custo 3.043,70
 *   Nayara CLT 7d  → custo 687,29 (o rateio pelos dias)
 *   Dudu CLT 31d   → líquido 2.357,72 · provisão 747,68 · custo 4.585,92
 *   Andreia PJ 31d → líquido 4.200,00 · custo 5.042,00 · PJ 7d → 1.138,52
 */

export type TipoContratacao = 'CLT' | 'PJ' | string;

export type EntradaFolha = {
  /** G — salário base do cadastro (do contrato vigente) */
  salario: number;
  /** H — manual (estimativa de gorjeta); "manual" confirmado pelo Gonza */
  estimativa: number;
  /** L — manual (tempo de casa); varia por pessoa, não é % fixo */
  tempo_casa: number;
  /** J — vem da ÁREA. Cargo de confiança não recebe: não tem jornada controlada. */
  adicional_noturno_area: number;
  cargo_confianca: boolean;
  /** Y — adicional fixo mensal do cadastro. NÃO tem encargo. */
  adicionais: number;
  /** consumação mensal do cadastro. Não existia na planilha; entra como custo. */
  consumacao: number;
  /** Z — manual, raro */
  aviso_previo: number;
  /** diária de VT do cadastro */
  vt_diaria: number;
  tipo_contratacao: TipoContratacao;
  /** AB — dias em que a pessoa contou no mês (vínculo). Rateia o custo. */
  dias: number;
  /** dias do mês (28..31). O rateio é sobre o mês de calendário, como na planilha. */
  dias_mes: number;
  /** dias de trabalho no mês, usado SÓ pro vale-transporte (na planilha, 22 no geral) */
  dias_vt: number;
};

export type SaidaFolha = {
  salario_bruto: number; estimativa: number; adicional_noturno: number; drs_noturno: number;
  tempo_casa: number; produtividade: number; desc_vale_transporte: number; inss: number; ir: number;
  salario_liquido: number; inss_empresa: number; fgts: number; vale_transporte: number;
  provisao_certa: number; mensalidade_sindical: number; adicionais: number; consumacao: number;
  aviso_previo: number; custo_empresa: number; dias_trabalhados: number; dias_mes: number;
  dias_vt: number;
};

/** Mensalidade sindical: valor fixo, e só pra CLT — `=SE(D6="CLT";65,58;0)` (Gonza). */
export const MENSALIDADE_SINDICAL = 65.58;
const PCT_PRODUTIVIDADE = 0.05;
const PCT_DESC_VT = 0.06;
const PCT_INSS = 0.08;
const PCT_FGTS = 0.08;
const PCT_PROVISAO = 0.27;
const PCT_DSR_NOTURNO = 0.2;

const cent = (v: number) => Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;

export function calcularFolha(e: EntradaFolha): SaidaFolha {
  const diasMes = e.dias_mes > 0 ? e.dias_mes : 30;
  const dias = Math.max(0, Math.min(e.dias, diasMes));
  const G = e.salario || 0;
  const L = e.tempo_casa || 0;
  const Y = e.adicionais || 0;
  const Z = e.aviso_previo || 0;
  const consumacao = e.consumacao || 0;
  const T = cent((e.vt_diaria || 0) * (e.dias_vt || 0));
  const clt = String(e.tipo_contratacao || '').toUpperCase() === 'CLT';

  // ---- PJ: não tem encargo nenhum. Custo = o que sai do caixa, rateado pelos dias.
  if (!clt) {
    const liquido = cent(G + L);
    const custo = cent(((G + L + T + Y + Z + consumacao) / diasMes) * dias);
    return {
      salario_bruto: G, estimativa: 0, adicional_noturno: 0, drs_noturno: 0, tempo_casa: L,
      produtividade: 0, desc_vale_transporte: 0, inss: 0, ir: 0, salario_liquido: liquido,
      inss_empresa: 0, fgts: 0, vale_transporte: T, provisao_certa: 0, mensalidade_sindical: 0,
      adicionais: Y, consumacao, aviso_previo: Z, custo_empresa: custo,
      dias_trabalhados: dias, dias_mes: diasMes, dias_vt: e.dias_vt || 0,
    };
  }

  const H = e.estimativa || 0;
  // Confiança não bate ponto, então não gera adicional noturno — é o que a planilha faz ao
  // deixar a área "Liderança" com 0.
  const J = e.cargo_confianca ? 0 : (e.adicional_noturno_area || 0);
  const K = cent(J * PCT_DSR_NOTURNO);
  const M = cent(G * PCT_PRODUTIVIDADE);
  const N = cent(-G * PCT_DESC_VT);

  // A base do INSS/FGTS INCLUI a estimativa; a da provisão NÃO — confirmado nos dois casos
  // contra a planilha (Lucia: 4.785,58 × 8% = 382,85 e 4.299,28 × 27% = 1.160,81).
  const baseEncargos = cent(G + H + J + K + L + M);
  const baseProvisao = cent(G + J + K + L + M);

  const O = cent(-baseEncargos * PCT_INSS);

  // IR: a planilha usa (salário − 528) × 7,5% − 158,40, e só quando dá positivo.
  // ATENÇÃO: na planilha esse valor é SOMADO ao líquido, não descontado (na Lucia,
  // 3.549,87 + 571,92 + 177,49 − 212,99 − 382,85 + 68,24 = 3.771,68, que é o que ela mostra).
  // Reproduzido igual de propósito — trocar o sinal aqui faria a tela divergir da planilha que a
  // operação usa hoje, e essa diferença tem que ser decisão do Gonza, não minha.
  const irBase = cent((G - 528) * 0.075 - 158.4);
  const P = irBase > 0 ? irBase : 0;

  const Q = cent(G + J + K + L + M + N + O + P);
  const R = cent(Math.abs(O));
  const S = cent(baseEncargos * PCT_FGTS);
  const W = cent(baseProvisao * PCT_PROVISAO);
  const X = MENSALIDADE_SINDICAL;

  // Custo-empresa: tudo o que a empresa desembolsa, rateado pelos dias — MENOS adicionais,
  // aviso prévio e consumação, que a planilha soma cheios (são valores acordados, não diária).
  const custo = cent(((Q + R + S + T + W + X) / diasMes) * dias + Y + Z + consumacao);

  return {
    salario_bruto: G, estimativa: H, adicional_noturno: J, drs_noturno: K, tempo_casa: L,
    produtividade: M, desc_vale_transporte: N, inss: O, ir: P, salario_liquido: Q,
    inss_empresa: R, fgts: S, vale_transporte: T, provisao_certa: W, mensalidade_sindical: X,
    adicionais: Y, consumacao, aviso_previo: Z, custo_empresa: custo,
    dias_trabalhados: dias, dias_mes: diasMes, dias_vt: e.dias_vt || 0,
  };
}

/** Dias do mês (28..31). */
export function diasDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

/**
 * Dias em que a pessoa CONTOU no mês — o que rateia o custo.
 *
 * Sai da admissão/demissão, sem ninguém digitar: quem entrou dia 20 custa 11/31 do mês, e é
 * exatamente o que a planilha faz na mão (o Thaylson aparece com 7 no mês em que saiu).
 */
export function diasDeVinculo(
  ano: number, mes: number, admissao?: string | null, demissao?: string | null,
): number {
  const total = diasDoMes(ano, mes);
  const primeiro = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const ultimo = `${ano}-${String(mes).padStart(2, '0')}-${String(total).padStart(2, '0')}`;
  const de = admissao && admissao > primeiro ? admissao : primeiro;
  const ate = demissao && demissao < ultimo ? demissao : ultimo;
  if (de > ate) return 0; // admitido depois do mês, ou desligado antes dele
  return Number(ate.slice(8, 10)) - Number(de.slice(8, 10)) + 1;
}

/**
 * Dias de trabalho no mês pro VT, quando ninguém informou: dias/semana × semanas do mês.
 * Na planilha isso é 22 pra quem faz 5×2 (e 27 no estoque, que faz 6×1).
 */
export function diasVtPadrao(dias_trabalho_semana?: number | null, diasMes = 30): number {
  const porSemana = dias_trabalho_semana && dias_trabalho_semana > 0 ? dias_trabalho_semana : 5;
  return Math.round((porSemana * diasMes) / 7);
}
