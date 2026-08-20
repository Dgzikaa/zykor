import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import {
  CHAVES_DIMENSAO, PERGUNTA_FEEDBACK, PERGUNTA_MARCA, SUGESTAO_MARCA,
  aplicarNomeDoBar, nomeCurtoDoBar,
} from '@/lib/rh/pesquisa-felicidade';

export const dynamic = 'force-dynamic';

/**
 * O formulário público das pesquisas de RH — quem responde não tem login.
 *
 * Serve os três tipos pelo mesmo token:
 *  - felicidade         : 5 perguntas sorteadas, anônima, área conforme a config do bar;
 *  - marca_empregadora  : nota 0-10 + sugestão aberta, 100% anônima (nem área);
 *  - feedback           : uma pergunta, IDENTIFICADA (a pessoa escolhe o próprio nome).
 *
 * Regras que existem por causa do histórico: em 13/08/2026 a rota pública antiga foi REMOVIDA
 * porque era pública E escrevia direto no indicador. Aqui o token só abre rodada ABERTA, a
 * gravação vai pra tabela própria de respostas e nada de resultado sai daqui.
 */

async function rodadaPorToken(supabase: any, token: string) {
  const { data } = await supabase.schema('hr').from('pesquisa_rodada')
    .select('id, bar_id, referencia, aberta, tipo').eq('token', token).maybeSingle();
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

  const { data: bar } = await (supabase as any).schema('operations')
    .from('bares').select('nome').eq('id', rodada.bar_id).maybeSingle();
  const nomeBar = nomeCurtoDoBar((bar as any)?.nome);
  const base = { tipo: rodada.tipo, bar: nomeBar, referencia: rodada.referencia };

  if (rodada.tipo === 'marca_empregadora') {
    // Sem área e sem nada: "aqui também é 100% anônimo e a gente nem pega a área da pessoa".
    return NextResponse.json({
      ...base,
      pergunta: aplicarNomeDoBar(PERGUNTA_MARCA, nomeBar),
      sugestao: aplicarNomeDoBar(SUGESTAO_MARCA, nomeBar),
    });
  }

  if (rodada.tipo === 'feedback') {
    // Identificada: a lista é o quadro ATIVO do bar. Quem não está no organograma não aparece
    // — e é o organograma que diz quem é o líder de cada um.
    const { data: pessoas } = await (supabase as any).schema('hr').from('funcionarios')
      .select('id, nome').eq('bar_id', rodada.bar_id).eq('ativo', true).order('nome');
    return NextResponse.json({ ...base, pergunta: PERGUNTA_FEEDBACK, pessoas: pessoas || [] });
  }

  const [{ data: perguntas }, { data: cfg }] = await Promise.all([
    (supabase as any).schema('hr').from('pesquisa_rodada_pergunta')
      .select('dimensao, ordem, texto').eq('rodada_id', rodada.id).order('ordem'),
    (supabase as any).schema('hr').from('pesquisa_config')
      .select('exige_area').eq('bar_id', rodada.bar_id).maybeSingle(),
  ]);

  // Bar sem config cai no padrão "exige área": é o comportamento do Ordinário, e pedir demais
  // é recuperável (o RH desliga); pedir de menos perde o corte por setor daquela semana.
  const exigeArea = (cfg as any)?.exige_area ?? true;
  const { data: areas } = exigeArea
    ? await (supabase as any).schema('hr').from('areas').select('id, nome')
        .eq('bar_id', rodada.bar_id).eq('ativo', true).order('nome')
    : { data: [] };

  return NextResponse.json({
    ...base,
    // Sem o nome da dimensão: "não precisa aparecer o nome da dimensão ali 'Eu comigo' e tal".
    // A dimensão continua vindo porque é a chave da resposta — só não é mostrada.
    perguntas: (perguntas || []).map((p: any) => ({ dimensao: p.dimensao, texto: p.texto })),
    exige_area: exigeArea,
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

  const hr = (t: string) => (supabase as any).schema('hr').from(t);
  const comum = { rodada_id: rodada.id, bar_id: rodada.bar_id };

  // ---------- Marca Empregadora: nota 0-10 + sugestão ----------
  if (rodada.tipo === 'marca_empregadora') {
    const nota = Number(body.nota);
    if (!(nota >= 0 && nota <= 10)) {
      return NextResponse.json({ error: 'Escolha uma nota de 0 a 10.' }, { status: 400 });
    }
    const { error } = await hr('pesquisa_resposta').insert({
      ...comum, nota: Math.round(nota),
      comentario: String(body.comentario || '').trim().slice(0, 2000) || null,
    });
    if (error) return NextResponse.json({ error: 'Não foi possível registrar sua resposta.' }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ---------- Feedback: identificada, uma por pessoa ----------
  if (rodada.tipo === 'feedback') {
    const fid = Number(body.funcionario_id);
    if (!fid) return NextResponse.json({ error: 'Selecione o seu nome.' }, { status: 400 });
    if (typeof body.sim !== 'boolean') {
      return NextResponse.json({ error: 'Responda sim ou não.' }, { status: 400 });
    }
    const { data: pessoa } = await hr('funcionarios')
      .select('id').eq('id', fid).eq('bar_id', rodada.bar_id).eq('ativo', true).maybeSingle();
    if (!pessoa) return NextResponse.json({ error: 'Nome não encontrado neste bar.' }, { status: 404 });

    /**
     * O líder sai do ORGANOGRAMA (cadeira acima da dela), não de um campo digitado: perguntar
     * "quem é seu líder?" numa pesquisa sobre o líder é convite pra resposta errada, e o dado
     * já existe.
     */
    const { data: acima } = await hr('cadeira_ocupacao')
      .select('cadeiras!inner(cadeira_chefe_id)')
      .is('fim', null).eq('funcionario_id', fid).maybeSingle();
    const cadeiraChefe = (acima as any)?.cadeiras?.cadeira_chefe_id ?? null;
    let liderId: number | null = null;
    if (cadeiraChefe) {
      const { data: chefe } = await hr('cadeira_ocupacao')
        .select('funcionario_id').is('fim', null).eq('cadeira_id', cadeiraChefe).maybeSingle();
      liderId = (chefe as any)?.funcionario_id ?? null;
    }

    const { error } = await hr('pesquisa_resposta').upsert({
      ...comum, funcionario_id: fid, lider_id: liderId, sim: body.sim,
    }, { onConflict: 'rodada_id,funcionario_id' });
    if (error) return NextResponse.json({ error: 'Não foi possível registrar sua resposta.' }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ---------- Felicidade ----------
  const respostas: Record<string, number> = {};
  for (const [chave, valor] of Object.entries(body.respostas || {})) {
    const nota = Number(valor);
    if (CHAVES_DIMENSAO.includes(chave) && nota >= 1 && nota <= 5) respostas[chave] = Math.round(nota);
  }
  if (Object.keys(respostas).length === 0) {
    return NextResponse.json({ error: 'Responda pelo menos uma pergunta.' }, { status: 400 });
  }

  const { data: cfg } = await hr('pesquisa_config')
    .select('exige_area').eq('bar_id', rodada.bar_id).maybeSingle();
  const areaId = Number(body.area_id) || null;
  if (((cfg as any)?.exige_area ?? true) && !areaId) {
    return NextResponse.json({ error: 'Selecione a sua área.' }, { status: 400 });
  }

  const { error } = await hr('pesquisa_resposta').insert({ ...comum, area_id: areaId, respostas });
  if (error) return NextResponse.json({ error: 'Não foi possível registrar sua resposta.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
