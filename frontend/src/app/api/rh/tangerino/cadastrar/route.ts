import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { encryptSecret } from '@/lib/crypto/secretBox';

/**
 * GET  /api/rh/tangerino/cadastrar — status da credencial Tangerino do bar (existe? quando).
 * POST /api/rh/tangerino/cadastrar — salva o token CIFRADO (server-side, master key do runtime).
 * Body: { token, empresa_nome? }. bar_id vem do usuário. Admin/RH/financeiro. Nunca ecoa o token.
 */
export const dynamic = 'force-dynamic';

function podeUsar(role?: string) {
  return role === 'admin' || role === 'rh' || role === 'financeiro';
}

export async function GET(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeUsar(user.role)) return permissionErrorResponse('Apenas admin/RH');
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data } = await (supabase as any).from('api_credentials')
    .select('id, empresa_nome, ativo, atualizado_em, criado_em')
    .eq('bar_id', user.bar_id).eq('sistema', 'tangerino').maybeSingle();
  return NextResponse.json({ cadastrado: !!data, credencial: data ?? null });
}

export async function POST(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeUsar(user.role)) return permissionErrorResponse('Apenas admin/RH podem cadastrar');
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await req.json().catch(() => ({} as any));
  const token = String(body?.token || '').trim();
  if (!token) return NextResponse.json({ error: 'token obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const row = {
    bar_id: user.bar_id, sistema: 'tangerino', ambiente: 'producao',
    empresa_nome: body?.empresa_nome || 'Tangerino', ativo: true,
    configuracoes: { enc: { token: encryptSecret(token) } },
  };
  // idempotente: substitui a credencial anterior do bar
  await (supabase as any).from('api_credentials').delete().eq('bar_id', user.bar_id).eq('sistema', 'tangerino');
  const { data, error } = await (supabase as any).from('api_credentials').insert(row).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data.id });
}
