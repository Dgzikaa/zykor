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

const STATUS = ['ok', 'ok_atraso', 'escala_errada', 'falta'] as const;
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

  const lista = (linhas || []) as any[];
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

  // deixou de ser falta -> a ocorrência que ESTE check-in criou vai junto
  if (atual?.ocorrencia_id && status !== 'falta') {
    await hr('funcionario_ocorrencias').delete().eq('id', atual.ocorrencia_id);
    ocorrenciaId = null;
  }

  // virou falta e ainda não tinha ocorrência
  if (status === 'falta' && !ocorrenciaId) {
    const { data: oc } = await hr('funcionario_ocorrencias').insert({
      funcionario_id: funcionarioId,
      bar_id: user.bar_id,
      tipo: 'falta',
      data_inicio: data,
      descricao: body.observacao || 'Falta registrada no check-in do dia',
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
