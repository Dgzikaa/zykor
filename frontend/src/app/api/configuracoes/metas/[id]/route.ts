import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

// =====================================================
// GET - BUSCAR META ESPECÍFICA
// =====================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const { id: metaId } = await params;
    const supabase = await getAdminClient();

    // Buscar metas da coluna 'metas' da tabela bars
    const { data: bar, error } = await supabase
      .from('bars')
      .select('metas')
      .eq('id', user.bar_id)
      .single();

    if (error) {
      console.error('❌ Erro ao buscar metas:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar metas' },
        { status: 500 }
      );
    }

    const metas = bar?.metas || [];
    const meta = metas.find((m: any) => m.id === metaId);

    if (!meta) {
      return NextResponse.json(
        { error: 'Meta não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: meta,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar meta:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// =====================================================
// PUT - ATUALIZAR META
// =====================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const { id: metaId } = await params;
    const body = await request.json();
    const supabase = await getAdminClient();

    // Buscar metas existentes
    const { data: bar, error: fetchError } = await supabase
      .from('bars')
      .select('metas')
      .eq('id', user.bar_id)
      .single();

    if (fetchError) {
      console.error('❌ Erro ao buscar metas existentes:', fetchError);
      return NextResponse.json(
        { error: 'Erro ao buscar metas existentes' },
        { status: 500 }
      );
    }

    const metasExistentes = bar?.metas || [];
    const metaIndex = metasExistentes.findIndex((m: any) => m.id === metaId);

    if (metaIndex === -1) {
      return NextResponse.json(
        { error: 'Meta não encontrada' },
        { status: 404 }
      );
    }

    // Atualizar a meta específica
    const metaAtualizada = {
      ...metasExistentes[metaIndex],
      ...body,
      atualizado_por: user.auth_id,
      atualizado_em: new Date().toISOString(),
    };

    metasExistentes[metaIndex] = metaAtualizada;

    // Atualizar a coluna metas
    const { error: updateError } = await supabase
      .from('bars')
      .update({
        metas: metasExistentes,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', user.bar_id);

    if (updateError) {
      console.error('❌ Erro ao atualizar meta:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar meta' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: metaAtualizada,
      message: 'Meta atualizada com sucesso',
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar meta:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE - DELETAR META
// =====================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const { id: metaId } = await params;
    const supabase = await getAdminClient();

    // Buscar metas existentes
    const { data: bar, error: fetchError } = await supabase
      .from('bars')
      .select('metas')
      .eq('id', user.bar_id)
      .single();

    if (fetchError) {
      console.error('❌ Erro ao buscar metas existentes:', fetchError);
      return NextResponse.json(
        { error: 'Erro ao buscar metas existentes' },
        { status: 500 }
      );
    }

    const metasExistentes = bar?.metas || [];
    const metasFiltradas = metasExistentes.filter((m: any) => m.id !== metaId);

    // Verificar se a meta foi encontrada
    if (metasFiltradas.length === metasExistentes.length) {
      return NextResponse.json(
        { error: 'Meta não encontrada' },
        { status: 404 }
      );
    }

    // Atualizar a coluna metas removendo a meta
    const { error: updateError } = await supabase
      .from('bars')
      .update({
        metas: metasFiltradas,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', user.bar_id);

    if (updateError) {
      console.error('❌ Erro ao deletar meta:', updateError);
      return NextResponse.json(
        { error: 'Erro ao deletar meta' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Meta deletada com sucesso',
    });
  } catch (error) {
    console.error('❌ Erro ao deletar meta:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
