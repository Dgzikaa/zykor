import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Usuários de um perfil de acesso (RBAC).
 * GET  ?perfil_id=X  → { doPerfil: [...], candidatos: [...] }  (quem já está + todos p/ adicionar)
 * POST { user_id, perfil_id | null }  → move o usuário pra o perfil (ou tira, perfil_id=null)
 *
 * Só admin. Mudar o perfil de alguém troca as permissões dele → a trigger corta o token,
 * então ELE precisa relogar pra valer (a UI avisa isso).
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
  const perfilId = new URL(req.url).searchParams.get('perfil_id');
  if (!perfilId) return NextResponse.json({ success: false, error: 'perfil_id obrigatório' }, { status: 400 });

  const { data: usuarios, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, perfil_id')
    .eq('ativo', true)
    .order('nome');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const arr = (usuarios || []) as any[];
  const doPerfil = arr.filter(u => u.perfil_id === perfilId).map(u => ({ id: u.id, nome: u.nome, email: u.email }));
  // candidatos = quem NÃO está neste perfil (pra adicionar); leva o perfil atual pra UI avisar a troca
  const candidatos = arr.filter(u => u.perfil_id !== perfilId)
    .map(u => ({ id: u.id, nome: u.nome, email: u.email, perfil_id: u.perfil_id }));

  return NextResponse.json({ success: true, doPerfil, candidatos });
}

export async function POST(req: NextRequest) {
  const c = await requerAdmin(req); if ('erro' in c) return c.erro;
  const { supabase } = c;
  const body = await req.json().catch(() => ({}));

  const userId = String(body?.user_id || '').trim();
  if (!userId) return NextResponse.json({ success: false, error: 'user_id obrigatório' }, { status: 400 });
  // perfil_id null = tirar do perfil (volta pra matriz manual do próprio usuário)
  const perfilId = body?.perfil_id ? String(body.perfil_id).trim() : null;

  const { error } = await supabase
    .from('usuarios')
    .update({ perfil_id: perfilId, atualizado_em: new Date().toISOString() })
    .eq('id', userId);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
