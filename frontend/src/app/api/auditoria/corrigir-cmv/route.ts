import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const body = await request.json();
    const { cmv_id, acao } = body;

    if (!cmv_id) {
      return NextResponse.json({ error: 'cmv_id é obrigatório' }, { status: 400 });
    }

    // Buscar dados do CMV problemático
    const { data: cmv, error: erroBusca } = await supabase
      .from('cmv_semanal')
      .select('*')
      .eq('id', cmv_id)
      .single();

    if (erroBusca || !cmv) {
      return NextResponse.json({ error: 'CMV não encontrado' }, { status: 404 });
    }

    let resultado: any = { cmv_original: cmv };

    // AÇÃO 1: Recalcular CMV baseado nos dados existentes
    if (acao === 'recalcular') {
      const faturamento = cmv.faturamento_liquido || 0;
      const consumo = cmv.consumo_total || 0;
      
      if (faturamento > 0) {
        const cmvCorrigido = (consumo / faturamento) * 100;
        
        const { data: atualizado, error: erroUpdate } = await supabase
          .from('cmv_semanal')
          .update({ 
            cmv_percentual: cmvCorrigido,
            updated_at: new Date().toISOString()
          })
          .eq('id', cmv_id)
          .select()
          .single();

        if (erroUpdate) {
          return NextResponse.json({ error: erroUpdate.message }, { status: 500 });
        }

        resultado.cmv_corrigido = atualizado;
        resultado.acao = 'recalculado';
        resultado.mudanca = {
          antes: cmv.cmv_percentual,
          depois: cmvCorrigido,
          diferenca: cmvCorrigido - cmv.cmv_percentual
        };
      }
    }

    // AÇÃO 2: Marcar como "revisar manualmente"
    if (acao === 'marcar_revisao') {
      const { data: atualizado, error: erroUpdate } = await supabase
        .from('cmv_semanal')
        .update({ 
          observacoes: `[AUDITORIA] CMV impossível (${cmv.cmv_percentual}%) - Requer revisão manual`,
          updated_at: new Date().toISOString()
        })
        .eq('id', cmv_id)
        .select()
        .single();

      if (erroUpdate) {
        return NextResponse.json({ error: erroUpdate.message }, { status: 500 });
      }

      resultado.cmv_corrigido = atualizado;
      resultado.acao = 'marcado_para_revisao';
    }

    // AÇÃO 3: Investigar componentes do CMV
    if (acao === 'investigar') {
      resultado.investigacao = {
        faturamento_liquido: cmv.faturamento_liquido,
        consumo_total: cmv.consumo_total,
        estoque_inicial: cmv.estoque_inicial_total,
        compras_periodo: cmv.compras_total,
        estoque_final: cmv.estoque_final_total,
        bonificacoes: cmv.bonificacoes_total,
        cma: cmv.cma_total,
        formula: 'CMV% = (Consumo Total / Faturamento Líquido) × 100',
        consumo_calculado: (cmv.estoque_inicial_total || 0) + (cmv.compras_total || 0) - (cmv.estoque_final_total || 0),
        problema_identificado: null
      };

      // Identificar problema
      if (cmv.faturamento_liquido === 0 || cmv.faturamento_liquido === null) {
        resultado.investigacao.problema_identificado = 'Faturamento zerado ou nulo';
      } else if (cmv.consumo_total > cmv.faturamento_liquido * 2) {
        resultado.investigacao.problema_identificado = 'Consumo muito alto (>200% do faturamento)';
      } else if (cmv.consumo_total < 0) {
        resultado.investigacao.problema_identificado = 'Consumo negativo';
      }
    }

    return NextResponse.json({
      success: true,
      resultado
    });

  } catch (error: any) {
    console.error('Erro ao corrigir CMV:', error);
    return NextResponse.json(
      { error: 'Erro ao corrigir CMV', details: error.message },
      { status: 500 }
    );
  }
}
