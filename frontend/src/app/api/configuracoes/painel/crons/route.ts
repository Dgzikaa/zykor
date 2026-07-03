import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/** Status dos pg_cron jobs (última execução de cada) — Central de Operações. Admin only. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin') return NextResponse.json({ success: false, error: 'Apenas admin' }, { status: 403 });

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).schema('system').rpc('cron_status');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const jobs = (data || []) as any[];
  const resumo = {
    total: jobs.length,
    problema: jobs.filter(j => j.status && j.status !== 'succeeded').length,
    inativos: jobs.filter(j => j.ativo === false).length,
  };
  return NextResponse.json({ success: true, jobs, resumo });
}
