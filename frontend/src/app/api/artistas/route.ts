import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser , permissionErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

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

// PATCH — atualiza campos do cadastro do artista (foto e presskit).
// Substitui a rota /api/artistas/foto: era um endpoint por campo, e o presskit viraria um
// segundo igualzinho. Aqui o bar_id do usuario entra no WHERE — sem isso, um id de artista
// de outro bar seria editavel por quem tem a rota.
export async function PATCH(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const neg_request = negarPorRota(user, request); if (neg_request) return neg_request;
  const barId = getBarId(request) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const id = Number(body?.artista_id || body?.id);
  if (!id) return NextResponse.json({ success: false, error: 'artista_id obrigatório' }, { status: 400 });

  // String vazia = limpar o campo (null). Campo ausente no body = nao mexe.
  const limpa = (v: unknown) => {
    const s = typeof v === 'string' ? v.trim().slice(0, 1000) : '';
    return s ? s : null;
  };
  const patch: Record<string, string | null> = {};
  if ('foto_url' in body) patch.foto_url = limpa(body.foto_url);
  if ('presskit_url' in body) patch.presskit_url = limpa(body.presskit_url);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: 'Nada para atualizar' }, { status: 400 });
  }

  const { data, error } = await (supabase as any).schema('operations').from('bar_artistas')
    .update(patch).eq('id', id).eq('bar_id', barId).select('id').maybeSingle();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ success: false, error: 'Artista não encontrado neste bar' }, { status: 404 });
  return NextResponse.json({ success: true });
}

// POST — cria um artista no cadastro (idempotente por bar_id+nome).
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const neg_request = negarPorRota(user, request); if (neg_request) return neg_request;
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
