import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rh/areas
 * Lista todas as áreas de um bar
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const ativo = searchParams.get('ativo');

    if (!barId) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();
    
    let query = supabase
      .from('areas')
      .select('*')
      .eq('bar_id', parseInt(barId))
      .order('nome');

    if (ativo !== null && ativo !== undefined) {
      query = query.eq('ativo', ativo === 'true');
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Erro ao listar áreas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rh/areas
 * Cria uma nova área
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, nome, adicional_noturno, cor } = body;

    if (!bar_id || !nome) {
      return NextResponse.json(
        { error: 'bar_id e nome são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    const { data, error } = await supabase
      .from('areas')
      .insert({
        bar_id,
        nome: nome.trim(),
        adicional_noturno: adicional_noturno || 0,
        cor: cor || '#6366f1',
        ativo: true
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Já existe uma área com este nome' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Área criada com sucesso',
      data
    });

  } catch (error) {
    console.error('Erro ao criar área:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/rh/areas
 * Atualiza uma área existente
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, nome, adicional_noturno, cor, ativo } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    const updateData: Record<string, unknown> = {
      atualizado_em: new Date().toISOString()
    };

    if (nome !== undefined) updateData.nome = nome.trim();
    if (adicional_noturno !== undefined) updateData.adicional_noturno = adicional_noturno;
    if (cor !== undefined) updateData.cor = cor;
    if (ativo !== undefined) updateData.ativo = ativo;

    const { data, error } = await supabase
      .from('areas')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Já existe uma área com este nome' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Área atualizada com sucesso',
      data
    });

  } catch (error) {
    console.error('Erro ao atualizar área:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rh/areas
 * Remove uma área (soft delete - marca como inativo)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    // Verificar se há funcionários usando esta área
    const { count } = await supabase
      .from('funcionarios')
      .select('*', { count: 'exact', head: true })
      .eq('area_id', parseInt(id))
      .eq('ativo', true);

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir. Existem ${count} funcionário(s) nesta área.` },
        { status: 409 }
      );
    }

    // Soft delete
    const { error } = await supabase
      .from('areas')
      .update({ ativo: false, atualizado_em: new Date().toISOString() })
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Área removida com sucesso'
    });

  } catch (error) {
    console.error('Erro ao remover área:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
