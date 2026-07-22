import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * "Insumo acabou" — sinal manual de falta de estoque (chão de produção OU gestor), que aparece
 * como badge no Plano de Compras mesmo quando a contagem semanal ainda mostra estoque.
 *
 * GET  ?bar_id           → faltas ATIVAS do bar (resolvido_em is null).
 * POST { bar_id, insumo_codigo, nome?, origem?, observacao?, acao? }
 *      acao 'resolver'   → marca como resolvida (comprou / recontou / voltou).
 *      senão (marcar)    → cria a falta ativa (idempotente: 1 ativa por insumo/bar).
 *
 * Coluna operations.insumo_falta. Escrita por qualquer usuário autenticado do bar (a tela de
 * produção e a de compras já são gateadas). Ver project_plano_compras_expande_preparos.
 */
const SCHEMA = 'operations';
const TABLE = 'insumo_falta';

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).schema(SCHEMA).from(TABLE)
    .select('insumo_codigo, nome, origem, observacao, marcado_por, marcado_em')
    .eq('bar_id', barId).is('resolvido_em', null);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, faltas: data || [] });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const body = await request.json().catch(() => ({}));

  const barId = Number(body?.bar_id) || user.bar_id;
  const codigo = String(body?.insumo_codigo || '').trim();
  if (!barId || !codigo) return NextResponse.json({ success: false, error: 'bar_id e insumo_codigo obrigatórios' }, { status: 400 });
  const quem = user.nome ?? user.email ?? null;
  const supabase = await getAdminClient();

  if (String(body?.acao) === 'resolver') {
    const { error } = await (supabase as any).schema(SCHEMA).from(TABLE)
      .update({ resolvido_em: new Date().toISOString(), resolvido_por: quem })
      .eq('bar_id', barId).ilike('insumo_codigo', codigo).is('resolvido_em', null);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, resolvido: true });
  }

  // marcar: só cria se não houver uma falta ATIVA pra esse insumo (índice único parcial garante).
  const { data: ativa } = await (supabase as any).schema(SCHEMA).from(TABLE)
    .select('id').eq('bar_id', barId).ilike('insumo_codigo', codigo).is('resolvido_em', null).maybeSingle();
  if (ativa) return NextResponse.json({ success: true, jaExistia: true });

  const { error } = await (supabase as any).schema(SCHEMA).from(TABLE).insert({
    bar_id: barId, insumo_codigo: codigo,
    nome: body?.nome ? String(body.nome).slice(0, 200) : null,
    origem: body?.origem ? String(body.origem).slice(0, 20) : 'compras',
    observacao: body?.observacao ? String(body.observacao).slice(0, 300) : null,
    marcado_por: quem,
  });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, marcado: true });
}
