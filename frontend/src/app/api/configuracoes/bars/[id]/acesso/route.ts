import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth/server';

// Gerencia quais usuários enxergam um bar (auth_custom.usuarios_bares).
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// GET — usuários com acesso ao bar
export const GET = requireAdmin(async (_request: NextRequest, _user, ctx: Ctx) => {
  try {
    const { id } = await ctx.params;
    const barId = parseInt(id, 10);
    const supabase = await getAdminClient();

    const { data: vinculos, error } = await (supabase as any)
      .schema('auth_custom').from('usuarios_bares')
      .select('usuario_id').eq('bar_id', barId);
    if (error) throw error;

    const ids = (vinculos || []).map((v: any) => v.usuario_id);
    if (ids.length === 0) return NextResponse.json({ success: true, usuarios: [] });

    const { data: usuarios } = await (supabase as any)
      .schema('auth_custom').from('usuarios')
      .select('auth_id, nome, email, role, ativo').in('auth_id', ids);

    return NextResponse.json({ success: true, usuarios: usuarios || [] });
  } catch (error: any) {
    console.error('Erro GET acesso bar:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

// POST — concede acesso { usuario_id } ou { email }
export const POST = requireAdmin(async (request: NextRequest, _user, ctx: Ctx) => {
  try {
    const { id } = await ctx.params;
    const barId = parseInt(id, 10);
    const body = await request.json();
    let usuario_id = body.usuario_id as string | undefined;
    const supabase = await getAdminClient();

    // Permite conceder por email (resolve o auth_id).
    if (!usuario_id && body.email) {
      const { data: u } = await (supabase as any)
        .schema('auth_custom').from('usuarios')
        .select('auth_id').ilike('email', String(body.email).trim()).maybeSingle();
      if (!u) {
        return NextResponse.json({ success: false, error: 'Usuário não encontrado por esse email' }, { status: 404 });
      }
      usuario_id = u.auth_id;
    }

    if (!usuario_id) {
      return NextResponse.json({ success: false, error: 'usuario_id ou email é obrigatório' }, { status: 400 });
    }

    const { data: existe } = await (supabase as any)
      .schema('auth_custom').from('usuarios_bares')
      .select('id').eq('bar_id', barId).eq('usuario_id', usuario_id).maybeSingle();
    if (existe) return NextResponse.json({ success: true, jaTinha: true });

    const { error } = await (supabase as any)
      .schema('auth_custom').from('usuarios_bares')
      .insert([{ bar_id: barId, usuario_id }]);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro POST acesso bar:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

// DELETE ?usuario_id= — revoga acesso
export const DELETE = requireAdmin(async (request: NextRequest, _user, ctx: Ctx) => {
  try {
    const { id } = await ctx.params;
    const barId = parseInt(id, 10);
    const usuarioId = new URL(request.url).searchParams.get('usuario_id');
    if (!usuarioId) {
      return NextResponse.json({ success: false, error: 'usuario_id é obrigatório' }, { status: 400 });
    }
    const supabase = await getAdminClient();

    const { error } = await (supabase as any)
      .schema('auth_custom').from('usuarios_bares')
      .delete().eq('bar_id', barId).eq('usuario_id', usuarioId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro DELETE acesso bar:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
