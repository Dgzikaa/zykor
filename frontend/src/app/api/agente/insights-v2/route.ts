import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/agente/insights-v2
 * Busca insights do Agent V2 com filtros
 * 
 * Query params:
 * - bar_id (obrigatório)
 * - data_inicio (opcional, formato YYYY-MM-DD)
 * - data_fim (opcional, formato YYYY-MM-DD)
 * - tipo (opcional: 'problema' | 'oportunidade')
 * - severidade (opcional: 'baixa' | 'media' | 'alta')
 * - limit (opcional, default 50)
 */
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

    const barId = parseInt(barIdParam);
    const dataInicio = searchParams.get('data_inicio');
    const dataFim = searchParams.get('data_fim');
    const tipo = searchParams.get('tipo');
    const severidade = searchParams.get('severidade');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('agent_insights_v2')
      .select('*')
      .eq('bar_id', barId)
      .eq('arquivado', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (dataInicio) {
      query = query.gte('data', dataInicio);
    }

    if (dataFim) {
      query = query.lte('data', dataFim);
    }

    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    if (severidade) {
      query = query.eq('severidade', severidade);
    }

    const { data: insights, error } = await query;

    if (error) {
      console.error('Erro ao buscar insights v2:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const insightsArr = (insights || []) as any[];

    const stats = {
      total: insightsArr.length,
      nao_visualizados: insightsArr.filter(i => !i.visualizado).length,
      problemas: insightsArr.filter(i => i.tipo === 'problema').length,
      oportunidades: insightsArr.filter(i => i.tipo === 'oportunidade').length,
      por_severidade: {
        alta: insightsArr.filter(i => i.severidade === 'alta').length,
        media: insightsArr.filter(i => i.severidade === 'media').length,
        baixa: insightsArr.filter(i => i.severidade === 'baixa').length,
      },
    };

    return NextResponse.json({
      success: true,
      insights: insightsArr,
      stats,
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao buscar insights' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agente/insights-v2
 * Atualiza status de um insight (visualizado/arquivado)
 * 
 * Body:
 * - id (obrigatório, UUID)
 * - visualizado (opcional, boolean)
 * - arquivado (opcional, boolean)
 */
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

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nenhum campo para atualizar' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('agent_insights_v2')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar insight v2:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao atualizar insight' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agente/insights-v2
 * Dispara o pipeline v2 manualmente
 * 
 * Body:
 * - bar_id (obrigatório)
 * - data (opcional, formato YYYY-MM-DD, default = ontem)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, data } = body;

    if (!bar_id) {
      return NextResponse.json(
        { success: false, error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`🎭 Disparando pipeline v2 para bar_id=${bar_id}, data=${data || 'ontem'}`);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/agente-pipeline-v2`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bar_id, data }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na Edge Function:', errorText);
      return NextResponse.json(
        { success: false, error: 'Erro ao executar pipeline v2' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Erro ao disparar pipeline v2:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao disparar pipeline' },
      { status: 500 }
    );
  }
}
