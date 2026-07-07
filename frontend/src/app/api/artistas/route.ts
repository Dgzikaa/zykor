import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

// GET — cadastro de artistas do bar (operations.bar_artistas), pro combobox do modal.
export async function GET(request: NextRequest) {
  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });
  const { data, error } = await (supabase as any)
    .schema('operations')
    .from('bar_artistas')
    .select('id, nome, tipo')
    .eq('bar_id', barId)
    .eq('ativo', true)
    .order('nome', { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, artistas: data || [] });
}

// POST — cria um artista no cadastro (idempotente por bar_id+nome).
export async function POST(request: NextRequest) {
  await authenticateUser(request);
  const barId = getBarId(request);
  const body = await request.json().catch(() => ({}));
  const nome = String(body.nome || '').trim();
  const tipo = ['banda', 'dj', 'solo'].includes(body.tipo) ? body.tipo : 'banda';
  if (!barId || !nome) return NextResponse.json({ success: false, error: 'bar_id e nome obrigatórios' }, { status: 400 });
  const ops = (supabase as any).schema('operations');
  const { data: ja } = await ops.from('bar_artistas').select('id, tipo').eq('bar_id', barId).eq('nome', nome).maybeSingle();
  if (ja) return NextResponse.json({ success: true, id: ja.id, tipo: ja.tipo, ja_existia: true });
  const { data, error } = await ops.from('bar_artistas').insert({ bar_id: barId, nome, tipo }).select('id, tipo').single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data.id, tipo: data.tipo });
}
