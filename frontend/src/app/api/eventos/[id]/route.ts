import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function getBarIdFromRequest(request: NextRequest): number | null {
  const barIdHeader = request.headers.get('x-selected-bar-id');
  if (!barIdHeader) return null;
  return parseInt(barIdHeader, 10) || null;
}

// PUT - Atualizar dados de planejamento do evento
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const observacoes = body.observacoes;

    // Verificar se o evento existe e pertence ao bar do usuário
    const { data: evento, error: eventoError } = await supabase
      .from('eventos_base')
      .select('id, nome, bar_id')
      .eq('id', eventoId)
      .eq('bar_id', barId)
      .single();

    if (eventoError || !evento) {
      console.error('❌ Evento não encontrado:', eventoError);
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    // Verificar se o evento já tem versão manual (999)
    const { data: eventoAtual } = await supabase
      .from('eventos_base')
      .select('versao_calculo')
      .eq('id', eventoId)
      .single();

    // Atualizar os dados de planejamento na tabela eventos_base
    // SEMPRE salvar os dados de planejamento, independente da versão
    // Usar valores diretos das variáveis
    const updateData: any = {
      nome: nome || evento.nome,
      m1_r: m1_r !== undefined && m1_r !== null && !isNaN(m1_r) ? m1_r : null,
      cl_plan: cl_plan !== undefined && cl_plan !== null && !isNaN(cl_plan) ? cl_plan : null,
      te_plan: te_plan !== undefined && te_plan !== null && !isNaN(te_plan) ? te_plan : null,
      tb_plan: tb_plan !== undefined && tb_plan !== null && !isNaN(tb_plan) ? tb_plan : null,
      c_artistico_plan: c_artistico_plan !== undefined && c_artistico_plan !== null && !isNaN(c_artistico_plan) ? c_artistico_plan : null,
      observacoes: observacoes || null,
      atualizado_em: new Date().toISOString()
    };

    // Só alterar versao_calculo se não for manual (999)
    if (eventoAtual?.versao_calculo !== 999) {
      updateData.precisa_recalculo = true;
      updateData.versao_calculo = 1;
    }

    const { data: eventoAtualizado, error: updateError } = await supabase
      .from('eventos_base')
      .update(updateData)
      .eq('id', eventoId)
      .eq('bar_id', barId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar evento:', updateError);
      return NextResponse.json({ 
        error: 'Erro ao atualizar evento',
        details: updateError.message 
      }, { status: 500 });
    }

    if (!eventoAtualizado) {
      console.error('❌ Nenhum evento foi atualizado - possível problema de permissão');
      return NextResponse.json({ 
        error: 'Nenhum evento foi atualizado',
        details: 'Verifique se o evento existe e pertence ao usuário' 
      }, { status: 404 });
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