import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * API para recalcular dados históricos de stockout
 * Remove produtos que não devem estar no stockout (baldes, happy hour, etc)
 */
export async function POST(request: NextRequest) {
  try {
    const { bar_id } = await request.json();

    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    // 1. Deletar produtos que não devem estar no stockout
    const termosExcluidos = ['happy hour', 'happyhour', 'happy-hour', 'balde', 'baldes'];
    
    let totalDeletados = 0;
    
    for (const termo of termosExcluidos) {
      const { data: deletados, error } = await supabase
        .schema('bronze')
        .from('bronze_contahub_operacional_stockout_raw')
        .delete()
        .eq('bar_id', bar_id)
        .ilike('prd_desc', `%${termo}%`)
        .select('id');

      if (error) {
        console.error(`❌ Erro ao deletar produtos com termo "${termo}":`, error);
      } else {
        const count = deletados?.length || 0;
        totalDeletados += count;
      }
    }

    // 2. Buscar todas as datas únicas que temos dados
    const { data: datas, error: datasError } = await supabase
      .schema('bronze')
      .from('bronze_contahub_operacional_stockout_raw')
      .select('data_consulta')
      .eq('bar_id', bar_id)
      .order('data_consulta', { ascending: false });

    if (datasError) {
      throw new Error(`Erro ao buscar datas: ${datasError.message}`);
    }

    const datasUnicas = [...new Set(datas?.map(d => d.data_consulta) || [])];

    // 3. Para cada data, recalcular as estatísticas
    const resultados: Array<{
      data: string;
      total_produtos: number;
      produtos_ativos: number;
      produtos_inativos: number;
      percentual_stockout: string;
      percentual_disponibilidade: string;
    }> = [];
    
    for (const data of datasUnicas) {
      // Buscar produtos da data
      const { data: produtos, error: produtosError } = await supabase
        .schema('bronze')
        .from('bronze_contahub_operacional_stockout_raw')
        .select('*')
        .eq('bar_id', bar_id)
        .eq('data_consulta', data);

      if (produtosError) {
        console.error(`❌ Erro ao buscar produtos de ${data}:`, produtosError);
        continue;
      }

      // Calcular estatísticas
      const total = produtos?.length || 0;
      const ativos = produtos?.filter(p => p.prd_venda === 'S' && (p.prd_estoque || 0) > 0).length || 0;
      const inativos = total - ativos;
      const percStockout = total > 0 ? ((inativos / total) * 100).toFixed(2) : '0.00';
      const percDisponibilidade = total > 0 ? ((ativos / total) * 100).toFixed(2) : '100.00';

      resultados.push({
        data,
        total_produtos: total,
        produtos_ativos: ativos,
        produtos_inativos: inativos,
        percentual_stockout: `${percStockout}%`,
        percentual_disponibilidade: `${percDisponibilidade}%`
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Recálculo concluído com sucesso',
      estatisticas: {
        bar_id,
        produtos_deletados: totalDeletados,
        datas_recalculadas: datasUnicas.length,
        termos_excluidos: termosExcluidos
      },
      resultados: resultados.slice(0, 10) // Retornar apenas as 10 datas mais recentes
    });

  } catch (error) {
    console.error('❌ Erro no recálculo:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao recalcular dados de stockout',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
