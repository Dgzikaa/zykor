import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
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

    const supabase = createServiceRoleClient();
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
      precisa_recalculo: true,
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

    // Projeta custo artístico/produção (média 4 ocorrências do mesmo dia da semana ×
    // M1) já no cadastro, pros eventos novos nascerem em amarelo/⚠️ sem esperar o
    // cron. Best-effort: se falhar, o cron projetar_custos_pre_lancado é o backup.
    let projetados: number | null = null;
    try {
      const datas = eventos.map(e => e.data_evento).filter(Boolean).sort();
      if (datas.length > 0) {
        const { data: proj, error: projError } = await supabase.rpc('projetar_custos_pre_lancado', {
          p_bar_id: user.bar_id,
          p_data_inicio: datas[0],
          p_data_fim: datas[datas.length - 1]
        });
        if (projError) console.error('⚠️ Projeção de custos falhou (cron cobre):', projError.message);
        else projetados = proj as number;
      }
    } catch (projErr) {
      console.error('⚠️ Projeção de custos falhou (cron cobre):', projErr);
    }

    return NextResponse.json({
      success: true,
      message: `${eventos.length} eventos inseridos/atualizados com sucesso`,
      projetados,
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
