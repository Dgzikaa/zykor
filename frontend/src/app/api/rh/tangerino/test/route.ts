import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { resolveTangerinoCredential, tangerinoAuthHeader, TANGERINO } from '@/lib/tangerino/resolveCredential';

/**
 * GET /api/rh/tangerino/test — valida a credencial Tangerino do bar chamando o GET /test deles.
 * Use depois de cadastrar o token, antes de ativar o sync.
 */
export const dynamic = 'force-dynamic';

function podeUsar(role?: string) {
  return role === 'admin' || role === 'rh' || role === 'financeiro';
}

export async function GET(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeUsar(user.role)) return permissionErrorResponse('Apenas admin/RH');
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data: cred } = await (supabase as any)
    .from('api_credentials').select('*')
    .eq('bar_id', user.bar_id).eq('sistema', 'tangerino').eq('ativo', true).maybeSingle();
  if (!cred) return NextResponse.json({ ok: false, erro: 'Sem credencial Tangerino cadastrada para este bar.' }, { status: 404 });

  let resolved;
  try { resolved = await resolveTangerinoCredential(cred); }
  catch (e: any) { return NextResponse.json({ ok: false, erro: e?.message }, { status: 400 }); }

  try {
    const resp = await fetch(`${TANGERINO.employer}/test`, {
      headers: { Authorization: tangerinoAuthHeader(resolved.token) },
    });
    const txt = await resp.text();
    return NextResponse.json({ ok: resp.ok, http_status: resp.status, empresa: resolved.empresaNome, resposta: txt.slice(0, 300) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, erro: e?.message }, { status: 502 });
  }
}
