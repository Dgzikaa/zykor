import { NextRequest, NextResponse } from 'next/server';
import { gunzipSync } from 'zlib';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { resolveStoneCredential, stoneBasicAuthHeader } from '@/lib/stone/resolveCredential';

/**
 * POST /api/stone/conciliacao/sync  — PoC ingestão Stone (Cliente Stone).
 *
 * Baixa o arquivo de conciliação de UM dia (por StoneCode do bar), descompacta o
 * gzip e grava o XML cru em bronze.bronze_stone_conciliacao. Valida a auth Basic
 * (chave do Portal + senha vazia) + header x-user-type: client antes de eu montar
 * o pipeline completo (parse tipado + cron + silver/gold).
 *
 * bar_id vem SEMPRE do usuário autenticado (nunca do corpo). Exige admin/financeiro.
 * Body: { reference_date: "AAAAMMDD" | "YYYY-MM-DD", layout?: "XML2_2"|"XML2_4", stone_code?: string }
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function podeUsar(role?: string) {
  return role === 'admin' || role === 'financeiro';
}

export async function POST(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.ativo) return authErrorResponse('Usuário inativo', 403);
  if (!podeUsar(user.role))
    return permissionErrorResponse('Apenas admin ou financeiro podem sincronizar a Stone');

  const body = await req.json().catch(() => ({} as any));

  // Normaliza a data: aceita AAAAMMDD ou YYYY-MM-DD.
  const digits = String(body?.reference_date ?? '').replace(/\D/g, '');
  if (digits.length !== 8) {
    return NextResponse.json(
      { error: 'reference_date inválida — use AAAAMMDD ou YYYY-MM-DD.' },
      { status: 400 },
    );
  }
  const refYmd = digits;
  const refIso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  const layout = body?.layout === 'XML2_4' ? 'XML2_4' : 'XML2_2';

  const supabase = await getAdminClient();

  // Credencial Stone do bar (envelope-only).
  const { data: cred, error: credErr } = await (supabase as any)
    .from('api_credentials')
    .select('*')
    .eq('bar_id', user.bar_id)
    .eq('sistema', 'stone')
    .eq('ativo', true)
    .maybeSingle();

  if (credErr) return NextResponse.json({ error: credErr.message }, { status: 500 });
  if (!cred) {
    return NextResponse.json(
      {
        error:
          'Nenhuma credencial Stone cadastrada para este bar. ' +
          'Rode scripts/cadastrar-credencial-stone.mjs com a chave do Portal.',
      },
      { status: 404 },
    );
  }

  let resolved;
  try {
    resolved = await resolveStoneCredential(cred);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Falha ao resolver credencial Stone' }, { status: 500 });
  }

  const stoneCodes = body?.stone_code ? [String(body.stone_code).trim()] : resolved.stoneCodes;
  const authHeader = stoneBasicAuthHeader(resolved.apiKey);
  const resultados: any[] = [];

  for (const code of stoneCodes) {
    const url =
      `https://conciliation.stone.com.br/v2/merchant/${encodeURIComponent(code)}` +
      `/conciliation-file/${refYmd}?layout=${layout}`;
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          'x-user-type': 'client',
          'Accept-Encoding': 'gzip',
        },
      });

      const buf = Buffer.from(await resp.arrayBuffer());
      // Stone devolve gzip. O runtime pode já descomprimir via Content-Encoding;
      // se ainda vier com os magic bytes de gzip (1f 8b), descomprime manualmente.
      const isGzip = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
      const conteudo = isGzip ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
      const ok = resp.ok;

      await (supabase as any)
        .schema('bronze')
        .from('bronze_stone_conciliacao')
        .upsert(
          {
            bar_id: user.bar_id,
            stone_code: code,
            reference_date: refIso,
            layout,
            http_status: resp.status,
            bytes: buf.length,
            xml_raw: ok ? conteudo : null,
            erro: ok ? null : conteudo.slice(0, 1000) || `HTTP ${resp.status}`,
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'bar_id,stone_code,reference_date,layout' },
        );

      resultados.push({
        stone_code: code,
        ok,
        http_status: resp.status,
        bytes: buf.length,
        gzip: isGzip,
        // amostra p/ validar o formato no PoC
        snippet: conteudo.slice(0, 300),
      });
    } catch (e: any) {
      resultados.push({ stone_code: code, ok: false, erro: e?.message || 'Falha no fetch' });
    }
  }

  return NextResponse.json({
    success: resultados.some((r) => r.ok),
    bar_id: user.bar_id,
    reference_date: refIso,
    layout,
    resultados,
  });
}
