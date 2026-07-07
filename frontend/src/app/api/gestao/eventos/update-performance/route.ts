import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  await authenticateUser(request);
  try {
    // Inicializar cliente Supabase
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Erro ao conectar com banco' },
        { status: 500 }
      );
    }
    const { data_evento, bar_id, publico_real, faturamento_liquido } =
      await request.json();

    if (!data_evento || !bar_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Data do evento e bar_id são obrigatórios',
        },
        { status: 400 }
      );
    }

    // Atualizar os dados de performance
    const { data, error } = await supabase
      .from('eventos_base')
      .update({
        publico_real,
        receita_total: faturamento_liquido, // Usar campo existente
        updated_at: new Date().toISOString(),
      })
      .eq('bar_id', bar_id)
      .eq('data_evento', data_evento)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar performance:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Dados de performance atualizados com sucesso',
    });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Inicializar cliente Supabase
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Erro ao conectar com banco' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const data_evento = searchParams.get('data_evento');
    const bar_id = searchParams.get('bar_id');

    if (!data_evento || !bar_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Data do evento e bar_id são obrigatórios',
        },
        { status: 400 }
      );
    }

    // Buscar evento com dados de performance
    const { data: evento, error } = await supabase
      .from('eventos_base')
      .select('*')
      .eq('bar_id', parseInt(bar_id))
      .eq('data_evento', data_evento)
      .single();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Evento não encontrado para esta data',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: evento,
    });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}
