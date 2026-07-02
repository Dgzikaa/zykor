import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/configuracoes/auditoria — trilha de auditoria (system.audit_trail).
 * Admin only. Filtros: de, ate (timestamp), operation, table (ilike), q (email/descrição),
 * bar_id, limit, offset. Retorna logs + total + valores distintos p/ os selects de filtro.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Apenas admin pode ver a auditoria' }, { status: 403 });
  }

  const sp = new URL(request.url).searchParams;
  const de = sp.get('de');
  const ate = sp.get('ate');
  const operation = sp.get('operation');
  const table = sp.get('table');
  const q = (sp.get('q') || '').trim();
  const barId = sp.get('bar_id');
  const limit = Math.min(Number(sp.get('limit')) || 100, 500);
  const offset = Math.max(Number(sp.get('offset')) || 0, 0);

  const supabase = await getAdminClient();

  let query = (supabase as any)
    .schema('system').from('audit_trail')
    .select('id, timestamp, bar_id, operation, table_name, record_id, user_email, user_role, description, old_values, new_values, severity, category, endpoint, method', { count: 'exact' })
    .order('timestamp', { ascending: false });

  if (de) query = query.gte('timestamp', de);
  if (ate) query = query.lte('timestamp', `${ate}T23:59:59.999`);
  if (operation) query = query.eq('operation', operation);
  if (table) query = query.ilike('table_name', `%${table}%`);
  if (barId) query = query.eq('bar_id', Number(barId));
  if (q) query = query.or(`user_email.ilike.%${q}%,description.ilike.%${q}%,record_id.ilike.%${q}%`);

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // valores distintos p/ os selects (amostra dos 1000 mais recentes — barato e suficiente)
  const { data: amostra } = await (supabase as any)
    .schema('system').from('audit_trail')
    .select('operation, table_name').order('timestamp', { ascending: false }).limit(1000);
  const operacoes = Array.from(new Set((amostra || []).map((r: any) => r.operation).filter(Boolean))).sort();
  const tabelas = Array.from(new Set((amostra || []).map((r: any) => r.table_name).filter(Boolean))).sort();

  return NextResponse.json({ success: true, logs: data || [], total: count ?? (data?.length || 0), operacoes, tabelas, limit, offset });
}
