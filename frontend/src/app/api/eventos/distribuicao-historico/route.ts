import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

// GET — histórico de mudanças da Meta M1 (m1_r) dos eventos do mês, a partir do
// system.audit_trail (trigger trg_audit). Retorna de→para por dia + quem/quando.
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 });

  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });
  const url = new URL(request.url);
  const ano = parseInt(url.searchParams.get('ano') || '', 10);
  const mes = parseInt(url.searchParams.get('mes') || '', 10);
  if (!ano || !mes) return NextResponse.json({ success: false, error: 'ano/mes obrigatórios' }, { status: 400 });

  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const prox = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, '0')}-01`;

  // eventos do mês (id → data_evento)
  const { data: eventos, error: e1 } = await (supabase as any)
    .schema('operations').from('eventos_base')
    .select('id, data_evento').eq('bar_id', barId)
    .gte('data_evento', inicio).lt('data_evento', prox);
  if (e1) return NextResponse.json({ success: false, error: e1.message }, { status: 500 });
  const mapa = new Map<string, string>((eventos || []).map((e: any) => [String(e.id), e.data_evento]));
  const ids = [...mapa.keys()];
  if (!ids.length) return NextResponse.json({ success: true, historico: [] });

  const { data: audit, error: e2 } = await (supabase as any)
    .schema('system').from('audit_trail')
    .select('timestamp, user_email, record_id, old_values, new_values')
    .eq('table_name', 'operations.eventos_base')
    .eq('bar_id', barId)
    .in('record_id', ids)
    .order('timestamp', { ascending: false })
    .limit(500);
  if (e2) return NextResponse.json({ success: false, error: e2.message }, { status: 500 });

  const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  const historico = (audit || [])
    .map((a: any) => {
      const oldV = a.old_values?.m1_r;
      const newV = a.new_values?.m1_r;
      const de = oldV != null ? Number(oldV) : null;
      const para = newV != null ? Number(newV) : null;
      return { a, de, para };
    })
    .filter(({ de, para }: any) => (de ?? 0) !== (para ?? 0)) // só quando a Meta M1 mudou
    .map(({ a, de, para }: any) => {
      const data_evento = mapa.get(String(a.record_id)) || null;
      const dow = data_evento ? new Date(`${data_evento}T12:00:00Z`).getUTCDay() : null;
      return {
        data_evento,
        dia: dow != null ? DOW[dow] : null,
        de, para,
        user_email: a.user_email || null,
        timestamp: a.timestamp,
      };
    });

  return NextResponse.json({ success: true, historico });
}
