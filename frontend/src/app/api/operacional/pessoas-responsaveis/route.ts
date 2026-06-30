import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Responsáveis de produção. Vivem em auth_custom.pessoas_responsaveis (curada por bar).
 * Usado pela tela de Produções (execução/cronômetro) para registrar quem produziu.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any)
    .schema('auth_custom')
    .from('pessoas_responsaveis')
    .select('id, nome, cargo, ativo')
    .eq('bar_id', barId)
    .eq('ativo', true)
    .order('nome', { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: data || [] });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  // Gestão da equipe é restrita a admin — quem executa produção só lê/seleciona (GET).
  if (user.role !== 'admin') return permissionErrorResponse('Apenas administradores podem gerir responsáveis');
  const body = await request.json().catch(() => ({}));
  const barId = Number(body.bar_id) || user.bar_id;
  const nome = String(body.nome || '').trim();
  if (!barId || !nome) return NextResponse.json({ success: false, error: 'bar_id e nome obrigatórios' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any)
    .schema('auth_custom')
    .from('pessoas_responsaveis')
    .insert({ bar_id: barId, nome, cargo: body.cargo ? String(body.cargo).trim() : null, ativo: true })
    .select('id, nome, cargo, ativo')
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin') return permissionErrorResponse('Apenas administradores podem gerir responsáveis');
  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const patch: any = { updated_at: new Date().toISOString() };
  if ('nome' in body) patch.nome = body.nome;
  if ('cargo' in body) patch.cargo = body.cargo;
  if ('ativo' in body) patch.ativo = body.ativo;
  const { data, error } = await (supabase as any)
    .schema('auth_custom')
    .from('pessoas_responsaveis')
    .update(patch)
    .eq('id', id)
    .select('id, nome, cargo, ativo')
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin') return permissionErrorResponse('Apenas administradores podem gerir responsáveis');
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();
  // soft delete
  const { error } = await (supabase as any)
    .schema('auth_custom')
    .from('pessoas_responsaveis')
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
