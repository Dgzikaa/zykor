import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/agente/insights-v2/events
 * Busca eventos detectados pelo detector determinístico
 * 
 * Query params:
 * - bar_id (obrigatório)
 * - data (opcional, formato YYYY-MM-DD)
 * - processed (opcional, boolean)
 * - event_type (opcional, string)
 * - severity (opcional: 'baixa' | 'media' | 'alta')
 * - limit (opcional, default 100)
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
    const data = searchParams.get('data');
    const processedParam = searchParams.get('processed');
    const eventType = searchParams.get('event_type');
    const severity = searchParams.get('severity');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = supabase
      .from('insight_events')
      .select('*')
      .eq('bar_id', barId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (data) {
      query = query.eq('data', data);
    }

    if (processedParam !== null) {
      const processed = processedParam === 'true';
      query = query.eq('processed', processed);
    }

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data: eventos, error } = await query;

    if (error) {
      console.error('Erro ao buscar eventos:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const eventosArr = (eventos || []) as any[];

    const stats = {
      total: eventosArr.length,
      processados: eventosArr.filter(e => e.processed).length,
      nao_processados: eventosArr.filter(e => !e.processed).length,
      por_tipo: {} as Record<string, number>,
      por_severidade: {
        alta: eventosArr.filter(e => e.severity === 'alta').length,
        media: eventosArr.filter(e => e.severity === 'media').length,
        baixa: eventosArr.filter(e => e.severity === 'baixa').length,
      },
    };

    for (const evento of eventosArr) {
      stats.por_tipo[evento.event_type] = (stats.por_tipo[evento.event_type] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      eventos: eventosArr,
      stats,
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao buscar eventos' },
      { status: 500 }
    );
  }
}
