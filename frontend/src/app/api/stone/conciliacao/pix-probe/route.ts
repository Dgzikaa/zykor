import { NextRequest, NextResponse } from 'next/server';
import { gunzipSync } from 'zlib';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { resolveStoneCredential, stoneBasicAuthHeader } from '@/lib/stone/resolveCredential';
import { timingSafeEqual } from 'crypto';

/**
 * SONDA (diagnóstico) do arquivo de conciliação de PIX da Stone.
 *
 * O PIX não vem no arquivo de cartão — tem endpoint próprio, ASSÍNCRONO:
 *   POST https://conciliation.stone.com.br/v2/merchant/{CNPJ}/conciliation-file/pix/{AAAA-MM-DD}
 * que devolve 202 e o arquivo (CSV) fica pronto depois. Esta rota só faz a chamada
 * (POST p/ solicitar, ou GET p/ tentar baixar) e devolve a resposta CRUA — status,
 * headers e um trecho do corpo — pra eu entender o fluxo antes de montar o pipeline.
 *
 * Não grava nada. Body: { reference_date, method?: "POST"|"GET", bar_id? (service-role) }.
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
  const httpMethod = body?.method === 'GET' ? 'GET' : 'POST';

  const { getAdminClient } = await import('@/lib/supabase-admin');
  const supabase = await getAdminClient();
  const { data: creds, error: credErr } = await (supabase as any)
    .from('api_credentials').select('*')
    .eq('bar_id', barId).eq('sistema', 'stone').eq('ativo', true);
  if (credErr) return NextResponse.json({ error: credErr.message }, { status: 500 });

  const filtroDoc = body?.cnpj ? String(body.cnpj).replace(/\D/g, '') : null;
  const resultados: any[] = [];

  for (const cred of creds || []) {
    let resolved;
    try {
      resolved = await resolveStoneCredential(cred);
    } catch (e: any) {
      resultados.push({ empresa: cred?.empresa_nome ?? null, ok: false, erro: e?.message });
      continue;
    }
    const doc = String(resolved.cnpj || '').replace(/\D/g, '');
    if (!doc) { resultados.push({ empresa: resolved.empresaNome, ok: false, erro: 'credencial sem CNPJ' }); continue; }
    if (filtroDoc && doc !== filtroDoc) continue;

    const authHeader = stoneBasicAuthHeader(resolved.apiKey);
    const url = `https://conciliation.stone.com.br/v2/merchant/${doc}/conciliation-file/pix/${refIso}`;
    try {
      const resp = await fetch(url, {
        method: httpMethod,
        headers: {
          Authorization: authHeader,
          'x-user-type': 'client',
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip',
        },
      });
      const buf = Buffer.from(await resp.arrayBuffer());
      const isGzip = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
      const conteudo = isGzip ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
      const headersObj: Record<string, string> = {};
      resp.headers.forEach((v, k) => { headersObj[k] = v; });
      resultados.push({
        empresa: resolved.empresaNome, doc, method: httpMethod, url,
        http_status: resp.status, bytes: buf.length, gzip: isGzip,
        headers: headersObj, snippet: conteudo.slice(0, 1200),
      });
    } catch (e: any) {
      resultados.push({ empresa: resolved.empresaNome, doc, method: httpMethod, ok: false, erro: e?.message });
    }
  }

  return NextResponse.json({ success: true, bar_id: barId, reference_date: refIso, resultados });
}
