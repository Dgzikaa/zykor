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
    
    // Obter bar_id do header x-selected-bar-id
    const barIdHeader = request.headers.get('x-selected-bar-id');
    const barId = barIdHeader ? parseInt(barIdHeader, 10) : null;
    
    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
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

    // Buscar todas as semanas em paralelo de gold.desempenho
    const promises = semanasParaBuscar.map(async ({ semana, ano: anoSemana }) => {
      const desempenhoResult = await (supabase as any)
        .schema('gold')
        .from('desempenho')
        .select('*')
        .eq('bar_id', barId)
        .eq('granularidade', 'semanal')
        .eq('numero_semana', semana)
        .eq('ano', anoSemana)
        .maybeSingle();

      if (desempenhoResult.error && desempenhoResult.error.code !== 'PGRST116') {
        console.error(`Erro ao buscar semana ${semana}/${anoSemana}:`, desempenhoResult.error);
      }

      const dadosSemana = desempenhoResult.data || null;

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
