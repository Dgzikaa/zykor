import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Recalcular todos os CMVs com fórmula correta
export async function POST(request: NextRequest) {
  try {
    const { bar_id } = await request.json();

    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar todos os CMVs do bar
    const { data: cmvs, error: fetchError } = await supabase
      .from('cmv_semanal')
      .select('*')
      .eq('bar_id', bar_id)
      .order('ano', { ascending: true })
      .order('semana', { ascending: true });

    if (fetchError) {
      console.error('Erro ao buscar CMVs:', fetchError);
      return NextResponse.json(
        { error: 'Erro ao buscar CMVs' },
        { status: 500 }
      );
    }

    if (!cmvs || cmvs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum CMV encontrado para recalcular',
        recalculados: 0
      });
    }

    const recalculados: any[] = [];
    const erros: any[] = [];

    // Recalcular cada CMV
    for (const cmv of cmvs) {
      try {
        // 1. Calcular estoques totais
        const estoqueInicial = (cmv.estoque_inicial_cozinha || 0) + 
                               (cmv.estoque_inicial_bebidas || 0) + 
                               (cmv.estoque_inicial_drinks || 0);
        
        const estoqueFinal = (cmv.estoque_final_cozinha || 0) + 
                             (cmv.estoque_final_bebidas || 0) + 
                             (cmv.estoque_final_drinks || 0);

        // 2. Calcular compras totais
        const comprasPeriodo = (cmv.compras_custo_comida || 0) + 
                               (cmv.compras_custo_bebidas || 0) + 
                               (cmv.compras_custo_outros || 0) + 
                               (cmv.compras_custo_drinks || 0);

        // 3. Calcular consumos totais
        const totalConsumos = (cmv.consumo_socios || 0) + 
                              (cmv.consumo_beneficios || 0) + 
                              (cmv.consumo_adm || 0) + 
                              (cmv.consumo_rh || 0) + 
                              (cmv.consumo_artista || 0) + 
                              (cmv.outros_ajustes || 0);

        // 4. Calcular CMV Real com fórmula CORRETA
        // CMV Real = (Estoque Inicial + Compras - Estoque Final) - Consumos + Bonificações
        const cmvBruto = estoqueInicial + comprasPeriodo - estoqueFinal;
        const cmvReal = cmvBruto - totalConsumos + (cmv.ajuste_bonificacoes || 0);

        // 5. Calcular CMV %
        const fatBruto = cmv.vendas_brutas || cmv.faturamento_bruto || 0;
        const cmvPercentual = fatBruto > 0 ? (cmvReal / fatBruto) * 100 : 0;

        // 6. Calcular CMV Limpo %
        const fatCmvivel = cmv.faturamento_cmvivel || 0;
        const cmvLimpoPercentual = fatCmvivel > 0 ? (cmvReal / fatCmvivel) * 100 : 0;

        // 7. Calcular GAP
        const gap = cmvLimpoPercentual - (cmv.cmv_teorico_percentual || 0);

        // Atualizar no banco (cmv_percentual é GENERATED ALWAYS, não pode ser atualizado)
        const { error: updateError } = await supabase
          .from('cmv_semanal')
          .update({
            estoque_inicial: estoqueInicial,
            estoque_final: estoqueFinal,
            compras_periodo: comprasPeriodo,
            cmv_real: cmvReal,
            cmv_limpo_percentual: cmvLimpoPercentual,
            gap: gap,
            updated_at: new Date().toISOString()
          })
          .eq('id', cmv.id);

        if (updateError) {
          console.error(`Erro ao atualizar CMV ${cmv.id}:`, updateError);
          erros.push({
            id: cmv.id,
            semana: `${cmv.ano}-S${cmv.semana}`,
            erro: updateError.message
          });
        } else {
          recalculados.push({
            id: cmv.id,
            semana: `${cmv.ano}-S${cmv.semana}`,
            cmv_antigo: cmv.cmv_real,
            cmv_novo: cmvReal,
            diferenca: cmvReal - (cmv.cmv_real || 0)
          });
        }
      } catch (error: any) {
        console.error(`Erro ao processar CMV ${cmv.id}:`, error);
        erros.push({
          id: cmv.id,
          semana: `${cmv.ano}-S${cmv.semana}`,
          erro: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Recálculo concluído: ${recalculados.length} CMVs atualizados, ${erros.length} erros`,
      total_cmvs: cmvs.length,
      recalculados: recalculados.length,
      erros: erros.length,
      detalhes: {
        recalculados: recalculados.slice(0, 10), // Primeiros 10 para não sobrecarregar resposta
        erros: erros
      }
    });

  } catch (error: any) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    );
  }
}
