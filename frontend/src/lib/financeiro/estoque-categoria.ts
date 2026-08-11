/**
 * Estoque valorizado por categoria de CMV (Bebidas / Comidas / Drinks) numa DATA de contagem.
 *
 * Existe porque o fechamento mensal precisa da variação de estoque entre o dia 1º de um mês e
 * o dia 1º do seguinte, e a única fonte que tinha essa quebra por categoria era
 * `financial.cmv_semanal` — que é indexada por SEMANA ISO, não por data de contagem.
 *
 * O estrago que isso causava (Gonza, 11/08/2026): a variação de estoque lançada no Conta Azul
 * pegava o `estoque_inicial_*` da semana que CONTÉM o dia 1º e o `estoque_final_*` da semana que
 * contém o dia 1º do mês seguinte. Para julho/2026 do Ordinário isso virou a janela 29/06 → 03/08
 * em vez de 01/07 → 01/08, e o resultado foi −R$ 37.891,16 no lugar dos −R$ 8.275,04 reais.
 *
 * Lê `silver.estoque_contagem`, que já traz `valor` com o PREÇO CONGELADO da contagem
 * (estoque_final × preco_unitario), além de `tipo_local`, `categoria` e `insumo_codigo` — os três
 * campos de que a classificação precisa. Não refaz o cálculo de valor.
 *
 * A classificação abaixo é a MESMA de /api/cmv-semanal/buscar-dados-automaticos; as listas são
 * exportadas daqui para que as duas não divirjam com o tempo.
 */

import { areaDe, areaParaBucketCmv } from '@/lib/estoque/area-contagem';
import { paginate } from '@/lib/supabase/paginate';

/** tipo_local='cozinha' + estas categorias = COMIDAS. */
export const CATEGORIAS_COZINHA = [
  'cozinha', 'ARMAZÉM (C)', 'HORTIFRUTI (C)', 'MERCADO (C)', 'Mercado (S)',
  'PÃES', 'PEIXE', 'PROTEÍNA', 'tempero', 'hortifruti', 'líquido',
];

/** tipo_local='cozinha' + estas categorias = DRINKS (DESTILADOS é de longe a maior). */
export const CATEGORIAS_DRINKS = [
  'ARMAZÉM B', 'DESTILADOS', 'DESTILADOS LOG', 'HORTIFRUTI B',
  'IMPÉRIO', 'MERCADO B', 'POLPAS', 'OUTROS',
];

/** Alimentação de funcionários — CMA, nunca CMV. */
export const CATEGORIAS_EXCLUIR = ['HORTIFRUTI (F)', 'MERCADO (F)', 'PROTEÍNA (F)'];

export interface EstoquePorCategoria {
  bebidas: number;
  cozinha: number;
  drinks: number;
  total: number;
  /** Data da contagem efetivamente usada (pode diferir da pedida — ver `buscarContagemMensal`). */
  data: string;
  itens: number;
}

interface LinhaContagem {
  insumo_codigo: string | null;
  categoria: string | null;
  tipo_local: string | null;
  valor: number | null;
}

/** Classifica UMA linha de contagem no bucket de CMV. Devolve null para o que não entra (funcionários). */
export function bucketDaLinha(l: LinhaContagem): 'bebidas' | 'cozinha' | 'drinks' | null {
  const categoria = l.categoria || '';
  if (CATEGORIAS_EXCLUIR.includes(categoria)) return null;

  const codigo = (l.insumo_codigo || '').toLowerCase();
  if (l.tipo_local === 'bar') return 'bebidas';
  if (codigo.startsWith('pd')) return 'drinks';   // PRODUÇÃO (B)
  if (codigo.startsWith('pc')) return 'cozinha';  // PRODUÇÃO (C)
  if (l.tipo_local === 'cozinha') {
    if (CATEGORIAS_DRINKS.includes(categoria)) return 'drinks';
    if (CATEGORIAS_COZINHA.includes(categoria)) return 'cozinha';
    if (categoria === 'Não-alcóolicos') return 'drinks';
  }
  // Fallback: mesma regra da tela Estoque/Desvios. Sem ele, item fora das listas era descartado.
  const b = areaParaBucketCmv(areaDe(l.categoria, l.insumo_codigo));
  return b === 'funcionarios' ? null : b;
}

/**
 * Acha a contagem MENSAL que representa a virada do mês em `dia1`.
 *
 * Prefere a contagem do próprio dia 1º. Se a equipe contou um ou dois dias antes/depois, aceita a
 * mensal mais próxima dentro de [-2, +3] dias. NÃO cai numa contagem semanal ou diária: elas
 * cobrem só parte dos itens (uma diária tem ~80 dos ~415), e usar uma delas como fronteira de mês
 * é exatamente o erro que esta função existe para evitar — melhor devolver null e a rota acusar.
 */
export async function buscarContagemMensal(
  supabase: any, barId: number, dia1: string,
): Promise<string | null> {
  const d = new Date(`${dia1}T00:00:00Z`);
  const de = new Date(d); de.setUTCDate(de.getUTCDate() - 2);
  const ate = new Date(d); ate.setUTCDate(ate.getUTCDate() + 3);

  const { data } = await (supabase.schema('silver') as any)
    .from('estoque_contagem')
    .select('data_contagem')
    .eq('bar_id', barId)
    .eq('tipo_contagem', 'mensal')
    .gte('data_contagem', de.toISOString().slice(0, 10))
    .lte('data_contagem', ate.toISOString().slice(0, 10))
    .order('data_contagem');

  const datas = Array.from(new Set(((data as any[]) || []).map((r) => String(r.data_contagem).slice(0, 10))));
  if (!datas.length) return null;
  if (datas.includes(dia1)) return dia1;
  // mais próxima do dia 1º
  return datas.sort((a, b) =>
    Math.abs(+new Date(a) - +d) - Math.abs(+new Date(b) - +d))[0];
}

/**
 * Estoque valorizado por categoria na contagem mensal da virada `dia1`.
 * Devolve null se não existir contagem mensal na janela — quem chama decide o que fazer,
 * mas NUNCA deve substituir por uma contagem parcial.
 */
export async function estoqueMensalPorCategoria(
  supabase: any, barId: number, dia1: string,
): Promise<EstoquePorCategoria | null> {
  const dataContagem = await buscarContagemMensal(supabase, barId, dia1);
  if (!dataContagem) return null;

  const linhas = await paginate<LinhaContagem>(
    () => (supabase.schema('silver') as any)
      .from('estoque_contagem')
      .select('insumo_codigo, categoria, tipo_local, valor')
      .eq('bar_id', barId)
      .eq('data_contagem', dataContagem)
      .order('insumo_codigo'),
    { label: 'silver.estoque_contagem/mensal' },
  );

  const out: EstoquePorCategoria = {
    bebidas: 0, cozinha: 0, drinks: 0, total: 0, data: dataContagem, itens: linhas.length,
  };
  for (const l of linhas) {
    const b = bucketDaLinha(l);
    if (!b) continue;
    const v = Number(l.valor || 0);
    out[b] += v;
    out.total += v;
  }
  out.bebidas = Math.round(out.bebidas * 100) / 100;
  out.cozinha = Math.round(out.cozinha * 100) / 100;
  out.drinks = Math.round(out.drinks * 100) / 100;
  out.total = Math.round(out.total * 100) / 100;
  return out;
}
