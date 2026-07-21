/**
 * Aprendizado de categoria por estabelecimento (fatura de cartão).
 *
 * A tabela financial.cartao_categoria_map guarda keyword -> categoria (por bar, com hits).
 * A keyword é o token mais "cara-de-estabelecimento" da descrição (mais longo, sem stopwords).
 * A sugestão casa quando a descrição normalizada CONTÉM a keyword.
 *
 * Usado pela aba antiga (foto/PDF) e pela aba "Fatura Cartão" (Excel/OFX) — mesma lógica
 * pra os dois aprenderem/sugerirem do mesmo lugar.
 */

const STOP = new Set([
  'pg', 'ec', 'pag', 'pagamento', 'compra', 'cartao', 'parcela', 'ltda', 'me', 'sa',
  'com', 'br', 'do', 'da', 'de',
]);

/** Normaliza descrição pra match: minúsculo, sem acento. Mantém dígitos/espaços. */
export function normDesc(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/** Extrai a keyword do estabelecimento (token mais longo, sem stopwords/dígitos). */
export function keywordDe(descricao: string): string | null {
  const limpo = (descricao || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[*\d]/g, ' ')
    .replace(/[^a-z ]/g, ' ');
  const tokens = limpo.split(/\s+/).filter((t) => t.length >= 3 && !STOP.has(t));
  if (!tokens.length) return null;
  return tokens.sort((a, b) => b.length - a.length)[0];
}
