import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { equipeDoUsuario } from '@/lib/rh/equipe';
import { salvarCheckin } from '@/lib/rh/checkin';

export const dynamic = 'force-dynamic';

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * VISÃO DIA da Escala da Operação — quem está escalado hoje e o check do líder.
 *
 * Substitui a aba Check-ins que morava no RH. Duas diferenças que importam:
 *  - lê a escala da OPERAÇÃO (operations.v_escala_checkin_dia), não a hr.escalas do Tangerino,
 *    que marcava ~50 escalados por dia num bar de 56 ativos;
 *  - salva em LOTE, quando o líder aperta Salvar, em vez de um POST por clique.
 *
 * O escopo é o mesmo da visão Semana: a árvore de cadeiras abaixo de quem está logado.
 */

// GET ?data=AAAA-MM-DD
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const data = new URL(request.url).searchParams.get('data') || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ error: 'data inválida (AAAA-MM-DD)' }, { status: 400 });
  }

  const c = sb();
  const [{ data: linhas, error }, equipe] = await Promise.all([
    (c as any).schema('operations').from('v_escala_checkin_dia')
      .select('*').eq('bar_id', user.bar_id).eq('data', data).order('nome'),
    equipeDoUsuario(c, user),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const todas = (linhas || []) as any[];
  const lista = equipe.ids ? todas.filter((l) => equipe.ids!.has(l.funcionario_id)) : todas;

  // sugestão: o que o ponto diz, traduzido para as opções que o líder tem. Quem não bate ponto
  // (PJ, liderança) não gera sugestão — some do ponto seria falta, e não é.
  const comSugestao = lista.map((l) => ({
    ...l,
    sugestao: l.ponto_situacao === 'ok' ? 'ok'
      : l.ponto_situacao === 'atraso' ? 'ok_atraso'
      : l.ponto_situacao === 'falta' ? 'falta'
      : null,
  }));

  return NextResponse.json({
    data,
    linhas: comSugestao,
    equipe_de: equipe.lider,
    resumo: {
      escalados: comSugestao.length,
      marcados: comSugestao.filter((l) => l.checkin_status).length,
      pendentes: comSugestao.filter((l) => !l.checkin_status).length,
      faltas: comSugestao.filter((l) => l.checkin_status === 'falta').length,
    },
  });
}

/**
 * POST — salva o lote do dia. body: { data, marcacoes: [{ funcionario_id, status, observacao? }] }
 *
 * Em lote porque o líder revisa a lista inteira e só aperta Salvar no fim; e porque a maioria
 * das linhas já vem certa pela sugestão do ponto, então salvar a cada toque seria pedir dezenas
 * de requisições pra registrar duas correções.
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({} as any));
  const data = String(body.data || '').slice(0, 10);
  const marcacoes = Array.isArray(body.marcacoes) ? body.marcacoes : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ error: 'data inválida (AAAA-MM-DD)' }, { status: 400 });
  }
  if (!marcacoes.length) return NextResponse.json({ error: 'Nada para salvar' }, { status: 400 });

  const c = sb();
  const equipe = await equipeDoUsuario(c, user);

  const erros: string[] = [];
  let gravados = 0;
  for (const m of marcacoes) {
    const fid = Number(m?.funcionario_id);
    // trava no SERVIDOR: sem isto bastaria mandar outro funcionario_id na requisição pra
    // marcar falta em gente de outra equipe.
    if (equipe.ids && !equipe.ids.has(fid)) {
      erros.push(`funcionário ${fid} não é da sua equipe`);
      continue;
    }
    const r = await salvarCheckin(c, user, {
      funcionario_id: fid, data, status: String(m?.status || ''), observacao: m?.observacao ?? null,
    });
    if (r.ok) gravados++; else erros.push(r.erro);
  }

  // Parcial NÃO é sucesso silencioso: o líder precisa saber que 2 das 12 não entraram.
  return NextResponse.json({
    success: erros.length === 0,
    gravados,
    erros,
  }, { status: erros.length && !gravados ? 400 : 200 });
}
