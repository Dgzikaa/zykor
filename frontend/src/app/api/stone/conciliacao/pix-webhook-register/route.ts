import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { resolveStoneCredential, stoneBasicAuthHeader } from '@/lib/stone/resolveCredential';
import { timingSafeEqual } from 'crypto';

/**
 * Cadastra o webhook de PIX na Stone (POST /v2/webhook), UMA vez por credencial/CNPJ.
 * Registra nossa URL receptora + o header de segurança (x-zykor-stone-token). A Stone
 * dispara um validation_notification na hora — por isso o receptor precisa estar no ar.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function podeUsar(role?: string) {
  return role === 'admin' || role === 'financeiro';
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));

  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const viaServiceRole = !!bearer && !!sr && bearer.length === sr.length &&
    timingSafeEqual(Buffer.from(bearer), Buffer.from(sr));

  let barId: number | null = null;
  if (viaServiceRole) {
    barId = body?.bar_id != null ? Number(body.bar_id) : null;
  } else {
    const user = await authenticateUser(req);
    if (!user) return authErrorResponse('Usuário não autenticado');
    if (!podeUsar(user.role)) return permissionErrorResponse('Apenas admin ou financeiro');
    barId = user.bar_id ?? null;
  }
  if (!barId) return NextResponse.json({ error: 'bar_id ausente' }, { status: 400 });

  const { getAdminClient } = await import('@/lib/supabase-admin');
  const supabase = await getAdminClient();

  const { data: cfg } = await (supabase as any)
    .schema('financial').from('stone_pix_webhook').select('token, callback_url').eq('id', 1).maybeSingle();
  if (!cfg?.token || !cfg?.callback_url) {
    return NextResponse.json({ error: 'config do webhook ausente (financial.stone_pix_webhook)' }, { status: 500 });
  }

  const { data: creds } = await (supabase as any)
    .from('api_credentials').select('*').eq('bar_id', barId).eq('sistema', 'stone').eq('ativo', true);

  const resultados: any[] = [];
  for (const cred of creds || []) {
    let resolved;
    try { resolved = await resolveStoneCredential(cred); }
    catch (e: any) { resultados.push({ empresa: cred?.empresa_nome, ok: false, erro: e?.message }); continue; }

    const authHeader = stoneBasicAuthHeader(resolved.apiKey);
    try {
      const resp = await fetch('https://conciliation.stone.com.br/v2/webhook', {
        method: 'POST',
        headers: { Authorization: authHeader, 'x-user-type': 'client', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: cfg.callback_url,
          headers: JSON.stringify({ 'x-zykor-stone-token': cfg.token }),
        }),
      });
      const txt = await resp.text();
      resultados.push({ empresa: resolved.empresaNome, ok: resp.ok, http_status: resp.status, resp: txt.slice(0, 600) });
    } catch (e: any) {
      resultados.push({ empresa: resolved.empresaNome, ok: false, erro: e?.message });
    }
  }

  await (supabase as any).schema('financial').from('stone_pix_webhook')
    .update({ registrado_em: new Date().toISOString() }).eq('id', 1);

  return NextResponse.json({ success: resultados.some((r) => r.ok), callback_url: cfg.callback_url, resultados });
}
