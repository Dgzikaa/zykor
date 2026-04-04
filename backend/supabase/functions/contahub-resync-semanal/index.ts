import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { heartbeatStart, heartbeatEnd, heartbeatError } from "../_shared/heartbeat.ts";
import { getCorsHeaders } from '../_shared/cors.ts';
import { agoraEdgeFunction, formatarDataHoraEdge } from '../_shared/timezone.ts';

console.log("🔄 ContaHub Re-Sync Semanal - Atualização de Dados da Semana Anterior");



/**
 * 🎯 OBJETIVO: Re-sincronizar dados da semana anterior para capturar lançamentos tardios
 * 
 * PROBLEMA: Cancelamentos/estornos do dia 28.03 podem ser lançados apenas no dia 30.03
 * SOLUÇÃO: Toda segunda-feira, re-sincronizar os 7 dias anteriores para pegar dados atualizados
 * 
 * EXEMPLO: Segunda 30.03.2026 → Re-sincroniza 23.03 a 29.03
 */

Deno.serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let heartbeatId: number | null = null;
  let startTime: number = Date.now();

  try {
    const requestBody = await req.text();
    console.log('📊 Body recebido:', requestBody);
    
    const { 
      bar_id = 3,
      dias_anteriores = 7, // Quantos dias para trás sincronizar (padrão: 7 = semana anterior)
      data_referencia // Opcional: data de referência (padrão: hoje)
    } = JSON.parse(requestBody || '{}');
    
    console.log(`🎯 Re-sincronizando últimos ${dias_anteriores} dias para bar_id=${bar_id}`);
    
    // Configurar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis do Supabase não encontradas');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 💓 Heartbeat: registrar início
    const hbResult = await heartbeatStart(
      supabase,
      'contahub-resync-semanal',
      bar_id,
      'weekly_resync',
      'pgcron'
    );
    heartbeatId = hbResult.heartbeatId;
    startTime = hbResult.startTime;
    
    // Calcular range de datas (semana anterior)
    const dataRef = data_referencia ? new Date(data_referencia) : new Date();
    const datasParaSincronizar: string[] = [];
    
    for (let i = 1; i <= dias_anteriores; i++) {
      const data = new Date(dataRef);
      data.setDate(data.getDate() - i);
      datasParaSincronizar.push(data.toISOString().split('T')[0]);
    }
    
    datasParaSincronizar.reverse(); // Ordem cronológica
    
    console.log(`📅 Datas para re-sincronizar: ${datasParaSincronizar.join(', ')}`);
    
    // Enviar notificação Discord de início
    try {
      await fetch(`${supabaseUrl}/functions/v1/discord-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({
          title: '🔄 ContaHub Re-Sync Semanal Iniciado',
          webhook_type: 'contahub',
          bar_id: bar_id,
          custom_message: `📅 **Período:** ${datasParaSincronizar[0]} a ${datasParaSincronizar[datasParaSincronizar.length - 1]}\n🍺 **Bar ID:** ${bar_id}\n⏰ **Início:** ${formatarDataHoraEdge(agoraEdgeFunction())}`
        })
      });
    } catch (discordError) {
      console.warn('⚠️ Erro ao enviar notificação Discord de início:', discordError);
    }
    
    // Chamar a Edge Function de sync para cada data
    const results = {
      success: [] as any[],
      errors: [] as any[]
    };
    
    for (const dataDate of datasParaSincronizar) {
      try {
        console.log(`\n📅 Re-sincronizando ${dataDate}...`);
        
        const syncResponse = await fetch(`${supabaseUrl}/functions/v1/contahub-sync-automatico`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            bar_id: bar_id,
            data_date: dataDate
          })
        });
        
        if (!syncResponse.ok) {
          const errorText = await syncResponse.text();
          throw new Error(`Erro na sincronização: ${syncResponse.status} - ${errorText}`);
        }
        
        const syncResult = await syncResponse.json();
        results.success.push({
          data_date: dataDate,
          collected_count: syncResult.summary?.collected_count || 0,
          total_records: syncResult.summary?.total_records_collected || 0
        });
        
        console.log(`✅ ${dataDate}: ${syncResult.summary?.collected_count || 0} tipos coletados, ${syncResult.summary?.total_records_collected || 0} registros`);
        
        // Pequeno delay entre datas para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ Erro ao re-sincronizar ${dataDate}:`, error);
        results.errors.push({
          data_date: dataDate,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Aguardar um pouco para o pg_cron processar os dados
    console.log('\n⏳ Aguardando 30 segundos para processamento automático...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Verificar quantos registros foram processados
    const { data: processedData, error: processedError } = await supabase
      .from('contahub_raw_data')
      .select('data_type, data_date, processed, record_count')
      .eq('bar_id', bar_id)
      .in('data_date', datasParaSincronizar)
      .order('data_date', { ascending: true });
    
    const processedCount = processedData?.filter(r => r.processed).length || 0;
    const pendingCount = processedData?.filter(r => !r.processed).length || 0;
    
    const summary = {
      bar_id,
      periodo: `${datasParaSincronizar[0]} a ${datasParaSincronizar[datasParaSincronizar.length - 1]}`,
      total_dias: datasParaSincronizar.length,
      dias_sucesso: results.success.length,
      dias_erro: results.errors.length,
      total_registros_coletados: results.success.reduce((sum, r) => sum + r.total_records, 0),
      processamento: {
        processados: processedCount,
        pendentes: pendingCount,
        total: processedData?.length || 0
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('\n📊 RESUMO FINAL:');
    console.log(`- Período: ${summary.periodo}`);
    console.log(`- Dias re-sincronizados: ${summary.dias_sucesso}/${summary.total_dias}`);
    console.log(`- Total de registros: ${summary.total_registros_coletados}`);
    console.log(`- Processados: ${processedCount}/${processedData?.length || 0}`);
    console.log(`- Erros: ${summary.dias_erro}`);
    
    // Enviar notificação Discord final
    try {
      const statusEmoji = summary.dias_erro === 0 ? '✅' : '⚠️';
      const statusText = summary.dias_erro === 0 ? 'Concluído' : 'Concluído com Erros';
      
      await fetch(`${supabaseUrl}/functions/v1/discord-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({
          title: `${statusEmoji} ContaHub Re-Sync Semanal ${statusText}`,
          webhook_type: 'contahub',
          bar_id: bar_id,
          processed_records: summary.total_registros_coletados,
          custom_message: `📅 **Período:** ${summary.periodo}\n📊 **Dias:** ${summary.dias_sucesso}/${summary.total_dias} re-sincronizados\n📈 **Registros:** ${summary.total_registros_coletados} coletados\n⚙️ **Processamento:** ${processedCount}/${processedData?.length || 0} processados\n${summary.dias_erro > 0 ? `\n⚠️ **Erros:** ${summary.dias_erro} dias falharam` : ''}\n⏰ **Fim:** ${formatarDataHoraEdge(agoraEdgeFunction())}`
        })
      });
    } catch (discordError) {
      console.warn('⚠️ Erro ao enviar notificação Discord final:', discordError);
    }
    
    // 💓 Heartbeat: registrar sucesso
    await heartbeatEnd(
      supabase,
      heartbeatId,
      summary.dias_erro === 0 ? 'success' : 'partial',
      startTime,
      summary.total_registros_coletados,
      { 
        periodo: summary.periodo,
        dias_sucesso: summary.dias_sucesso,
        dias_erro: summary.dias_erro
      }
    );
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Re-sincronização semanal concluída',
      summary,
      details: {
        success: results.success,
        errors: results.errors,
        processed_data: processedData
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
    
    // 💓 Heartbeat: registrar erro
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && supabaseServiceKey) {
        const supabaseForError = createClient(supabaseUrl, supabaseServiceKey);
        await heartbeatError(supabaseForError, heartbeatId, startTime, error instanceof Error ? error : String(error));
      }
    } catch (hbErr) {
      console.warn('⚠️ Erro ao registrar heartbeat de erro:', hbErr);
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
