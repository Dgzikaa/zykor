import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';



interface ReceitaInsumo {
  id: number;
  receita_id: number;
  insumo_id: number;
  quantidade_necessaria: number;
  unidade_medida: string;
}

interface Receita {
  id: number;
  receita_codigo: string;
  receita_nome: string;
  rendimento_esperado: number;
}

interface Insumo {
  id: number;
  codigo: string;
  nome: string;
  custo_unitario: number;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { receita_id, insumo_id } = await req.json();

    console.log('🔄 Atualizando fichas técnicas...', {
      receita_id,
      insumo_id,
    });

    let receitasParaAtualizar: number[] = [];

    // Se receita_id foi especificado, atualizar apenas essa receita
    if (receita_id) {
      receitasParaAtualizar = [receita_id];
    }
    // Se insumo_id foi especificado, buscar todas as receitas que usam esse insumo
    else if (insumo_id) {
      const { data: receitasComInsumo, error: errorReceitas } = await supabase
        .from('receitas_insumos')
        .select('receita_id')
        .eq('insumo_id', insumo_id);

      if (errorReceitas) {
        throw new Error(`Erro ao buscar receitas: ${errorReceitas.message}`);
      }

      receitasParaAtualizar = [
        ...new Set(
          receitasComInsumo?.map((r: any) => r.receita_id) || []
        ),
      ];
    }
    // Se nenhum ID foi especificado, atualizar todas as receitas ativas
    else {
      const { data: receitas, error: errorReceitas } = await supabase
        .from('receitas')
        .select('id')
        .eq('ativo', true);

      if (errorReceitas) {
        throw new Error(`Erro ao buscar receitas: ${errorReceitas.message}`);
      }

      receitasParaAtualizar = receitas?.map((r: any) => r.id) || [];
    }

    console.log(
      `📋 Total de receitas para atualizar: ${receitasParaAtualizar.length}`
    );

    let sucessos = 0;
    let erros = 0;
    const detalhes = [];

    // Processar cada receita
    for (const receitaId of receitasParaAtualizar) {
      try {
        // Buscar dados da receita
        const { data: receita, error: errorReceita } = await supabase
          .from('receitas')
          .select('id, receita_codigo, receita_nome, rendimento_esperado')
          .eq('id', receitaId)
          .single();

        if (errorReceita || !receita) {
          console.error(
            `❌ Erro ao buscar receita ${receitaId}:`,
            errorReceita
          );
          erros++;
          continue;
        }

        // Buscar todos os insumos da receita
        const { data: insumosReceita, error: errorInsumos } = await supabase
          .from('receitas_insumos')
          .select(
            `
            id,
            receita_id,
            insumo_id,
            quantidade_necessaria,
            unidade_medida,
            is_chefe,
            insumos (
              id,
              codigo,
              nome,
              custo_unitario,
              unidade_medida
            )
          `
          )
          .eq('receita_id', receitaId);

        if (errorInsumos) {
          console.error(
            `❌ Erro ao buscar insumos da receita ${receitaId}:`,
            errorInsumos
          );
          erros++;
          continue;
        }

        if (!insumosReceita || insumosReceita.length === 0) {
          console.log(`⚠️ Receita ${receitaId} sem insumos cadastrados`);
          continue;
        }

        // Calcular custo total e peso total
        let custoTotal = 0;
        let pesoTotal = 0;

        for (const item of insumosReceita) {
          const insumo = item.insumos as any;
          const qtd = item.quantidade_necessaria;
          const custoUnitario = insumo.custo_unitario || 0;

          // Calcular custo (considerando unidade de medida)
          const custoItem = (qtd / 1000) * custoUnitario; // Assumindo custo por kg
          custoTotal += custoItem;

          // Somar peso (assumindo que quantidade está em gramas)
          pesoTotal += qtd;
        }

        // Calcular custo por porção (se houver rendimento esperado)
        const rendimentoEsperado = receita.rendimento_esperado || pesoTotal;
        const custoPorGrama = pesoTotal > 0 ? custoTotal / pesoTotal : 0;

        // Registrar histórico de alteração
        const { error: errorHistorico } = await supabase
          .from('receitas_historico')
          .insert({
            receita_id: receitaId,
            receita_codigo: receita.receita_codigo,
            receita_nome: receita.receita_nome,
            tipo_alteracao: 'atualizacao_automatica',
            campo_alterado: 'gramatura_e_custo',
            valor_anterior: null,
            valor_novo: JSON.stringify({
              custo_total: custoTotal,
              peso_total: pesoTotal,
              rendimento_esperado: rendimentoEsperado,
              custo_por_grama: custoPorGrama,
            }),
            realizado_por: 'Sistema - Atualização Automática',
            motivo: 'Recálculo automático de gramatura e custos',
          });

        if (errorHistorico) {
          console.error(`⚠️ Erro ao registrar histórico:`, errorHistorico);
        }

        sucessos++;
        detalhes.push({
          receita_id: receitaId,
          receita_nome: receita.receita_nome,
          custo_total: custoTotal.toFixed(2),
          peso_total: pesoTotal,
          rendimento_esperado: rendimentoEsperado,
          custo_por_grama: custoPorGrama.toFixed(4),
          insumos_count: insumosReceita.length,
        });

        console.log(
          `✅ Receita ${receita.receita_nome} atualizada - Custo: R$ ${custoTotal.toFixed(2)} | Peso: ${pesoTotal}g`
        );
      } catch (error) {
        console.error(`❌ Erro ao processar receita ${receitaId}:`, error);
        erros++;
      }
    }

    console.log(
      `📊 Atualização concluída - Sucessos: ${sucessos} | Erros: ${erros}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Fichas técnicas atualizadas com sucesso',
        total_receitas: receitasParaAtualizar.length,
        sucessos,
        erros,
        detalhes: detalhes.slice(0, 10), // Retornar apenas os primeiros 10 para não sobrecarregar
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Erro na função:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

