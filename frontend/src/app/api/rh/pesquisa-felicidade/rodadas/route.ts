import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import {
  DIMENSOES, aplicarNomeDoBar, scoreDimensao, segundaDaSemana, sortearRodada,
} from '@/lib/rh/pesquisa-felicidade';

export const dynamic = 'force-dynamic';

/**
 * Rodadas da Pesquisa da Felicidade — o lado do RH.
 *
 * GET  lista as rodadas do bar com o resultado de cada uma.
 * POST cria uma rodada nova: sorteia 1 pergunta de cada dimensão do banco, aplica o nome do
 *      bar e devolve o link público pra mandar no WhatsApp.
 *
 * O link é a única credencial da rodada, então o token é aleatório de 24 bytes — não é id
 * sequencial nem data, que qualquer um adivinharia e usaria pra inflar a pesquisa dos outros.
 */

const TOKEN_BYTES = 24;

async function resultadoDasRodadas(supabase: any, rodadas: any[]) {
  if (!rodadas.length) return new Map<string, any>();
  const ids = rodadas.map((r) => r.id);
  const { data: respostas } = await (supabase as any).schema('hr')
    .from('pesquisa_resposta').select('rodada_id, respostas, area_id, comentario').in('rodada_id', ids);

  const porRodada = new Map<string, any>();
  for (const id of ids) porRodada.set(id, { n: 0, dimensoes: {} as Record<string, number[]>, comentarios: [] as string[] });
  for (const r of (respostas || []) as any[]) {
    const acc = porRodada.get(r.rodada_id);
    if (!acc) continue;
    acc.n++;
    if (r.comentario) acc.comentarios.push(r.comentario);
    for (const d of DIMENSOES) {
      const nota = Number((r.respostas || {})[d.chave]);
      if (nota >= 1 && nota <= 5) (acc.dimensoes[d.chave] ||= []).push(nota);
    }
  }
  for (const [, acc] of porRodada) {
    const scores: Record<string, number | null> = {};
    for (const d of DIMENSOES) scores[d.chave] = scoreDimensao(acc.dimensoes[d.chave] || []);
    const validos = Object.values(scores).filter((v): v is number => v != null);
    acc.scores = scores;
    acc.geral = validos.length ? Math.round((validos.reduce((s, v) => s + v, 0) / validos.length) * 10) / 10 : null;
    delete acc.dimensoes;
  }
  return porRodada;
}

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const supabase = await getAdminClient();
  const hr = (t: string) => (supabase as any).schema('hr').from(t);

  const { data: rodadas, error } = await hr('pesquisa_rodada')
    .select('id, token, referencia, aberta, criada_em, criada_por, fechada_em')
    .eq('bar_id', user.bar_id).order('referencia', { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lista = (rodadas || []) as any[];
  const [{ data: perguntas }, resultados] = await Promise.all([
    lista.length
      ? hr('pesquisa_rodada_pergunta').select('rodada_id, dimensao, ordem, texto').in('rodada_id', lista.map((r) => r.id))
      : Promise.resolve({ data: [] }),
    resultadoDasRodadas(supabase, lista),
  ]);

  const perguntasPor = new Map<string, any[]>();
  for (const p of (perguntas || []) as any[]) {
    const daRodada = perguntasPor.get(p.rodada_id) ?? [];
    daRodada.push(p);
    perguntasPor.set(p.rodada_id, daRodada);
  }

  return NextResponse.json({
    success: true,
    // o banco vai junto pro RH ver o que existe sem outra chamada
    banco_total: 55,
    rodadas: lista.map((r) => ({
      ...r,
      perguntas: (perguntasPor.get(r.id) || []).sort((a, b) => a.ordem - b.ordem),
      resultado: resultados.get(r.id) || { n: 0, scores: {}, geral: null, comentarios: [] },
    })),
  });
}

/** POST — cria a rodada da semana. body: { referencia?: 'AAAA-MM-DD' } */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({} as any));
  const supabase = await getAdminClient();
  const hr = (t: string) => (supabase as any).schema('hr').from(t);

  if (body.acao === 'fechar' || body.acao === 'reabrir') {
    const { error } = await hr('pesquisa_rodada')
      .update({ aberta: body.acao === 'reabrir', fechada_em: body.acao === 'fechar' ? new Date().toISOString() : null })
      .eq('id', String(body.rodada_id)).eq('bar_id', user.bar_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const referencia = /^\d{4}-\d{2}-\d{2}$/.test(String(body.referencia || ''))
    ? String(body.referencia) : segundaDaSemana();

  // Uma rodada por semana: duas rodadas abertas ao mesmo tempo dividiriam as respostas em dois
  // links e o número da semana sairia pela metade nos dois.
  const { data: existente } = await hr('pesquisa_rodada')
    .select('id, token').eq('bar_id', user.bar_id).eq('referencia', referencia).maybeSingle();
  if (existente) {
    return NextResponse.json(
      { error: 'Já existe uma pesquisa desta semana. Use o link dela ou escolha outra semana.', rodada_id: existente.id },
      { status: 409 },
    );
  }

  const [{ data: bar }, { data: banco }, { data: recentes }] = await Promise.all([
    (supabase as any).schema('operations').from('bares').select('nome').eq('id', user.bar_id).maybeSingle(),
    hr('pesquisa_pergunta').select('id, dimensao, texto')
      .or(`bar_id.is.null,bar_id.eq.${user.bar_id}`).eq('ativa', true),
    // últimas 8 rodadas do bar: o suficiente pra não repetir pergunta antes de girar o banco
    hr('pesquisa_rodada').select('id').eq('bar_id', user.bar_id)
      .order('referencia', { ascending: false }).limit(8),
  ]);

  if (!banco?.length) {
    return NextResponse.json({ error: 'Banco de perguntas vazio.' }, { status: 400 });
  }

  let usadas = new Set<number>();
  if (recentes?.length) {
    const { data: usadasRows } = await hr('pesquisa_rodada_pergunta')
      .select('pergunta_id').in('rodada_id', (recentes as any[]).map((r) => r.id));
    usadas = new Set(((usadasRows || []) as any[]).map((u) => u.pergunta_id).filter(Boolean));
  }

  const sorteadas = sortearRodada(banco as any[], usadas);
  if (sorteadas.length < DIMENSOES.length) {
    return NextResponse.json({ error: 'O banco não tem pergunta para todas as 5 dimensões.' }, { status: 400 });
  }

  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const { data: rodada, error } = await hr('pesquisa_rodada').insert({
    bar_id: user.bar_id, token, referencia, aberta: true,
    criada_por: user.nome || user.email || null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const nomeBar = (bar as any)?.nome || '';
  const linhas = sorteadas.map((s, i) => ({
    rodada_id: rodada.id, dimensao: s.dimensao, ordem: i + 1,
    pergunta_id: s.pergunta_id, texto: aplicarNomeDoBar(s.texto, nomeBar),
  }));
  const { error: errP } = await hr('pesquisa_rodada_pergunta').insert(linhas);
  if (errP) {
    // rodada sem pergunta é um link quebrado esperando alguém abrir
    await hr('pesquisa_rodada').delete().eq('id', rodada.id);
    return NextResponse.json({ error: errP.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, rodada: { ...rodada, perguntas: linhas } });
}
