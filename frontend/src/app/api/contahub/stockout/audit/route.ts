import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

/**
 * POST /api/contahub/stockout/audit
 *
 * Auditoria do stockout: une bronze (raw) com silver (processado),
 * retornando uma lista unificada de produtos com status incluido/excluido +
 * resumo do dia. Permite ao conferente comparar 1:1 o que foi coletado do
 * ContaHub com o que foi aplicado no cálculo de stockout.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data_consulta, bar_id, prd_codigo } = body;

    if (!data_consulta || !bar_id) {
      return NextResponse.json(
        { success: false, error: 'data_consulta e bar_id são obrigatórios' },
        { status: 400 },
      );
    }

    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Erro ao conectar com o banco de dados' },
        { status: 500 },
      );
    }

    let rawQuery = (supabase as any)
      .schema('bronze')
      .from('bronze_contahub_operacional_stockout_raw')
      .select('id, prd, prd_desc, prd_venda, prd_ativo, prd_estoque, loc_desc, hora_consulta_real, raw_data')
      .eq('data_consulta', data_consulta)
      .eq('bar_id', bar_id);
    if (prd_codigo) rawQuery = rawQuery.eq('prd', prd_codigo);
    const { data: rawData, error: rawError } = await rawQuery.order('prd_desc');
    if (rawError) {
      console.error('[stockout/audit] RAW erro:', rawError);
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar dados RAW' },
        { status: 500 },
      );
    }

    let procQuery = (supabase as any)
      .schema('silver')
      .from('silver_contahub_operacional_stockout_processado')
      .select(
        'raw_id, prd, prd_desc, prd_venda, prd_ativo, prd_estoque, loc_desc, hora_coleta, categoria_mix, categoria_local, incluido, motivo_exclusao, regra_aplicada, ordem_aplicacao, versao_regras, processado_em',
      )
      .eq('data_consulta', data_consulta)
      .eq('bar_id', bar_id);
    if (prd_codigo) procQuery = procQuery.eq('prd', prd_codigo);
    const { data: procData, error: procError } = await procQuery.order('prd_desc');
    if (procError) {
      console.error('[stockout/audit] silver erro:', procError);
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar dados processados' },
        { status: 500 },
      );
    }

    const rawArr = (rawData ?? []) as any[];
    const procArr = (procData ?? []) as any[];
    const procByRawId = new Map<number, any>();
    for (const p of procArr) procByRawId.set(p.raw_id, p);

    const produtos = rawArr.map((raw) => {
      const proc = procByRawId.get(raw.id);
      const grpDesc = raw.raw_data?.grp_desc ?? null;
      return {
        raw_id: raw.id,
        prd_codigo: raw.prd,
        prd_desc: raw.prd_desc,
        prd_venda: raw.prd_venda,
        prd_ativo: raw.prd_ativo,
        prd_estoque: raw.prd_estoque,
        loc_desc: raw.loc_desc,
        grp_desc: grpDesc,
        hora_coleta: proc?.hora_coleta ?? raw.hora_consulta_real,
        foi_processado: !!proc,
        incluido: proc?.incluido ?? false,
        motivo_exclusao: proc?.motivo_exclusao ?? null,
        regra_aplicada: proc?.regra_aplicada ?? null,
        ordem_aplicacao: proc?.ordem_aplicacao ?? null,
        categoria_mix: proc?.categoria_mix ?? null,
        categoria_local: proc?.categoria_local ?? null,
        versao_regras: proc?.versao_regras ?? null,
        raw_data: raw.raw_data ?? null,
      };
    });

    const totalRaw = rawArr.length;
    const totalProcessado = procArr.length;
    const incluidos = procArr.filter((r) => r.incluido).length;
    const excluidos = totalProcessado - incluidos;
    const naoProcessados = produtos.filter((p) => !p.foi_processado).length;

    const motivosMap = new Map<string, number>();
    for (const r of procArr) {
      if (!r.incluido && r.motivo_exclusao) {
        motivosMap.set(r.motivo_exclusao, (motivosMap.get(r.motivo_exclusao) ?? 0) + 1);
      }
    }
    const exclusoesPorMotivo: Record<string, number> = {};
    for (const [k, v] of motivosMap.entries()) exclusoesPorMotivo[k] = v;

    const produtosIncluidos = procArr.filter((r) => r.incluido);
    const produtosDisponiveis = produtosIncluidos.filter((r) => r.prd_venda === 'S').length;
    const produtosIndisponiveis = produtosIncluidos.filter((r) => r.prd_venda === 'N').length;
    const percentualStockout =
      produtosIncluidos.length > 0
        ? (produtosIndisponiveis / produtosIncluidos.length) * 100
        : 0;
    const percentualExcluido = totalProcessado > 0 ? (excluidos / totalProcessado) * 100 : 0;

    const stockoutPorCategoria: Record<string, { total: number; disponiveis: number; stockout: number; percentual: string }> = {};
    for (const r of produtosIncluidos) {
      const cat = r.categoria_local ?? 'Outro';
      if (!stockoutPorCategoria[cat]) {
        stockoutPorCategoria[cat] = { total: 0, disponiveis: 0, stockout: 0, percentual: '0.00' };
      }
      stockoutPorCategoria[cat].total += 1;
      if (r.prd_venda === 'S') stockoutPorCategoria[cat].disponiveis += 1;
      else stockoutPorCategoria[cat].stockout += 1;
    }
    for (const cat of Object.keys(stockoutPorCategoria)) {
      const c = stockoutPorCategoria[cat];
      c.percentual = c.total > 0 ? ((c.stockout / c.total) * 100).toFixed(2) : '0.00';
    }

    const horaProcessamento = procArr.length > 0
      ? procArr.map((r) => r.processado_em).filter(Boolean).sort().slice(-1)[0]
      : null;
    const versaoRegras = procArr[0]?.versao_regras ?? '2.0';

    const audit = totalProcessado > 0 ? {
      data_consulta,
      hora_processamento: horaProcessamento,
      bar_id,
      total_produtos_raw: totalRaw,
      total_incluidos: incluidos,
      total_excluidos: excluidos,
      percentual_excluido: percentualExcluido,
      percentual_stockout: percentualStockout,
      produtos_disponiveis: produtosDisponiveis,
      produtos_indisponiveis: produtosIndisponiveis,
      exclusoes_por_motivo: exclusoesPorMotivo,
      stockout_por_categoria: stockoutPorCategoria,
      versao_regras: versaoRegras,
      tempo_processamento_ms: 0,
    } : null;

    return NextResponse.json({
      success: true,
      data: {
        audit,
        produtos,
        resumo: {
          total_raw: totalRaw,
          total_processado: totalProcessado,
          incluidos,
          excluidos,
          nao_processados: naoProcessados,
        },
      },
    });
  } catch (err) {
    console.error('[stockout/audit] exceção:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    );
  }
}
