import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { resolveTangerinoCredential, tangerinoAuthHeader, TANGERINO } from '@/lib/tangerino/resolveCredential';
import { podeRH } from '@/lib/auth/rh-guard';

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
    if (!podeRH(user)) return permissionErrorResponse('Sem permissão de RH');
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

  // DEBUG: testa formatos do GET /api/punch numa tacada só (não grava). { debug:true }
  if (body?.debug) {
    const combos: Array<{ nome: string; url: string }> = [
      { nome: 'ms-slash', url: `${TANGERINO.punch}/?startDate=${deMs}&endDate=${ateMs}&page=0&size=3` },
      { nome: 'ms-noslash', url: `${TANGERINO.punch}?startDate=${deMs}&endDate=${ateMs}&page=0&size=3` },
      { nome: 'iso-noslash', url: `${TANGERINO.punch}?startDate=${de}&endDate=${hoje}&page=0&size=3` },
      { nome: 'isodt-noslash', url: `${TANGERINO.punch}?startDate=${de}T00:00:00&endDate=${hoje}T23:59:59&page=0&size=3` },
      { nome: 'so-pagina', url: `${TANGERINO.punch}?page=0&size=3` },
      { nome: 'lastUpdate-ms', url: `${TANGERINO.punch}?lastUpdate=${deMs}&page=0&size=3` },
    ];
    const out: any[] = [];
    for (const c of combos) {
      try {
        const r = await fetch(c.url, { headers: { Authorization: authHeader } });
        const t = await r.text();
        out.push({ nome: c.nome, status: r.status, ct: r.headers.get('content-type'), body: t.slice(0, 220) });
      } catch (e: any) { out.push({ nome: c.nome, erro: e?.message }); }
    }
    return NextResponse.json({ debug: true, de, ate: hoje, deMs, ateMs, tentativas: out });
  }

  // PROBE: inspeciona os cadastros do Sólides (colaborador/cargo/setor) — { employees:true }
  if (body?.employees) {
    const urls = [
      { nome: 'employee-find-all', url: `${TANGERINO.employer}/employee/find-all?page=0&size=2` },
      { nome: 'job-role-find-all', url: `${TANGERINO.employer}/job-role/find-all?page=0&size=8` },
      { nome: 'workplace-find-all', url: `${TANGERINO.employer}/workplace/find-all?page=0&size=8` },
    ];
    const out: any[] = [];
    for (const u of urls) {
      try {
        const r = await fetch(u.url, { headers: { Authorization: authHeader } });
        const t = await r.text();
        out.push({ nome: u.nome, status: r.status, body: t.slice(0, 700) });
      } catch (e: any) { out.push({ nome: u.nome, erro: e?.message }); }
    }
    return NextResponse.json({ employees: true, tentativas: out });
  }

  // SYNC dos cadastros (cargo/setor/colaborador/escala) -> bronze. { cadastros:true }
  if (body?.cadastros) {
    const pullAll = async (path: string): Promise<{ items: any[]; error?: number }> => {
      const items: any[] = [];
      for (let page = 0; page < 60; page++) {
        const sep = path.includes('?') ? '&' : '?';
        const r = await fetch(`${TANGERINO.employer}${path}${sep}page=${page}&size=200`, { headers: { Authorization: authHeader } });
        if (!r.ok) return { items, error: r.status };
        const j: any = await r.json();
        const c: any[] = j?.content ?? (Array.isArray(j) ? j : []);
        items.push(...c);
        if (j?.last === true || c.length < 200) break;
      }
      return { items };
    };
    const up = async (tabela: string, conflict: string, rows: any[]) => {
      if (rows.length) await (supabase as any).schema('bronze').from(tabela).upsert(rows, { onConflict: conflict });
    };
    const jr = await pullAll('/job-role/find-all');
    await up('bronze_tangerino_job_role', 'bar_id,job_role_id_ext', jr.items.map((x: any) => ({ bar_id: barId, job_role_id_ext: x.id, payload: x })));
    const wp = await pullAll('/workplace/find-all');
    await up('bronze_tangerino_workplace', 'bar_id,workplace_id_ext', wp.items.map((x: any) => ({ bar_id: barId, workplace_id_ext: x.id, payload: x })));
    const emp = await pullAll('/employee/find-all');
    await up('bronze_tangerino_employee', 'bar_id,employee_id_ext', emp.items.map((x: any) => ({ bar_id: barId, employee_id_ext: x.id, payload: x })));
    const ws = await pullAll('/work-schedule');
    await up('bronze_tangerino_work_schedule', 'bar_id,schedule_id_ext', ws.items.map((x: any) => ({ bar_id: barId, schedule_id_ext: x.id, payload: x })));
    return NextResponse.json({ cadastros: true,
      job_roles: jr.items.length, workplaces: wp.items.length, employees: emp.items.length, work_schedules: ws.items.length,
      erros: { jr: jr.error, wp: wp.error, emp: emp.error, ws: ws.error } });
  }

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
        bar_id: barId, punch_id: Number(p.id),
        employee_id_ext: p.employee?.id ?? (p.employeeId != null ? Number(p.employeeId) : null),
        payload: p, synced_at: new Date().toISOString(), parsed_em: null,
      }));
      await (supabase as any).schema('bronze').from('bronze_tangerino_punch')
        .upsert(linhas, { onConflict: 'bar_id,punch_id' });
      gravados += linhas.length; total = json?.totalElements ?? total;
      if (json?.last === true || itens.length < size) break;
      pagina += 1;
      if (pagina > 200) break; // backstop
    }

    // ETL bronze -> hr.ponto_registro (liga por employee.id -> funcionario; bar = bar-casa; agrega por dia operacional)
    const { data: etl } = await (supabase as any).schema('hr').rpc('fn_tangerino_punch_to_ponto');

    return NextResponse.json({ success: true, periodo: { de, ate: hoje }, marcacoes_gravadas: gravados, total_tangerino: total, etl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message, gravados }, { status: 502 });
  }
}
