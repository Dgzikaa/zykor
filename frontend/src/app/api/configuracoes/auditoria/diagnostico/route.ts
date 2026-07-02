import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Diagnóstico da atribuição de auditoria. Confirma se o header x-audit-email injetado pelo
 * getAdminClient chega ao PostgREST (request.headers) — o elo crítico do trigger de auditoria.
 * Se `chega_ao_banco` for true, a atribuição está 100%. Admin only.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Apenas admin' }, { status: 403 });
  }

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).schema('system').rpc('debug_request_headers');

  return NextResponse.json({
    success: !error,
    error: error?.message ?? null,
    usuario_no_contexto: user.email,          // quem o app acha que está logado
    x_audit_email_no_banco: data?.x_audit_email ?? null, // o que o PostgREST recebeu
    chega_ao_banco: !!data?.x_audit_email,    // true = atribuição funcionando ponta a ponta
    headers_vistos: data?.request_headers ?? null,
  });
}
