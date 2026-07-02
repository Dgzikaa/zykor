import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Config da antecipação de crédito Stone→CA, por bar (financial.stone_antecipacao_config).
 * GET  ?bar_id= → { config }. PUT { bar_id, antecipa, dias_landing:number[] } (admin).
 * Se o bar antecipa, o crédito cai no próximo "dia da lista" após a venda (dia útil).
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;
function admin() {
  return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin' && user.role !== 'financeiro') return permissionErrorResponse('Sem permissão');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || Number(user.bar_id);
  if (!barId) return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });

  const { data, error } = await (admin().schema('financial' as any) as any)
    .from('stone_antecipacao_config')
    .select('bar_id, antecipa, dias_landing, atualizado_em, atualizado_por')
    .eq('bar_id', barId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data || { bar_id: barId, antecipa: false, dias_landing: [1] } });
}

export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin') return permissionErrorResponse('Apenas admin pode alterar a antecipação');
  const body = await request.json().catch(() => ({} as any));
  const barId = Number(body.bar_id);
  if (!barId) return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });

  const antecipa = !!body.antecipa;
  // dias_landing: inteiros 1..31, únicos e ordenados; default {1}
  let dias: number[] = Array.isArray(body.dias_landing)
    ? body.dias_landing.map((d: any) => parseInt(d, 10))
    : [];
  dias = Array.from(new Set(dias.filter((d) => Number.isInteger(d) && d >= 1 && d <= 31))).sort((a, b) => a - b);
  if (dias.length === 0) dias = [1];

  const { error } = await (admin().schema('financial' as any) as any)
    .from('stone_antecipacao_config')
    .upsert({
      bar_id: barId,
      antecipa,
      dias_landing: dias,
      atualizado_em: new Date().toISOString(),
      atualizado_por: user.email ?? user.nome ?? null,
    }, { onConflict: 'bar_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, config: { bar_id: barId, antecipa, dias_landing: dias } });
}
