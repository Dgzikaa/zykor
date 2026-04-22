import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    
    // Obter parâmetros
    const { searchParams } = new URL(request.url);
    const semana = parseInt(searchParams.get('semana') || '1');
    const ano = parseInt(searchParams.get('ano') || new Date().getFullYear().toString());
    
    // Obter bar_id do header x-selected-bar-id
    const barIdHeader = request.headers.get('x-selected-bar-id');
    const barId = barIdHeader ? parseInt(barIdHeader, 10) : null;
    
    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    // Buscar dados da semana atual de gold.desempenho (já inclui marketing)
    const desempenhoResult = await (supabase as any)
      .schema('gold')
      .from('desempenho')
      .select('*')
      .eq('bar_id', barId)
      .eq('granularidade', 'semanal')
      .eq('numero_semana', semana)
      .eq('ano', ano)
      .maybeSingle();

    if (desempenhoResult.error && desempenhoResult.error.code !== 'PGRST116') {
      console.error('Erro ao buscar semana:', desempenhoResult.error);
    }

    const dadosSemana = desempenhoResult.data || null;

    // Calcular semana anterior
    let semanaAnterior = semana - 1;
    let anoAnterior = ano;
    if (semanaAnterior < 1) {
      semanaAnterior = 53;
      anoAnterior = ano - 1;
    }

    // Buscar dados da semana anterior de gold.desempenho
    const desempenhoAnteriorResult = await (supabase as any)
      .schema('gold')
      .from('desempenho')
      .select('*')
      .eq('bar_id', barId)
      .eq('granularidade', 'semanal')
      .eq('numero_semana', semanaAnterior)
      .eq('ano', anoAnterior)
      .maybeSingle();

    if (desempenhoAnteriorResult.error && desempenhoAnteriorResult.error.code !== 'PGRST116') {
      console.error('Erro ao buscar semana anterior:', desempenhoAnteriorResult.error);
    }

    const dadosSemanaAnterior = desempenhoAnteriorResult.data || null;

    // Contar total de semanas com dados
    const { count } = await (supabase as any)
      .schema('gold')
      .from('desempenho')
      .select('*', { count: 'exact', head: true })
      .eq('bar_id', barId)
      .eq('granularidade', 'semanal')
      .eq('ano', ano);

    return NextResponse.json({
      success: true,
      semana: dadosSemana || null,
      semanaAnterior: dadosSemanaAnterior || null,
      totalSemanas: count || 53,
      parametros: {
        semana,
        ano,
        barId
      }
    });

  } catch (error) {
    console.error('Erro na API de desempenho semanal:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
