import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

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
const STATUS = ['ok', 'ok_atraso', 'escala_errada', 'falta', 'atestado'] as const;
type Status = (typeof STATUS)[number];

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
 * FALTA cria ocorrência automaticamente (pedido explícito da ata). Se o líder corrigir depois para
 * outra coisa, a ocorrência criada é removida junto — senão a falta ficaria no histórico da pessoa
 * para sempre por causa de um clique errado.
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const funcionarioId = Number(body.funcionario_id);
  const data = String(body.data || '').slice(0, 10);
  const status = String(body.status || '') as Status;

  if (!funcionarioId) return NextResponse.json({ success: false, error: 'funcionario_id obrigatório' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return NextResponse.json({ success: false, error: 'data inválida' }, { status: 400 });
  if (!STATUS.includes(status)) return NextResponse.json({ success: false, error: 'status inválido' }, { status: 400 });

  const supabase = await getAdminClient();
  const hr = (t: string) => (supabase as any).schema('hr').from(t);

  const { data: pessoa } = await hr('funcionarios')
    .select('id, nome').eq('id', funcionarioId).eq('bar_id', user.bar_id).maybeSingle();
  if (!pessoa) return NextResponse.json({ success: false, error: 'Funcionário não encontrado neste bar' }, { status: 404 });

  const { data: atual } = await hr('checkin')
    .select('id, status, ocorrencia_id').eq('funcionario_id', funcionarioId).eq('data', data).maybeSingle();

  let ocorrenciaId: string | null = atual?.ocorrencia_id ?? null;

  // Falta e atestado geram ocorrência no dossiê; os outros status, não.
  const TIPO_OCORRENCIA: Partial<Record<Status, { tipo: string; descricao: string }>> = {
    falta: { tipo: 'falta', descricao: 'Falta registrada no check-in do dia' },
    atestado: { tipo: 'atestado', descricao: 'Atestado registrado no check-in do dia' },
  };
  const alvo = TIPO_OCORRENCIA[status];

  // Trocou pra um status que não gera ocorrência (ou gera OUTRA): a que ESTE check-in criou sai.
  // Sem comparar o tipo, marcar falta e depois corrigir pra atestado deixava a FALTA no histórico.
  if (atual?.ocorrencia_id && (!alvo || atual.status !== status)) {
    await hr('funcionario_ocorrencias').delete().eq('id', atual.ocorrencia_id);
    ocorrenciaId = null;
  }

  if (alvo && !ocorrenciaId) {
    const { data: oc } = await hr('funcionario_ocorrencias').insert({
      funcionario_id: funcionarioId,
      bar_id: user.bar_id,
      tipo: alvo.tipo,
      data_inicio: data,
      descricao: body.observacao || alvo.descricao,
      colaborador_nome: pessoa.nome,
      aplicado_por: user.email || 'app',
    }).select('id').single();
    ocorrenciaId = oc?.id ?? null;
  }

  const { data: reg, error } = await hr('checkin').upsert({
    bar_id: user.bar_id,
    funcionario_id: funcionarioId,
    data,
    status,
    observacao: body.observacao || null,
    ocorrencia_id: ocorrenciaId,
    registrado_por: user.email || 'app',
    atualizado_em: new Date().toISOString(),
  }, { onConflict: 'funcionario_id,data' }).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, checkin: reg });
}
