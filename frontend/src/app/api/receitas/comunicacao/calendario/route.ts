import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { CATEGORIA_KEYS } from '@/lib/comunicacao/calendario';

export const dynamic = 'force-dynamic';
const sb = () => createServiceRoleClient();
const COLS = 'id, bar_id, data, titulo, formato, categoria, observacao, ordem, criado_por, criado_em';

/** GET ?bar_id=&mes=YYYY-MM → posts do mês (para o calendário). */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const mes = String(sp.get('mes') || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(mes)) return NextResponse.json({ success: false, error: 'mes (YYYY-MM) obrigatório' }, { status: 400 });

  const [ano, m] = mes.split('-').map(Number);
  const ini = `${mes}-01`;
  const fim = new Date(Date.UTC(ano, m, 0)).toISOString().slice(0, 10); // último dia do mês

  const { data, error } = await sb().from('marketing_calendario_posts')
    .select(COLS).eq('bar_id', barId).gte('data', ini).lte('data', fim)
    .order('data', { ascending: true }).order('ordem', { ascending: true }).order('id', { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, posts: data || [] });
}

/** POST — cria um post no dia. body { data, titulo, formato?, categoria?, observacao?, bar_id? } */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const b = await request.json().catch(() => ({}));
  const barId = Number(b.bar_id) || user.bar_id;
  const data = String(b.data || '').slice(0, 10);
  const titulo = String(b.titulo || '').trim();
  const categoria = CATEGORIA_KEYS.includes(b.categoria) ? b.categoria : 'programacao';
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return NextResponse.json({ success: false, error: 'data (YYYY-MM-DD) obrigatória' }, { status: 400 });
  if (titulo.length < 1) return NextResponse.json({ success: false, error: 'título obrigatório' }, { status: 400 });

  const { data: row, error } = await sb().from('marketing_calendario_posts').insert({
    bar_id: barId, data, titulo,
    formato: b.formato ? String(b.formato).trim() : null,
    categoria,
    observacao: b.observacao ? String(b.observacao).trim() : null,
    ordem: Number.isFinite(Number(b.ordem)) ? Number(b.ordem) : 0,
    criado_por: user.email || user.nome || null,
  }).select(COLS).single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, post: row });
}

/** PATCH ?id= — edita um post. */
export async function PATCH(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
  const b = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if ('titulo' in b) patch.titulo = String(b.titulo || '').trim();
  if ('formato' in b) patch.formato = b.formato ? String(b.formato).trim() : null;
  if ('categoria' in b && CATEGORIA_KEYS.includes(b.categoria)) patch.categoria = b.categoria;
  if ('observacao' in b) patch.observacao = b.observacao ? String(b.observacao).trim() : null;
  if ('data' in b && /^\d{4}-\d{2}-\d{2}$/.test(String(b.data))) patch.data = String(b.data).slice(0, 10);
  if ('ordem' in b && Number.isFinite(Number(b.ordem))) patch.ordem = Number(b.ordem);

  const { error } = await sb().from('marketing_calendario_posts').update(patch)
    .eq('id', id).eq('bar_id', user.bar_id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** DELETE ?id= — remove um post. */
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
  const { error } = await sb().from('marketing_calendario_posts').delete()
    .eq('id', id).eq('bar_id', user.bar_id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
