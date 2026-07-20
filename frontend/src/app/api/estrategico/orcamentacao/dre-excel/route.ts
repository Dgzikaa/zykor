import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

/**
 * GET /api/estrategico/orcamentacao/dre-excel?bar_id=3&ano=2026&modo=bar
 * Retorna estrutura do DRE igual ao Excel:
 * - 12 meses + YTD
 * - Cada categoria MACRO + subcategorias
 * - Valor (R$) + percentual da receita
 *
 * modo=bar ("DRE Bar"): espelho da DRE isolando a operação de bar da economia do show:
 *   1) injeta uma linha negativa na Receita — "(−) Couvert / Ingressos" — deduzindo a
 *      arrecadação de entrada (couvert ContaHub + ingresso Yuzer + Sympla), que na DRE
 *      oficial fica diluída em Stone/Dinheiro. Fonte: gold.v_dre_bar_deducao_entrada.
 *   2) remove o grupo "Atrações & Eventos" (as 4 categorias abaixo), que é o custo que
 *      gera essa receita de entrada.
 * Não mexe em mais nada: Margem/Lucro e % recompõem sozinhos no frontend a partir das linhas.
 */
const ATRACOES_EVENTOS = new Set([
  'Atrações Programação', '[Consumação] Artistas', 'Produção Eventos', 'Produção Mensal Fixo',
]);
const DEDUCAO_ENTRADA_CANON = '(−) Couvert / Ingressos';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });
    const ano = Number(sp.get('ano')) || new Date().getFullYear();
    const modoBar = sp.get('modo') === 'bar';

    const supabase = await getAdminClient();
    // gold.mv_dre_ano = saída materializada de get_dre_por_ano (validada idêntica, refresh
    // horário). ~0,3ms vs ~2,1s da função. Mesmos números, sem risco de timeout/500.
    const { data, error } = await (supabase as any).schema('gold').from('mv_dre_ano')
      .select('bar_id, mes, categoria_macro, ordem_macro, ordem_sub, categoria, sinal, valor_com_sinal, percentual_receita')
      .eq('bar_id', barId).eq('ano', ano);
    if (error) throw error;

    let linhas = data ?? [];

    if (modoBar) {
      // (2) tira o grupo Atrações & Eventos inteiro
      linhas = linhas.filter((l: any) => !ATRACOES_EVENTOS.has(l.categoria));

      // (1) injeta a dedução de entrada por mês, como sub-linha da Receita (ordem_sub alta
      // = aparece por último dentro da Receita). Reduz a receita → cascateia em % e resultados.
      const { data: ded, error: errDed } = await (supabase as any)
        .schema('gold').from('v_dre_bar_deducao_entrada')
        .select('mes, total_deducao')
        .eq('bar_id', barId).eq('ano', ano);
      if (errDed) throw errDed;

      for (const d of ded ?? []) {
        const v = Number(d.total_deducao) || 0;
        if (v <= 0) continue;
        linhas.push({
          bar_id: barId,
          mes: d.mes, // 'YYYY-MM-01', mesmo formato da mv
          categoria_macro: 'Receita',
          ordem_macro: 1,
          ordem_sub: 999,
          categoria: DEDUCAO_ENTRADA_CANON,
          sinal: -1,
          valor_com_sinal: -v,
          percentual_receita: null, // recalculado no frontend
        });
      }
    }

    return NextResponse.json({ linhas, ano });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
