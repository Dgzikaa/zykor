import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const body = await request.json();
    const { evento_id, publico_estimado, metodo_estimativa } = body;

    if (!evento_id) {
      return NextResponse.json({ error: 'evento_id é obrigatório' }, { status: 400 });
    }

    // Buscar evento
    const { data: evento, error: erroBusca } = await supabase
      .from('eventos_base')
      .select('*')
      .eq('id', evento_id)
      .single();

    if (erroBusca || !evento) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    let publicoFinal = publico_estimado;

    // Se não foi fornecido público, estimar baseado no faturamento
    if (!publico_estimado && evento.real_r) {
      // MÉTODO 1: Baseado em ticket médio histórico
      const { data: ticketMedio } = await supabase
        .from('eventos_base')
        .select('real_r, cl_real')
        .eq('bar_id', evento.bar_id)
        .not('cl_real', 'is', null)
        .gt('cl_real', 0)
        .not('real_r', 'is', null)
        .gt('real_r', 0);

      if (ticketMedio && ticketMedio.length > 0) {
        const tickets = ticketMedio.map((e: any) => e.real_r / e.cl_real);
        const ticketMedioBar = tickets.reduce((a, b) => a + b, 0) / tickets.length;
        publicoFinal = Math.round(evento.real_r / ticketMedioBar);
      } else {
        // MÉTODO 2: Usar ticket médio padrão de R$ 80
        publicoFinal = Math.round(evento.real_r / 80);
      }
    }

    // Atualizar evento
    const { data: atualizado, error: erroUpdate } = await supabase
      .from('eventos_base')
      .update({
        cl_real: publicoFinal,
        observacoes: `${evento.observacoes || ''}\n[AUDITORIA] Público estimado via ${metodo_estimativa || 'ticket médio histórico'} em ${new Date().toLocaleDateString('pt-BR')}`
      })
      .eq('id', evento_id)
      .select()
      .single();

    if (erroUpdate) {
      return NextResponse.json({ error: erroUpdate.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      evento_original: evento,
      evento_corrigido: atualizado,
      mudanca: {
        publico_antes: evento.cl_real,
        publico_depois: publicoFinal,
        metodo: metodo_estimativa || 'ticket médio histórico'
      }
    });

  } catch (error: any) {
    console.error('Erro ao corrigir público:', error);
    return NextResponse.json(
      { error: 'Erro ao corrigir público', details: error.message },
      { status: 500 }
    );
  }
}
