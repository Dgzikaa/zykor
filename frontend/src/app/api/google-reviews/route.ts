import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();
    
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');
    const dataInicio = searchParams.get('data_inicio');
    const dataFim = searchParams.get('data_fim');
    const estrelas = searchParams.get('estrelas');
    const limite = parseInt(searchParams.get('limite') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const ordenar = searchParams.get('ordenar') || 'published_at_date';
    const ordem = searchParams.get('ordem') || 'desc';

    // Query base
    let query = supabase
      .from('google_reviews')
      .select('*', { count: 'exact' })
      .eq('bar_id', barId);

    // Filtros opcionais
    if (dataInicio) {
      query = query.gte('published_at_date', dataInicio);
    }
    if (dataFim) {
      query = query.lte('published_at_date', dataFim + 'T23:59:59');
    }
    if (estrelas) {
      query = query.eq('stars', parseInt(estrelas));
    }

    // Ordenação
    query = query.order(ordenar, { ascending: ordem === 'asc' });

    // Paginação
    query = query.range(offset, offset + limite - 1);

    const { data: reviews, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar reviews:', error);
      return NextResponse.json({ error: 'Erro ao buscar dados', details: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: reviews || [],
      total: count || 0,
      limite,
      offset,
    });

  } catch (error) {
    console.error('Erro na API de Google Reviews:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
