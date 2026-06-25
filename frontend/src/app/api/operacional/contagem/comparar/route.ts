import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** GET /api/operacional/contagem/comparar?data_a=2026-06-15&data_b=2026-06-22 → comparativo item a item */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const data_a = sp.get('data_a');
  const data_b = sp.get('data_b');
  if (!data_a || !data_b) return NextResponse.json({ success: false, error: 'data_a e data_b obrigatórios' }, { status: 400 });

  const { data, error } = await (sb() as any).schema('operations')
    .rpc('contagem_comparar', { p_bar_id: user.bar_id, p_data_a: data_a, p_data_b: data_b });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const itens = data || [];
  const resumo = itens.reduce((s: any, r: any) => {
    s.valor_a += Number(r.valor_a) || 0;
    s.valor_b += Number(r.valor_b) || 0;
    return s;
  }, { valor_a: 0, valor_b: 0 });
  resumo.delta_valor = Math.round((resumo.valor_b - resumo.valor_a) * 100) / 100;
  resumo.valor_a = Math.round(resumo.valor_a * 100) / 100;
  resumo.valor_b = Math.round(resumo.valor_b * 100) / 100;

  return NextResponse.json({ success: true, data_a, data_b, itens, resumo });
}
