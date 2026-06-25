import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const hoje = () => new Date().toISOString().slice(0, 10);

/** GET /api/operacional/contagem/itens?tipo=semanal&data=2026-06-22 → itens a contar (por frequência) */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const tipo = sp.get('tipo') || 'diaria';
  const data = sp.get('data') || hoje();
  if (!['diaria', 'semanal', 'mensal'].includes(tipo)) {
    return NextResponse.json({ success: false, error: 'tipo inválido' }, { status: 400 });
  }

  const { data: itens, error } = await (sb() as any).schema('operations')
    .rpc('contagem_itens', { p_bar_id: user.bar_id, p_tipo: tipo, p_data: data });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, tipo, data, itens: itens || [] });
}
