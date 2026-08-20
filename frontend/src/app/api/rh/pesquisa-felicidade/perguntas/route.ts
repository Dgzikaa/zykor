import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { CHAVES_DIMENSAO, DIMENSOES, nomeCurtoDoBar } from '@/lib/rh/pesquisa-felicidade';

export const dynamic = 'force-dynamic';

/**
 * Banco de perguntas da Pesquisa da Felicidade — o RH mexe sem pedir deploy.
 * Gonza (20/08/2026): "seria legal ter acesso às perguntas, pra modificar, substituir,
 * adicionar novas ou excluir alguma".
 *
 * Pergunta com `bar_id` nulo é do CATÁLOGO, valendo pra rede toda; com bar_id é só daquele bar.
 * Editar uma do catálogo muda pra todo mundo — a tela avisa. Excluir NUNCA apaga de verdade
 * (`ativa = false`): a rodada guarda o texto que foi perguntado, mas o histórico ainda aponta
 * pra pergunta, e apagar quebraria a leitura de "essa pergunta caiu de nota".
 */

function hr(supabase: any, t: string) { return supabase.schema('hr').from(t); }

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const supabase = await getAdminClient();
  const [{ data, error }, { data: bar }] = await Promise.all([
    hr(supabase, 'pesquisa_pergunta').select('id, bar_id, dimensao, ordem, texto, ativa')
      .or(`bar_id.is.null,bar_id.eq.${user.bar_id}`).order('dimensao').order('ordem'),
    (supabase as any).schema('operations').from('bares').select('nome').eq('id', user.bar_id).maybeSingle(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    // pra tela mostrar o texto como a pessoa vai ler, sem perder o marcador na edição
    bar: nomeCurtoDoBar((bar as any)?.nome),
    dimensoes: DIMENSOES,
    perguntas: data || [],
  });
}

/** POST — cria pergunta. body: { dimensao, texto } */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({} as any));
  const dimensao = String(body.dimensao || '');
  const texto = String(body.texto || '').trim();
  if (!CHAVES_DIMENSAO.includes(dimensao)) return NextResponse.json({ error: 'Dimensão inválida' }, { status: 400 });
  if (texto.length < 5) return NextResponse.json({ error: 'Escreva a pergunta.' }, { status: 400 });

  const supabase = await getAdminClient();
  // Pergunta nova nasce DO BAR: quem cria está resolvendo a casa dele, não editando o catálogo
  // da rede sem querer.
  const { data: ultima } = await hr(supabase, 'pesquisa_pergunta')
    .select('ordem').eq('bar_id', user.bar_id).eq('dimensao', dimensao)
    .order('ordem', { ascending: false }).limit(1);
  const ordem = ((ultima?.[0]?.ordem as number) ?? 0) + 1;

  const { data, error } = await hr(supabase, 'pesquisa_pergunta')
    .insert({ bar_id: user.bar_id, dimensao, ordem, texto, ativa: true }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, pergunta: data });
}

/** PUT — edita texto/dimensão/ativa. body: { id, texto?, dimensao?, ativa? } */
export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({} as any));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data: atual } = await hr(supabase, 'pesquisa_pergunta')
    .select('id, bar_id').eq('id', id).maybeSingle();
  if (!atual) return NextResponse.json({ error: 'Pergunta não encontrada' }, { status: 404 });
  // trava multi-bar: pergunta de OUTRO bar não se edita daqui (a do catálogo, bar_id nulo, sim)
  if (atual.bar_id != null && atual.bar_id !== user.bar_id) {
    return NextResponse.json({ error: 'Essa pergunta é de outro bar.' }, { status: 403 });
  }

  const patch: any = {};
  if (body.texto !== undefined) {
    const texto = String(body.texto).trim();
    if (texto.length < 5) return NextResponse.json({ error: 'Escreva a pergunta.' }, { status: 400 });
    patch.texto = texto;
  }
  if (body.dimensao !== undefined) {
    if (!CHAVES_DIMENSAO.includes(String(body.dimensao))) {
      return NextResponse.json({ error: 'Dimensão inválida' }, { status: 400 });
    }
    patch.dimensao = String(body.dimensao);
  }
  if (body.ativa !== undefined) patch.ativa = !!body.ativa;
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nada para alterar' }, { status: 400 });

  const { data, error } = await hr(supabase, 'pesquisa_pergunta')
    .update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, pergunta: data });
}

/**
 * DELETE ?id= — desativa. Só apaga de verdade a pergunta do próprio bar que nunca foi usada
 * numa rodada; o resto vira inativa, pra não sumir do histórico.
 */
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data: atual } = await hr(supabase, 'pesquisa_pergunta')
    .select('id, bar_id').eq('id', id).maybeSingle();
  if (!atual) return NextResponse.json({ error: 'Pergunta não encontrada' }, { status: 404 });
  if (atual.bar_id != null && atual.bar_id !== user.bar_id) {
    return NextResponse.json({ error: 'Essa pergunta é de outro bar.' }, { status: 403 });
  }

  const { count } = await hr(supabase, 'pesquisa_rodada_pergunta')
    .select('rodada_id', { count: 'exact', head: true }).eq('pergunta_id', id);

  if (!count && atual.bar_id === user.bar_id) {
    const { error } = await hr(supabase, 'pesquisa_pergunta').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, apagada: true });
  }

  const { error } = await hr(supabase, 'pesquisa_pergunta').update({ ativa: false }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, apagada: false, usos: count || 0 });
}
