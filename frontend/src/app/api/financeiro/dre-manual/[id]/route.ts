import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

// PUT para atualizar lançamento manual
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  try {
    const { id } = await params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'ID do lançamento é obrigatório' },
        { status: 400 }
      );
    }

    const {
      data_competencia,
      descricao,
      valor,
      categoria,
      categoria_macro,
      observacoes,
    } = body;

    const updateData: Record<string, any> = {
      atualizado_em: new Date().toISOString(),
    };

    if (data_competencia) updateData.data_competencia = data_competencia;
    if (descricao) updateData.descricao = descricao;
    if (valor !== undefined) updateData.valor = parseFloat(valor);
    if (categoria) updateData.categoria = categoria;
    if (categoria_macro) updateData.categoria_macro = categoria_macro;
    if (observacoes !== undefined) updateData.observacoes = observacoes;

    const { data, error } = await supabase
      .from('dre_manual')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar lançamento manual:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar lançamento' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      lancamento: data,
    });
  } catch (error) {
    console.error('Erro ao atualizar lançamento:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE para remover lançamento manual
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'ID do lançamento é obrigatório' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('dre_manual')
      .delete()
      .eq('id', parseInt(id));

    if (error) {
      console.error('Erro ao deletar lançamento manual:', error);
      return NextResponse.json(
        { error: 'Erro ao deletar lançamento' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Lançamento removido com sucesso',
    });
  } catch (error) {
    console.error('Erro ao deletar lançamento:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// GET para buscar um lançamento específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'ID do lançamento é obrigatório' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('dre_manual')
      .select('*')
      .eq('id', parseInt(id))
      .single();

    if (error) {
      console.error('Erro ao buscar lançamento manual:', error);
      return NextResponse.json(
        { error: 'Lançamento não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      lancamento: data,
    });
  } catch (error) {
    console.error('Erro ao buscar lançamento:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
