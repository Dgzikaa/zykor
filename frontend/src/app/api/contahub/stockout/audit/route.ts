import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data_consulta, bar_id, prd_codigo } = body;

    if (!data_consulta || !bar_id) {
      return NextResponse.json(
        { success: false, error: 'data_consulta e bar_id são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Erro ao conectar com o banco de dados' },
        { status: 500 }
      );
    }

    // 1. Buscar resumo do audit
    const { data: auditData, error: auditError } = await supabase
      .from('contahub_stockout_audit')
      .select('*')
      .eq('data_consulta', data_consulta)
      .eq('bar_id', bar_id)
      .order('hora_processamento', { ascending: false })
      .limit(1);

    if (auditError) {
      console.error('Erro ao buscar audit:', auditError);
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar dados de auditoria' },
        { status: 500 }
      );
    }

    const audit = (auditData || [])[0] || null;

    // 2. Buscar dados RAW
    let rawQuery = supabase
      .from('contahub_stockout_raw')
      .select('id, prd, prd_desc, prd_venda, prd_ativo, prd_estoque, loc_desc, raw_data, hora_consulta_real')
      .eq('data_consulta', data_consulta)
      .eq('bar_id', bar_id);

    if (prd_codigo) {
      rawQuery = rawQuery.eq('prd', prd_codigo);
    }

    const { data: rawData, error: rawError } = await rawQuery.order('prd_desc');

    if (rawError) {
      console.error('Erro ao buscar RAW:', rawError);
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar dados RAW' },
        { status: 500 }
      );
    }

    // 3. Buscar dados PROCESSADOS
    let processadoQuery = supabase
      .from('contahub_stockout_processado')
      .select('raw_id, prd, prd_desc, prd_venda, prd_ativo, prd_estoque, loc_desc, categoria_mix, categoria_local, incluido, motivo_exclusao, regra_aplicada, ordem_aplicacao, versao_regras')
      .eq('data_consulta', data_consulta)
      .eq('bar_id', bar_id);

    if (prd_codigo) {
      processadoQuery = processadoQuery.eq('prd', prd_codigo);
    }

    const { data: processadoData, error: processadoError } = await processadoQuery.order('prd_desc');

    if (processadoError) {
      console.error('Erro ao buscar PROCESSADO:', processadoError);
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar dados processados' },
        { status: 500 }
      );
    }

    // 4. Combinar dados RAW com PROCESSADOS
    const rawArr = (rawData || []) as any[];
    const processadoArr = (processadoData || []) as any[];

    const produtosAuditoria = rawArr.map(raw => {
      const processado = processadoArr.find(p => p.raw_id === raw.id);
      
      return {
        raw_id: raw.id,
        prd_codigo: raw.prd,
        prd_desc: raw.prd_desc,
        prd_venda: raw.prd_venda,
        prd_ativo: raw.prd_ativo,
        prd_estoque: raw.prd_estoque,
        loc_desc: raw.loc_desc,
        grp_desc: raw.raw_data?.grp_desc || null,
        hora_coleta: raw.hora_consulta_real,
        
        // Dados do processamento
        foi_processado: !!processado,
        incluido: processado?.incluido || false,
        motivo_exclusao: processado?.motivo_exclusao || null,
        regra_aplicada: processado?.regra_aplicada || null,
        ordem_aplicacao: processado?.ordem_aplicacao || null,
        categoria_mix: processado?.categoria_mix || null,
        categoria_local: processado?.categoria_local || null,
        versao_regras: processado?.versao_regras || null,
        
        // Dados completos do raw_data
        raw_data: raw.raw_data
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        audit: audit,
        produtos: produtosAuditoria,
        resumo: {
          total_raw: rawArr.length,
          total_processado: processadoArr.length,
          incluidos: processadoArr.filter(p => p.incluido).length,
          excluidos: processadoArr.filter(p => !p.incluido).length,
          nao_processados: rawArr.length - processadoArr.length
        }
      }
    });

  } catch (error) {
    console.error('Erro na API de auditoria de stockout:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
