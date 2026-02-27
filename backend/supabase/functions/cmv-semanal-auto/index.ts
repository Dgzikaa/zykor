/**
 * 📊 CMV Semanal Automático
 * 
 * Processa automaticamente o CMV semanal integrando dados de:
 * - Google Sheets (Planilha CMV)
 * - NIBO (Compras)
 * - ContaHub (Vendas e consumos)
 * 
 * Pode processar uma semana específica ou todas as semanas disponíveis.
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: CMVRequest = await req.json().catch(() => ({}));
    const { bar_id = 3, ano, semana, todas_semanas = false } = body;

    console.log('📊 CMV Semanal Automático - Iniciando processamento', {
      bar_id,
      ano,
      semana,
      todas_semanas
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Determinar semana a processar
    let anoProcessar = ano;
    let semanaProcessar = semana;

    if (!anoProcessar || !semanaProcessar) {
      const hoje = new Date();
      anoProcessar = hoje.getFullYear();
      
      // Calcular número da semana (ISO 8601)
      const primeiroDia = new Date(hoje.getFullYear(), 0, 1);
      const diasPassados = Math.floor((hoje.getTime() - primeiroDia.getTime()) / 86400000);
      semanaProcessar = Math.ceil((diasPassados + primeiroDia.getDay() + 1) / 7);
    }

    console.log(`📅 Processando: Ano ${anoProcessar}, Semana ${semanaProcessar}`);

    // 1. Buscar dados da planilha CMV (Google Sheets)
    console.log('📋 Buscando dados da planilha CMV...');
    
    const { data: configSheets } = await supabase
      .from('integracao_config')
      .select('config')
      .eq('bar_id', bar_id)
      .eq('tipo', 'google_sheets')
      .eq('ativo', true)
      .single();

    if (!configSheets?.config?.planilha_cmv_id) {
      throw new Error('Planilha CMV não configurada');
    }

    // 2. Buscar dados de vendas do ContaHub
    console.log('💰 Buscando dados de vendas do ContaHub...');
    
    const { data: cmvAtual } = await supabase
      .from('cmv_semanal')
      .select('*')
      .eq('bar_id', bar_id)
      .eq('ano', anoProcessar)
      .eq('semana', semanaProcessar)
      .single();

    if (!cmvAtual) {
      console.log('⚠️ CMV não encontrado, criando registro...');
      
      // Calcular datas da semana
      const primeiroDiaSemana = new Date(anoProcessar, 0, 1 + (semanaProcessar - 1) * 7);
      const diaSemana = primeiroDiaSemana.getDay();
      const dataInicio = new Date(primeiroDiaSemana);
      dataInicio.setDate(primeiroDiaSemana.getDate() - diaSemana);
      
      const dataFim = new Date(dataInicio);
      dataFim.setDate(dataInicio.getDate() + 6);

      const { error: insertError } = await supabase
        .from('cmv_semanal')
        .insert({
          bar_id,
          ano: anoProcessar,
          semana: semanaProcessar,
          data_inicio: dataInicio.toISOString().split('T')[0],
          data_fim: dataFim.toISOString().split('T')[0],
          status: 'rascunho',
          responsavel: 'Sistema Automático'
        });

      if (insertError) {
        console.error('Erro ao criar CMV:', insertError);
      }
    }

    // 3. Buscar vendas do ContaHub para o período
    const dataInicio = cmvAtual?.data_inicio || new Date().toISOString().split('T')[0];
    const dataFim = cmvAtual?.data_fim || new Date().toISOString().split('T')[0];

    const { data: vendas } = await supabase
      .from('contahub_vendas')
      .select('vr_bruto, vr_repique')
      .eq('bar_id', bar_id)
      .gte('dt_gerencial', dataInicio)
      .lte('dt_gerencial', dataFim);

    const vendasBrutas = vendas?.reduce((sum, v) => sum + (parseFloat(v.vr_bruto) || 0), 0) || 0;
    const repique = vendas?.reduce((sum, v) => sum + (parseFloat(v.vr_repique) || 0), 0) || 0;
    const faturamentoCmvivel = vendasBrutas - repique;

    console.log(`💰 Vendas: R$ ${vendasBrutas.toFixed(2)}, CMVível: R$ ${faturamentoCmvivel.toFixed(2)}`);

    // 4. Buscar compras do NIBO
    console.log('🛒 Buscando compras do NIBO...');
    
    const { data: compras } = await supabase
      .from('nibo_agendamentos')
      .select('valor, categoria_nome')
      .eq('bar_id', bar_id)
      .eq('tipo', 'pagar')
      .gte('data_vencimento', dataInicio)
      .lte('data_vencimento', dataFim)
      .in('categoria_nome', ['Custo Comida', 'Custo Bebidas', 'Custo Outros', 'Custo Drinks']);

    const comprasPorCategoria = {
      comida: 0,
      bebidas: 0,
      outros: 0,
      drinks: 0
    };

    compras?.forEach(c => {
      const valor = parseFloat(c.valor) || 0;
      if (c.categoria_nome === 'Custo Comida') comprasPorCategoria.comida += valor;
      else if (c.categoria_nome === 'Custo Bebidas') comprasPorCategoria.bebidas += valor;
      else if (c.categoria_nome === 'Custo Drinks') comprasPorCategoria.drinks += valor;
      else comprasPorCategoria.outros += valor;
    });

    const comprasTotal = Object.values(comprasPorCategoria).reduce((a, b) => a + b, 0);

    console.log(`🛒 Compras: R$ ${comprasTotal.toFixed(2)}`);

    // 5. Atualizar CMV com os dados coletados
    const { error: updateError } = await supabase
      .from('cmv_semanal')
      .update({
        vendas_brutas: vendasBrutas,
        faturamento_cmvivel: faturamentoCmvivel,
        vr_repique: repique,
        compras_periodo: comprasTotal,
        compras_custo_comida: comprasPorCategoria.comida,
        compras_custo_bebidas: comprasPorCategoria.bebidas,
        compras_custo_drinks: comprasPorCategoria.drinks,
        compras_custo_outros: comprasPorCategoria.outros,
        updated_at: new Date().toISOString()
      })
      .eq('bar_id', bar_id)
      .eq('ano', anoProcessar)
      .eq('semana', semanaProcessar);

    if (updateError) {
      throw new Error(`Erro ao atualizar CMV: ${updateError.message}`);
    }

    console.log('✅ CMV processado com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        message: `CMV Semana ${semanaProcessar}/${anoProcessar} processado`,
        data: {
          ano: anoProcessar,
          semana: semanaProcessar,
          vendas_brutas: vendasBrutas,
          faturamento_cmvivel: faturamentoCmvivel,
          compras_total: comprasTotal
        }
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
