import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Pulso da sessão (auditoria de acessos). O cliente manda a cada ~1min se o usuário está
 * ATIVO (navegando de verdade) ou só com a aba aberta. O servidor lê o id da sessão do cookie
 * httpOnly zk_sid e atualiza last_seen (sempre) + tempo ativo (quando ativo). Best-effort.
 */
export async function POST(request: NextRequest) {
  const sid = request.cookies.get('zk_sid')?.value;
  if (!sid) return NextResponse.json({ ok: false, reason: 'sem sessão' });
  const body = await request.json().catch(() => ({}));
  const active = body?.active === true;
  const path = typeof body?.path === 'string' ? body.path.slice(0, 200) : null;
  try {
    const supabase = await getAdminClient();
    await (supabase as any).schema('system').rpc('session_heartbeat', { p_sid: sid, p_active: active, p_path: path });
  } catch { /* auditoria nunca quebra nada */ }
  return NextResponse.json({ ok: true });
}
