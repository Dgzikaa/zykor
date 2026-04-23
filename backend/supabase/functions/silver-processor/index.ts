/**
 * @camada silver
 * @jobName silver-processor
 * @descricao Silver generico
 *
 * Classificacao medallion mantida em ops.job_camada_mapping (ver
 * database/migrations/2026-04-23-observability-mapping.sql). Observability
 * via _shared/heartbeat.ts ou _shared/observability.ts.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth-guard.ts';
import { trackResponse } from '../_shared/observability.ts';

console.log("🥈 Silver Processor - Transforma Bronze → Silver");

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Validar autenticação
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const requestBody = await req.text();
    console.log('📊 Body recebido:', requestBody);

    const {
      bar_id,
      data_date,
      data_types = ['financeiro_pagamentos', 'vendas_periodo', 'vendas_analitico', 'producao_tempo']
    } = JSON.parse(requestBody || '{}');

    if (!bar_id || !data_date) {
      return new Response(JSON.stringify({
        success: false,
        error: 'bar_id e data_date são obrigatórios'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 📊 Observability wrapper — registra heartbeat start/end com camada='silver'
    return await trackResponse(supabase, {
      camada: 'silver',
      jobName: 'silver-processor',
      barId: Number(bar_id),
      action: 'transform_bronze_to_silver',
      triggeredBy: req.headers.get('x-triggered-by') === 'manual' ? 'manual' : 'api',
      metadata: { data_date, data_types },
    }, async () => {
    const results: any = {};

    console.log(`🥈 Processando Silver para bar_id=${bar_id}, data=${data_date}`);
    console.log(`📋 Tipos: ${data_types.join(', ')}`);

    // Processar cada tipo de dado
    for (const dataType of data_types) {
      try {
        console.log(`\n🔄 Processando ${dataType}...`);
        
        let result;
        
        switch (dataType) {
          case 'financeiro_pagamentos':
            result = await processarPagamentos(supabase, bar_id, data_date);
            break;
            
          case 'vendas_periodo':
            result = await processarPeriodo(supabase, bar_id, data_date);
            break;
            
          case 'vendas_analitico':
            result = await processarAnalitico(supabase, bar_id, data_date);
            break;
            
          case 'producao_tempo':
            result = await processarTempo(supabase, bar_id, data_date);
            break;
            
          default:
            result = { success: false, error: `Tipo ${dataType} não implementado` };
        }
        
        results[dataType] = result;
        
        if (result.success) {
          console.log(`✅ ${dataType}: ${result.inserted || 0} registros inseridos`);
        } else {
          console.error(`❌ ${dataType}: ${result.error}`);
        }
        
      } catch (error) {
        console.error(`❌ Erro ao processar ${dataType}:`, error);
        results[dataType] = {
          success: false,
          error: String(error)
        };
      }
    }

    // Marcar como processado no controle
    await supabase
      .schema('bronze')
      .from('bronze_processing_control')
      .upsert({
        data_date,
        bar_id: String(bar_id),
        data_type: 'silver_processed',
        status: 'completed',
        completed_at: new Date().toISOString()
      }, {
        onConflict: 'data_date,bar_id,data_type'
      });

    const totalSucesso = Object.values(results).filter((r: any) => r.success).length;
    const totalErros = Object.values(results).filter((r: any) => !r.success).length;

    // records_affected = soma de registros inseridos por tipo
    const totalInseridos = Object.values(results).reduce((acc: number, r: any) => {
      return acc + (typeof r.inserted === 'number' ? r.inserted : 0);
    }, 0);

    const response = new Response(JSON.stringify({
      success: totalErros === 0,
      bar_id,
      data_date,
      results,
      summary: {
        total: data_types.length,
        sucesso: totalSucesso,
        erros: totalErros
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

    return {
      response,
      rowsAffected: totalInseridos,
      summary: { total_tipos: data_types.length, sucesso: totalSucesso, erros: totalErros },
    };
    }); // fim trackResponse

  } catch (error) {
    console.error('❌ Erro fatal:', error);
    return new Response(JSON.stringify({
      success: false,
      error: String(error)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

// ============================================
// PROCESSADORES POR TIPO DE DADO
// ============================================

async function processarPagamentos(supabase: any, barId: number, dataDate: string) {
  console.log('   💰 Processando pagamentos...');
  
  const { data, error } = await supabase.rpc('transform_pagamentos_bronze_to_silver', {
    p_data_inicio: dataDate,
    p_data_fim: dataDate,
    p_bar_id: String(barId)
  });
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  const result = data[0];
  return {
    success: true,
    processados: result.total_processados,
    inserted: result.total_inseridos,
    erros: result.total_erros
  };
}

async function processarPeriodo(supabase: any, barId: number, dataDate: string) {
  console.log('   📊 Processando periodo...');
  // TODO: Implementar quando criar silver_contahub_vendas_periodo
  return { success: true, inserted: 0, message: 'Ainda não implementado' };
}

async function processarAnalitico(supabase: any, barId: number, dataDate: string) {
  console.log('   📈 Processando analitico...');
  // TODO: Implementar quando criar silver_contahub_vendas_analitico
  return { success: true, inserted: 0, message: 'Ainda não implementado' };
}

async function processarTempo(supabase: any, barId: number, dataDate: string) {
  console.log('   ⏱️ Processando tempo...');
  // TODO: Implementar quando criar silver_contahub_producao_tempo
  return { success: true, inserted: 0, message: 'Ainda não implementado' };
}
