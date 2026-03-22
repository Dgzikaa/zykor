import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barIdParam = searchParams.get('bar_id');
    if (!barIdParam) {
      return NextResponse.json(
        { success: false, error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }
    const barId = barIdParam;
    const tipo = searchParams.get('tipo');
    const limite = parseInt(searchParams.get('limite') || '50');
    const incluirPadroes = searchParams.get('padroes') === 'true';

    // Buscar insights
    let insightsQuery = supabase
      .from('agente_insights')
      .select('*')
      .eq('bar_id', parseInt(barId))
      .eq('arquivado', false)
      .order('created_at', { ascending: false })
      .limit(limite);

    if (tipo) {
      insightsQuery = insightsQuery.eq('tipo', tipo);
    }

    const { data: insights, error: insightsError } = await insightsQuery;

    if (insightsError) throw insightsError;

    // Buscar padrões detectados
    let padroes: any[] | null = null;
    if (incluirPadroes) {
      const { data: padroesData } = await supabase
        .from('agente_padroes_detectados')
        .select('*')
        .eq('bar_id', parseInt(barId))
        .eq('status', 'ativo')
        .order('created_at', { ascending: false });
      
      padroes = padroesData;
    }

    // Estatísticas
    const stats = {
      total_insights: insights?.length || 0,
      nao_visualizados: insights?.filter(i => !i.visualizado).length || 0,
      por_tipo: {} as Record<string, number>,
      por_impacto: {} as Record<string, number>
    };

    for (const insight of insights || []) {
      stats.por_tipo[insight.tipo] = (stats.por_tipo[insight.tipo] || 0) + 1;
      stats.por_impacto[insight.impacto || 'sem_impacto'] = (stats.por_impacto[insight.impacto || 'sem_impacto'] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        insights: insights || [],
        padroes: padroes || [],
        stats
      }
    });

  } catch (error) {
    console.error('Erro ao buscar insights:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar insights' },
      { status: 500 }
    );
  }
}

// Marcar insight como visualizado
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, visualizado, arquivado } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID é obrigatório' },
        { status: 400 }
      );
    }

    const updates: any = {};
    if (visualizado !== undefined) updates.visualizado = visualizado;
    if (arquivado !== undefined) updates.arquivado = arquivado;

    const { data, error } = await supabase
      .from('agente_insights')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Erro ao atualizar insight:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar insight' },
      { status: 500 }
    );
  }
}

// Executar detecção de padrões
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { acao, bar_id } = body;

    if (!bar_id) {
      return NextResponse.json(
        { success: false, error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    if (acao === 'detectar_padroes') {
      // Chamar Edge Function de detecção de padrões
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/agente-padroes-detector`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ bar_id })
        }
      );

      const result = await response.json();
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { success: false, error: 'Ação não reconhecida' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Erro na ação:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao executar ação' },
      { status: 500 }
    );
  }
}
