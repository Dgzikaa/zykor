import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * API para buscar dados automáticos para CMA (Custo de Alimentação de Funcionários)
 * 
 * Busca:
 * 1. Estoque Inicial de insumos de funcionários (HORTIFRUTI (F), MERCADO (F), PROTEÍNA (F))
 * 2. Compras de Alimentação (categoria "Alimentação" do NIBO)
 * 3. Estoque Final de insumos de funcionários
 * 
 * Fórmula: CMA = Estoque Inicial + Compras - Estoque Final
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, data_inicio, data_fim, criterio_data } = body;
    const usarDataCriacao = criterio_data === 'criacao';

    if (!bar_id || !data_inicio || !data_fim) {
      return NextResponse.json(
        { error: 'Dados inválidos: bar_id, data_inicio e data_fim são obrigatórios' },
        { status: 400 }
      );
    }

    console.log(`🍽️ Buscando dados CMA (Alimentação Funcionários) - Bar ${bar_id} de ${data_inicio} até ${data_fim}`);

    const resultado = {
      estoque_inicial_funcionarios: 0,
      compras_alimentacao: 0,
      estoque_final_funcionarios: 0,
      cma_total: 0,
    };

    // Categorias de insumos de funcionários
    const categoriasFuncionarios = ['HORTIFRUTI (F)', 'MERCADO (F)', 'PROTEÍNA (F)'];

    // 1. BUSCAR ESTOQUE INICIAL (contagem da segunda-feira = data_inicio)
    try {
      const dataContagem = data_inicio;
      console.log(`📅 Estoque Inicial Funcionários: Buscando contagem de ${dataContagem}`);

      // Buscar insumos de funcionários
      const { data: insumos } = await supabase
        .from('insumos')
        .select('id, tipo_local, categoria')
        .eq('bar_id', bar_id)
        .in('categoria', categoriasFuncionarios);

      if (insumos && insumos.length > 0) {
        const insumosMap = new Map(insumos.map((i: any) => [i.id, i]));

        // Buscar contagens com custo_unitario
        const { data: contagensIniciais } = await supabase
          .from('contagem_estoque_insumos')
          .select('insumo_id, estoque_final, custo_unitario')
          .eq('bar_id', bar_id)
          .eq('data_contagem', dataContagem);

        if (contagensIniciais && contagensIniciais.length > 0) {
          contagensIniciais.forEach((contagem: any) => {
            const insumo = insumosMap.get(contagem.insumo_id);
            if (!insumo) return;

            const valor = contagem.estoque_final * (contagem.custo_unitario || 0);
            resultado.estoque_inicial_funcionarios += valor;
          });

          console.log(`✅ Estoque Inicial Funcionários: R$ ${resultado.estoque_inicial_funcionarios.toFixed(2)}`);
        } else {
          console.log(`⚠️ Nenhuma contagem de funcionários encontrada para ${dataContagem}`);
        }
      } else {
        console.log(`⚠️ Nenhum insumo de funcionário cadastrado`);
      }
    } catch (err) {
      console.error('Erro ao buscar estoque inicial de funcionários:', err);
    }

    // 2. BUSCAR COMPRAS DE ALIMENTAÇÃO (categoria "Alimentação" do NIBO)
    try {
      const dataInicioFull = data_inicio + (usarDataCriacao ? 'T00:00:00' : '');
      const dataFimFull = data_fim + (usarDataCriacao ? 'T23:59:59' : '');
      console.log(`📅 Compras Alimentação: critério=${usarDataCriacao ? 'criação (criado_em)' : 'competência (data_competencia)'}`);

      const queryBuilder = supabase
        .from('nibo_agendamentos')
        .select('categoria_nome, valor')
        .eq('bar_id', bar_id)
        .eq('tipo', 'Debit');

      const { data: comprasAlimentacao, error: errorCompras } = usarDataCriacao
        ? await queryBuilder.gte('criado_em', dataInicioFull).lte('criado_em', dataFimFull)
        : await queryBuilder.gte('data_competencia', data_inicio).lte('data_competencia', data_fim);

      if (!errorCompras && comprasAlimentacao) {
        // Filtrar apenas categoria "Alimentação" (case-insensitive)
        resultado.compras_alimentacao = comprasAlimentacao
          .filter(item => {
            const cat = (item.categoria_nome || '').toLowerCase();
            return cat === 'alimentação' || cat === 'alimentacao';
          })
          .reduce((sum, item) => sum + Math.abs(parseFloat(item.valor) || 0), 0);

        console.log(`✅ Compras Alimentação: R$ ${resultado.compras_alimentacao.toFixed(2)}`);
      }
    } catch (err) {
      console.error('Erro ao buscar compras de alimentação:', err);
    }

    // 3. BUSCAR ESTOQUE FINAL (contagem da próxima segunda-feira)
    try {
      // Calcular a segunda-feira seguinte ao fim do período
      const dataFimDate = new Date(data_fim + 'T12:00:00Z');
      const diaSemana = dataFimDate.getUTCDay();
      
      let diasParaSegunda = 1;
      if (diaSemana === 0) {
        diasParaSegunda = 1;
      } else if (diaSemana === 6) {
        diasParaSegunda = 2;
      } else {
        diasParaSegunda = (8 - diaSemana) % 7;
        if (diasParaSegunda === 0) diasParaSegunda = 7;
      }
      
      dataFimDate.setUTCDate(dataFimDate.getUTCDate() + diasParaSegunda);
      const dataSegundaFinal = dataFimDate.toISOString().split('T')[0];
      
      console.log(`📅 Estoque Final Funcionários: Buscando contagem de ${dataSegundaFinal}`);
      
      let dataContagemFinal: string | null = null;
      
      // Tentar buscar contagem exata da segunda-feira
      const { data: contagemExata } = await supabase
        .from('contagem_estoque_insumos')
        .select('data_contagem, estoque_final')
        .eq('bar_id', bar_id)
        .eq('data_contagem', dataSegundaFinal)
        .gt('estoque_final', 0)
        .limit(1);
      
      if (contagemExata && contagemExata.length > 0) {
        dataContagemFinal = dataSegundaFinal;
        console.log(`✅ Encontrou contagem exata: ${dataContagemFinal}`);
      } else {
        // Fallback: buscar contagem mais próxima
        const { data: contagensProximas } = await supabase
          .from('contagem_estoque_insumos')
          .select('data_contagem, estoque_final')
          .eq('bar_id', bar_id)
          .gte('data_contagem', dataSegundaFinal)
          .gt('estoque_final', 0)
          .order('data_contagem', { ascending: true })
          .limit(1);
        
        if (contagensProximas && contagensProximas.length > 0) {
          dataContagemFinal = contagensProximas[0].data_contagem;
          console.log(`✅ Usando contagem próxima: ${dataContagemFinal}`);
        }
      }

      if (dataContagemFinal) {
        // Buscar insumos de funcionários
        const { data: insumos } = await supabase
          .from('insumos')
          .select('id, tipo_local, categoria')
          .eq('bar_id', bar_id)
          .in('categoria', categoriasFuncionarios);

        if (insumos && insumos.length > 0) {
          const insumosMap = new Map(insumos.map((i: any) => [i.id, i]));

          // Buscar contagens com custo_unitario
          const { data: contagens } = await supabase
            .from('contagem_estoque_insumos')
            .select('insumo_id, estoque_final, custo_unitario')
            .eq('bar_id', bar_id)
            .eq('data_contagem', dataContagemFinal);

          if (contagens && contagens.length > 0) {
            contagens.forEach((contagem: any) => {
              const insumo = insumosMap.get(contagem.insumo_id);
              if (!insumo) return;

              const valor = contagem.estoque_final * (contagem.custo_unitario || 0);
              resultado.estoque_final_funcionarios += valor;
            });

            console.log(`✅ Estoque Final Funcionários: R$ ${resultado.estoque_final_funcionarios.toFixed(2)}`);
          }
        }
      } else {
        console.log('⚠️ Nenhuma contagem de estoque final encontrada');
      }
    } catch (err) {
      console.error('Erro ao buscar estoque final de funcionários:', err);
    }

    // 4. CALCULAR CMA TOTAL
    resultado.cma_total = resultado.estoque_inicial_funcionarios + 
                          resultado.compras_alimentacao - 
                          resultado.estoque_final_funcionarios;

    console.log(`📊 CMA TOTAL: R$ ${resultado.cma_total.toFixed(2)}`);
    console.log(`   Estoque Inicial: R$ ${resultado.estoque_inicial_funcionarios.toFixed(2)}`);
    console.log(`   (+) Compras: R$ ${resultado.compras_alimentacao.toFixed(2)}`);
    console.log(`   (-) Estoque Final: R$ ${resultado.estoque_final_funcionarios.toFixed(2)}`);

    return NextResponse.json({
      success: true,
      data: resultado,
      message: 'Dados CMA carregados com sucesso'
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: (error as Error).message },
      { status: 500 }
    );
  }
}
