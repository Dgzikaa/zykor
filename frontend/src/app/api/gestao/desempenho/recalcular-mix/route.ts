import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Recalcula o mix de vendas de uma semana específica usando média ponderada dos eventos
 * 
 * Query params:
 * - semana: número da semana
 * - ano: ano
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    
    const { searchParams } = new URL(request.url);
    const semana = parseInt(searchParams.get('semana') || '0');
    const ano = parseInt(searchParams.get('ano') || '0');
    
    const barIdHeader = request.headers.get('x-selected-bar-id');
    const barId = barIdHeader ? parseInt(barIdHeader, 10) : null;
    
    if (!barId || !semana || !ano) {
      return NextResponse.json({ 
        error: 'Parâmetros obrigatórios: bar_id (header), semana, ano' 
      }, { status: 400 });
    }

    console.log(`🔄 Recalculando mix da semana ${semana}/${ano} para bar ${barId}`);

    // 1. Buscar dados da semana
    const { data: semanaData, error: semanaError } = await supabase
      .from('desempenho_semanal')
      .select('id, data_inicio, data_fim, perc_bebidas, perc_drinks, perc_comida')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .eq('numero_semana', semana)
      .single();

    if (semanaError || !semanaData) {
      return NextResponse.json({ 
        error: 'Semana não encontrada',
        details: semanaError 
      }, { status: 404 });
    }

    const dataInicio = semanaData.data_inicio;
    const dataFim = semanaData.data_fim;

    console.log(`📅 Período: ${dataInicio} até ${dataFim}`);
    console.log(`📊 Mix atual: B=${semanaData.perc_bebidas}% D=${semanaData.perc_drinks}% C=${semanaData.perc_comida}%`);

    // 2. Buscar eventos da semana
    const { data: eventos, error: eventosError } = await supabase
      .from('eventos_base')
      .select('id, data_evento, nome, real_r, faturamento_bar, percent_b, percent_d, percent_c, percent_happy_hour')
      .eq('bar_id', barId)
      .gte('data_evento', dataInicio)
      .lte('data_evento', dataFim)
      .eq('ativo', true);

    if (eventosError) {
      return NextResponse.json({ 
        error: 'Erro ao buscar eventos',
        details: eventosError 
      }, { status: 500 });
    }

    const eventosData = (eventos || []) as any[];
    const diasComFaturamento = eventosData.filter(e => (e.faturamento_bar || 0) > 0);

    if (diasComFaturamento.length === 0) {
      return NextResponse.json({ 
        error: 'Nenhum evento com faturamento encontrado' 
      }, { status: 400 });
    }

    // 3. Calcular mix ponderado usando faturamento_bar (só produtos, sem couvert)
    // Isso garante que o mix seja calculado sobre a mesma base que a planilha (contahub_analitico)
    const faturamentoTotal = diasComFaturamento.reduce((acc, e) => {
      return acc + (parseFloat(String(e.faturamento_bar)) || 0);
    }, 0);

    const somaBebidasPonderado = diasComFaturamento.reduce((acc, e) => {
      const fat = parseFloat(String(e.faturamento_bar)) || 0;
      const perc = parseFloat(String(e.percent_b)) || 0;
      return acc + (perc * fat);
    }, 0);

    const somaDrinksPonderado = diasComFaturamento.reduce((acc, e) => {
      const fat = parseFloat(String(e.faturamento_bar)) || 0;
      const perc = parseFloat(String(e.percent_d)) || 0;
      return acc + (perc * fat);
    }, 0);

    const somaComidaPonderado = diasComFaturamento.reduce((acc, e) => {
      const fat = parseFloat(String(e.faturamento_bar)) || 0;
      const perc = parseFloat(String(e.percent_c)) || 0;
      return acc + (perc * fat);
    }, 0);

    const somaHappyHourPonderado = diasComFaturamento.reduce((acc, e) => {
      const fat = parseFloat(String(e.faturamento_bar)) || 0;
      const perc = parseFloat(String(e.percent_happy_hour)) || 0;
      return acc + (perc * fat);
    }, 0);

    const mixNovo = {
      perc_bebidas: faturamentoTotal > 0 ? somaBebidasPonderado / faturamentoTotal : 0,
      perc_drinks: faturamentoTotal > 0 ? somaDrinksPonderado / faturamentoTotal : 0,
      perc_comida: faturamentoTotal > 0 ? somaComidaPonderado / faturamentoTotal : 0,
      perc_happy_hour: faturamentoTotal > 0 ? somaHappyHourPonderado / faturamentoTotal : 0,
    };

    console.log(`🧮 Mix calculado: B=${mixNovo.perc_bebidas.toFixed(2)}% D=${mixNovo.perc_drinks.toFixed(2)}% C=${mixNovo.perc_comida.toFixed(2)}%`);

    // 4. Atualizar banco
    const { data: updated, error: updateError } = await supabase
      .from('desempenho_semanal')
      .update({
        perc_bebidas: mixNovo.perc_bebidas,
        perc_drinks: mixNovo.perc_drinks,
        perc_comida: mixNovo.perc_comida,
        perc_happy_hour: mixNovo.perc_happy_hour,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', semanaData.id)
      .select();

    if (updateError) {
      return NextResponse.json({ 
        error: 'Erro ao atualizar banco',
        details: updateError 
      }, { status: 500 });
    }

    console.log(`✅ Mix atualizado com sucesso!`);

    return NextResponse.json({
      success: true,
      semana: {
        numero: semana,
        ano: ano,
        periodo: `${dataInicio} até ${dataFim}`,
      },
      mix_anterior: {
        perc_bebidas: semanaData.perc_bebidas,
        perc_drinks: semanaData.perc_drinks,
        perc_comida: semanaData.perc_comida,
      },
      mix_novo: mixNovo,
      diferencas: {
        bebidas: Math.abs((mixNovo.perc_bebidas || 0) - (semanaData.perc_bebidas || 0)),
        drinks: Math.abs((mixNovo.perc_drinks || 0) - (semanaData.perc_drinks || 0)),
        comida: Math.abs((mixNovo.perc_comida || 0) - (semanaData.perc_comida || 0)),
      },
      eventos_analisados: diasComFaturamento.length,
      faturamento_total: faturamentoTotal,
      atualizado: true,
    });

  } catch (error) {
    console.error('Erro ao recalcular mix:', error);
    return NextResponse.json(
      { error: 'Erro interno', details: String(error) },
      { status: 500 }
    );
  }
}
