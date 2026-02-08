import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rh/cargos
 * Lista todos os cargos de um bar
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
      .from('cargos')
      .select('*')
      .eq('bar_id', parseInt(barId))
      .order('nivel', { ascending: false })
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
    console.error('Erro ao listar cargos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rh/cargos
 * Cria um novo cargo
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, nome, descricao, nivel } = body;

    if (!bar_id || !nome) {
      return NextResponse.json(
        { error: 'bar_id e nome são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    const { data, error } = await supabase
      .from('cargos')
      .insert({
        bar_id,
        nome: nome.trim(),
        descricao: descricao || null,
        nivel: nivel || 1,
        ativo: true
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Já existe um cargo com este nome' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Cargo criado com sucesso',
      data
    });

  } catch (error) {
    console.error('Erro ao criar cargo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/rh/cargos
 * Atualiza um cargo existente
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, nome, descricao, nivel, ativo } = body;

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
    if (descricao !== undefined) updateData.descricao = descricao;
    if (nivel !== undefined) updateData.nivel = nivel;
    if (ativo !== undefined) updateData.ativo = ativo;

    const { data, error } = await supabase
      .from('cargos')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Já existe um cargo com este nome' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Cargo atualizado com sucesso',
      data
    });

  } catch (error) {
    console.error('Erro ao atualizar cargo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rh/cargos
 * Remove um cargo (soft delete - marca como inativo)
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

    // Verificar se há funcionários usando este cargo
    const { count } = await supabase
      .from('funcionarios')
      .select('*', { count: 'exact', head: true })
      .eq('cargo_id', parseInt(id))
      .eq('ativo', true);

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir. Existem ${count} funcionário(s) com este cargo.` },
        { status: 409 }
      );
    }

    // Soft delete
    const { error } = await supabase
      .from('cargos')
      .update({ ativo: false, atualizado_em: new Date().toISOString() })
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Cargo removido com sucesso'
    });

  } catch (error) {
    console.error('Erro ao remover cargo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
