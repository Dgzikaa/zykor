import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { CHAVES_DIMENSAO, DIMENSOES, nomeCurtoDoBar } from '@/lib/rh/pesquisa-felicidade';

export const dynamic = 'force-dynamic';

/**
 * O formulário público da Pesquisa da Felicidade — quem responde não tem login.
 *
 * Regras que existem por causa do histórico: em 13/08/2026 a rota pública antiga foi REMOVIDA
 * porque era pública E escrevia direto no indicador. Aqui:
 *  - o token é a única chave, e só abre rodada ABERTA;
 *  - o GET devolve só as perguntas e o nome do bar — nenhum resultado, nenhuma outra rodada;
 *  - o POST grava em hr.pesquisa_resposta (tabela própria), sem nada que identifique a pessoa;
 *  - nota fora de 1..5 e dimensão desconhecida são descartadas antes de gravar.
 */

async function rodadaPorToken(supabase: any, token: string) {
  const { data } = await supabase.schema('hr').from('pesquisa_rodada')
    .select('id, bar_id, referencia, aberta').eq('token', token).maybeSingle();
  return data;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: 'Link inválido' }, { status: 400 });

  const supabase = await getAdminClient();
  const rodada = await rodadaPorToken(supabase, token);
  if (!rodada) return NextResponse.json({ error: 'Link inválido' }, { status: 404 });
  if (!rodada.aberta) {
    return NextResponse.json({ error: 'Esta pesquisa já foi encerrada.', encerrada: true }, { status: 410 });
  }

  const [{ data: perguntas }, { data: bar }, { data: areas }] = await Promise.all([
    (supabase as any).schema('hr').from('pesquisa_rodada_pergunta')
      .select('dimensao, ordem, texto').eq('rodada_id', rodada.id).order('ordem'),
    (supabase as any).schema('operations').from('bares').select('nome').eq('id', rodada.bar_id).maybeSingle(),
    // o indicador é lido por SETOR; a área é opcional e é a única coisa que a resposta guarda
    // além das notas.
    (supabase as any).schema('hr').from('areas').select('id, nome')
      .eq('bar_id', rodada.bar_id).eq('ativo', true).order('nome'),
  ]);

  return NextResponse.json({
    bar: nomeCurtoDoBar((bar as any)?.nome),
    referencia: rodada.referencia,
    perguntas: (perguntas || []).map((p: any) => ({
      dimensao: p.dimensao, texto: p.texto,
      titulo: DIMENSOES.find((d) => d.chave === p.dimensao)?.titulo ?? p.dimensao,
    })),
    areas: areas || [],
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: 'Link inválido' }, { status: 400 });

  const body = await request.json().catch(() => ({} as any));
  const supabase = await getAdminClient();
  const rodada = await rodadaPorToken(supabase, token);
  if (!rodada) return NextResponse.json({ error: 'Link inválido' }, { status: 404 });
  if (!rodada.aberta) return NextResponse.json({ error: 'Esta pesquisa já foi encerrada.' }, { status: 410 });

  const respostas: Record<string, number> = {};
  for (const [chave, valor] of Object.entries(body.respostas || {})) {
    const nota = Number(valor);
    if (CHAVES_DIMENSAO.includes(chave) && nota >= 1 && nota <= 5) respostas[chave] = Math.round(nota);
  }
  if (Object.keys(respostas).length === 0) {
    return NextResponse.json({ error: 'Responda pelo menos uma pergunta.' }, { status: 400 });
  }

  const comentario = String(body.comentario || '').trim().slice(0, 2000) || null;
  const areaId = Number(body.area_id) || null;

  const { error } = await (supabase as any).schema('hr').from('pesquisa_resposta').insert({
    rodada_id: rodada.id, bar_id: rodada.bar_id, area_id: areaId, respostas, comentario,
  });
  if (error) return NextResponse.json({ error: 'Não foi possível registrar sua resposta.' }, { status: 500 });

  return NextResponse.json({ success: true });
}
