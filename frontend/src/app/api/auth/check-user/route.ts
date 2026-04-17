/**
 * API para verificar se usuário existe
 * REMOVER EM PRODUÇÃO
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email é obrigatório' },
        { status: 400 }
      );
    }

    const adminClient = await getAdminClient();

    // Buscar na tabela usuarios
    const { data: usuarios, error } = await adminClient
      .schema('auth_custom')
      .from('usuarios')
      .select('id, email, nome, role, ativo, auth_id, modulos_permitidos')
      .eq('email', email);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      found: usuarios && usuarios.length > 0,
      count: usuarios?.length || 0,
      users: usuarios?.map(u => ({
        id: u.id,
        email: u.email,
        nome: u.nome,
        role: u.role,
        ativo: u.ativo,
        auth_id: u.auth_id ? `${u.auth_id.substring(0, 8)}...` : 'null',
        modulos_count: Array.isArray(u.modulos_permitidos) 
          ? u.modulos_permitidos.length 
          : Object.keys(u.modulos_permitidos || {}).length,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
