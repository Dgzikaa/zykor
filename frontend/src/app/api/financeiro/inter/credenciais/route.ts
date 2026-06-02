import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) return authErrorResponse('Usuário não autenticado');
    if (user.role !== 'admin' && user.role !== 'financeiro') {
      return permissionErrorResponse('Sem permissão para ver credenciais bancárias');
    }
    const barId = Number(user.bar_id);

    if (!Number.isFinite(barId)) {
      return NextResponse.json(
        { success: false, error: 'Usuário sem bar associado' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('api_credentials')
      .select('id, empresa_nome, empresa_cnpj, configuracoes')
      .eq('bar_id', barId)
      .in('sistema', ['inter', 'banco_inter'])
      .eq('ativo', true)
      .order('id', { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const credenciais = (data || []).map((row: any) => ({
      id: row.id,
      nome: row.empresa_nome || `Inter #${row.id}`,
      cnpj: row.empresa_cnpj || null,
      conta_corrente: row.configuracoes?.conta_corrente || null
    }));

    return NextResponse.json({
      success: true,
      credenciais,
      total: credenciais.length
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
