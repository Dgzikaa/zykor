import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Endpoint para investigar em detalhes o problema do mix da semana 12
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    
    const barId = 3; // Deboche
    const semana = 12;
    const ano = 2026;
    const dataInicio = '2026-03-16';
    const dataFim = '2026-03-22';

    console.log('🔍 Investigando mix semana 12...');

    // 1. Dados da semana no desempenho_semanal
    const { data: semanaData } = await supabase
      .from('desempenho_semanal')
      .select('*')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .eq('numero_semana', semana)
      .single();

    // 2. Eventos da semana
    const { data: eventos } = await supabase
      .from('eventos_base')
      .select('id, data_evento, nome, real_r, percent_b, percent_d, percent_c, calculado_em, versao_calculo')
      .eq('bar_id', barId)
      .gte('data_evento', dataInicio)
      .lte('data_evento', dataFim)
      .eq('ativo', true)
      .order('data_evento', { ascending: true });

    const eventosData = (eventos || []) as any[];

    // 3. Calcular mix ponderado manualmente
    const diasComFaturamento = eventosData.filter(e => (e.real_r || 0) > 0);
    const faturamentoTotal = diasComFaturamento.reduce((acc, e) => acc + (parseFloat(String(e.real_r)) || 0), 0);
    
    const somaPercentBPonderado = diasComFaturamento.reduce((acc, e) => {
      const fat = parseFloat(String(e.real_r)) || 0;
      const perc = parseFloat(String(e.percent_b)) || 0;
      return acc + (perc * fat);
    }, 0);
    
    const mixManual = {
      perc_bebidas: faturamentoTotal > 0 ? somaPercentBPonderado / faturamentoTotal : 0,
    };

    // 4. Chamar RPC
    const { data: mixRPC } = await supabase
      .rpc('calcular_mix_vendas', {
        p_bar_id: barId,
        p_data_inicio: dataInicio,
        p_data_fim: dataFim
      });

    // 5. Verificar vendas_item (fonte do RPC)
    const { data: vendasItem } = await supabase
      .from('vendas_item')
      .select('data_venda, valor, local_desc')
      .eq('bar_id', barId)
      .gte('data_venda', dataInicio)
      .lte('data_venda', dataFim)
      .gt('valor', 0);

    // 6. Buscar mapeamento de locais
    const { data: mapeamento } = await supabase
      .from('bar_local_mapeamento')
      .select('*')
      .eq('bar_id', barId)
      .single();

    // 7. Calcular mix direto do vendas_item (igual ao RPC deveria fazer)
    let totalVendasItem = 0;
    let bebidasVendasItem = 0;
    let drinksVendasItem = 0;
    let comidasVendasItem = 0;
    let outrosVendasItem = 0;

    const locaisBebidas = mapeamento?.bebidas || [];
    const locaisDrinks = mapeamento?.drinks || [];
    const locaisComidas = mapeamento?.comidas || [];

    (vendasItem || []).forEach((item: any) => {
      const valor = item.valor || 0;
      const local = item.local_desc || '';
      totalVendasItem += valor;

      if (locaisBebidas.includes(local)) {
        bebidasVendasItem += valor;
      } else if (locaisDrinks.includes(local)) {
        drinksVendasItem += valor;
      } else if (locaisComidas.includes(local)) {
        comidasVendasItem += valor;
      } else {
        outrosVendasItem += valor;
      }
    });

    // Bebidas inclui "outros"
    const mixVendasItem = {
      perc_bebidas: totalVendasItem > 0 ? ((bebidasVendasItem + outrosVendasItem) / totalVendasItem) * 100 : 0,
      perc_drinks: totalVendasItem > 0 ? (drinksVendasItem / totalVendasItem) * 100 : 0,
      perc_comida: totalVendasItem > 0 ? (comidasVendasItem / totalVendasItem) * 100 : 0,
    };

    // 8. Agrupar vendas_item por data
    const vendasPorData = (vendasItem || []).reduce((acc: any, item: any) => {
      const data = item.data_venda;
      if (!acc[data]) {
        acc[data] = { total: 0, bebidas: 0, drinks: 0, comidas: 0, outros: 0, registros: 0 };
      }
      const valor = item.valor || 0;
      const local = item.local_desc || '';
      acc[data].total += valor;
      acc[data].registros += 1;

      if (locaisBebidas.includes(local)) {
        acc[data].bebidas += valor;
      } else if (locaisDrinks.includes(local)) {
        acc[data].drinks += valor;
      } else if (locaisComidas.includes(local)) {
        acc[data].comidas += valor;
      } else {
        acc[data].outros += valor;
      }

      return acc;
    }, {});

    const vendasPorDataArray = Object.entries(vendasPorData).map(([data, valores]: [string, any]) => ({
      data,
      ...valores,
      perc_bebidas: valores.total > 0 ? ((valores.bebidas + valores.outros) / valores.total) * 100 : 0,
      perc_drinks: valores.total > 0 ? (valores.drinks / valores.total) * 100 : 0,
      perc_comida: valores.total > 0 ? (valores.comidas / valores.total) * 100 : 0,
    })).sort((a, b) => a.data.localeCompare(b.data));

    return NextResponse.json({
      success: true,
      resumo: {
        semana: semana,
        ano: ano,
        periodo: `${dataInicio} até ${dataFim}`,
        problema: 'Mix no banco (69.48%) diferente do calculado manualmente (67.88%)',
        diferenca_bebidas: '1.60%',
      },
      mix_banco: {
        perc_bebidas: semanaData?.perc_bebidas,
        perc_drinks: semanaData?.perc_drinks,
        perc_comida: semanaData?.perc_comida,
      },
      mix_manual_eventos: mixManual,
      mix_rpc: mixRPC && mixRPC.length > 0 ? mixRPC[0] : null,
      mix_vendas_item: mixVendasItem,
      eventos: eventosData,
      vendas_item_por_data: vendasPorDataArray,
      totais: {
        faturamento_eventos: faturamentoTotal,
        faturamento_vendas_item: totalVendasItem,
        diferenca: Math.abs(faturamentoTotal - totalVendasItem),
      },
      mapeamento_locais: {
        bebidas: locaisBebidas,
        drinks: locaisDrinks,
        comidas: locaisComidas,
      },
      diagnostico: {
        fonte_rpc: 'vendas_item (ContaHub)',
        fonte_eventos: 'eventos_base.percent_b/d/c',
        hipotese_1: 'RPC usa vendas_item direto, eventos usam percent_b/d/c que podem estar desatualizados',
        hipotese_2: 'Algum evento teve seus percentuais calculados com dados antigos',
        hipotese_3: 'Há diferença entre faturamento total dos eventos vs vendas_item',
      }
    });

  } catch (error) {
    console.error('Erro na investigação:', error);
    return NextResponse.json(
      { error: 'Erro interno', details: String(error) },
      { status: 500 }
    );
  }
}
