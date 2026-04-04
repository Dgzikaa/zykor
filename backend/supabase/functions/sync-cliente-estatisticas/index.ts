/**
 * 📊 SYNC CLIENTE ESTATÍSTICAS - Atualiza tabela cliente_estatisticas
 * 
 * Executa refresh completo ou incremental da tabela cliente_estatisticas
 * que agrega dados de visitas por cliente.
 * 
 * Parâmetros:
 * - bar_id: ID do bar (opcional, se não informado atualiza todos)
 * - incremental: true para atualizar apenas clientes afetados recentemente
 * - data_visita: data específica para refresh incremental (formato YYYY-MM-DD)
 * 
 * @version 1.0.0
 * @date 2026-03-31
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { heartbeatStart, heartbeatEnd, heartbeatError } from '../_shared/heartbeat.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  bar_id?: number;
  incremental?: boolean;
  data_visita?: string;
  debug?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let heartbeatId: number | null = null;
  let startTime: number = Date.now();

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body: SyncRequest = await req.json().catch(() => ({}));
    const { bar_id, incremental = false, data_visita, debug = false } = body;

    console.log('📊 Sync Cliente Estatísticas - Iniciando', { bar_id, incremental, data_visita });

    const hbResult = await heartbeatStart(supabase, 'sync-cliente-estatisticas', bar_id || null, null, 'pgcron');
    heartbeatId = hbResult.heartbeatId;
    startTime = hbResult.startTime;

    // Determinar quais bares processar
    const baresParaProcessar: number[] = [];
    if (bar_id) {
      baresParaProcessar.push(bar_id);
    } else {
      // Buscar todos os bares ativos
      const { data: bares, error: errBares } = await supabase
        .from('bares')
        .select('id')
        .eq('ativo', true);
      
      if (errBares) {
        throw new Error(`Erro ao buscar bares: ${errBares.message}`);
      }
      
      baresParaProcessar.push(...(bares?.map(b => b.id) || []));
    }

    console.log(`🏪 Processando ${baresParaProcessar.length} bar(es)`);

    const resultadosPorBar: any[] = [];
    let totalRegistrosAtualizados = 0;

    for (const barId of baresParaProcessar) {
      console.log(`\n🍺 Processando bar_id=${barId}`);
      
      try {
        // SEMPRE usar modo incremental devido ao trigger de proteção contra DELETE
        // Se data_visita não foi especificada, processar últimos 10 dias
        const datasParaProcessar: string[] = [];
        
        if (data_visita) {
          datasParaProcessar.push(data_visita);
        } else {
          // Gerar últimos 10 dias
          for (let i = 0; i < 10; i++) {
            const data = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            datasParaProcessar.push(data.toISOString().split('T')[0]);
          }
        }
        
        console.log(`🔄 Processando ${datasParaProcessar.length} data(s) no modo incremental`);
        
        let datasProcessadas = 0;
        
        for (const dataProcessar of datasParaProcessar) {
          const { error: refreshError } = await supabase.rpc('refresh_cliente_estatisticas_upsert', {
            p_bar_id: barId,
            p_data_visita: dataProcessar
          });
          
          if (refreshError) {
            console.error(`⚠️ Erro ao processar data ${dataProcessar}:`, refreshError.message);
            continue;
          }
          
          datasProcessadas++;
        }
        
        // Contar total de clientes após refresh
        const { count } = await supabase
          .from('cliente_estatisticas')
          .select('*', { count: 'exact', head: true })
          .eq('bar_id', barId);
        
        totalRegistrosAtualizados += count || 0;
        
        console.log(`✅ Bar ${barId}: ${datasProcessadas} datas processadas, ${count} clientes totais`);
        
        resultadosPorBar.push({
          bar_id: barId,
          success: true,
          modo: 'incremental',
          datas_processadas: datasProcessadas,
          total_clientes: count || 0
        });
        
      } catch (barError: any) {
        console.error(`❌ Erro bar ${barId}:`, barError.message);
        resultadosPorBar.push({
          bar_id: barId,
          success: false,
          error: barError.message
        });
      }
    }

    const sucessos = resultadosPorBar.filter(r => r.success).length;
    const falhas = resultadosPorBar.filter(r => !r.success).length;

    await heartbeatEnd(supabase, heartbeatId, falhas === 0 ? 'success' : 'partial', startTime, totalRegistrosAtualizados, {
      bares_processados: baresParaProcessar.length,
      sucessos,
      falhas
    });

    return new Response(
      JSON.stringify({
        success: falhas === 0,
        message: `Cliente Estatísticas sincronizado: ${sucessos} bares OK, ${falhas} falhas`,
        total_registros_atualizados: totalRegistrosAtualizados,
        resultados_por_bar: resultadosPorBar,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    await heartbeatError(supabase, heartbeatId, startTime, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message, timestamp: new Date().toISOString() }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
