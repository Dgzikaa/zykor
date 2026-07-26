import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse , permissionErrorResponse } from '@/middleware/auth';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

/** POST { artista_id, foto_url } — grava a foto do artista no cadastro (operations.bar_artistas). */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const neg_request = negarPorRota(user, request); if (neg_request) return neg_request;
  try {
    const { artista_id, foto_url } = await request.json();
    if (!artista_id) return NextResponse.json({ success: false, error: 'artista_id obrigatório' }, { status: 400 });
    const url = typeof foto_url === 'string' && foto_url.trim() ? foto_url.trim().slice(0, 1000) : null;
    const { error } = await (supabase as any).schema('operations').from('bar_artistas')
      .update({ foto_url: url }).eq('id', Number(artista_id));
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erro' }, { status: 500 });
  }
}
