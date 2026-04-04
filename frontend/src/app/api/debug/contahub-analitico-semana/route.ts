import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Busca dados de contahub_analitico para uma semana e calcula o mix
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    const body = await request.json();
    
    const { bar_id, data_inicio, data_fim } = body;
    
    if (!bar_id || !data_inicio || !data_fim) {
      return NextResponse.json({ 
        error: 'bar_id, data_inicio e data_fim são obrigatórios' 
      }, { status: 400 });
    }

    // Buscar dados de contahub_analitico
    const { data: vendas, error: vendasError } = await supabase
      .from('contahub_analitico')
      .select('trn_dtgerencial, categoria_produto, valor_final')
      .eq('bar_id', bar_id)
      .gte('trn_dtgerencial', data_inicio)
      .lte('trn_dtgerencial', data_fim);

    if (vendasError) {
      return NextResponse.json({ 
        error: 'Erro ao buscar contahub_analitico', 
        details: vendasError 
      }, { status: 500 });
    }

    const vendasArray = (vendas || []) as any[];

    // Calcular totais por categoria
    let totalBebidas = 0;
    let totalDrinks = 0;
    let totalComida = 0;
    let totalGeral = 0;

    vendasArray.forEach(v => {
      const valor = parseFloat(String(v.valor_final)) || 0;
      const categoria = (v.categoria_produto || '').toUpperCase();

      totalGeral += valor;

      if (categoria === 'BEBIDA') {
        totalBebidas += valor;
      } else if (categoria === 'DRINK') {
        totalDrinks += valor;
      } else if (categoria === 'COMIDA') {
        totalComida += valor;
      }
    });

    // Calcular percentuais
    const percBebidas = totalGeral > 0 ? (totalBebidas / totalGeral) * 100 : 0;
    const percDrinks = totalGeral > 0 ? (totalDrinks / totalGeral) * 100 : 0;
    const percComida = totalGeral > 0 ? (totalComida / totalGeral) * 100 : 0;

    return NextResponse.json({
      success: true,
      periodo: { data_inicio, data_fim },
      faturamento_total: totalGeral,
      totais_por_categoria: {
        bebidas: totalBebidas,
        drinks: totalDrinks,
        comida: totalComida,
        outros: totalGeral - totalBebidas - totalDrinks - totalComida,
      },
      mix: {
        perc_bebidas: percBebidas,
        perc_drinks: percDrinks,
        perc_comida: percComida,
      },
      total_registros: vendasArray.length,
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Erro interno', 
      message: error.message 
    }, { status: 500 });
  }
}
