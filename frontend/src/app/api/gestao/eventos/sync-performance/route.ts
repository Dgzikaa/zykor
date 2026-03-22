import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Inicializar cliente Supabase
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Erro ao conectar com banco' },
        { status: 500 }
      );
    }

    const {
      data_evento,
      bar_id,
      forcar_atualizacao = false,
    } = await request.json();

    if (!data_evento || !bar_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Data do evento e bar_id são obrigatórios',
        },
        { status: 400 }
      );
    }

    // Verificar se existe evento para esta data
    const { data: evento, error: eventoError } = await supabase
      .from('eventos_base')
      .select('*')
      .eq('bar_id', bar_id)
      .eq('data_evento', data_evento)
      .single();

    if (eventoError || !evento) {
      return NextResponse.json(
        {
          success: false,
          error: 'Nenhum evento encontrado para esta data',
        },
        { status: 404 }
      );
    }

    // Verificar se já tem dados de performance atualizados
    if (
      evento.publico_real &&
      evento.faturamento_liquido &&
      !forcar_atualizacao
    ) {
      return NextResponse.json({
        success: true,
        message: 'Evento já possui dados de performance atualizados',
        data: evento,
        ja_sincronizado: true,
      });
    }

    // Buscar dados de vendas do dia
    const [periodoResponse, pagamentosResponse, symplaResponse] =
      await Promise.all([
        // 1. Dados de pessoas da tabela período
        supabase
          .from('periodo')
          .select('pessoas, vr_produtos, vr_couvert, vr_pagamentos')
          .eq('bar_id', bar_id)
          .eq('dt_gerencial', data_evento),

        // 2. Faturamento da tabela pagamentos
        supabase
          .from('pagamentos')
          .select('liquido, vr_couvert, meio')
          .eq('bar_id', bar_id)
          .eq('dt_gerencial', data_evento),

        // 3. Dados Sympla (ingressos)
        supabase
          .from('sympla_bilheteria')
          .select('total_liquido, qtd_checkins_realizados')
          .eq('bar_id', bar_id)
          .eq('data_evento', data_evento),
      ]);

    const periodoData = periodoResponse.data || [];
    const pagamentosData = pagamentosResponse.data || [];
    const symplaData = symplaResponse.data || [];

    // Calcular totais
    let publico_real = 0;
    let faturamento_liquido = 0;
    let receita_couvert = 0;
    let receita_ingressos = 0;
    let receita_bar = 0;

    // 1. Público real - somar pessoas da tabela período
    publico_real = periodoData.reduce((sum: number, item: any) => {
      return sum + parseInt(item.pessoas || '0');
    }, 0);

    // 2. Faturamento líquido - somar pagamentos
    faturamento_liquido = pagamentosData.reduce(
      (sum: number, item: any) => {
        return sum + parseFloat(item.liquido || '0');
      },
      0
    );

    // 3. Receita de couvert - tanto de período quanto pagamentos
    receita_couvert = periodoData.reduce((sum: number, item: any) => {
      return sum + parseFloat(item.vr_couvert || '0');
    }, 0);

    const couvertPagamentos = pagamentosData.reduce(
      (sum: number, item: any) => {
        return sum + parseFloat(item.vr_couvert || '0');
      },
      0
    );

    receita_couvert = Math.max(receita_couvert, couvertPagamentos);

    // 4. Receita de ingressos - Sympla
    receita_ingressos = symplaData.reduce((sum: number, item: any) => {
      return sum + parseFloat(item.total_liquido || '0');
    }, 0);

    // 5. Receita do bar - produtos
    receita_bar = periodoData.reduce((sum: number, item: any) => {
      return sum + parseFloat(item.vr_produtos || '0');
    }, 0);

    // Se não temos público da tabela período, tentar usar checkins do Sympla
    if (publico_real === 0 && symplaData.length > 0) {
      publico_real = symplaData.reduce((sum: number, item: any) => {
        return sum + parseInt(item.qtd_checkins_realizados || '0');
      }, 0);
    }

    // Calcular métricas derivadas
    const ticket_medio =
      publico_real > 0 ? faturamento_liquido / publico_real : null;
    const taxa_ocupacao =
      evento.capacidade_estimada && publico_real > 0
        ? (publico_real / evento.capacidade_estimada) * 100
        : null;

    // Atualizar o evento com os dados de performance
    const { data: eventoAtualizado, error: updateError } = await supabase
      .from('eventos_base')
      .update({
        publico_real,
        receita_total: faturamento_liquido, // Usar campo existente
        updated_at: new Date().toISOString(),
      })
      .eq('bar_id', bar_id)
      .eq('data_evento', data_evento)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar evento:', updateError);
      return NextResponse.json(
        {
          success: false,
          error: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Dados sincronizados com sucesso',
      data: eventoAtualizado,
      metricas_calculadas: {
        publico_real,
        faturamento_liquido,
        receita_couvert,
        receita_ingressos,
        receita_bar,
        ticket_medio,
        taxa_ocupacao,
      },
      fontes_dados: {
        periodo: periodoData.length,
        pagamentos: pagamentosData.length,
        sympla: symplaData.length,
      },
    });
  } catch (error) {
    console.error('❌ Erro:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        details: error,
      },
      { status: 500 }
    );
  }
}
