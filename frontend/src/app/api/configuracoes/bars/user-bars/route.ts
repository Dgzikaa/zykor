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

    // 1. Buscar dados do usuário
    const { data: usuarioData, error: userError } = await supabase
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

    // 2. Buscar bares do usuário através de usuarios_bares (usando auth_id)
    const { data: relacoes, error: relacoesError } = await supabase
      .from('usuarios_bares')
      .select(`
        bar_id,
        bares!inner(id, nome, ativo)
      `)
      .eq('usuario_id', usuarioData.auth_id);

    if (relacoesError) {
      console.error('❌ API: Erro ao buscar relacionamentos:', relacoesError);
      return NextResponse.json(
        { error: 'Erro ao buscar bares do usuário' },
        { status: 500 }
      );
    }

    if (!relacoes || relacoes.length === 0) {
      return NextResponse.json(
        { error: 'Usuário não tem acesso a nenhum bar' },
        { status: 404 }
      );
    }

    // 3. Filtrar apenas bares ativos e enriquecer com permissões do usuário
    const barsEnriquecidos = relacoes
      .filter((rel: any) => rel.bares && !Array.isArray(rel.bares) && rel.bares.ativo)
      .map((rel: any) => ({
        id: rel.bares.id,
        nome: rel.bares.nome,
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
