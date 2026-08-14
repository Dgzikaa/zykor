import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import {
  fimDoAviso, validaDesligamento, tipoDesligamento, resumoDesligamento,
  type FormDesligamento,
} from '@/lib/rh/desligamento';

export const dynamic = 'force-dynamic';

/**
 * Desligamento do funcionário (ata de 13/08/2026).
 *
 * Registrar aqui é diferente de só preencher data_demissao: guarda de quem partiu, se houve justa
 * causa e o tipo de aviso prévio — sem isso não dá para montar o bloco "Avisos Prévio Trabalhado"
 * da mensagem de segunda, que precisa saber quando o aviso termina.
 *
 * Enquanto o aviso está correndo a pessoa CONTINUA ativa: ela trabalha até o último dia. O cadastro
 * só é desativado quando essa data chega — por isso o `ativo` é decidido pela data, não pelo ato de
 * registrar.
 */

async function pega(request: NextRequest, id: string, escrita: boolean) {
  const user = await authenticateUser(request);
  if (!user) return { erro: authErrorResponse('Usuário não autenticado') };
  if (escrita) { const nega = negarPorRota(user, request); if (nega) return { erro: nega }; }
  if (!user.bar_id) return { erro: NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 }) };

  const supabase = await getAdminClient();
  const hr = (t: string) => (supabase as any).schema('hr').from(t);
  const { data: func } = await hr('funcionarios')
    .select('id, nome, ativo, data_admissao').eq('id', Number(id)).eq('bar_id', user.bar_id).maybeSingle();
  if (!func) return { erro: NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 }) };
  return { user, supabase, hr, func };
}

/** GET -> desligamentos registrados da pessoa (mais recente primeiro). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await pega(request, id, false);
  if (c.erro) return c.erro;
  const { hr } = c as any;

  const { data, error } = await hr('desligamentos')
    .select('*').eq('funcionario_id', Number(id)).order('data_desligamento', { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, desligamentos: data || [] });
}

/**
 * POST -> registra o desligamento.
 * body: { iniciativa, justa_causa, aviso_previo, modalidade, data_comunicacao,
 *         data_desligamento?, motivo?, observacao?, documento_id? }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await pega(request, id, true);
  if (c.erro) return c.erro;
  const { user, hr, func } = c as any;

  const body = await request.json().catch(() => ({}));
  const form: FormDesligamento = {
    iniciativa: body.iniciativa,
    justa_causa: !!body.justa_causa,
    aviso_previo: body.aviso_previo,
    modalidade: body.modalidade || null,
    data_comunicacao: String(body.data_comunicacao || '').slice(0, 10),
    data_desligamento: body.data_desligamento ? String(body.data_desligamento).slice(0, 10) : null,
  };

  const erro = validaDesligamento(form);
  if (erro) return NextResponse.json({ success: false, error: erro }, { status: 400 });

  // carta de demissão: só faz sentido quando o pedido parte do funcionário
  const documentoId = form.iniciativa === 'funcionario' ? (body.documento_id || null) : null;

  const dataDesligamento = form.data_desligamento
    || fimDoAviso(form.data_comunicacao, form.aviso_previo, form.modalidade);

  const { data: reg, error } = await hr('desligamentos').insert({
    bar_id: user.bar_id,
    funcionario_id: Number(id),
    iniciativa: form.iniciativa,
    justa_causa: form.justa_causa,
    aviso_previo: form.aviso_previo,
    modalidade: form.modalidade,
    data_comunicacao: form.data_comunicacao,
    data_desligamento: dataDesligamento,
    documento_id: documentoId,
    motivo: body.motivo || null,
    observacao: body.observacao || null,
    registrado_por: user.email || 'app',
  }).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Espelha no cadastro (é de onde o Histórico e os indicadores leem). Continua ativa enquanto o
  // aviso corre — só sai da operação quando o último dia chega.
  const hoje = new Date().toISOString().slice(0, 10);
  const jaSaiu = dataDesligamento <= hoje;
  await hr('funcionarios').update({
    data_demissao: dataDesligamento,
    tipo_desligamento: tipoDesligamento(form.iniciativa),
    motivo_desligamento: body.motivo || resumoDesligamento(form),
    ativo: !jaSaiu,
  }).eq('id', Number(id)).eq('bar_id', user.bar_id);

  // Quem já saiu libera a cadeira — é assim que a vaga aparece no organograma e no recrutamento.
  if (jaSaiu) {
    await hr('cadeira_ocupacao')
      .update({ fim: dataDesligamento, motivo_saida: 'desligamento' })
      .eq('funcionario_id', Number(id)).is('fim', null);
  }

  return NextResponse.json({
    success: true,
    desligamento: reg,
    mensagem: jaSaiu
      ? `${func.nome} foi desligado(a) em ${dataDesligamento.split('-').reverse().join('/')} e a cadeira ficou vaga.`
      : `Aviso prévio registrado — ${func.nome} trabalha até ${dataDesligamento.split('-').reverse().join('/')}.`,
  });
}

/** DELETE ?desligamento_id= -> desfaz (erro de digitação) e devolve a pessoa para a operação. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await pega(request, id, true);
  if (c.erro) return c.erro;
  const { hr } = c as any;

  const desligamentoId = new URL(request.url).searchParams.get('desligamento_id');
  if (!desligamentoId) return NextResponse.json({ success: false, error: 'desligamento_id obrigatório' }, { status: 400 });

  const { error } = await hr('desligamentos').delete().eq('id', desligamentoId).eq('funcionario_id', Number(id));
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Sobrou outro registro? Então o cadastro volta para o mais recente; senão limpa de vez.
  const { data: resto } = await hr('desligamentos')
    .select('*').eq('funcionario_id', Number(id)).order('data_desligamento', { ascending: false }).limit(1);
  const ultimo = (resto || [])[0];
  const hoje = new Date().toISOString().slice(0, 10);

  await hr('funcionarios').update(ultimo ? {
    data_demissao: ultimo.data_desligamento,
    tipo_desligamento: tipoDesligamento(ultimo.iniciativa),
    ativo: ultimo.data_desligamento > hoje,
  } : {
    data_demissao: null, tipo_desligamento: null, motivo_desligamento: null, ativo: true,
  }).eq('id', Number(id));

  return NextResponse.json({ success: true });
}
