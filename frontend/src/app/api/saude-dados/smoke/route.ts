import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Smoke-check de INFRA (existência/config): buckets, tabelas críticas, schemas expostos
 * no PostgREST e crons vivos. Pega o furo silencioso do tipo "bucket/tabela não existe".
 * Só admin. Roda a função system.fn_infra_smoke_check().
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Apenas administradores' }, { status: 403 });
  }

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).schema('system').rpc('fn_infra_smoke_check');

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, checks: data || [] });
}
