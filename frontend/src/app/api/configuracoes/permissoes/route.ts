import { NextRequest, NextResponse } from 'next/server';
import { getModulosParaPermissoes, ROLES_PADRAO } from '@/lib/permissions/modules';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic'

// Módulos são agora gerados automaticamente a partir do menu lateral
// Módulos derivados da fonte única do menu: /lib/permissions/modules.ts

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
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
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
