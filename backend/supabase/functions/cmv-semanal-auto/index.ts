/**
 * 📊 CMV Semanal Automático
 * 
 * Processa automaticamente o CMV semanal integrando dados de:
 * - desempenho_semanal (faturamento_total como faturamento bruto)
 * - NIBO (Compras por categoria)
 * 
 * Cria automaticamente semanas que existem no desempenho_semanal mas não no cmv_semanal.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CMVRequest {
  bar_id?: number;
  ano?: number;
  semana?: number;
  todas_semanas?: boolean;
}

function getWeekDateRange(year: number, week: number): { start: string; end: string } {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { start: fmt(start), end: fmt(end) };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: CMVRequest = await req.json().catch(() => ({}));
    const { bar_id, ano, semana, todas_semanas = false } = body;

    console.log('📊 CMV Semanal Automático - Iniciando processamento', {
      bar_id,
      ano,
      semana,
      todas_semanas
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const bares = bar_id ? [bar_id] : [3, 4];
    const anoAtual = ano || new Date().getFullYear();
    
    let semanasProcessadas = 0;
    let semanasCriadas = 0;
    const resultados: any[] = [];

    for (const barId of bares) {
      console.log(`\n🍺 Processando bar_id: ${barId}`);

      // 1. Buscar todas as semanas do desempenho_semanal
      // Inclui couvert_atracoes e comissao para calcular faturamento líquido
      let queryDesempenho = supabase
        .from('desempenho_semanal')
        .select('numero_semana, ano, data_inicio, data_fim, faturamento_total, couvert_atracoes, comissao')
        .eq('bar_id', barId)
        .eq('ano', anoAtual)
        .order('numero_semana', { ascending: true });

      if (semana && !todas_semanas) {
        queryDesempenho = queryDesempenho.eq('numero_semana', semana);
      }

      const { data: semanasDesempenho, error: errDesempenho } = await queryDesempenho;

      if (errDesempenho) {
        console.error('Erro ao buscar desempenho_semanal:', errDesempenho);
        continue;
      }

      console.log(`📅 Encontradas ${semanasDesempenho?.length || 0} semanas no desempenho_semanal`);

      // 2. Buscar semanas existentes no cmv_semanal COM dados de estoque e consumos
      // Inclui todos os campos que podem vir da planilha para não sobrescrever
      const { data: semanasCmv } = await supabase
        .from('cmv_semanal')
        .select(`
          semana, 
          estoque_inicial, estoque_inicial_cozinha, estoque_inicial_bebidas, estoque_inicial_drinks,
          estoque_final, estoque_final_cozinha, estoque_final_bebidas, estoque_final_drinks,
          total_consumo_socios, mesa_beneficios_cliente, mesa_banda_dj, consumo_rh,
          cmv_teorico_percentual, bonificacao_contrato_anual
        `)
        .eq('bar_id', barId)
        .eq('ano', anoAtual)
        .order('semana', { ascending: true });

      const semanasExistentes = new Set(semanasCmv?.map(s => s.semana) || []);
      
      // Mapear dados existentes por semana para não sobrescrever valores da planilha
      const dadosPorSemana = new Map<number, any>();
      semanasCmv?.forEach(s => {
        dadosPorSemana.set(s.semana, {
          estoque_inicial: parseFloat(String(s.estoque_inicial)) || 0,
          estoque_inicial_cozinha: parseFloat(String(s.estoque_inicial_cozinha)) || 0,
          estoque_inicial_bebidas: parseFloat(String(s.estoque_inicial_bebidas)) || 0,
          estoque_inicial_drinks: parseFloat(String(s.estoque_inicial_drinks)) || 0,
          estoque_final: parseFloat(String(s.estoque_final)) || 0,
          estoque_final_cozinha: parseFloat(String(s.estoque_final_cozinha)) || 0,
          estoque_final_bebidas: parseFloat(String(s.estoque_final_bebidas)) || 0,
          estoque_final_drinks: parseFloat(String(s.estoque_final_drinks)) || 0,
          total_consumo_socios: parseFloat(String(s.total_consumo_socios)) || 0,
          mesa_beneficios_cliente: parseFloat(String(s.mesa_beneficios_cliente)) || 0,
          mesa_banda_dj: parseFloat(String(s.mesa_banda_dj)) || 0,
          consumo_rh: parseFloat(String(s.consumo_rh)) || 0,
          cmv_teorico_percentual: parseFloat(String(s.cmv_teorico_percentual)) || 0,
          bonificacao_contrato_anual: parseFloat(String(s.bonificacao_contrato_anual)) || 0,
        });
      });
      
      // Mapear estoque final por semana para propagar como estoque inicial
      const estoqueFinalPorSemana = new Map<number, {
        estoque_final: number;
        estoque_final_cozinha: number;
        estoque_final_bebidas: number;
        estoque_final_drinks: number;
      }>();
      
      semanasCmv?.forEach(s => {
        estoqueFinalPorSemana.set(s.semana, {
          estoque_final: parseFloat(String(s.estoque_final)) || 0,
          estoque_final_cozinha: parseFloat(String(s.estoque_final_cozinha)) || 0,
          estoque_final_bebidas: parseFloat(String(s.estoque_final_bebidas)) || 0,
          estoque_final_drinks: parseFloat(String(s.estoque_final_drinks)) || 0,
        });
      });

      // 3. Processar cada semana
      for (const sem of semanasDesempenho || []) {
        const numeroSemana = sem.numero_semana;
        const faturamentoBruto = sem.faturamento_total || 0;
        const comissao = (sem as any).comissao || 0;
        const couvert = (sem as any).couvert_atracoes || 0;
        // Faturamento Limpo = Faturamento Total - Comissão - Couvert
        // Usado para cálculo do CMV Limpo %
        const faturamentoLimpo = faturamentoBruto - comissao - couvert;
        
        // Calcular datas da semana se não existirem
        let dataInicio = sem.data_inicio;
        let dataFim = sem.data_fim;
        
        if (!dataInicio || !dataFim) {
          const { start, end } = getWeekDateRange(anoAtual, numeroSemana);
          dataInicio = start;
          dataFim = end;
        }

        // Criar semana se não existir
        if (!semanasExistentes.has(numeroSemana)) {
          console.log(`➕ Criando CMV para semana ${numeroSemana}...`);
          
          const { error: insertError } = await supabase
            .from('cmv_semanal')
            .insert({
              bar_id: barId,
              ano: anoAtual,
              semana: numeroSemana,
              data_inicio: dataInicio,
              data_fim: dataFim,
              vendas_brutas: faturamentoBruto,
              faturamento_bruto: faturamentoBruto,
              status: 'rascunho',
              responsavel: 'Sistema Automático',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (insertError) {
            console.error(`Erro ao criar CMV semana ${numeroSemana}:`, insertError);
            continue;
          }
          
          semanasCriadas++;
          semanasExistentes.add(numeroSemana);
        }

        // 4. Buscar compras do NIBO para esta semana (usando data_competencia)
        // CMV - Categorias de custo de mercadoria:
        // - Ordinário: CUSTO COMIDA, Custo Bebidas, Custo Drinks
        // - Deboche: CUSTO COMIDAS, CUSTO BEBIDAS, CUSTO DRINKS
        // CMA - Alimentação (separado):
        // - Ordinário: ALIMENTAÇÃO
        // - Deboche: Alimentação
        const { data: compras } = await supabase
          .from('nibo_agendamentos')
          .select('valor, categoria_nome, tipo')
          .eq('bar_id', barId)
          .gte('data_competencia', dataInicio)
          .lte('data_competencia', dataFim)
          .or('categoria_nome.ilike.%custo comida%,categoria_nome.ilike.%custo bebida%,categoria_nome.ilike.%custo drink%,categoria_nome.ilike.alimenta%');

        const comprasPorCategoria = {
          cozinha: 0,    // CUSTO COMIDA / CUSTO COMIDAS
          bebidas: 0,    // Custo Bebidas / CUSTO BEBIDAS
          drinks: 0,     // Custo Drinks / CUSTO DRINKS
          alimentacao: 0 // ALIMENTAÇÃO (CMA - separado do CMV)
        };

        // Calcular: despesas são positivas, receitas (devoluções/créditos) são negativas
        compras?.forEach(c => {
          const valorBruto = parseFloat(String(c.valor)) || 0;
          const tipo = (c.tipo || '').toLowerCase();
          const cat = (c.categoria_nome || '').toLowerCase();
          
          // Se for receita (crédito/devolução), subtrai; se for despesa, soma
          const valor = tipo === 'receita' ? -valorBruto : valorBruto;
          
          if (cat.includes('custo comida')) comprasPorCategoria.cozinha += valor;
          else if (cat.includes('custo bebida')) comprasPorCategoria.bebidas += valor;
          else if (cat.includes('custo drink')) comprasPorCategoria.drinks += valor;
          else if (cat.includes('alimenta')) comprasPorCategoria.alimentacao += valor;
        });

        // CMV Total = cozinha + bebidas + drinks (NÃO inclui alimentação)
        const comprasCmvTotal = comprasPorCategoria.cozinha + comprasPorCategoria.bebidas + comprasPorCategoria.drinks;

        // 5. Verificar dados existentes da semana (podem ter vindo da planilha)
        const dadosAtuais = dadosPorSemana.get(numeroSemana) || {};
        
        // 6. Propagar Estoque Inicial = Estoque Final da semana anterior
        // APENAS se o estoque inicial atual for zero (não veio da planilha)
        const semanaAnterior = numeroSemana - 1;
        const estoqueAnterior = estoqueFinalPorSemana.get(semanaAnterior);
        
        const estoqueInicialUpdate: any = {};
        if (dadosAtuais.estoque_inicial === 0 && estoqueAnterior && estoqueAnterior.estoque_final > 0) {
          estoqueInicialUpdate.estoque_inicial = estoqueAnterior.estoque_final;
          estoqueInicialUpdate.estoque_inicial_cozinha = estoqueAnterior.estoque_final_cozinha;
          estoqueInicialUpdate.estoque_inicial_bebidas = estoqueAnterior.estoque_final_bebidas;
          estoqueInicialUpdate.estoque_inicial_drinks = estoqueAnterior.estoque_final_drinks;
          console.log(`  📦 Propagando Estoque Inicial semana ${numeroSemana} = Estoque Final semana ${semanaAnterior}: R$ ${estoqueAnterior.estoque_final.toFixed(2)}`);
        } else if (dadosAtuais.estoque_inicial > 0) {
          console.log(`  📋 Estoque Inicial semana ${numeroSemana} já preenchido (planilha): R$ ${dadosAtuais.estoque_inicial.toFixed(2)}`);
        }

        // 7. Calcular CMV Real se tiver estoques válidos
        // CMV Real = Estoque Inicial + Compras - Estoque Final - Consumos + Bonificações
        const estoqueInicial = dadosAtuais.estoque_inicial || estoqueInicialUpdate.estoque_inicial || 0;
        const estoqueFinal = dadosAtuais.estoque_final || 0;
        
        let cmvReal = null;
        let cmvPercentual = null;
        let cmvLimpoPercentual = null;
        
        if (estoqueInicial > 0 || estoqueFinal > 0) {
          // Consumos com fator 0.35 (conforme frontend)
          const consumoSocios = (dadosAtuais.total_consumo_socios || 0) * 0.35;
          const consumoBeneficios = (dadosAtuais.mesa_beneficios_cliente || 0) * 0.35;
          const consumoArtista = (dadosAtuais.mesa_banda_dj || 0) * 0.35;
          const consumoRh = (dadosAtuais.consumo_rh || 0) * 0.35;
          const totalConsumos = consumoSocios + consumoBeneficios + consumoArtista + consumoRh;
          
          const bonificacoes = dadosAtuais.bonificacao_contrato_anual || 0;
          
          // CMV Real = Est. Inicial + Compras - Est. Final - Consumos + Bonificações
          cmvReal = estoqueInicial + comprasCmvTotal - estoqueFinal - totalConsumos + bonificacoes;
          
          // Evitar CMV negativo
          if (cmvReal < 0) cmvReal = 0;
          
          // CMV % (bruto) = CMV Real / Faturamento Bruto * 100
          if (faturamentoBruto > 0) {
            cmvPercentual = (cmvReal / faturamentoBruto) * 100;
          }
          
          // CMV Limpo % = CMV Real / Faturamento LIMPO * 100
          // Faturamento Limpo = Bruto - Comissão - Couvert
          if (faturamentoLimpo > 0) {
            cmvLimpoPercentual = (cmvReal / faturamentoLimpo) * 100;
          }
          
          console.log(`  💰 CMV Real: R$ ${cmvReal.toFixed(2)} | CMV Bruto: ${cmvPercentual?.toFixed(1) || 0}% | CMV Limpo: ${cmvLimpoPercentual?.toFixed(1) || 0}%`);
        }

        // 9. Montar objeto de update
        const updateData: any = {
          vendas_brutas: faturamentoBruto,
          vendas_liquidas: faturamentoLimpo,
          faturamento_bruto: faturamentoBruto,
          // CMV - Total de compras (sem alimentação)
          compras_periodo: comprasCmvTotal,
          compras_cozinha: comprasPorCategoria.cozinha,
          compras_bebidas: comprasPorCategoria.bebidas,
          compras_drinks: comprasPorCategoria.drinks,
          // CMA - Alimentação (separado)
          compras_alimentacao: comprasPorCategoria.alimentacao,
          // Campos legado (manter compatibilidade)
          compras_custo_comida: comprasPorCategoria.cozinha,
          compras_custo_bebidas: comprasPorCategoria.bebidas,
          compras_custo_drinks: comprasPorCategoria.drinks,
          // Propagar estoque inicial da semana anterior (só se não veio da planilha)
          ...estoqueInicialUpdate,
          updated_at: new Date().toISOString()
        };
        
        // Adicionar CMV calculado se válido
        if (cmvReal !== null) {
          updateData.cmv_real = cmvReal;
        }
        if (cmvPercentual !== null) {
          updateData.cmv_percentual = cmvPercentual;
        }
        if (cmvLimpoPercentual !== null) {
          updateData.cmv_limpo_percentual = cmvLimpoPercentual;
        }
        
        // Calcular gap se tiver CMV teórico
        if (cmvLimpoPercentual !== null && dadosAtuais.cmv_teorico_percentual > 0) {
          const gap = cmvLimpoPercentual - dadosAtuais.cmv_teorico_percentual;
          updateData.gap = gap;
        }

        // 10. Atualizar CMV no banco
        const { error: updateError } = await supabase
          .from('cmv_semanal')
          .update(updateData)
          .eq('bar_id', barId)
          .eq('ano', anoAtual)
          .eq('semana', numeroSemana);

        if (updateError) {
          console.error(`Erro ao atualizar CMV semana ${numeroSemana}:`, updateError);
          continue;
        }

        semanasProcessadas++;
        
        resultados.push({
          bar_id: barId,
          semana: numeroSemana,
          faturamento_bruto: faturamentoBruto,
          compras_cmv: comprasCmvTotal,
          compras_alimentacao: comprasPorCategoria.alimentacao,
          cmv_real: cmvReal,
          cmv_percentual: cmvPercentual,
          estoque_inicial: estoqueInicial,
          estoque_final: estoqueFinal,
          status: 'ok'
        });

        console.log(`✅ Semana ${numeroSemana}: Fat. Bruto R$ ${faturamentoBruto.toFixed(2)}, Limpo R$ ${faturamentoLimpo.toFixed(2)}, CMV Real R$ ${(cmvReal || 0).toFixed(2)}`);
      }
    }

    console.log(`\n✅ Processamento concluído: ${semanasProcessadas} semanas atualizadas, ${semanasCriadas} criadas`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `CMV processado: ${semanasProcessadas} semanas atualizadas, ${semanasCriadas} criadas`,
        semanas_processadas: semanasProcessadas,
        semanas_criadas: semanasCriadas,
        resultados,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Erro ao processar CMV:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
