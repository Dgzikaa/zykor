import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

// Função para obter as datas de início e fim de uma semana do ano
function getWeekDates(year: number, weekNumber: number) {
  // Janeiro 1 do ano
  const firstDayOfYear = new Date(year, 0, 1);
  
  // Encontrar a primeira segunda-feira do ano
  const firstMonday = new Date(firstDayOfYear);
  const dayOfWeek = firstDayOfYear.getDay();
  const daysToAdd = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // Se domingo, próxima segunda; senão, próxima segunda
  firstMonday.setDate(firstDayOfYear.getDate() + daysToAdd);
  
  // Calcular a data de início da semana desejada
  const startDate = new Date(firstMonday);
  startDate.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
  
  // Data de fim (domingo)
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0]
  };
}

// Função para obter o número da semana atual via banco (mais preciso)
async function getCurrentWeekNumber(supabase: any, barId: number, ano: number) {
  try {
    const { data: semanaAtual } = await supabase
      .from('desempenho_semanal')
      .select('numero_semana')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .lte('data_inicio::date', 'CURRENT_DATE')
      .gte('data_fim::date', 'CURRENT_DATE')
      .single();
    
    return semanaAtual?.numero_semana || 1;
  } catch (error) {
    return 1;
  }
}

// POST - Criar semanas faltantes
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ano: anoParam } = body;
    
    const barIdHeader = request.headers.get('x-selected-bar-id');
    const barId = barIdHeader ? parseInt(barIdHeader, 10) : null;

    if (!barId) {
      return NextResponse.json(
        { success: false, error: 'Bar não selecionado' },
        { status: 400 }
      );
    }

    // Usar ano passado no body ou o ano atual
    const ano = anoParam || new Date().getFullYear();

    // Usar service_role para dados administrativos (bypass RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Buscar semanas já existentes para este ano
    const { data: semanasExistentes, error: existentesError } = await supabase
      .from('desempenho_semanal')
      .select('numero_semana')
      .eq('bar_id', barId)
      .eq('ano', ano);

    if (existentesError) {
      console.error('❌ Erro ao buscar semanas existentes:', existentesError);
      return NextResponse.json(
        { success: false, error: 'Erro ao verificar semanas existentes' },
        { status: 500 }
      );
    }

    const semanasJaCriadas = new Set((semanasExistentes || []).map(s => s.numero_semana));
    const semanaFinal = 52;

    // Criar semanas faltantes (1 a 52)
    const semanasParaCriar = [];
    
    for (let semana = 1; semana <= semanaFinal; semana++) {
      if (semanasJaCriadas.has(semana)) continue; // Pular semanas já existentes
      
      const { start, end } = getWeekDates(ano, semana);

      semanasParaCriar.push({
        bar_id: barId,
        ano: ano,
        numero_semana: semana,
        data_inicio: start,
        data_fim: end,
        faturamento_total: 0,
        faturamento_entrada: 0,
        faturamento_bar: 0,
        faturamento_cmovivel: 0,
        clientes_atendidos: 0,
        reservas_totais: 0,
        reservas_presentes: 0,
        ticket_medio: 0,
        cmv_teorico: 0,
        cmv_limpo: 0,
        meta_semanal: 0, // Será preenchido pelo planejamento comercial
        atingimento: 0,
        observacoes: `Semana criada automaticamente em ${new Date().toLocaleString('pt-BR')}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tm_entrada: 0,
        tm_bar: 0,
        cmv_global_real: 0,
        cmo: 0,
        custo_atracao_faturamento: 0,
        qui_sab_dom: null,
        avaliacoes_5_google_trip: 0,
        media_avaliacoes_google: 0,
        nota_felicidade_equipe: 0,
        imposto: 0,
        comissao: 0,
        cmv: 0,
        cmo_custo: 0,
        pro_labore: 0,
        cmv_rs: 0
      });
    }

    if (semanasParaCriar.length === 0) {
      return NextResponse.json({
        success: true,
        message: `Todas as 52 semanas de ${ano} já estão criadas`,
        data: [],
        detalhes: {
          ano,
          semanas_existentes: semanasJaCriadas.size,
        }
      });
    }

    // Inserir as semanas no banco
    const { data: semanasInseridas, error: insertError } = await supabase
      .from('desempenho_semanal')
      .insert(semanasParaCriar)
      .select();

    if (insertError) {
      console.error('❌ Erro ao inserir semanas:', insertError);
      return NextResponse.json(
        { success: false, error: 'Erro ao criar semanas: ' + insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${semanasInseridas?.length || 0} semana(s) de ${ano} criada(s) com sucesso`,
      data: semanasInseridas,
      detalhes: {
        ano,
        semanas_criadas: semanasInseridas?.length || 0,
        semanas_ja_existiam: semanasJaCriadas.size,
        semana_atual: await getCurrentWeekNumber(supabase, barId, ano)
      }
    });

  } catch (error) {
    console.error('❌ Erro ao criar semanas:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
