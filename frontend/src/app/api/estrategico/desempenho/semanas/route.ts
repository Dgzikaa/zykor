import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    
    // Obter parâmetros
    const { searchParams } = new URL(request.url);
    const quantidade = parseInt(searchParams.get('quantidade') || '6');
    const ateSemana = parseInt(searchParams.get('ate_semana') || '0');
    const ano = parseInt(searchParams.get('ano') || new Date().getFullYear().toString());
    
    // Obter bar_id do header
    const userDataHeader = request.headers.get('x-user-data');
    let barId = 3; // Default
    
    if (userDataHeader) {
      try {
        const userData = JSON.parse(decodeURIComponent(userDataHeader));
        if (userData.bar_id) barId = userData.bar_id;
      } catch (e) {
        console.warn('Erro ao parsear user data:', e);
      }
    }

    // Se não especificou semana, calcular semana atual (ISO)
    let semanaFinal = ateSemana;
    let anoFinal = ano;
    
    if (semanaFinal === 0) {
      const hoje = new Date();
      const d = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      semanaFinal = Math.ceil((((d.getTime() - inicioAno.getTime()) / 86400000) + 1) / 7);
      anoFinal = d.getUTCFullYear();
    }

    // Função para calcular quantas semanas ISO um ano tem
    const getISOWeeksInYear = (year: number): number => {
      const jan1 = new Date(Date.UTC(year, 0, 1));
      const jan1Weekday = jan1.getUTCDay(); // 0=domingo, 4=quinta
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
      if (jan1Weekday === 4 || (isLeap && jan1Weekday === 3)) {
        return 53;
      }
      return 52;
    };

    // Calcular as semanas a buscar (da mais antiga para a mais recente)
    const semanasParaBuscar: { semana: number; ano: number }[] = [];
    let semanaAtual = semanaFinal;
    let anoAtualCalc = anoFinal;
    
    for (let i = 0; i < quantidade; i++) {
      semanasParaBuscar.unshift({ semana: semanaAtual, ano: anoAtualCalc });
      
      // Voltar uma semana
      semanaAtual--;
      if (semanaAtual < 1) {
        // Usar o número correto de semanas do ano anterior
        anoAtualCalc--;
        semanaAtual = getISOWeeksInYear(anoAtualCalc);
      }
    }
    
    console.log(`[Semanas API] Bar ${barId}: Buscando ${quantidade} semanas até S${semanaFinal}/${anoFinal}:`, 
      semanasParaBuscar.map(s => `S${s.semana}/${s.ano}`).join(', '));

    // Buscar todas as semanas em paralelo
    const promises = semanasParaBuscar.map(async ({ semana, ano: anoSemana }) => {
      const [desempenhoResult, marketingResult] = await Promise.all([
        supabase
          .from('desempenho_semanal')
          .select('*')
          .eq('bar_id', barId)
          .eq('numero_semana', semana)
          .eq('ano', anoSemana)
          .single(),
        supabase
          .from('marketing_semanal')
          .select('*')
          .eq('bar_id', barId)
          .eq('semana', semana)
          .eq('ano', anoSemana)
          .single()
      ]);

      if (desempenhoResult.error && desempenhoResult.error.code !== 'PGRST116') {
        console.error(`Erro ao buscar semana ${semana}/${anoSemana}:`, desempenhoResult.error);
      }

      // Mesclar dados de desempenho com marketing
      const dadosSemana = desempenhoResult.data ? {
        ...desempenhoResult.data,
        ...(marketingResult.data ? {
          o_num_posts: marketingResult.data.o_num_posts,
          o_alcance: marketingResult.data.o_alcance,
          o_interacao: marketingResult.data.o_interacao,
          o_compartilhamento: marketingResult.data.o_compartilhamento,
          o_engajamento: marketingResult.data.o_engajamento,
          o_num_stories: marketingResult.data.o_num_stories,
          o_visu_stories: marketingResult.data.o_visu_stories,
          m_valor_investido: marketingResult.data.m_valor_investido,
          m_alcance: marketingResult.data.m_alcance,
          m_frequencia: marketingResult.data.m_frequencia,
          m_cpm: marketingResult.data.m_cpm,
          m_cliques: marketingResult.data.m_cliques,
          m_ctr: marketingResult.data.m_ctr,
          m_custo_por_clique: marketingResult.data.m_cpc,
          m_conversas_iniciadas: marketingResult.data.m_conversas_iniciadas,
          g_valor_investido: marketingResult.data.g_valor_investido,
          g_impressoes: marketingResult.data.g_impressoes,
          g_cliques: marketingResult.data.g_cliques,
          g_ctr: marketingResult.data.g_ctr,
          g_solicitacoes_rotas: marketingResult.data.g_solicitacoes_rotas,
          gmn_total_acoes: marketingResult.data.gmn_total_acoes,
          gmn_total_visualizacoes: marketingResult.data.gmn_total_visualizacoes,
          gmn_solicitacoes_rotas: marketingResult.data.gmn_solicitacoes_rotas,
        } : {})
      } : null;

      return {
        semana,
        ano: anoSemana,
        dados: dadosSemana
      };
    });

    const resultados = await Promise.all(promises);

    return NextResponse.json({
      success: true,
      semanas: resultados,
      parametros: {
        quantidade,
        ateSemana: semanaFinal,
        ano: anoFinal,
        barId
      }
    });

  } catch (error) {
    console.error('Erro na API de múltiplas semanas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
