import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { heartbeatStart, heartbeatEnd, heartbeatError, sendJobFailureAlert } from "../_shared/heartbeat.ts";
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * 🐕 CRON WATCHDOG
 * 
 * Monitora a saúde dos cron jobs baseado na tabela cron_heartbeats.
 * Detecta: jobs stale (não executou), stuck (travado), error (falhou).
 * 
 * Execução recomendada: a cada 5 minutos via pg_cron
 */

console.log("🐕 Cron Watchdog - Monitor de Saúde dos Jobs");



interface ProblemaDetectado {
  job_name: string;
  tipo_problema: 'stale' | 'stuck' | 'error';
  status: string;
  tempo_sem_execucao_minutos: number;
  ultima_execucao: string;
  bar_id: number | null;
  error_message: string | null;
  detalhes: Record<string, any>;
}

interface WatchdogConfig {
  stale_minutes: number;
  stuck_minutes: number;
  error_hours: number;
}

const DEFAULT_CONFIG: WatchdogConfig = {
  stale_minutes: 120,  // Alerta se não executou há 2 horas
  stuck_minutes: 30,   // Alerta se running há mais de 30 minutos
  error_hours: 24,     // Considera erros das últimas 24 horas
};

Deno.serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders }

  // Validar autenticação (JWT ou CRON_SECRET)
  const authError = requireAuth(req);
  if (authError) return authError;);
  }

  // 💓 Heartbeat: variáveis no escopo externo para acesso no catch
  let heartbeatId: number | null = null;
  let startTime: number = Date.now();

  try {
    console.log('🔍 Iniciando verificação de saúde dos crons...');
    
    // Configurar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis do Supabase não encontradas');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 💓 Heartbeat: registrar início da execução
    const hbResult = await heartbeatStart(supabase, 'cron-watchdog', null, 'check', 'pgcron');
    heartbeatId = hbResult.heartbeatId;
    startTime = hbResult.startTime;
    
    // Ler configuração do body (opcional)
    let config = { ...DEFAULT_CONFIG };
    try {
      const body = await req.json();
      if (body.stale_minutes) config.stale_minutes = body.stale_minutes;
      if (body.stuck_minutes) config.stuck_minutes = body.stuck_minutes;
      if (body.error_hours) config.error_hours = body.error_hours;
    } catch {
      // Usa config padrão se não houver body
    }
    
    console.log(`⚙️ Configuração: stale=${config.stale_minutes}min, stuck=${config.stuck_minutes}min, errors=${config.error_hours}h`);
    
    // Chamar função SQL que detecta problemas
    const { data: problemas, error } = await supabase.rpc('verificar_saude_crons', {
      p_stale_minutes: config.stale_minutes,
      p_stuck_minutes: config.stuck_minutes,
      p_error_hours: config.error_hours
    });
    
    if (error) {
      throw new Error(`Erro ao verificar saúde: ${error.message}`);
    }
    
    const problemasDetectados: ProblemaDetectado[] = problemas || [];
    
    // Agrupar por tipo de problema
    const stale = problemasDetectados.filter(p => p.tipo_problema === 'stale');
    const stuck = problemasDetectados.filter(p => p.tipo_problema === 'stuck');
    const errors = problemasDetectados.filter(p => p.tipo_problema === 'error');
    
    // Log estruturado
    console.log('\n📊 ========== WATCHDOG REPORT ==========');
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.log(`📋 Total de problemas: ${problemasDetectados.length}`);
    console.log(`   - Stale (não executou): ${stale.length}`);
    console.log(`   - Stuck (travado): ${stuck.length}`);
    console.log(`   - Error (falhou): ${errors.length}`);
    
    if (stale.length > 0) {
      console.log('\n⚠️ JOBS STALE (não executaram recentemente):');
      stale.forEach(p => {
        console.log(`   📛 ${p.job_name}`);
        console.log(`      └─ Última execução: ${p.ultima_execucao} (${p.tempo_sem_execucao_minutos} min atrás)`);
      });
    }
    
    if (stuck.length > 0) {
      console.log('\n🔴 JOBS STUCK (travados em running):');
      stuck.forEach(p => {
        console.log(`   📛 ${p.job_name}`);
        console.log(`      └─ Running há: ${p.tempo_sem_execucao_minutos} minutos`);
        if (p.bar_id) console.log(`      └─ Bar ID: ${p.bar_id}`);
      });
    }
    
    if (errors.length > 0) {
      console.log('\n❌ JOBS COM ERRO RECENTE:');
      errors.forEach(p => {
        console.log(`   📛 ${p.job_name}`);
        console.log(`      └─ Erro em: ${p.ultima_execucao}`);
        console.log(`      └─ Mensagem: ${p.error_message || 'N/A'}`);
        if (p.bar_id) console.log(`      └─ Bar ID: ${p.bar_id}`);
      });
    }
    
    if (problemasDetectados.length === 0) {
      console.log('\n✅ Todos os crons estão saudáveis!');
    }
    
    console.log('\n========================================\n');
    
    // ========== ENVIAR ALERTAS DISCORD ==========
    if (problemasDetectados.length > 0) {
      console.log('📢 Enviando alertas para Discord...');
      
      for (const problema of problemasDetectados) {
        await sendJobFailureAlert({
          job_name: problema.job_name,
          tipo_problema: problema.tipo_problema,
          bar_id: problema.bar_id,
          error_message: problema.error_message || undefined,
          resumo: `${problema.tipo_problema === 'stale' 
            ? `Última execução há ${problema.tempo_sem_execucao_minutos} minutos` 
            : problema.tipo_problema === 'stuck'
            ? `Executando há ${problema.tempo_sem_execucao_minutos} minutos`
            : `Erro em ${problema.ultima_execucao}`}`,
          detalhes: problema.detalhes,
        }, supabase);
      }
      
      console.log(`✅ ${problemasDetectados.length} alerta(s) enviado(s)`);
    }
    // ========== FIM ALERTAS DISCORD ==========
    
    // Buscar estatísticas gerais
    const { data: stats } = await supabase
      .from('cron_heartbeats')
      .select('job_name, status, started_at')
      .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('started_at', { ascending: false });
    
    const statsResume = {
      total_execucoes_24h: stats?.length || 0,
      jobs_unicos: [...new Set(stats?.map(s => s.job_name) || [])].length,
      por_status: {
        success: stats?.filter(s => s.status === 'success').length || 0,
        partial: stats?.filter(s => s.status === 'partial').length || 0,
        error: stats?.filter(s => s.status === 'error').length || 0,
        running: stats?.filter(s => s.status === 'running').length || 0,
      }
    };
    
    // Resposta estruturada
    const resultado = {
      success: true,
      timestamp: new Date().toISOString(),
      config,
      saude: problemasDetectados.length === 0 ? 'OK' : 'PROBLEMAS_DETECTADOS',
      resumo: {
        total_problemas: problemasDetectados.length,
        stale: stale.length,
        stuck: stuck.length,
        errors: errors.length,
      },
      problemas: problemasDetectados.map(p => ({
        job_name: p.job_name,
        tipo_problema: p.tipo_problema,
        tempo_sem_execucao_minutos: p.tempo_sem_execucao_minutos,
        ultima_execucao: p.ultima_execucao,
        bar_id: p.bar_id,
        error_message: p.error_message,
      })),
      estatisticas_24h: statsResume,
    };

    // 💓 Heartbeat: registrar sucesso
    await heartbeatEnd(
      supabase,
      heartbeatId,
      'success',
      startTime,
      problemasDetectados.length,
      { saude: resultado.saude, ...resultado.resumo },
      undefined, // errorMessage
      'cron-watchdog' // jobName
    );
    
    return new Response(JSON.stringify(resultado, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
    
  } catch (error) {
    console.error('❌ Erro no watchdog:', error);

    // 💓 Heartbeat: registrar erro (com alerta Discord)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && supabaseServiceKey) {
        const supabaseForError = createClient(supabaseUrl, supabaseServiceKey);
        await heartbeatError(
          supabaseForError, 
          heartbeatId, 
          startTime, 
          error instanceof Error ? error : String(error),
          undefined, // responseSummary
          'cron-watchdog' // jobName para alerta Discord
        );
      }
    } catch (hbErr) {
      console.warn('⚠️ Erro ao registrar heartbeat de erro:', hbErr);
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
