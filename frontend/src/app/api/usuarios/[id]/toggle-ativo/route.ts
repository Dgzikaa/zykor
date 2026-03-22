import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 🔐 AUTENTICAÇÃO
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const { id: userId } = await params;
    const supabase = await getAdminClient();

    // Buscar usuário atual
    const { data: usuario, error: fetchError } = await supabase
      .from('usuarios_bar')
      .select('id, nome, ativo')
      .eq('id', userId)
      .eq('bar_id', user.bar_id)
      .single();

    if (fetchError || !usuario) {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Toggle do status ativo
    const novoStatus = !usuario.ativo;

    const { data: usuarioAtualizado, error: updateError } = await supabase
      .from('usuarios_bar')
      .update({
        ativo: novoStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .eq('bar_id', user.bar_id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar status:', updateError);
      return NextResponse.json(
        { success: false, error: 'Erro ao atualizar status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      usuario: usuarioAtualizado,
      message: `Usuário ${novoStatus ? 'ativado' : 'desativado'} com sucesso`,
    });
  } catch (error) {
    console.error('Erro ao alterar status do usuário:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno' },
      { status: 500 }
    );
  }
}
