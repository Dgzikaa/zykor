import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { podeAprovar } from '@/lib/financeiro/pedidos-pagamento';

export const dynamic = 'force-dynamic';

/**
 * POST /api/financeiro/beneficiarios/unificar — funde grupos canônicos numa pessoa só.
 * Body: { keys: string[], nome?: string }. Mapeia todos os pessoa_id do CA -> 1 beneficiário
 * (de-para) e refaz o gold. Reversível (é só o de-para; não toca o Conta Azul).
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });
  if (!podeAprovar(user)) return authErrorResponse('Sem permissão para unificar beneficiários', 403);

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 }); }
  const keys: string[] = Array.isArray(body.keys) ? body.keys.filter(Boolean) : [];
  if (keys.length < 2) return NextResponse.json({ success: false, error: 'informe ao menos 2 grupos' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).schema('financial').rpc('unificar_beneficiarios', {
    p_bar_id: user.bar_id, p_keys: keys, p_nome: body.nome || null,
  });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, beneficiario_id: data });
}
