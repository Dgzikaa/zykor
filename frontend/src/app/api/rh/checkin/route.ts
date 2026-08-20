import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { salvarCheckin } from '@/lib/rh/checkin';

export const dynamic = 'force-dynamic';

/**
 * Check-in do dia (ata de 13/08/2026).
 *
 * A lista sai da ESCALA, não do ponto: a pergunta é "quem deveria estar aqui hoje". Se viesse do
 * ponto, sumiriam justamente PJ e liderança, que não batem — o buraco que a ata aponta.
 *
 * O ponto entra como SUGESTÃO. Vale conferir o tamanho do problema: em 12/08 o ponto acusou 18
 * faltas entre 50 escalados, enquanto a mensagem da semana reportou 9 faltas no total. Marcar na
 * mão é o que separa "não veio" de "veio e não bateu".
 */

// 'atestado' = ausência JUSTIFICADA (Gonza, 19/08/2026). Não é falta: gera ocorrência de tipo
// 'atestado' no dossiê, não de tipo 'falta'.

/** GET ?data=YYYY-MM-DD -> escalados do dia com sugestão do ponto e o que já foi marcado. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const data = sp.get('data') || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ success: false, error: 'data inválida (AAAA-MM-DD)' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const { data: linhas, error } = await (supabase as any).schema('hr')
    .from('v_checkin_dia').select('*').eq('bar_id', user.bar_id).eq('data', data).order('nome');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  let lista = (linhas || []) as any[];

  /**
   * Cada líder marca só a SUA gente (ata de 13/08/2026: "chefe de fila luan tem que dar check so
   * nas pessoas abaixo dele... de acordo com o usuario logado").
   *
   * A equipe sai da árvore de CADEIRAS abaixo da cadeira que a pessoa logada ocupa — assim continua
   * certa quando alguém troca de posição. Quem não está vinculado a um funcionário, ou está numa
   * cadeira sem ninguém abaixo, segue vendo o dia inteiro: é o caso de RH e admin, que precisam da
   * visão completa. `?todos=1` também devolve tudo, para quem quiser conferir a casa toda.
   */
  let equipeDe: string | null = null;
  const verTodos = sp.get('todos') === '1';
  if (!verTodos) {
    const { data: usr } = await (supabase as any).from('usuarios')
      .select('funcionario_id, nome').eq('id', user.id).maybeSingle();
    if (usr?.funcionario_id) {
      const { data: equipe } = await (supabase as any).schema('hr')
        .rpc('fn_equipe_do_funcionario', { p_funcionario_id: usr.funcionario_id });
      const ids = new Set<number>(((equipe || []) as any[]).map((e) => e.funcionario_id));
      // só restringe quando ele de fato lidera alguém — senão o líder sem equipe cadastrada
      // abriria a tela vazia e acharia que quebrou
      if (ids.size > 1) {
        lista = lista.filter((l) => ids.has(l.funcionario_id));
        equipeDe = usr.nome || null;
      }
    }
  }
  // sugestão: o que o ponto diz, traduzido para as 4 opções que o líder tem
  const comSugestao = lista.map((l) => ({
    ...l,
    sugestao: l.ponto_situacao === 'ok' ? 'ok'
      : l.ponto_situacao === 'atraso' ? 'ok_atraso'
      : l.ponto_situacao === 'falta' ? 'falta'
      : null,
  }));

  return NextResponse.json({
    success: true,
    data,
    linhas: comSugestao,
    equipe_de: equipeDe,   // preenchido = a lista está restrita à equipe dessa pessoa
    resumo: {
      escalados: comSugestao.length,
      marcados: comSugestao.filter((l) => l.checkin_status).length,
      faltas: comSugestao.filter((l) => l.checkin_status === 'falta').length,
      pendentes: comSugestao.filter((l) => !l.checkin_status).length,
    },
  });
}

/**
 * POST -> marca o check-in. body: { funcionario_id, data, status, observacao? }
 *
 * A regra (FALTA e ATESTADO viram ocorrência no dossiê; trocar o status desfaz a ocorrência
 * anterior) mora em lib/rh/checkin.ts, porque a visão Dia da Escala da Operação grava o MESMO
 * registro em lote — duplicar a regra aqui era garantir que um dia elas divergiriam.
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const supabase = await getAdminClient();
  const r = await salvarCheckin(supabase, user, {
    funcionario_id: Number(body.funcionario_id),
    data: String(body.data || ''),
    status: String(body.status || ''),
    observacao: body.observacao ?? null,
  });
  if (!r.ok) return NextResponse.json({ success: false, error: r.erro }, { status: r.status });
  return NextResponse.json({ success: true, checkin: r.checkin });
}
