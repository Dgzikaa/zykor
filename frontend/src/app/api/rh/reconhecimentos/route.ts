import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

/**
 * Reconhecimentos (ata de 13/08/2026, aba de Pesquisas).
 *
 * Fica fora de `funcionario_ocorrencias` de propósito: ocorrência é o lado disciplinar — vira
 * alerta no dossiê e conta cartão. Reconhecimento é o oposto e não pode entrar na mesma contagem.
 */

/** GET ?meses=12 -> reconhecimentos do bar, mais recentes primeiro. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const meses = Math.min(Number(new URL(request.url).searchParams.get('meses')) || 12, 60);
  const desde = new Date();
  desde.setMonth(desde.getMonth() - meses);

  const supabase = await getAdminClient();
  const hr = (t: string) => (supabase as any).schema('hr').from(t);

  const [recRes, funcRes] = await Promise.all([
    hr('reconhecimentos').select('*').eq('bar_id', user.bar_id)
      .gte('data', desde.toISOString().slice(0, 10)).order('data', { ascending: false }),
    hr('funcionarios').select('id, nome').eq('bar_id', user.bar_id).eq('ativo', true).order('nome'),
  ]);
  if (recRes.error) return NextResponse.json({ success: false, error: recRes.error.message }, { status: 500 });

  const nomes = new Map<number, string>((funcRes.data || []).map((f: any) => [f.id, f.nome]));
  const lista = (recRes.data || []).map((r: any) => ({ ...r, funcionario_nome: nomes.get(r.funcionario_id) || '—' }));

  // ranking do período: quem mais foi reconhecido
  const porPessoa = new Map<number, { nome: string; n: number }>();
  for (const r of lista) {
    const o = porPessoa.get(r.funcionario_id) || { nome: r.funcionario_nome, n: 0 };
    o.n++; porPessoa.set(r.funcionario_id, o);
  }

  return NextResponse.json({
    success: true,
    reconhecimentos: lista,
    funcionarios: funcRes.data || [],
    ranking: Array.from(porPessoa.entries())
      .map(([id, v]) => ({ funcionario_id: id, ...v }))
      .sort((a, b) => b.n - a.n).slice(0, 10),
  });
}

/** POST -> registra. body: { funcionario_id, titulo, descricao?, data?, reconhecido_por? } */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const funcionarioId = Number(body.funcionario_id);
  const titulo = String(body.titulo || '').trim();
  if (!funcionarioId) return NextResponse.json({ success: false, error: 'Escolha quem está sendo reconhecido' }, { status: 400 });
  if (!titulo) return NextResponse.json({ success: false, error: 'Escreva o reconhecimento' }, { status: 400 });

  const supabase = await getAdminClient();
  const hr = (t: string) => (supabase as any).schema('hr').from(t);

  const { data: pessoa } = await hr('funcionarios').select('id').eq('id', funcionarioId).eq('bar_id', user.bar_id).maybeSingle();
  if (!pessoa) return NextResponse.json({ success: false, error: 'Funcionário não encontrado neste bar' }, { status: 404 });

  const { data, error } = await hr('reconhecimentos').insert({
    bar_id: user.bar_id, funcionario_id: funcionarioId, titulo,
    descricao: body.descricao?.trim() || null,
    data: body.data || new Date().toISOString().slice(0, 10),
    reconhecido_por: body.reconhecido_por?.trim() || null,
    registrado_por: user.nome || user.email || null,
  }).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, reconhecimento: data }, { status: 201 });
}

/** DELETE ?id= */
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const { error } = await (supabase as any).schema('hr').from('reconhecimentos')
    .delete().eq('id', id).eq('bar_id', user.bar_id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
