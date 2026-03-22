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
async function getCurrentWeekNumber(supabase: any, barId: number) {
  try {
    const { data: semanaAtual } = await supabase
      .from('desempenho_semanal')
      .select('numero_semana')
      .eq('bar_id', barId)
      .eq('ano', 2025)
      .lte('data_inicio::date', 'CURRENT_DATE')
      .gte('data_fim::date', 'CURRENT_DATE')
      .single();
    
    return semanaAtual?.numero_semana || 31; // fallback para semana 31
  } catch (error) {
    return 31;
  }
}

// POST - Criar semanas faltantes
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ate_semana } = body;
    
    const barIdHeader = request.headers.get('x-selected-bar-id');
    const barId = barIdHeader ? parseInt(barIdHeader, 10) : null;

    if (!barId) {
      return NextResponse.json(
        { success: false, error: 'Bar não selecionado' },
        { status: 400 }
      );
    }

    // Usar service_role para dados administrativos (bypass RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Buscar a última semana existente
    const { data: ultimaSemana, error: ultimaError } = await supabase
      .from('desempenho_semanal')
      .select('numero_semana, ano')
      .eq('bar_id', barId)
      .eq('ano', 2025)
      .order('numero_semana', { ascending: false })
      .limit(1)
      .single();

    if (ultimaError && ultimaError.code !== 'PGRST116') {
      console.error('❌ Erro ao buscar última semana:', ultimaError);
      return NextResponse.json(
        { success: false, error: 'Erro ao verificar semanas existentes' },
        { status: 500 }
      );
    }

    const ultimaSemanaCriada = ultimaSemana?.numero_semana || 0;
    const semanaFinal = 52; // CRIAR TODAS AS 52 SEMANAS DO ANO

    if (ultimaSemanaCriada >= semanaFinal) {
      return NextResponse.json({
        success: true,
        message: 'Todas as semanas do ano já estão criadas',
        data: []
      });
    }

    // Criar semanas faltantes até o final do ano
    const semanasParaCriar = [];
    
    for (let semana = ultimaSemanaCriada + 1; semana <= semanaFinal; semana++) {
      const { start, end } = getWeekDates(2025, semana);

      (semanasParaCriar as any).push({
        bar_id: barId,
        ano: 2025,
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
        meta_semanal: 200000, // Meta padrão de R$ 200.000
        atingimento: 0,
        observacoes: `Semana criada automaticamente em ${new Date().toLocaleString('pt-BR')}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Campos adicionais zerados
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
        message: 'Nenhuma semana para criar',
        data: []
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
        { success: false, error: 'Erro ao criar semanas' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${semanasInseridas?.length || 0} semana(s) criada(s) com sucesso`,
      data: semanasInseridas,
      detalhes: {
        semana_inicial: ultimaSemanaCriada + 1,
        semana_final: semanaFinal,
        total_criadas: semanasInseridas?.length || 0,
        semana_atual: await getCurrentWeekNumber(supabase, barId)
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
