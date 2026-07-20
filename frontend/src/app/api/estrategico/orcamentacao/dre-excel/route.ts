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
 *   3) compensa a taxa de maquininha e o imposto sobre a receita deduzida, via uma linha
 *      positiva em Custos Variáveis:
 *        · IMPOSTO: exatamente 2% da entrada deduzida (alíquota real do couvert, mais fiel
 *          que a média do DAS). Vale para couvert + ingresso Yuzer + Sympla.
 *        · TAXA MAQUININHA: proporcional — mesma % em que a receita caiu no mês
 *          (pct = dedução ÷ receita bruta do mês).
 *      Não é 100% (couvert não tem quebra por meio de pagamento; nem todo couvert é cartão),
 *      mas evita a DRE Bar carregar taxa/imposto de receita que ela não tem. COMISSÃO 10% e
 *      PROVISÃO FISCAL ficam de fora de propósito (couvert/ingresso não têm gorjeta).
 * Não mexe em mais nada: Margem/Lucro e % recompõem sozinhos no frontend a partir das linhas.
 */
const ATRACOES_EVENTOS = new Set([
  'Atrações Programação', '[Consumação] Artistas', 'Produção Eventos', 'Produção Mensal Fixo',
]);
const DEDUCAO_ENTRADA_CANON = '(−) Couvert / Ingressos';
const COMPENSACAO_CANON = '(+) Taxa/Imposto s/ entrada';
// Alíquota real do couvert (≈ISS), mais fiel que a média do DAS. Aplicada à entrada deduzida.
const IMPOSTO_ENTRADA_RATE = 0.02;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });
    const ano = Number(sp.get('ano')) || new Date().getFullYear();
    const modoBar = sp.get('modo') === 'bar';
    const modoEventos = sp.get('modo') === 'eventos';

    const supabase = await getAdminClient();
    // gold.mv_dre_ano = saída materializada de get_dre_por_ano (validada idêntica, refresh
    // horário). ~0,3ms vs ~2,1s da função. Mesmos números, sem risco de timeout/500.
    const { data, error } = await (supabase as any).schema('gold').from('mv_dre_ano')
      .select('bar_id, mes, categoria_macro, ordem_macro, ordem_sub, categoria, sinal, valor_com_sinal, percentual_receita')
      .eq('bar_id', barId).eq('ano', ano);
    if (error) throw error;

    // modo=eventos ("DRE Eventos"): o COMPLEMENTO exato da DRE Bar — mostra só a economia do show.
    //   Receita        = entrada (couvert ContaHub + ingresso Yuzer + Sympla), da v_dre_bar_deducao_entrada.
    //   Custo Variável = imposto (2% da entrada) + taxa maquininha (proporcional à queda de receita
    //                    do mês) — a MESMA conta que a DRE Bar compensa, aqui como custo real (negativo).
    //   Despesas Artístico = as 4 categorias que a DRE Bar remove (valores reais do CA, drilláveis).
    // Assim DRE Bar + DRE Eventos ≈ DRE cheia. Mensal (12 meses), igual às outras abas.
    if (modoEventos) {
      const receitaPorMes = new Map<string, number>();
      const taxaPorMes = new Map<string, number>();
      for (const l of (data ?? []) as any[]) {
        if (l.categoria_macro === 'Receita') {
          receitaPorMes.set(l.mes, (receitaPorMes.get(l.mes) || 0) + Number(l.valor_com_sinal));
        } else if (l.categoria === 'TAXA MAQUININHA') {
          taxaPorMes.set(l.mes, (taxaPorMes.get(l.mes) || 0) + Number(l.valor_com_sinal));
        }
      }

      const { data: ent, error: errEnt } = await (supabase as any)
        .schema('gold').from('v_dre_bar_deducao_entrada')
        .select('mes, couvert, ingresso_yuzer, sympla, total_deducao')
        .eq('bar_id', barId).eq('ano', ano);
      if (errEnt) throw errEnt;

      const out: any[] = [];
      for (const e of ent ?? []) {
        const mes = e.mes;
        // Receita (positiva) — 3 aberturas
        out.push({ mes, grupo: 'Receita', ordem_grupo: 1, ordem_sub: 1, categoria: 'Couvert', valor: Number(e.couvert) || 0 });
        out.push({ mes, grupo: 'Receita', ordem_grupo: 1, ordem_sub: 2, categoria: 'Ingresso (Yuzer)', valor: Number(e.ingresso_yuzer) || 0 });
        out.push({ mes, grupo: 'Receita', ordem_grupo: 1, ordem_sub: 3, categoria: 'Sympla', valor: Number(e.sympla) || 0 });

        // Custo Variável (negativo) — imposto 2% fixo + taxa maquininha proporcional
        const v = Number(e.total_deducao) || 0;
        const recOrig = receitaPorMes.get(mes) || 0;
        const taxa = Math.abs(taxaPorMes.get(mes) || 0);
        const imposto = IMPOSTO_ENTRADA_RATE * v;
        const taxaMaq = recOrig > 0 ? (v / recOrig) * taxa : 0;
        out.push({ mes, grupo: 'Custo Variável', ordem_grupo: 2, ordem_sub: 1, categoria: 'Imposto (2%)', valor: -imposto });
        out.push({ mes, grupo: 'Custo Variável', ordem_grupo: 2, ordem_sub: 2, categoria: 'Taxa maquininha', valor: -taxaMaq });
      }

      // Despesas Artístico — as 4 categorias reais (valor_com_sinal já vem negativo). drill_macro
      // preserva o macro REAL do CA ('Despesas Comerciais') pra o drill-down casar os lançamentos.
      for (const l of (data ?? []) as any[]) {
        if (ATRACOES_EVENTOS.has(l.categoria)) {
          out.push({
            mes: l.mes, grupo: 'Despesas Artístico', ordem_grupo: 3,
            ordem_sub: Number(l.ordem_sub) || 99, categoria: l.categoria,
            valor: Number(l.valor_com_sinal), drill_macro: l.categoria_macro,
          });
        }
      }

      return NextResponse.json({ linhas: out, ano, modo: 'eventos' });
    }

    let linhas = data ?? [];

    if (modoBar) {
      // (2) tira o grupo Atrações & Eventos inteiro
      linhas = linhas.filter((l: any) => !ATRACOES_EVENTOS.has(l.categoria));

      // Mapas por mês a partir das linhas ORIGINAIS (antes de injetar nada):
      //  - receita bruta do mês (base do pct da taxa proporcional)
      //  - TAXA MAQUININHA do mês (base da compensação proporcional da taxa)
      // O imposto NÃO usa mapa: é 2% fixo da entrada deduzida.
      const receitaPorMes = new Map<string, number>();
      const taxaPorMes = new Map<string, number>();
      for (const l of linhas as any[]) {
        if (l.categoria_macro === 'Receita') {
          receitaPorMes.set(l.mes, (receitaPorMes.get(l.mes) || 0) + Number(l.valor_com_sinal));
        } else if (l.categoria === 'TAXA MAQUININHA') {
          taxaPorMes.set(l.mes, (taxaPorMes.get(l.mes) || 0) + Number(l.valor_com_sinal));
        }
      }

      // (1) dedução de entrada por mês, como sub-linha da Receita (ordem_sub alta = aparece
      // por último dentro da Receita). Reduz a receita → cascateia em % e resultados.
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

        // (3) compensação de taxa+imposto. valor_com_sinal de custo é negativo; a compensação
        // entra POSITIVA (reduz o custo).
        //  · imposto: 2% fixo da entrada deduzida (alíquota real do couvert).
        //  · taxa maquininha: proporcional à queda de receita no mês.
        const recOrig = receitaPorMes.get(d.mes) || 0;
        const taxa = Math.abs(taxaPorMes.get(d.mes) || 0);
        const compImposto = IMPOSTO_ENTRADA_RATE * v;
        const compTaxa = recOrig > 0 ? (v / recOrig) * taxa : 0;
        const comp = compImposto + compTaxa;
        if (comp > 0) {
          linhas.push({
            bar_id: barId,
            mes: d.mes,
            categoria_macro: 'Custos Variáveis',
            ordem_macro: 2,
            ordem_sub: 999,
            categoria: COMPENSACAO_CANON,
            sinal: 1,
            valor_com_sinal: comp,
            percentual_receita: null,
          });
        }
      }
    }

    return NextResponse.json({ linhas, ano });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
