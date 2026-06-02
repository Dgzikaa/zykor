import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

const supabase = createServiceRoleClient();

/**
 * GET /api/umbler/conversas
 * Lista conversas do chatbot
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id') || '3';
    const status = searchParams.get('status'); // aberta, em_atendimento, finalizada
    const telefone = searchParams.get('telefone');
    const dataInicio = searchParams.get('data_inicio');
    const dataFim = searchParams.get('data_fim');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('umbler_conversas')
      .select(`
        *,
        mensagens_count:umbler_mensagens(count)
      `, { count: 'exact' })
      .eq('bar_id', parseInt(barId))
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (telefone) {
      query = query.ilike('contato_telefone', `%${telefone}%`);
    }

    if (dataInicio) {
      query = query.gte('created_at', dataInicio);
    }

    if (dataFim) {
      query = query.lte('created_at', dataFim);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar conversas:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      conversas: data || [],
      total: count || 0,
      limit,
      offset
    });

  } catch (error) {
    console.error('Erro na API Umbler Conversas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
