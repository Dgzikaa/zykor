import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const supabase = createServiceRoleClient();

function barDe(request: NextRequest, user: any): number | null {
  const h = request.headers.get('x-selected-bar-id');
  return parseInt(String(h || ''), 10) || Number(user?.bar_id) || null;
}

// GET ?data_inicio&data_fim — comandas de artista (com artista resolvido) + cadastro p/ o dropdown
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const barId = barDe(request, user);
  const sp = new URL(request.url).searchParams;
  const di = sp.get('data_inicio'); const df = sp.get('data_fim');
  if (!barId || !di || !df) return NextResponse.json({ success: false, error: 'bar_id, data_inicio e data_fim obrigatórios' }, { status: 400 });

  const [{ data: linhas, error }, { data: cadastro }] = await Promise.all([
    (supabase as any).schema('financial').rpc('fn_consumo_artistas_periodo', { p_bar: barId, p_ini: di, p_fim: df }),
    (supabase as any).schema('operations').from('bar_artistas').select('id, nome').eq('bar_id', barId).eq('ativo', true).order('nome'),
  ]);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, linhas: linhas || [], cadastro: cadastro || [] });
}

// POST { vd, artista_id } — grava/limpa o vínculo manual (artista_id null volta pro auto)
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  const barId = barDe(request, user);
  const body = await request.json().catch(() => ({}));
  const vd = Number(body.vd) || null;
  const artistaId = body.artista_id == null || body.artista_id === '' ? null : Number(body.artista_id);
  if (!barId || !vd) return NextResponse.json({ success: false, error: 'bar_id e vd obrigatórios' }, { status: 400 });

  const fin = (supabase as any).schema('financial');
  if (artistaId == null) {
    // limpar o override -> volta pro auto (nome/noite)
    const { error } = await fin.from('consumo_artista_override').delete().eq('bar_id', barId).eq('vd', vd);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, artista_id: null });
  }
  const { error } = await fin.from('consumo_artista_override')
    .upsert({ bar_id: barId, vd, artista_id: artistaId, updated_at: new Date().toISOString() }, { onConflict: 'bar_id,vd' });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, artista_id: artistaId });
}
