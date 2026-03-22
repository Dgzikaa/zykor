import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/umbler/campanhas
 * Lista campanhas de disparo em massa
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id') || '3';
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('umbler_campanhas')
      .select('*', { count: 'exact' })
      .eq('bar_id', parseInt(barId))
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar campanhas:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      campanhas: data || [],
      total: count || 0,
      limit,
      offset
    });

  } catch (error) {
    console.error('Erro na API Umbler Campanhas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/umbler/campanhas
 * Cria e executa uma campanha de disparo em massa
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bar_id,
      nome,
      tipo,
      template_mensagem,
      template_name,
      variaveis,
      destinatarios, // Array de { telefone, nome, cliente_id }
      segmento_criterios,
      executar_agora = true,
      agendado_para,
      criado_por_email
    } = body;

    if (!bar_id || !nome || !template_mensagem || !destinatarios || destinatarios.length === 0) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: bar_id, nome, template_mensagem, destinatarios' },
        { status: 400 }
      );
    }

    // Verificar se Umbler está configurado
    const { data: config, error: configError } = await supabase
      .from('umbler_config')
      .select('channel_id')
      .eq('bar_id', parseInt(bar_id))
      .eq('ativo', true)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { error: 'Umbler não configurado para este bar' },
        { status: 400 }
      );
    }

    // Criar campanha
    const { data: campanha, error: campanhaError } = await supabase
      .from('umbler_campanhas')
      .insert({
        bar_id: parseInt(bar_id),
        channel_id: config.channel_id,
        nome,
        tipo: tipo || 'marketing',
        template_mensagem,
        template_name,
        variaveis: variaveis || {},
        segmento_criterios,
        total_destinatarios: destinatarios.length,
        status: executar_agora ? 'em_execucao' : (agendado_para ? 'agendada' : 'rascunho'),
        agendado_para,
        criado_por_email
      })
      .select()
      .single();

    if (campanhaError) {
      console.error('Erro ao criar campanha:', campanhaError);
      return NextResponse.json({ error: campanhaError.message }, { status: 500 });
    }

    // Criar destinatários
    const destinatariosData = destinatarios.map((d: { telefone: string; nome?: string; cliente_id?: number }) => ({
      campanha_id: campanha.id,
      telefone: normalizePhone(d.telefone),
      nome: d.nome,
      cliente_id: d.cliente_id,
      status: 'pendente'
    }));

    const { error: destError } = await supabase
      .from('umbler_campanha_destinatarios')
      .insert(destinatariosData);

    if (destError) {
      console.error('Erro ao criar destinatários:', destError);
    }

    // Se executar agora, disparar envio
    if (executar_agora) {
      // Chamar API de envio em background
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/umbler/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: parseInt(bar_id),
          mode: 'bulk',
          campanha_id: campanha.id,
          destinatarios,
          template_mensagem,
          variaveis,
          delay_ms: 1000
        })
      }).catch(err => {
        console.error('Erro ao iniciar disparo:', err);
      });
    }

    return NextResponse.json({
      success: true,
      campanha,
      total_destinatarios: destinatarios.length
    });

  } catch (error) {
    console.error('Erro na API Umbler Campanhas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/umbler/campanhas
 * Cancela uma campanha
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const campanhaId = searchParams.get('id');

    if (!campanhaId) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const { error } = await supabase
      .from('umbler_campanhas')
      .update({ status: 'cancelada' })
      .eq('id', campanhaId);

    if (error) {
      console.error('Erro ao cancelar campanha:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Erro na API Umbler Campanhas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function normalizePhone(phone: string): string {
  if (!phone) return '';
  let normalized = phone.replace(/\D/g, '');
  if (normalized.length === 11) {
    normalized = '55' + normalized;
  } else if (normalized.length === 10) {
    normalized = '55' + normalized;
  }
  return normalized;
}
