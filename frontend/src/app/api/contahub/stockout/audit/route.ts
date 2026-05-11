import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

/**
 * POST /api/contahub/stockout/audit
 *
 * Auditoria do stockout: compara bronze (raw) com silver (processado),
 * mostrando quais produtos foram incluídos/excluídos e por qual regra.
 *
 * Body: { data_consulta: YYYY-MM-DD, bar_id: N, prd_codigo?: string }
 *
 * Nota: a tabela `system.contahub_stockout_audit` (que existia em versões
 * anteriores) foi removida; agora a auditoria é construída comparando
 * bronze x silver direto.
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

    // 1. Dados RAW (bronze)
    let rawQuery = (supabase as any)
      .schema('bronze')
      .from('bronze_contahub_operacional_stockout_raw')
      .select('id, prd, prd_desc, prd_venda, prd_ativo, prd_estoque, loc_desc, hora_consulta_real')
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

    // 2. Dados PROCESSADOS (silver)
    let procQuery = (supabase as any)
      .schema('silver')
      .from('silver_contahub_operacional_stockout_processado')
      .select(
        'raw_id, prd, prd_desc, prd_venda, prd_ativo, prd_estoque, loc_desc, categoria_mix, categoria_local, incluido, motivo_exclusao, regra_aplicada, ordem_aplicacao, versao_regras',
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

    // 3. Resumo agregado
    const procArr = (procData ?? []) as any[];
    const total = procArr.length;
    const incluidos = procArr.filter(r => r.incluido).length;
    const excluidos = total - incluidos;
    const stockoutIncluidos = procArr.filter(r => r.incluido && r.prd_venda === 'N').length;

    const motivosMap = new Map<string, number>();
    for (const r of procArr) {
      if (!r.incluido && r.motivo_exclusao) {
        motivosMap.set(r.motivo_exclusao, (motivosMap.get(r.motivo_exclusao) ?? 0) + 1);
      }
    }
    const motivos = Array.from(motivosMap.entries())
      .map(([motivo, qtd]) => ({ motivo, qtd }))
      .sort((a, b) => b.qtd - a.qtd);

    // 4. RPC canônica para resumo de stockout do dia
    const { data: stockoutResumo } = await (supabase as any).rpc('calcular_stockout_dia', {
      p_bar_id: bar_id,
      p_data: data_consulta,
    });

    return NextResponse.json({
      success: true,
      data_consulta,
      bar_id,
      raw_count: (rawData ?? []).length,
      processado_count: total,
      resumo: {
        incluidos,
        excluidos,
        stockout_em_incluidos: stockoutIncluidos,
        motivos_exclusao: motivos,
        canonico: stockoutResumo ?? [],
      },
      raw: rawData ?? [],
      processado: procArr,
    });
  } catch (err) {
    console.error('[stockout/audit] exceção:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    );
  }
}
