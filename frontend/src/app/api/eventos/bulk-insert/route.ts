import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface EventoInsert {
  data_evento: string;
  nome: string;
  dia_semana: string;
  m1_r: number;
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();
    const { eventos } = body as { eventos: EventoInsert[] };

    if (!eventos || !Array.isArray(eventos)) {
      return NextResponse.json({ error: 'Eventos inválidos' }, { status: 400 });
    }

    // Inserir eventos em lote
    const eventosParaInserir = eventos.map(evento => ({
      bar_id: user.bar_id,
      data_evento: evento.data_evento,
      nome: evento.nome,
      dia_semana: evento.dia_semana,
      m1_r: evento.m1_r,
      ativo: true,
      precisa_recalculo: false,
      versao_calculo: 1
    }));

    const { data, error } = await supabase
      .from('eventos_base')
      .upsert(eventosParaInserir, {
        onConflict: 'bar_id,data_evento,nome',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('❌ Erro ao inserir eventos:', error);
      return NextResponse.json({ error: 'Erro ao inserir eventos', details: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${eventos.length} eventos inseridos/atualizados com sucesso`,
      data
    });

  } catch (error) {
    console.error('❌ Erro na API:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
