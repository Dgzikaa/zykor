import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';const supabase = createServiceRoleClient();

function getBarIdFromRequest(request: NextRequest): number | null {
  const barIdHeader = request.headers.get('x-selected-bar-id');
  if (!barIdHeader) return null;
  return parseInt(barIdHeader, 10) || null;
}

// PUT - Atualizar dados de planejamento do evento
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // authenticateUser PRIMEIRO (antes de qualquer await, incl. params) → publica o ator
  // no auditContext pro trigger trg_audit registrar quem alterou (ex.: Meta M1).
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const { id } = await params;

  try {
    // Obter bar_id do header
    const barId = getBarIdFromRequest(request);
    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const eventoId = parseInt(id);
    if (!eventoId) {
      return NextResponse.json({ error: 'ID do evento inválido' }, { status: 400 });
    }

    // SOLUÇÃO FORÇADA - O request.json() está retornando STRING!
    let body;
    try {
      const rawBody = await request.json();
      // Se for string, fazer parse
      if (typeof rawBody === 'string') {
        body = JSON.parse(rawBody);
      } else {
        body = rawBody;
      }
    } catch (e) {
      console.error('❌ Erro no parsing:', e);
      body = {};
    }
    
    // Acessar valores diretamente
    const nome = body.nome;
    const m1_r = body.m1_r;
    const cl_plan = body.cl_plan;
    const te_plan = body.te_plan;
    const tb_plan = body.tb_plan;
    const c_artistico_plan = body.c_artistico_plan;
    const c_prod_plan = body.c_prod_plan;
    const observacoes = body.observacoes;
    const flag_urgente = body.flag_urgente;

    // Resolve a entidade editável. gold.planejamento.id ≠ eventos_base.id: eventos que
    // são só PROJEÇÃO (futuros) não têm linha no eventos_base, então o planejamento manda
    // o id do gold e o update por id dava 404 (M1 não salvava). Resolvemos/criamos por
    // (bar, data_evento). Vale pros 2 bares.
    const DIAS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const dataEvento: string | undefined = body.data_evento;

    let evento: { id: number; nome: string; versao_calculo: number | null; m1_r: number | null } | null = null;
    const { data: porId } = await supabase
      .from('eventos_base').select('id, nome, versao_calculo, m1_r')
      .eq('id', eventoId).eq('bar_id', barId).maybeSingle();
    if (porId) evento = porId as any;

    if (!evento && dataEvento) {
      const { data: porData } = await supabase
        .from('eventos_base').select('id, nome, versao_calculo, m1_r')
        .eq('bar_id', barId).eq('data_evento', dataEvento).maybeSingle();
      if (porData) evento = porData as any;
    }

    // Dados de planejamento (sempre gravados, independente da versão).
    const updateData: any = {
      nome: nome || evento?.nome || 'Evento',
      m1_r: m1_r !== undefined && m1_r !== null && !isNaN(m1_r) ? m1_r : null,
      cl_plan: cl_plan !== undefined && cl_plan !== null && !isNaN(cl_plan) ? cl_plan : null,
      te_plan: te_plan !== undefined && te_plan !== null && !isNaN(te_plan) ? te_plan : null,
      tb_plan: tb_plan !== undefined && tb_plan !== null && !isNaN(tb_plan) ? tb_plan : null,
      c_artistico_plan: c_artistico_plan !== undefined && c_artistico_plan !== null && !isNaN(c_artistico_plan) ? c_artistico_plan : null,
      c_prod_plan: c_prod_plan !== undefined && c_prod_plan !== null && !isNaN(c_prod_plan) ? c_prod_plan : null,
      observacoes: observacoes || null,
      atualizado_em: new Date().toISOString()
    };
    // flag urgente só é tocado quando o payload envia (evita zerar em saves que não sabem do campo)
    if (flag_urgente !== undefined) updateData.flag_urgente = flag_urgente === true;
    // marca origem MANUAL da Meta M1 (mostra 🔔 no Planejamento) só quando o valor muda de fato
    // pelo modal — assim o Aplicar da calculadora (que zera m1_manual) não é confundido.
    const m1Num = (m1_r !== undefined && m1_r !== null && !isNaN(m1_r)) ? Number(m1_r) : null;
    if (m1Num !== null && (!evento || Number(evento.m1_r ?? NaN) !== m1Num)) updateData.m1_manual = true;
    // Só alterar versao_calculo se não for manual (999)
    if (evento?.versao_calculo !== 999) {
      updateData.precisa_recalculo = true;
      updateData.versao_calculo = 1;
    }

    let eventoAtualizado: any = null;
    if (evento) {
      const { data, error: updateError } = await supabase
        .from('eventos_base').update(updateData)
        .eq('id', evento.id).eq('bar_id', barId).select().single();
      if (updateError) {
        console.error('❌ Erro ao atualizar evento:', updateError);
        return NextResponse.json({ error: 'Erro ao atualizar evento', details: updateError.message }, { status: 500 });
      }
      eventoAtualizado = data;
    } else {
      // Sem linha no eventos_base: o evento era só projeção do gold → materializa ao salvar.
      if (!dataEvento) {
        return NextResponse.json({ error: 'Evento não encontrado (sem data_evento p/ criar)' }, { status: 404 });
      }
      const diaSemana = DIAS_PT[new Date(`${dataEvento}T12:00:00`).getDay()];
      const { data, error: insError } = await supabase
        .from('eventos_base')
        .insert({ bar_id: barId, data_evento: dataEvento, dia_semana: diaSemana, ativo: true, ...updateData })
        .select().single();
      if (insError) {
        console.error('❌ Erro ao criar evento:', insError);
        return NextResponse.json({ error: 'Erro ao criar evento', details: insError.message }, { status: 500 });
      }
      eventoAtualizado = data;
    }

    if (!eventoAtualizado) {
      console.error('❌ Nenhum evento foi atualizado');
      return NextResponse.json({ error: 'Nenhum evento foi atualizado' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      data: eventoAtualizado,
      message: 'Planejamento atualizado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro na API PUT eventos planejamento:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

// GET - Buscar evento específico por ID
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const barId = getBarIdFromRequest(request);
    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const { id } = await params;
    const eventoId = parseInt(id);
    if (!eventoId) {
      return NextResponse.json({ error: 'ID do evento inválido' }, { status: 400 });
    }

    // Buscar evento por ID
    const { data: evento, error } = await supabase
      .from('eventos_base')
      .select('*')
      .eq('id', eventoId)
      .eq('bar_id', barId)
      .single();

    if (error) {
      console.error('❌ Erro ao buscar evento:', error);
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: evento });

  } catch (error) {
    console.error('❌ Erro na API GET evento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}