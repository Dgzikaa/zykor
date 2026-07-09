import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const supabase = createServiceRoleClient();

function barDe(request: NextRequest, user: any): number | null {
  const h = request.headers.get('x-selected-bar-id');
  return parseInt(String(h || ''), 10) || Number(user?.bar_id) || null;
}

// normalização da mesa — DEVE bater com a do frontend/API GET
const normMesa = (m: string | null) => (m || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || '—';

/**
 * Vínculo de mesa (pessoa) da Consumação: liga uma mesa normalizada a um artista/sócio cadastrado
 * e/ou força a categoria (corrige classificação errada na origem). Também cria sócio no cadastro.
 *
 * POST { acao:'criar_socio', nome }                          -> cria sócio, retorna { id, nome }
 * POST { mesa, tipo, artista_id?, socio_id?, entidade_nome?, categoria_override? } -> upsert vínculo
 * DELETE { mesa }                                            -> remove o vínculo (volta pro motivo)
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request);
  if (nega) return nega;
  const barId = barDe(request, user);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const fin = (supabase as any).schema('financial');

  // criar sócio no cadastro
  if (body.acao === 'criar_socio') {
    const nome = String(body.nome || '').trim();
    if (!nome) return NextResponse.json({ success: false, error: 'nome obrigatório' }, { status: 400 });
    // já existe? (case-insensitive) retorna sem duplicar
    const { data: ex } = await fin.from('consumo_socio').select('id, nome').eq('bar_id', barId).ilike('nome', nome).maybeSingle();
    if (ex) return NextResponse.json({ success: true, socio: ex });
    const { data, error } = await fin.from('consumo_socio').insert({ bar_id: barId, nome, ativo: true }).select('id, nome').single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, socio: data });
  }

  // upsert do vínculo de mesa
  const mesa = body.mesa == null ? null : String(body.mesa);
  const mesaNorm = normMesa(mesa);
  if (mesaNorm === '—') return NextResponse.json({ success: false, error: 'mesa obrigatória' }, { status: 400 });
  const tipo = body.tipo ? String(body.tipo) : null;
  const row = {
    bar_id: barId,
    mesa_norm: mesaNorm,
    mesa_label: mesa,
    tipo,
    artista_id: body.artista_id == null || body.artista_id === '' ? null : Number(body.artista_id),
    socio_id: body.socio_id == null || body.socio_id === '' ? null : Number(body.socio_id),
    entidade_nome: body.entidade_nome ? String(body.entidade_nome) : null,
    categoria_override: body.categoria_override ? String(body.categoria_override) : null,
    updated_at: new Date().toISOString(),
    updated_by: user.email || user.nome || 'app',
  };
  const { error } = await fin.from('consumo_mesa_vinculo').upsert(row, { onConflict: 'bar_id,mesa_norm' });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, vinculo: row });
}

export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request);
  if (nega) return nega;
  const barId = barDe(request, user);
  const body = await request.json().catch(() => ({}));
  const mesaNorm = normMesa(body.mesa == null ? null : String(body.mesa));
  if (!barId || mesaNorm === '—') return NextResponse.json({ success: false, error: 'bar_id e mesa obrigatórios' }, { status: 400 });
  const { error } = await (supabase as any).schema('financial').from('consumo_mesa_vinculo').delete().eq('bar_id', barId).eq('mesa_norm', mesaNorm);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
