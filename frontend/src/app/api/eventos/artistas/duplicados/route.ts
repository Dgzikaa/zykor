import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, selectAll } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

// GET — pares de artistas parecidos (candidatos a duplicata) do bar
export async function GET(request: NextRequest) {
  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const ops = (supabase as any).schema('operations');
  const { data, error } = await ops.rpc('fn_artistas_duplicados', { p_bar_id: barId });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  // lista completa de artistas ativos (p/ a tela agrupar manualmente qualquer par)
  const { data: artistasRaw } = await ops
    .from('bar_artistas')
    .select('id, nome, tipo')
    .eq('bar_id', barId)
    .eq('ativo', true)
    .order('nome', { ascending: true });
  // nº de shows por artista (paginado — PostgREST corta em 1000)
  const tags = await selectAll((from, to) => ops
    .from('evento_artistas').select('artista_id').eq('bar_id', barId).range(from, to)).catch(() => []);
  const uso = new Map<number, number>();
  for (const t of tags as any[]) uso.set(t.artista_id, (uso.get(t.artista_id) || 0) + 1);
  const artistas = (artistasRaw || []).map((a: any) => ({ ...a, uso: uso.get(a.id) || 0 }));
  return NextResponse.json({ success: true, pares: data || [], artistas });
}

// POST — { action: 'merge', from_id, into_id } mescla; { action: 'ignorar', id_a, id_b } dispensa o par
export async function POST(request: NextRequest) {
  const barId = getBarId(request);
  const body = await request.json().catch(() => ({}));
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const ops = (supabase as any).schema('operations');

  if (body.action === 'merge') {
    const fromId = Number(body.from_id) || null;
    const intoId = Number(body.into_id) || null;
    if (!fromId || !intoId || fromId === intoId) {
      return NextResponse.json({ success: false, error: 'from_id e into_id válidos e diferentes' }, { status: 400 });
    }
    const { error } = await ops.rpc('fn_merge_artista', { p_bar_id: barId, p_from: fromId, p_into: intoId });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.action === 'ignorar') {
    // guarda sempre com o menor id em id_a (mesma convenção do fn_artistas_duplicados)
    const a = Math.min(Number(body.id_a), Number(body.id_b));
    const b = Math.max(Number(body.id_a), Number(body.id_b));
    if (!a || !b || a === b) return NextResponse.json({ success: false, error: 'ids inválidos' }, { status: 400 });
    const { error } = await ops.from('artista_dup_ignorar').upsert({ bar_id: barId, id_a: a, id_b: b });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: 'action inválida' }, { status: 400 });
}
