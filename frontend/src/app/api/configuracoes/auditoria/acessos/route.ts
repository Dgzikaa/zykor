import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/configuracoes/auditoria/acessos — sessões de usuário (tempo logado, ativo vs ocioso,
 * online agora, IP) + tentativas de login (sucesso/falha). Admin only.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin') return NextResponse.json({ success: false, error: 'Apenas admin' }, { status: 403 });

  const supabase = await getAdminClient();
  const [sesRes, attRes] = await Promise.all([
    (supabase as any).schema('system').from('user_sessions')
      .select('id, user_email, bar_id, ip, user_agent, login_at, last_seen_at, last_active_at, active_seconds, ended_at, end_reason')
      .order('login_at', { ascending: false }).limit(150),
    (supabase as any).schema('system').from('login_attempts')
      .select('id, at, email, ip, sucesso, motivo, user_agent')
      .order('at', { ascending: false }).limit(100),
  ]);
  if (sesRes.error) return NextResponse.json({ success: false, error: sesRes.error.message }, { status: 500 });

  const agora = Date.now();
  const sessoes = (sesRes.data || []).map((s: any) => {
    const fim = s.ended_at ? new Date(s.ended_at).getTime() : new Date(s.last_seen_at).getTime();
    const online = !s.ended_at && (agora - new Date(s.last_seen_at).getTime()) < 120_000; // visto nos últimos 2min
    return {
      ...s,
      online,
      duracao_seg: Math.max(0, Math.round((fim - new Date(s.login_at).getTime()) / 1000)),
      ativo_seg: Number(s.active_seconds || 0),
    };
  });
  const online_count = sessoes.filter((s: any) => s.online).length;

  return NextResponse.json({
    success: true,
    sessoes,
    tentativas: attRes.data || [],
    online_count,
  });
}
