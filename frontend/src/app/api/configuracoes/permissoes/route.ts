import { NextRequest, NextResponse } from 'next/server';
import { getModulosParaPermissoes, ROLES_PADRAO } from '@/lib/menu-config';

export const dynamic = 'force-dynamic'

// Módulos são agora gerados automaticamente a partir do menu lateral
// Fonte única de verdade: /lib/menu-config.ts

// GET - Listar módulos do sistema e roles padrão
export async function GET() {
  try {
    // Módulos gerados automaticamente do menu lateral
    const modulosParaExibir = getModulosParaPermissoes();
    
    return NextResponse.json({
      modulos: modulosParaExibir,
      roles: ROLES_PADRAO,
    });
  } catch (error) {
    console.error('Erro ao buscar permissões:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Atualizar permissões de uma role
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { role, modulos } = body;

    if (!role || !Array.isArray(modulos)) {
      return NextResponse.json(
        { error: 'Role e módulos são obrigatórios' },
        { status: 400 }
      );
    }

    // Aqui você poderia salvar as permissões customizadas em uma tabela
    // Por enquanto, retornamos sucesso
    
    return NextResponse.json({
      message: 'Permissões atualizadas com sucesso',
      role,
      modulos,
    });
  } catch (error) {
    console.error('Erro ao atualizar permissões:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
