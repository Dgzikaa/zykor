import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { resolveTangerinoCredential, tangerinoAuthHeader, TANGERINO } from '@/lib/tangerino/resolveCredential';
import { podeRH } from '@/lib/auth/rh-guard';

/**
 * Valida a credencial Tangerino do bar chamando o GET /test deles ("Hello, [nome]").
 * GET (sessão admin/RH, bar do usuário) ou POST (service-role bearer + bar_id no body) — o POST
 * é p/ debug/tooling. Retorna o status + corpo cru.
 */
export const dynamic = 'force-dynamic';

async function rodar(barId: number) {
  const supabase = await getAdminClient();
  const { data: cred } = await (supabase as any)
    .from('api_credentials').select('*')
    .eq('bar_id', barId).eq('sistema', 'tangerino').eq('ativo', true).maybeSingle();
  if (!cred) return NextResponse.json({ ok: false, erro: 'Sem credencial Tangerino cadastrada para este bar.' }, { status: 404 });

  let resolved;
  try { resolved = await resolveTangerinoCredential(cred); }
  catch (e: any) { return NextResponse.json({ ok: false, erro: e?.message }, { status: 400 }); }

  const header = tangerinoAuthHeader(resolved.token);
  try {
    const resp = await fetch(`${TANGERINO.employer}/test`, { headers: { Authorization: header } });
    const txt = await resp.text();
    return NextResponse.json({
      ok: resp.ok, http_status: resp.status, empresa: resolved.empresaNome,
      token_len: resolved.token.length, header_prefix: header.slice(0, 12) + '…',
      resposta: txt.slice(0, 400),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, erro: e?.message }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeRH(user)) return permissionErrorResponse('Sem permissão de RH');
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });
  return rodar(user.bar_id);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const viaServiceRole = !!bearer && !!sr && bearer.length === sr.length &&
    timingSafeEqual(Buffer.from(bearer), Buffer.from(sr));
  if (!viaServiceRole) return NextResponse.json({ error: 'service-role apenas' }, { status: 401 });
  const barId = Number(body?.bar_id);
  if (!barId) return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });
  return rodar(barId);
}
