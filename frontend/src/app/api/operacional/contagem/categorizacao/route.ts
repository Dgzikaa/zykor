import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const FREQ = ['diaria', 'semanal', 'mensal'];
const LOCAL = ['bar', 'cozinha'];
const TIPO = ['insumo', 'producao_cozinha', 'producao_drink'];

/**
 * GET  /api/operacional/contagem/categorizacao  → catálogo do bar (item + frequência + tipo + preço atual)
 * PATCH { id, frequencia?, tipo_local?, tipo_item? } → atualiza a categorização de 1 item
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { data, error } = await (sb() as any).schema('operations').rpc('contagem_catalogo', { p_bar_id: user.bar_id });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, itens: data || [] });
}

export async function PATCH(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 }); }
  const id = Number(body.id);
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });

  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (body.frequencia !== undefined) {
    if (!FREQ.includes(body.frequencia)) return NextResponse.json({ success: false, error: 'frequencia inválida' }, { status: 400 });
    patch.frequencia = body.frequencia;
  }
  if (body.tipo_local !== undefined) {
    if (!LOCAL.includes(body.tipo_local)) return NextResponse.json({ success: false, error: 'tipo_local inválido' }, { status: 400 });
    patch.tipo_local = body.tipo_local;
  }
  if (body.tipo_item !== undefined) {
    if (!TIPO.includes(body.tipo_item)) return NextResponse.json({ success: false, error: 'tipo_item inválido' }, { status: 400 });
    patch.tipo_item = body.tipo_item;
  }
  if (Object.keys(patch).length === 1) return NextResponse.json({ success: false, error: 'nada para atualizar' }, { status: 400 });

  const { error } = await (sb() as any).schema('operations').from('insumos')
    .update(patch).eq('id', id).eq('bar_id', user.bar_id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
