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

function getISOWeekAndYear(dateStr: string): { semana: number; ano: number } {
  const date = new Date(dateStr + 'T12:00:00Z');
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const ano = d.getUTCFullYear();
  return { semana, ano };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const barId = getBarIdFromRequest(request);
    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const eventoId = parseInt(id);
    if (!eventoId) {
      return NextResponse.json({ error: 'ID do evento inválido' }, { status: 400 });
    }

    let body;
    try {
      const rawBody = await request.json();
      if (typeof rawBody === 'string') {
        body = JSON.parse(rawBody);
      } else {
        body = rawBody;
      }
    } catch (e) {
      console.error('❌ Erro no parsing:', e);
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
    }

    const { data: evento, error: eventoError } = await supabase
      .from('eventos_base')
      .select('id, nome, bar_id, data_evento')
      .eq('id', eventoId)
      .eq('bar_id', barId)
      .single();

    if (eventoError || !evento) {
      console.error('❌ Evento não encontrado:', eventoError);
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    const updateData: Record<string, any> = {
      atualizado_em: new Date().toISOString()
    };

    if (body.res_tot !== undefined) {
      updateData.res_tot = parseInt(body.res_tot) || 0;
    }
    if (body.res_p !== undefined) {
      updateData.res_p = parseInt(body.res_p) || 0;
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

    // Atualizar desempenho_semanal com o novo total de reservas da semana
    const { semana, ano } = getISOWeekAndYear(evento.data_evento);

    // Buscar soma de reservas de todos os eventos da semana
    const { data: desempenhoSemana } = await supabase
      .from('desempenho_semanal')
      .select('id, data_inicio, data_fim')
      .eq('bar_id', evento.bar_id)
      .eq('ano', ano)
      .eq('numero_semana', semana)
      .single();

    if (desempenhoSemana) {
      // Somar todas as reservas dos eventos dessa semana
      const { data: eventosNaSemana } = await supabase
        .from('eventos_base')
        .select('res_tot, res_p')
        .eq('bar_id', evento.bar_id)
        .gte('data_evento', desempenhoSemana.data_inicio)
        .lte('data_evento', desempenhoSemana.data_fim);

      const reservasTotais = (eventosNaSemana || []).reduce((sum, e) => sum + (parseInt(e.res_tot) || 0), 0);
      const reservasPresentes = (eventosNaSemana || []).reduce((sum, e) => sum + (parseInt(e.res_p) || 0), 0);

      const { error: updateDesempenhoError } = await supabase
        .from('desempenho_semanal')
        .update({
          reservas_totais: reservasTotais,
          reservas_presentes: reservasPresentes,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', desempenhoSemana.id);

      if (updateDesempenhoError) {
        console.error('⚠️ Erro ao atualizar desempenho_semanal:', updateDesempenhoError);
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: eventoAtualizado,
      message: 'Reservas atualizadas com sucesso',
      desempenho_atualizado: !!desempenhoSemana
    });

  } catch (error) {
    console.error('❌ Erro na API update reservas:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
