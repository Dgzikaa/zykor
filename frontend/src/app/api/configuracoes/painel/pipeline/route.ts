import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Saúde do pipeline de dados (gold.v_pipeline_health) para a Central de Operações.
 * Mostra cada job (edge function / cron) com status, última execução, idade e erro.
 * Admin only. É a mesma view que pegou o ETL do ContaHub falhando.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Apenas admin' }, { status: 403 });
  }

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any)
    .schema('gold')
    .from('v_pipeline_health')
    .select('camada, kind, job_name, bar_id, ultima_execucao, finished_at, duration_ms, status, records_affected, error_message, idade, health_color, descricao');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const rows = (data || []) as any[];
  const ordem: Record<string, number> = { red: 0, yellow: 1, green: 2 };
  rows.sort((a, b) => (ordem[a.health_color] ?? 9) - (ordem[b.health_color] ?? 9));

  const resumo = {
    total: rows.length,
    red: rows.filter(r => r.health_color === 'red').length,
    yellow: rows.filter(r => r.health_color === 'yellow').length,
    green: rows.filter(r => r.health_color === 'green').length,
  };
  return NextResponse.json({ success: true, jobs: rows, resumo });
}
