import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * CRUD de perfis de acesso (RBAC — Fase 2).
 *
 * Perfil = conjunto de módulos aplicado em bloco a usuários. Mudança no perfil
 * propaga automaticamente pra todos os vinculados (public.usuarios.perfil_id).
 * Perfil `sistema=true` (Admin) não pode ser editado nem deletado.
 *
 * Só admin pode chamar.
 */

async function requerAdmin(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return { erro: authErrorResponse('Não autenticado') };
  if ((user.role as string) !== 'admin') {
    return { erro: NextResponse.json({ success: false, error: 'Só admin gerencia perfis' }, { status: 403 }) };
  }
  return { user, supabase: await getAdminClient() };
}

export async function GET(req: NextRequest) {
  const c = await requerAdmin(req); if ('erro' in c) return c.erro;
  const { supabase } = c;

  // Lista perfis + contagem de usuários vinculados (pra UI mostrar "3 usuários" no card).
  const [{ data: perfis, error }, { data: contagens }] = await Promise.all([
    supabase.from('usuarios_perfil')
      .select('id, nome, descricao, modulos, sistema, criado_em, atualizado_em')
      .order('sistema', { ascending: false })
      .order('nome'),
    supabase.from('usuarios')
      .select('perfil_id')
      .eq('ativo', true)
      .not('perfil_id', 'is', null),
  ]);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const usersPorPerfil = new Map<string, number>();
  for (const u of (contagens || []) as any[]) {
    if (u.perfil_id) usersPorPerfil.set(u.perfil_id, (usersPorPerfil.get(u.perfil_id) || 0) + 1);
  }

  const enriched = (perfis || []).map((p: any) => ({
    ...p,
    users_count: usersPorPerfil.get(p.id) || 0,
  }));

  return NextResponse.json({ success: true, perfis: enriched });
}

export async function POST(req: NextRequest) {
  const c = await requerAdmin(req); if ('erro' in c) return c.erro;
  const { supabase } = c;
  const body = await req.json().catch(() => ({}));

  const nome = String(body?.nome || '').trim();
  const descricao = body?.descricao ? String(body.descricao).trim() : null;
  const modulos = Array.isArray(body?.modulos) ? body.modulos.map(String) : [];

  if (!nome) return NextResponse.json({ success: false, error: 'nome obrigatório' }, { status: 400 });

  const { data, error } = await supabase
    .from('usuarios_perfil')
    .insert({ nome, descricao, modulos, sistema: false })
    .select('id, nome, descricao, modulos, sistema')
    .single();

  if (error) {
    const msg = /duplicate|unique/i.test(error.message) ? 'Já existe um perfil com esse nome' : error.message;
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
  return NextResponse.json({ success: true, perfil: data });
}

export async function PUT(req: NextRequest) {
  const c = await requerAdmin(req); if ('erro' in c) return c.erro;
  const { supabase } = c;
  const body = await req.json().catch(() => ({}));

  const id = String(body?.id || '').trim();
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });

  // Perfil sistema: só permite alterar módulos (não nome/descricao) — evita alguém
  // "renomear" o Admin acidentalmente. Alterar módulos do Admin também é bloqueado:
  // o marker "todos" está congelado.
  const { data: atual } = await supabase.from('usuarios_perfil').select('sistema, nome').eq('id', id).maybeSingle();
  if (!atual) return NextResponse.json({ success: false, error: 'perfil não encontrado' }, { status: 404 });
  if ((atual as any).sistema) {
    return NextResponse.json({ success: false, error: 'Perfil de sistema não pode ser editado' }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  if (body?.nome !== undefined) {
    const nome = String(body.nome).trim();
    if (!nome) return NextResponse.json({ success: false, error: 'nome inválido' }, { status: 400 });
    patch.nome = nome;
  }
  if (body?.descricao !== undefined) patch.descricao = body.descricao ? String(body.descricao).trim() : null;
  if (body?.modulos !== undefined) {
    if (!Array.isArray(body.modulos)) return NextResponse.json({ success: false, error: 'modulos deve ser array' }, { status: 400 });
    patch.modulos = body.modulos.map(String);
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ success: true, sem_mudancas: true });

  const { error } = await supabase.from('usuarios_perfil').update(patch).eq('id', id);
  if (error) {
    const msg = /duplicate|unique/i.test(error.message) ? 'Já existe um perfil com esse nome' : error.message;
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const c = await requerAdmin(req); if ('erro' in c) return c.erro;
  const { supabase } = c;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });

  const { data: atual } = await supabase.from('usuarios_perfil').select('sistema').eq('id', id).maybeSingle();
  if (!atual) return NextResponse.json({ success: false, error: 'perfil não encontrado' }, { status: 404 });
  if ((atual as any).sistema) {
    return NextResponse.json({ success: false, error: 'Perfil de sistema não pode ser removido' }, { status: 403 });
  }

  // Bloqueia deleção se ainda tem usuários vinculados (evita orfãos com perfil_id → NULL
  // caindo silenciosamente no fallback legado). Mensagem orienta o admin a re-atribuir.
  const { count } = await supabase.from('usuarios').select('id', { count: 'exact', head: true })
    .eq('perfil_id', id).eq('ativo', true);
  if ((count || 0) > 0) {
    return NextResponse.json({
      success: false,
      error: `Este perfil tem ${count} usuário(s) vinculado(s). Mova pra outro perfil antes de remover.`,
    }, { status: 400 });
  }

  const { error } = await supabase.from('usuarios_perfil').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
