import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

// POST — mapeia um favorecido do Conta Azul a um artista do cadastro (persistente).
// body: { ca_pessoa_nome, artista_id }
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  const barId = getBarId(request);
  const body = await request.json().catch(() => ({}));
  const caPessoa = String(body.ca_pessoa_nome || '').trim();
  const artistaId = Number(body.artista_id) || null;
  if (!barId || !caPessoa || !artistaId) {
    return NextResponse.json({ success: false, error: 'bar_id, ca_pessoa_nome e artista_id obrigatórios' }, { status: 400 });
  }
  const ops = (supabase as any).schema('operations');
  // upsert por (bar, favorecido) case-insensitive: apaga o existente e regrava
  await ops.from('artista_ca_pessoa').delete().eq('bar_id', barId).ilike('ca_pessoa_nome', caPessoa);
  const { error } = await ops.from('artista_ca_pessoa').insert({ bar_id: barId, ca_pessoa_nome: caPessoa, artista_id: artistaId });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE ?ca_pessoa_nome= — remove o mapeamento
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  const barId = getBarId(request);
  const caPessoa = String(new URL(request.url).searchParams.get('ca_pessoa_nome') || '').trim();
  if (!barId || !caPessoa) {
    return NextResponse.json({ success: false, error: 'bar_id e ca_pessoa_nome obrigatórios' }, { status: 400 });
  }
  const ops = (supabase as any).schema('operations');
  const { error } = await ops.from('artista_ca_pessoa').delete().eq('bar_id', barId).ilike('ca_pessoa_nome', caPessoa);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
