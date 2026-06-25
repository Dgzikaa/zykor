import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { resolveTangerinoCredential, tangerinoAuthHeader, TANGERINO } from '@/lib/tangerino/resolveCredential';

/**
 * POST /api/rh/tangerino/sync — puxa as marcações de ponto da Tangerino (paginado) pro
 * bronze e roda o ETL p/ hr.ponto_registro. Body: { de?: 'YYYY-MM-DD', ate?: 'YYYY-MM-DD',
 * bar_id? (service-role/cron) }. Sem datas: últimos 7 dias.
 *
 * PRONTO PRA API — pontos a confirmar quando o token estiver em mãos (marcados //CONFIRMAR):
 *  - formato exato de startDate/endDate do GET /api/punch (ISO vs ms);
 *  - nomes dos campos do Punch (dateIn/dateOut/status/employeeId) vs o que o /v2/api-docs traz;
 *  - paginação (tamanho de page) e se `lastUpdate` traz exclusões.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function podeUsar(role?: string) {
  return role === 'admin' || role === 'rh' || role === 'financeiro';
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
    if (!podeUsar(user.role)) return permissionErrorResponse('Apenas admin/RH');
    barId = user.bar_id ?? null;
  }
  if (!barId) return NextResponse.json({ error: 'bar_id ausente' }, { status: 400 });

  const hoje = body?.ate || new Date().toISOString().slice(0, 10);
  const de = body?.de || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const supabase = await getAdminClient();
  const { data: cred } = await (supabase as any)
    .from('api_credentials').select('*')
    .eq('bar_id', barId).eq('sistema', 'tangerino').eq('ativo', true).maybeSingle();
  if (!cred) return NextResponse.json({ error: 'Sem credencial Tangerino para este bar.' }, { status: 404 });

  let resolved;
  try { resolved = await resolveTangerinoCredential(cred); }
  catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 400 }); }

  const authHeader = tangerinoAuthHeader(resolved.token);
  // Datas da Tangerino são em MILISEGUNDOS (epoch). BRT -03:00.
  const deMs = new Date(`${de}T00:00:00-03:00`).getTime();
  const ateMs = new Date(`${hoje}T23:59:59-03:00`).getTime();
  let gravados = 0, pagina = 0, total = 0;
  const size = 200;
  try {
    // paginação do Page«Punch»
    for (;;) {
      const url = `${TANGERINO.punch}/?startDate=${deMs}&endDate=${ateMs}&page=${pagina}&size=${size}`;
      const resp = await fetch(url, { headers: { Authorization: authHeader } });
      if (!resp.ok) {
        return NextResponse.json({ error: `Tangerino HTTP ${resp.status}`, corpo: (await resp.text()).slice(0, 400), url, pagina }, { status: 502 });
      }
      const json: any = await resp.json();
      const itens: any[] = json?.content ?? (Array.isArray(json) ? json : []);
      if (itens.length === 0) break;
      const linhas = itens.map((p: any) => ({
        bar_id: barId, punch_id: Number(p.id), employee_id_ext: p.employeeId != null ? Number(p.employeeId) : null,
        payload: p, synced_at: new Date().toISOString(), parsed_em: null,
      }));
      await (supabase as any).schema('bronze').from('bronze_tangerino_punch')
        .upsert(linhas, { onConflict: 'bar_id,punch_id' });
      gravados += linhas.length; total = json?.totalElements ?? total;
      if (json?.last === true || itens.length < size) break;
      pagina += 1;
      if (pagina > 200) break; // backstop
    }

    // ETL bronze -> hr.ponto_registro (de-para por tangerino_employee_id)
    const { data: etl } = await (supabase as any).schema('hr').rpc('fn_tangerino_punch_to_ponto', { p_bar_id: barId });

    return NextResponse.json({ success: true, periodo: { de, ate: hoje }, marcacoes_gravadas: gravados, total_tangerino: total, etl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message, gravados }, { status: 502 });
  }
}
