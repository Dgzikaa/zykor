import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET - Buscar alertas de CMO
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const ano = searchParams.get('ano');
    const naoEnviados = searchParams.get('nao_enviados') === 'true';

    let query = supabase
      .from('cmo_alertas')
      .select(`
        *,
        cmo_semanal:cmo_semanal_id (
          ano,
          semana,
          data_inicio,
          data_fim,
          cmo_total
        )
      `)
      .order('created_at', { ascending: false });

    if (barId) {
      query = query.eq('bar_id', parseInt(barId));
    }

    if (naoEnviados) {
      query = query.eq('enviado', false);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('Erro ao buscar alertas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST - Criar alerta de CMO
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      cmo_semanal_id,
      bar_id,
      tipo_alerta,
      mensagem,
      valor_cmo,
      valor_meta,
    } = body;

    if (!cmo_semanal_id || !bar_id || !tipo_alerta) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando' },
        { status: 400 }
      );
    }

    const diferenca = valor_cmo - valor_meta;
    const percentual_diferenca = valor_meta > 0 
      ? ((diferenca / valor_meta) * 100) 
      : 0;

    const { data, error } = await supabase
      .from('cmo_alertas')
      .insert({
        cmo_semanal_id,
        bar_id,
        tipo_alerta,
        mensagem,
        valor_cmo,
        valor_meta,
        diferenca,
        percentual_diferenca,
      })
      .select()
      .single();

    if (error) throw error;

    // Marcar CMO como alerta enviado
    await supabase
      .from('cmo_semanal')
      .update({
        alerta_enviado: true,
        alerta_enviado_em: new Date().toISOString(),
      })
      .eq('id', cmo_semanal_id);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Erro ao criar alerta:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Marcar alerta como enviado
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID é obrigatório' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('cmo_alertas')
      .update({
        enviado: true,
        enviado_em: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Erro ao atualizar alerta:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
