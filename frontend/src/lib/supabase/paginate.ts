/**
 * Helper único de paginação para queries Supabase.
 *
 * MOTIVO: Supabase JS limita silenciosamente cada query a 1000 rows
 * (configurável no projeto, mas o default é 1000). Queries que retornam
 * mais que isso PERDEM DADOS sem warning. Causa raiz dos bugs:
 *   - Freelas Ord/2026 mostrava 78k de 109k real (1572 rows, perdia 572)
 *   - Compras/consumos mensais que truncavam ano completo
 *
 * USO: passar um builder que retorna a query (sem .range()), o helper
 * adiciona .range() em loop até pegar tudo.
 *
 * @example
 *   const todos = await paginate<MinhaRow>(
 *     () => supabase.from('tabela').select('*').eq('bar_id', 3)
 *   );
 *
 * @example com schema dinâmico (bronze/silver/gold/financial/etc)
 *   const lancs = await paginate<Lancamento>(
 *     () => (supabase as any).schema('bronze')
 *       .from('bronze_contaazul_lancamentos')
 *       .select('valor_bruto, data_competencia')
 *       .eq('bar_id', barId)
 *       .eq('tipo', 'DESPESA')
 *       .gte('data_competencia', '2026-01-01')
 *       .lte('data_competencia', '2026-12-31')
 *       .order('data_competencia') // ORDER eh importante pra paginacao estavel
 *   );
 *
 * NOTA: SEMPRE adicione .order() ao buildQuery — sem ORDER BY estável,
 * o Postgres pode retornar rows em ordens diferentes entre páginas e
 * você pode ter dupes ou misses.
 */

const DEFAULT_PAGE_SIZE = 1000;

export interface PaginateOptions {
  /** Tamanho de cada página. Default 1000 (limite Supabase). */
  pageSize?: number;
  /** Máximo de páginas pra buscar (defesa contra loop infinito). Default 100 = 100k rows. */
  maxPages?: number;
  /** Nome pra log de erro (ex: 'bronze.bronze_contaazul_lancamentos'). */
  label?: string;
}

/**
 * Pagina uma query Supabase em chunks até pegar tudo.
 *
 * @param buildQuery Closure que retorna a query Supabase. Será chamada uma
 *   vez por página com `.range(from, to)` aplicado.
 * @param options Configuração opcional.
 * @returns Array com todas as rows.
 * @throws Error se a query falhar em qualquer página (não retorna parcial).
 */
export async function paginate<T = unknown>(
  buildQuery: () => any,
  options: PaginateOptions = {},
): Promise<T[]> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = options.maxPages ?? 100;
  const label = options.label ?? 'paginate';

  const all: T[] = [];
  let from = 0;

  for (let page = 0; page < maxPages; page++) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);

    if (error) {
      console.error(`[${label}] erro na pagina ${page}:`, {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(`paginate(${label}) pagina ${page}: ${error.message} (${error.code ?? 'no-code'})`);
    }

    const rows = (data ?? []) as T[];
    all.push(...rows);

    // Acabou se voltou menos que pageSize
    if (rows.length < pageSize) return all;

    from += pageSize;
  }

  console.warn(`[${label}] atingiu maxPages=${maxPages} (${all.length} rows). Possivel loop ou dataset gigante.`);
  return all;
}
