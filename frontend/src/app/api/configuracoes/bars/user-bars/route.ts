import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 API: Buscando bares do usuário...');
    }

    const user = await authenticateUser(request);
    if (!user) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ API: Usuário não autenticado');
      }
      return authErrorResponse('Usuário não autenticado');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ API: Usuário autenticado:', user.nome);
    }

    const supabase = await getAdminClient();
    if (process.env.NODE_ENV === 'development') {
      console.log('🔗 API: Cliente Supabase conectado');
    }

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

    if (process.env.NODE_ENV === 'development') {
      console.log('📊 API: Dados do usuário encontrados:', usuarioData);
    }

    // 2. Buscar bares do usuário através de usuarios_bares
    const { data: relacoes, error: relacoesError } = await supabase
      .from('usuarios_bares')
      .select(`
        bar_id,
        bares:bar_id(id, nome, ativo)
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
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ API: Usuário não tem acesso a nenhum bar');
      }
      return NextResponse.json(
        { error: 'Usuário não tem acesso a nenhum bar' },
        { status: 404 }
      );
    }

    // 3. Filtrar apenas bares ativos e enriquecer com permissões do usuário
    const barsEnriquecidos = relacoes
      .filter(rel => rel.bares?.ativo)
      .map(rel => ({
        id: rel.bares.id,
        nome: rel.bares.nome,
        modulos_permitidos: usuarioData.modulos_permitidos || [],
        role: usuarioData.role || 'funcionario',
        setor: usuarioData.setor,
      }));

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ API: Bares encontrados:', barsEnriquecidos);
    }

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
