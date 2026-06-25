import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { resolveStoneCredential, stoneBasicAuthHeader } from '@/lib/stone/resolveCredential';
import { timingSafeEqual } from 'crypto';

/**
 * Solicita o arquivo de conciliação PIX de UM dia, por CNPJ (POST → 202 async).
 * A Stone processa e entrega o CSV depois no webhook (ver pix-webhook). Só pode pedir
 * depois das 03:00 do dia seguinte. Marca solicitado_em no bronze.
 * Body: { reference_date: "AAAAMMDD"|"YYYY-MM-DD", bar_id? (service-role) }.
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

  const digits = String(body?.reference_date ?? '').replace(/\D/g, '');
  if (digits.length !== 8) return NextResponse.json({ error: 'reference_date inválida — use AAAAMMDD ou YYYY-MM-DD' }, { status: 400 });
  const refIso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;

  const { getAdminClient } = await import('@/lib/supabase-admin');
  const supabase = await getAdminClient();

  const { data: maps } = await (supabase as any)
    .schema('financial').from('stone_cnpj_map').select('stone_code, cnpj_documento').eq('bar_id', barId);
  const docByCode: Record<string, string> = {};
  for (const m of maps || []) docByCode[String(m.stone_code)] = String(m.cnpj_documento || '').replace(/\D/g, '');

  const { data: creds } = await (supabase as any)
    .from('api_credentials').select('*').eq('bar_id', barId).eq('sistema', 'stone').eq('ativo', true);

  const resultados: any[] = [];
  for (const cred of creds || []) {
    let resolved;
    try { resolved = await resolveStoneCredential(cred); }
    catch (e: any) { resultados.push({ empresa: cred?.empresa_nome, ok: false, erro: e?.message }); continue; }

    const doc = (resolved.stoneCodes.map((c) => docByCode[c]).find(Boolean) || String(resolved.cnpj || '').replace(/\D/g, ''));
    if (!doc) { resultados.push({ empresa: resolved.empresaNome, ok: false, erro: 'sem CNPJ no stone_cnpj_map' }); continue; }

    const authHeader = stoneBasicAuthHeader(resolved.apiKey);
    const url = `https://conciliation.stone.com.br/v2/merchant/${doc}/conciliation-file/pix/${refIso}`;
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { Authorization: authHeader, 'x-user-type': 'client', 'Content-Type': 'application/json' },
      });
      const txt = await resp.text();
      const ok = resp.ok || resp.status === 202;
      resultados.push({ empresa: resolved.empresaNome, doc, ok, http_status: resp.status, resp: txt.slice(0, 300) });
      await (supabase as any).schema('bronze').from('bronze_stone_pix').upsert(
        { bar_id: barId, document: doc, reference_date: refIso, solicitado_em: new Date().toISOString() },
        { onConflict: 'bar_id,document,reference_date' },
      );
    } catch (e: any) {
      resultados.push({ empresa: resolved.empresaNome, doc, ok: false, erro: e?.message });
    }
  }

  return NextResponse.json({ success: resultados.some((r) => r.ok), reference_date: refIso, resultados });
}
