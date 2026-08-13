/**
 * Compra parcelada na fatura de cartão — leitura da parcela, identidade da compra e datas.
 *
 * A fatura traz uma linha por parcela ("Parcela 2 de 6") e TODA parcela carrega a data da compra
 * original. Lançar cada uma com competência = data da compra faz o mês da compra crescer pra trás a
 * cada fatura nova (Mercado Livre 2/6 caindo em 24/06 junto com a 1/6 que já estava lá).
 *
 * Aqui ficam as regras puras; quem chama o Conta Azul é a rota de lançamento.
 */

export interface Parcela {
  n: number;      // parcela atual
  total: number;  // total de parcelas
}

/**
 * Lê "Parcela 2 de 6", "2/6" ou "02/05". Devolve null quando não é parcelado (ou é 1 de 1).
 */
export function parseParcela(txt: string | null | undefined): Parcela | null {
  const s = String(txt || '').trim();
  if (!s) return null;
  const m = /(?:parcela\s*)?(\d{1,2})\s*(?:de|\/)\s*(\d{1,2})/i.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  const total = Number(m[2]);
  if (!Number.isFinite(n) || !Number.isFinite(total)) return null;
  if (total <= 1 || n < 1 || n > total) return null;
  return { n, total };
}

/**
 * Identidade da compra entre faturas de meses diferentes.
 *
 * NÃO entra a descrição: ela é editável na tela antes de lançar, e uma edição feita na parcela 3
 * quebraria o vínculo com a 2. Os centavos variam entre parcelas (38,42 / 38,37 / 38,41), então o
 * valor entra arredondado no real.
 */
export function chaveCompraParcelada(p: {
  banco?: string | null;
  cartao_final?: string | null;
  data_transacao: string;
  total_parcelas: number;
  valor: number;
}): string {
  return [
    String(p.banco || '').toLowerCase(),
    String(p.cartao_final || ''),
    String(p.data_transacao).slice(0, 10),
    String(p.total_parcelas),
    String(Math.round(Number(p.valor) || 0)),
  ].join('|');
}

/** Soma meses numa data ISO, segurando o dia no último do mês (31/01 + 1 mês = 28/02). */
export function addMeses(isoDate: string, meses: number): string {
  const [a, m, d] = String(isoDate).slice(0, 10).split('-').map(Number);
  const alvo = new Date(a, m - 1 + meses, 1);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  const dia = Math.min(d, ultimoDia);
  return `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export type ModoCompetencia = 'compra' | 'mensal';

export interface PlanoParcela {
  n: number;
  data_competencia: string;
  data_vencimento: string;
  valor: number;
}

/**
 * Monta as parcelas que vão pro Conta Azul.
 *
 * `modo: 'compra'`  — competência = data da compra em todas (parcelamento à vista: Mercado Livre).
 * `modo: 'mensal'`  — competência anda mês a mês a partir de `competenciaInicial`, que é a
 *                     competência da parcela 1 (contrato 12x tipo SKY, que hoje cai inteiro em janeiro).
 *
 * `ate` é a última parcela a gerar: `de` gera só a que chegou na fatura, `total` gera todas as que faltam.
 * Vencimento da parcela k = vencimento da fatura atual + (k − de) meses.
 */
export function planejarParcelas(opts: {
  de: number;
  ate: number;
  total: number;
  valorParcela: number;
  dataTransacao: string;
  vencimentoAtual: string;
  modo: ModoCompetencia;
  competenciaInicial?: string | null;
}): PlanoParcela[] {
  const { de, ate, valorParcela, dataTransacao, vencimentoAtual, modo } = opts;
  const base = modo === 'mensal'
    ? String(opts.competenciaInicial || dataTransacao).slice(0, 10)
    : String(dataTransacao).slice(0, 10);

  const out: PlanoParcela[] = [];
  for (let n = de; n <= ate; n++) {
    out.push({
      n,
      data_competencia: modo === 'mensal' ? addMeses(base, n - 1) : base,
      data_vencimento: addMeses(vencimentoAtual, n - de),
      valor: valorParcela,
    });
  }
  return out;
}
