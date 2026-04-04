import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint para investigar e recalcular mix de vendas de uma semana específica
 * 
 * Query params:
 * - semana: número da semana (ex: 12)
 * - ano: ano (ex: 2026)
 * - recalcular: se true, recalcula e atualiza o banco
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    
    const { searchParams } = new URL(request.url);
    const semana = parseInt(searchParams.get('semana') || '12');
    const ano = parseInt(searchParams.get('ano') || '2026');
    const recalcular = searchParams.get('recalcular') === 'true';
    
    const barIdHeader = request.headers.get('x-selected-bar-id');
    const barId = barIdHeader ? parseInt(barIdHeader, 10) : null;
    
    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    // 1. Buscar dados da semana no desempenho_semanal
    const { data: semanaData, error: semanaError } = await supabase
      .from('desempenho_semanal')
      .select('*')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .eq('numero_semana', semana)
      .single();

    if (semanaError) {
      return NextResponse.json({ 
        error: 'Erro ao buscar dados da semana', 
        details: semanaError 
      }, { status: 500 });
    }

    if (!semanaData) {
      return NextResponse.json({ 
        error: `Semana ${semana}/${ano} não encontrada` 
      }, { status: 404 });
    }

    const dataInicio = semanaData.data_inicio;
    const dataFim = semanaData.data_fim;

    console.log(`🔍 Debug Mix Vendas - Semana ${semana}/${ano} (${dataInicio} até ${dataFim})`);
    console.log(`📊 Mix atual no banco: Bebidas=${semanaData.perc_bebidas}%, Drinks=${semanaData.perc_drinks}%, Comida=${semanaData.perc_comida}%`);

    // 2. Buscar eventos da semana
    const { data: eventos, error: eventosError } = await supabase
      .from('eventos_base')
      .select('id, data_evento, nome, real_r, m1_r, percent_b, percent_d, percent_c')
      .eq('bar_id', barId)
      .gte('data_evento', dataInicio)
      .lte('data_evento', dataFim)
      .eq('ativo', true)
      .order('data_evento', { ascending: true });

    if (eventosError) {
      return NextResponse.json({ 
        error: 'Erro ao buscar eventos', 
        details: eventosError 
      }, { status: 500 });
    }

    const eventosData = (eventos || []) as any[];

    // 3. Calcular mix ponderado manualmente (igual ao código)
    const diasComFaturamento = eventosData.filter(e => (e.real_r || 0) > 0);
    
    const somaPercentBPonderado = diasComFaturamento.reduce((acc, e) => {
      const fat = parseFloat(String(e.real_r)) || 0;
      const perc = parseFloat(String(e.percent_b)) || 0;
      return acc + (perc * fat);
    }, 0);
    
    const somaPercentDPonderado = diasComFaturamento.reduce((acc, e) => {
      const fat = parseFloat(String(e.real_r)) || 0;
      const perc = parseFloat(String(e.percent_d)) || 0;
      return acc + (perc * fat);
    }, 0);
    
    const somaPercentCPonderado = diasComFaturamento.reduce((acc, e) => {
      const fat = parseFloat(String(e.real_r)) || 0;
      const perc = parseFloat(String(e.percent_c)) || 0;
      return acc + (perc * fat);
    }, 0);

    const faturamentoTotal = diasComFaturamento.reduce((acc, e) => acc + (parseFloat(String(e.real_r)) || 0), 0);

    const mixCalculadoManual = {
      perc_bebidas: faturamentoTotal > 0 ? somaPercentBPonderado / faturamentoTotal : 0,
      perc_drinks: faturamentoTotal > 0 ? somaPercentDPonderado / faturamentoTotal : 0,
      perc_comida: faturamentoTotal > 0 ? somaPercentCPonderado / faturamentoTotal : 0,
    };

    // 4. Chamar a stored procedure calcular_mix_vendas
    const { data: mixRPC, error: mixError } = await supabase
      .rpc('calcular_mix_vendas', {
        p_bar_id: barId,
        p_data_inicio: dataInicio,
        p_data_fim: dataFim
      });

    if (mixError) {
      console.error('Erro ao chamar calcular_mix_vendas:', mixError);
    }

    const mixRPCResult = mixRPC && mixRPC.length > 0 ? {
      perc_bebidas: parseFloat(mixRPC[0].perc_bebidas) || 0,
      perc_drinks: parseFloat(mixRPC[0].perc_drinks) || 0,
      perc_comidas: parseFloat(mixRPC[0].perc_comidas) || 0,
      perc_happy_hour: parseFloat(mixRPC[0].perc_happy_hour) || 0,
    } : null;

    // 5. Se recalcular=true, atualizar o banco
    let updateResult: any = null;
    if (recalcular && mixRPCResult) {
      const { data: updated, error: updateError } = await supabase
        .from('desempenho_semanal')
        .update({
          perc_bebidas: mixRPCResult.perc_bebidas,
          perc_drinks: mixRPCResult.perc_drinks,
          perc_comida: mixRPCResult.perc_comidas,
          perc_happy_hour: mixRPCResult.perc_happy_hour,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', semanaData.id)
        .select();

      if (updateError) {
        return NextResponse.json({ 
          error: 'Erro ao atualizar mix', 
          details: updateError 
        }, { status: 500 });
      }

      updateResult = updated;
    }

    return NextResponse.json({
      success: true,
      semana: {
        numero: semana,
        ano: ano,
        data_inicio: dataInicio,
        data_fim: dataFim,
      },
      mix_atual_banco: {
        perc_bebidas: semanaData.perc_bebidas,
        perc_drinks: semanaData.perc_drinks,
        perc_comida: semanaData.perc_comida,
        perc_happy_hour: semanaData.perc_happy_hour,
      },
      mix_calculado_manual: mixCalculadoManual,
      mix_rpc: mixRPCResult,
      eventos: eventosData.map(e => ({
        id: e.id,
        data: e.data_evento,
        nome: e.nome,
        faturamento: e.real_r,
        m1_receita: e.m1_r,
        percent_b: e.percent_b,
        percent_d: e.percent_d,
        percent_c: e.percent_c,
        contribuicao_bebidas: (e.real_r || 0) * (e.percent_b || 0),
        contribuicao_drinks: (e.real_r || 0) * (e.percent_d || 0),
        contribuicao_comida: (e.real_r || 0) * (e.percent_c || 0),
      })),
      faturamento_total: faturamentoTotal,
      recalculado: recalcular,
      update_result: updateResult,
      diagnostico: {
        diferenca_manual_vs_banco: {
          bebidas: Math.abs(mixCalculadoManual.perc_bebidas - (semanaData.perc_bebidas || 0)),
          drinks: Math.abs(mixCalculadoManual.perc_drinks - (semanaData.perc_drinks || 0)),
          comida: Math.abs(mixCalculadoManual.perc_comida - (semanaData.perc_comida || 0)),
        },
        diferenca_rpc_vs_banco: mixRPCResult ? {
          bebidas: Math.abs(mixRPCResult.perc_bebidas - (semanaData.perc_bebidas || 0)),
          drinks: Math.abs(mixRPCResult.perc_drinks - (semanaData.perc_drinks || 0)),
          comida: Math.abs(mixRPCResult.perc_comidas - (semanaData.perc_comida || 0)),
        } : null,
        diferenca_manual_vs_rpc: mixRPCResult ? {
          bebidas: Math.abs(mixCalculadoManual.perc_bebidas - mixRPCResult.perc_bebidas),
          drinks: Math.abs(mixCalculadoManual.perc_drinks - mixRPCResult.perc_drinks),
          comida: Math.abs(mixCalculadoManual.perc_comida - mixRPCResult.perc_comidas),
        } : null,
      }
    });

  } catch (error) {
    console.error('Erro no debug de mix:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    );
  }
}
