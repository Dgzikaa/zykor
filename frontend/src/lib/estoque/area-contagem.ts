// Classificador de ÁREA da contagem de estoque — fonte ÚNICA usada pelo relatório
// de estoque-histórico (aba Gestão/Desvios) E pelo CMV, pra que os dois nunca divirjam.
//
// Área = seção da planilha de contagem (COZINHA/SALÃO/DRINKS/FUNCIONÁRIOS), refletida no
// sufixo da categoria: (C)→Comidas · (S)→Salão · (B)/destilados→Drinks · (F)→Alimentação.
// "Não-alcóolicos" aparece nas 2 seções → resolve por código.

/** Não-alcóolicos que ficam na seção DRINKS (resolvidos por código, não por categoria). */
export const DRINK_NAOALC = new Set(['i0298', 'i0085', 'i0328', 'i0191', 'i0563']);

export type AreaContagem = 'Comidas' | 'Salão' | 'Drinks' | 'Alimentação';

export function areaDe(categoria: string | null, cod: string | null): AreaContagem {
  const c = (categoria || '').toUpperCase();
  if (cod && DRINK_NAOALC.has(cod)) return 'Drinks';
  if (/\(F\)/.test(c)) return 'Alimentação';
  if (/\(C\)/.test(c) || c.includes('PÃES') || c.includes('PAES') || c.includes('FEIJOADA')) return 'Comidas';
  if (/\(S\)/.test(c) || c.includes('MERCADO (S)')) return 'Salão';
  if (/\(B\)/.test(c) || ['DESTILADOS', 'IMPÉRIO', 'IMPERIO', 'POLPAS', 'PRÉ-BATCH', 'PRE-BATCH', 'OUTROS'].some((k) => c.includes(k))) return 'Drinks';
  if (['ARTESANAL', 'LATA', 'LONG NECK', 'RETORNÁVEIS', 'RETORNAVEIS', 'VINHOS'].some((k) => c.includes(k))) return 'Salão';
  if (c.includes('ALCÓOLICOS') || c.includes('ALCOOLICOS')) return 'Salão';
  return 'Comidas';
}

/** Buckets do CMV: cozinha (Comidas) · bebidas (Salão) · drinks · funcionarios (Alimentação). */
export type BucketCmv = 'cozinha' | 'bebidas' | 'drinks' | 'funcionarios';

export function areaParaBucketCmv(area: AreaContagem): BucketCmv {
  switch (area) {
    case 'Comidas': return 'cozinha';
    case 'Salão': return 'bebidas';
    case 'Drinks': return 'drinks';
    case 'Alimentação': return 'funcionarios';
  }
}
