import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * 📊 API ROUTE - ANOMALIAS DE CONTAGEM DE ESTOQUE
 * 
 * Retorna contagens com anomalias detectadas e permite executar detecção
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bar_id_param = searchParams.get('bar_id');
    
    if (!bar_id_param) {
      return NextResponse.json(
        { success: false, error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }
    const bar_id = parseInt(bar_id_param);
    const data_inicio = searchParams.get('data_inicio');
    const data_fim = searchParams.get('data_fim');
    const min_score = parseInt(searchParams.get('min_score') || '0');
    const tipo = searchParams.get('tipo'); // Filtrar por tipo específico
    const limit = parseInt(searchParams.get('limit') || '100');
    
    const supabase = createServiceRoleClient();
    
    // Query base
    let query = supabase
      .from('contagem_estoque_insumos')
      .select('*')
      .eq('bar_id', bar_id)
      .eq('contagem_anomala', true)
      .gte('score_anomalia', min_score)
      .order('score_anomalia', { ascending: false })
      .order('data_contagem', { ascending: false })
      .limit(limit);
    
    // Filtros opcionais
    if (data_inicio) {
      query = query.gte('data_contagem', data_inicio);
    }
    
    if (data_fim) {
      query = query.lte('data_contagem', data_fim);
    }
    
    if (tipo) {
      query = query.contains('tipo_anomalia', [tipo]);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Erro ao buscar anomalias:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }
    
    // Agrupar por tipo de anomalia
    const por_tipo: Record<string, number> = {};
    const por_gravidade: Record<string, number> = {
      critica: 0,    // score >= 70
      alta: 0,       // score >= 50
      media: 0,      // score >= 30
      baixa: 0       // score < 30
    };
    
    data?.forEach((item: any) => {
      // Contar por tipo
      item.tipo_anomalia?.forEach((tipo: string) => {
        por_tipo[tipo] = (por_tipo[tipo] || 0) + 1;
      });
      
      // Contar por gravidade
      const score = parseFloat(item.score_anomalia || 0);
      if (score >= 70) por_gravidade.critica++;
      else if (score >= 50) por_gravidade.alta++;
      else if (score >= 30) por_gravidade.media++;
      else por_gravidade.baixa++;
    });
    
    return NextResponse.json({
      success: true,
      data,
      stats: {
        total: data?.length || 0,
        por_tipo,
        por_gravidade
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erro ao buscar anomalias:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

/**
 * POST - Executar detecção de anomalias
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, data_inicio, data_fim } = body;

    if (!bar_id) {
      return NextResponse.json({
        success: false,
        error: 'bar_id é obrigatório'
      }, { status: 400 });
    }
    
    const supabase = createServiceRoleClient();

    // Chamar função SQL de detecção
    const { data, error } = await supabase.rpc('detectar_anomalias_contagem', {
      p_bar_id: bar_id,
      p_data_inicio: data_inicio || null,
      p_data_fim: data_fim || null
    });
    
    if (error) {
      console.error('Erro ao detectar anomalias:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }
    
    const resultado = data?.[0] || {};

    return NextResponse.json({
      success: true,
      message: 'Detecção de anomalias concluída',
      resultado: {
        total_processados: resultado.total_processados || 0,
        total_anomalias: resultado.total_anomalias || 0,
        por_tipo: resultado.por_tipo || {},
        taxa_anomalias: resultado.total_processados > 0 
          ? ((resultado.total_anomalias / resultado.total_processados) * 100).toFixed(2) + '%'
          : '0%'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erro ao executar detecção:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

