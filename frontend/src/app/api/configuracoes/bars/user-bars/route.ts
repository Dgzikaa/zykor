import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      return authErrorResponse('Usuário não autenticado');
    }

    const supabase = await getAdminClient();

    // 1. Buscar dados do usuário (auth_custom)
    const { data: usuarioData, error: userError } = await supabase
      .schema('auth_custom')
      .from('usuarios')
      .select('id, auth_id, email, nome, role, setor, modulos_permitidos')
      .eq('email', user.email)
      .eq('ativo', true)
      .single();

    if (userError || !usuarioData) {
      console.error('❌ API: Erro ao buscar dados do usuário:', userError);
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // 2. Buscar IDs dos bares vinculados ao usuário (auth_custom)
    const { data: relacoes, error: relacoesError } = await supabase
      .schema('auth_custom')
      .from('usuarios_bares')
      .select('bar_id')
      .eq('usuario_id', usuarioData.auth_id);

    if (relacoesError) {
      console.error('❌ API: Erro ao buscar relacionamentos:', relacoesError);
      return NextResponse.json(
        { error: 'Erro ao buscar bares do usuário' },
        { status: 500 }
      );
    }

    const barIds = ((relacoes || []) as Array<{ bar_id: number }>)
      .map((r) => r.bar_id)
      .filter((id): id is number => id !== null && id !== undefined);

    if (barIds.length === 0) {
      return NextResponse.json(
        { error: 'Usuário não tem acesso a nenhum bar' },
        { status: 404 }
      );
    }

    // 3. Buscar bares ativos (operations) - embed cross-schema nao funciona
    // no PostgREST, entao fazemos uma segunda query com schema explicito.
    const { data: bares, error: baresError } = await supabase
      .schema('operations')
      .from('bares')
      .select('id, nome, ativo')
      .in('id', barIds)
      .eq('ativo', true);

    if (baresError) {
      console.error('❌ API: Erro ao buscar bares:', baresError);
      return NextResponse.json(
        { error: 'Erro ao buscar bares' },
        { status: 500 }
      );
    }

    if (!bares || bares.length === 0) {
      return NextResponse.json(
        { error: 'Usuário não tem acesso a nenhum bar ativo' },
        { status: 404 }
      );
    }

    // 4. Enriquecer com permissões do usuário
    const barsEnriquecidos = (bares as Array<{ id: number; nome: string; ativo: boolean }>).map((bar) => ({
      id: bar.id,
      nome: bar.nome,
      modulos_permitidos: usuarioData.modulos_permitidos || [],
      role: usuarioData.role || 'funcionario',
      setor: usuarioData.setor,
    }));

    return NextResponse.json({
      success: true,
      bars: barsEnriquecidos,
      userData: usuarioData,
    });
  } catch (error) {
    console.error('❌ API: Erro interno:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}
