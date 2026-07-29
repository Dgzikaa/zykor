import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { userCan, type PermAction } from '@/lib/permissions/resolver';

export const dynamic = 'force-dynamic';

/**
 * Responsáveis de produção. Vivem em auth_custom.pessoas_responsaveis (curada por bar).
 * Usado pela tela de Produções (execução/cronômetro) para registrar quem produziu.
 *
 * ESCRITA gateada pela permissão granular do módulo "Gerir Equipe (Responsáveis)":
 * POST→inserir, PUT→editar, DELETE→excluir. Admin sempre pode. (Antes era admin-only;
 * agora dá pra delegar via matriz "Acesso por módulo" da tela de Usuários.)
 */
const MOD_GERIR_EQUIPE = 'producao - cmv_gerir_equipe';

/** Admin passa direto; senão precisa da AÇÃO específica no módulo de gerir equipe. */
function podeGerir(user: { role?: string; modulos_permitidos: unknown }, action: PermAction): boolean {
  if (user.role === 'admin') return true;
  return userCan(user.modulos_permitidos as any, MOD_GERIR_EQUIPE, action);
}

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });

  // ?secao=Bar|Cozinha filtra quem atende àquela área. Quem está com secao NULL aparece nas
  // DUAS listas de propósito (ex.: Chefe de Produção, que transita entre bar e cozinha).
  const secao = sp.get('secao');

  const supabase = await getAdminClient();
  let q = (supabase as any)
    .schema('auth_custom')
    .from('pessoas_responsaveis')
    .select('id, nome, cargo, ativo, secao')
    .eq('bar_id', barId)
    .eq('ativo', true);
  if (secao === 'Bar' || secao === 'Cozinha') q = q.or(`secao.eq.${secao},secao.is.null`);
  const { data, error } = await q.order('nome', { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: data || [] });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  // Cadastrar responsável exige a ação 'inserir' no módulo de gerir equipe (ou admin).
  if (!podeGerir(user, 'inserir')) return permissionErrorResponse('Sem permissão para adicionar responsáveis');
  const body = await request.json().catch(() => ({}));
  const barId = Number(body.bar_id) || user.bar_id;
  const nome = String(body.nome || '').trim();
  if (!barId || !nome) return NextResponse.json({ success: false, error: 'bar_id e nome obrigatórios' }, { status: 400 });

  // secao: 'Bar' | 'Cozinha' | null (null = atende as duas áreas)
  const secao = body.secao === 'Bar' || body.secao === 'Cozinha' ? body.secao : null;

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any)
    .schema('auth_custom')
    .from('pessoas_responsaveis')
    .insert({ bar_id: barId, nome, cargo: body.cargo ? String(body.cargo).trim() : null, secao, ativo: true })
    .select('id, nome, cargo, ativo, secao')
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  // Editar responsável exige a ação 'editar' (ou admin).
  if (!podeGerir(user, 'editar')) return permissionErrorResponse('Sem permissão para editar responsáveis');
  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const patch: any = { updated_at: new Date().toISOString() };
  if ('nome' in body) patch.nome = body.nome;
  if ('cargo' in body) patch.cargo = body.cargo;
  if ('ativo' in body) patch.ativo = body.ativo;
  // Aceita null explícito (volta a valer pras duas seções); valor inválido não vira patch.
  if ('secao' in body) {
    patch.secao = body.secao === 'Bar' || body.secao === 'Cozinha' ? body.secao : null;
  }
  const { data, error } = await (supabase as any)
    .schema('auth_custom')
    .from('pessoas_responsaveis')
    .update(patch)
    .eq('id', id)
    .select('id, nome, cargo, ativo, secao')
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  // Remover (soft-delete) responsável exige a ação 'excluir' (ou admin).
  if (!podeGerir(user, 'excluir')) return permissionErrorResponse('Sem permissão para remover responsáveis');
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
