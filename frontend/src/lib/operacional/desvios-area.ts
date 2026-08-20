/**
 * De qual ÁREA é um insumo — Comidas, Drinks, Salão ou Alimentação.
 *
 * A regra é lida da categoria do cadastro, que não tem um campo de área: a operação codifica no
 * nome ((F), (C), (S), (B)) e, no resto, no vocabulário ('DESTILADO', 'AMBEV', 'BAR - …').
 *
 * Vive aqui, e não dentro da rota, porque a tela de Desvios e a de Análises precisam somar do
 * MESMO jeito — duas cópias dessa lista de palavras divergem no primeiro fornecedor novo.
 */

/** Códigos de insumo que são drink não alcoólico e a categoria não denuncia. */
const DRINK_NAOALC = new Set(['i0298', 'i0085', 'i0328', 'i0191', 'i0563']);

export type AreaDesvio = 'Comidas' | 'Drinks' | 'Salão' | 'Alimentação';

export function areaDe(categoria: string | null, cod: string | null): AreaDesvio {
  const c = (categoria || '').toUpperCase();
  if (cod && DRINK_NAOALC.has((cod || '').toLowerCase())) return 'Drinks';
  if (/\(F\)/.test(c)) return 'Alimentação';
  if (/\(C\)/.test(c) || c.includes('PÃES') || c.includes('PAES') || c.includes('FEIJOADA')) return 'Comidas';
  if (/\(S\)/.test(c) || c.includes('MERCADO (S)')) return 'Salão';
  // 'DESTILADO' (sem S) casa singular + plural + 'BAR - DESTILADO' (Deboche usa singular)
  if (/\(B\)/.test(c) || ['DESTILADO', 'IMPÉRIO', 'IMPERIO', 'POLPAS', 'PRÉ-BATCH', 'PRE-BATCH', 'OUTROS'].some((k) => c.includes(k))) return 'Drinks';
  if (['ARTESANAL', 'LATA', 'LONG NECK', 'RETORNÁVEIS', 'RETORNAVEIS', 'VINHOS'].some((k) => c.includes(k))) return 'Salão';
  if (c.includes('ALCÓOLICOS') || c.includes('ALCOOLICOS')) return 'Salão';
  // fornecedor de bebida cadastrado como categoria (ex.: AMBEV/HEINEKEN) → Salão, não Comidas
  if (['AMBEV', 'HEINEKEN', 'KIRIN', 'CERVEJ', 'CHOPP'].some((k) => c.includes(k))) return 'Salão';
  // categoria prefixada 'BAR - …' (armazém/hortifruti/mercado do bar) é insumo de drink, não comida
  if (c.startsWith('BAR')) return 'Drinks';
  return 'Comidas';
}
