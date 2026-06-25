import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** GET /api/operacional/contagem/mes?ano=2026&mes=6 → matriz esparsa item×dia do mês */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const now = new Date();
  const ano = Number(sp.get('ano')) || now.getFullYear();
  const mes = Number(sp.get('mes')) || now.getMonth() + 1;

  const { data, error } = await (sb() as any).schema('operations')
    .rpc('contagem_mes', { p_bar_id: user.bar_id, p_ano: ano, p_mes: mes });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, ano, mes, linhas: data || [] });
}
