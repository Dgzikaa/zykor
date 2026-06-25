import { NextRequest, NextResponse } from 'next/server';
import { gunzipSync } from 'zlib';

/**
 * Receptor do webhook de conciliação PIX da Stone.
 *
 * A Stone chama esta URL (cadastrada via /v2/webhook):
 *  - No cadastro: { "type": "validation_notification" } → tem que responder 200 em até 3s.
 *  - Arquivo pronto: { "type":"pix", "url":"<url assinada>", "document", "referenceDate" }
 *    → baixa o CSV da URL pré-assinada e grava em bronze.bronze_stone_pix. Responder 200 em 5s.
 *
 * Segurança (não passa pelo nosso auth — quem chama é a Stone):
 *  - header x-zykor-stone-token tem que bater com financial.stone_pix_webhook.token
 *    (registramos esse header no cadastro do webhook);
 *  - só baixa de domínios da Stone/AWS.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({ ok: true });
}

// A Stone pode fazer pré-check de reachability com HEAD/OPTIONS antes de cadastrar.
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch { /* corpo vazio/!json */ }

  // Validação de cadastro — responder 200 rápido, sem exigir token (vem antes do registro concluir).
  if (body?.type === 'validation_notification') {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const { getAdminClient } = await import('@/lib/supabase-admin');
  const supabase = await getAdminClient();

  if (body?.type !== 'pix' || !body?.url || !body?.document || !body?.referenceDate) {
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  }

  // Segurança: a Stone NÃO aceita header custom no cadastro do webhook (o /v2/webhook
  // dá 400 quando mandamos `headers`), então registramos só com a URL. Validamos por:
  //  (1) o `document` tem que ser um CNPJ NOSSO (financial.stone_cnpj_map); e
  //  (2) a URL pré-assinada só pode ser de domínio Stone/AWS.
  let host = '';
  try { host = new URL(String(body.url)).host; } catch { /* url inválida */ }
  if (!/(\.stone\.com\.br|amazonaws\.com|cloudfront\.net)$/i.test(host)) {
    return NextResponse.json({ error: 'url não permitida', host }, { status: 400 });
  }

  const doc = String(body.document).replace(/\D/g, '');
  const { data: maps } = await (supabase as any)
    .schema('financial').from('stone_cnpj_map').select('bar_id, cnpj_documento');
  const m = (maps || []).find((x: any) => String(x.cnpj_documento).replace(/\D/g, '') === doc);
  if (!m) {
    return NextResponse.json({ error: 'cnpj desconhecido' }, { status: 401 });
  }
  const barId = m.bar_id;

  let csv = '', bytes = 0, status = 0, erro: string | null = null;
  try {
    const resp = await fetch(String(body.url), { headers: { 'Accept-Encoding': 'gzip' } });
    status = resp.status;
    const buf = Buffer.from(await resp.arrayBuffer());
    const isGzip = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
    csv = isGzip ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
    bytes = buf.length;
    if (!resp.ok) erro = csv.slice(0, 500) || `HTTP ${status}`;
  } catch (e: any) {
    erro = e?.message || 'falha no download';
  }

  if (barId) {
    await (supabase as any).schema('bronze').from('bronze_stone_pix').upsert({
      bar_id: barId, document: doc, reference_date: String(body.referenceDate),
      csv_raw: erro ? null : csv, bytes, http_status: status, signed_url: String(body.url),
      recebido_em: new Date().toISOString(), parsed_em: null, erro,
    }, { onConflict: 'bar_id,document,reference_date' });
  }

  return NextResponse.json({ ok: true, bar_id: barId, bytes, erro }, { status: 200 });
}
