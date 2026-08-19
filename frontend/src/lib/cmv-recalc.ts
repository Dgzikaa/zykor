/**
 * Recalcula o CMV teórico (gold.produto_cmv) de um bar após uma edição de ficha/insumo.
 * fn_cmv_teorico é idempotente e rápida — medida em produção: 225 chamadas, média 266 ms —
 * então pode rodar a cada save pra que a tela de CMV Teórico reflita a mudança na hora.
 * O cron diário (cmv-teorico-diario) e o botão seguem como backstop.
 *
 * NÃO ACRESCENTE REFRESH DE MATVIEW AQUI. Ver `refreshConsumoTeorico` abaixo.
 */
export async function recalcCmvTeorico(supabase: any, barId: number | null | undefined): Promise<void> {
  if (!barId) return;
  try { await supabase.schema('gold').rpc('fn_cmv_teorico', { p_bar_id: barId }); }
  catch (e) { console.error('[recalcCmvTeorico] fn_cmv_teorico falhou para bar', barId, e); }
}

/**
 * Refresca as matviews de consumo teórico (silver.consumo_teorico_insumo_dia e cascata).
 *
 * SAIU DO CAMINHO DO SAVE em 19/08/2026. Ela estava dentro do `recalcCmvTeorico`, num
 * `Promise.all` AGUARDADO — ou seja, todo salvar de ficha/insumo esperava por ela. E ela não é
 * "alguns segundos": `silver.fn_refresh_consumo_teorico` refaz CINCO matviews sobre o histórico
 * INTEIRO de vendas (1,15 milhão de linhas, 242 MB). Medida em produção: **média 27,7 s, máximo
 * 58 s**. É a mesma função que o cron `silver-vendas-produto-dia` roda de hora em hora.
 *
 * Na prática ela nunca chegou a rodar por aqui — em 8 dias o pg_stat_statements não registrou
 * NENHUMA chamada dela via PostgREST (sem nenhuma entrada descartada), enquanto a irmã
 * `gold.fn_cmv_teorico`, chamada na mesma função, registrou 225. Alguma coisa a engolia antes
 * do banco e o catch abaixo escondia. Ou seja: a promessa de "Saída Teórica reflete na hora"
 * já não valia — e, se um dia voltasse a funcionar, cada salvar de ficha passaria a travar
 * ~30 s. Por isso está fora do save, e não só "consertada".
 *
 * Quem precisar da Saída Teórica na hora deve ter um botão explícito de recalcular, que mostre
 * que vai demorar. O cron horário segue sendo a atualização normal.
 */
export async function refreshConsumoTeorico(supabase: any): Promise<void> {
  try {
    await supabase.schema('silver').rpc('fn_refresh_consumo_teorico');
  } catch (e) {
    console.error('[refreshConsumoTeorico] falhou', e);
  }
}

/** Deriva o bar a partir do parent do item de ficha (produto/produção) e recalcula. */
export async function recalcCmvFromFichaParent(
  supabase: any,
  parent: { producao_id?: number | null; produto_id?: number | null },
): Promise<void> {
  let barId: number | null = null;
  if (parent.produto_id) {
    const { data } = await supabase.from('produto_cardapio').select('bar_id').eq('id', parent.produto_id).single();
    barId = data?.bar_id ?? null;
  } else if (parent.producao_id) {
    const { data } = await supabase.from('producao_base').select('bar_id').eq('id', parent.producao_id).single();
    barId = data?.bar_id ?? null;
  }
  await recalcCmvTeorico(supabase, barId);
}
