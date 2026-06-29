// Fonte ÚNICA da resolução de unidade-base + tamanho de embalagem de um insumo.
// Usada pela tela de Insumos e pelo Planejamento de Compras pra não divergirem
// (era o bug: a tela derivava do nome, o plano-compras lia operations.insumos.embalagem cru).
//
// base = unidade física de medida da ficha (g | ml | un).
// embalagem = quanto da base cabe em 1 pacote de compra (ex.: "269ml" → 269; "5kg" → 5000; "30L" → 30000).
//
// Precedência (igual à tela de Insumos): override salvo (silver.insumo_catalogo.base/embalagem,
// vindo de insumo_unidade) e, quando ausente, derivação a partir do NOME.
export function deriveUnid(nome: string, um: string | null): { base: string; embalagem: number } {
  const n = (nome || '').toLowerCase();
  const m = n.match(/(\d+[.,]?\d*)\s*(kg|kilo|litro|lt|ml|gr|grama|l|g)\b/);
  if (m) {
    const num = parseFloat(m[1].replace('.', '').replace(',', '.')) || parseFloat(m[1].replace(',', '.'));
    const u = m[2];
    if (u === 'kg' || u === 'kilo') return { base: 'g', embalagem: num * 1000 };
    if (u === 'l' || u === 'lt' || u === 'litro') return { base: 'ml', embalagem: num * 1000 };
    if (u === 'ml') return { base: 'ml', embalagem: num };
    if (u === 'g' || u === 'gr' || u === 'grama') return { base: 'g', embalagem: num };
  }
  const mc = n.match(/c\/\s*(\d+)/) || n.match(/(\d+)\s*(und|unid|cx|caixa|pct|pacote|fardo)\b/);
  if (mc) return { base: 'un', embalagem: parseInt(mc[1], 10) || 1 };
  if (/vinho|espumante|frisante|moscatel|prosecco|sparkling|(^|\s)v\.|(^|\s)esp\./.test(n)) return { base: 'ml', embalagem: 750 };
  if (/whisky|vodka|\bgin\b|tequila|cacha|\brum\b|licor|conhaque|brandy|aperol|campari|cynar|vermouth|jager|bitter|absinto|steinha|amarula|cointreau|frangelico|limoncello|domecq|netuno|presidente|bananinha|\bjambu\b/.test(n)) return { base: 'ml', embalagem: 1000 };
  const s = (um || '').toLowerCase().trim();
  if (s === 'ml' || s === 'l' || s === 'litro') return { base: 'ml', embalagem: 1000 };
  if (s === 'kg' || s === 'g' || s === 'grama') return { base: 'g', embalagem: 1000 };
  return { base: 'un', embalagem: 1 };
}
