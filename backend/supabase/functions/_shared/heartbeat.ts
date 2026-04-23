/**
 * 📊 HEARTBEAT - Camada de Observabilidade para Cron Jobs
 * 
 * Módulo compartilhado para rastrear início e fim de execuções de edge functions.
 * Não altera lógica de negócio, apenas registra métricas para observabilidade.
 * 
 * Uso:
 *   const heartbeatId = await heartbeatStart(supabase, 'minha-funcao', barId, 'sync', 'pgcron');
 *   // ... lógica existente ...
 *   await heartbeatEnd(supabase, heartbeatId, 'success', 100, { detalhes: 'ok' });
 * 
 * v1.1.0: Adicionado sendJobFailureAlert para alertas Discord
 * 
 * @version 1.1.0
 * @date 2026-03-19
 */

type HeartbeatStatus = 'running' | 'success' | 'partial' | 'error';

// ============ ALERTAS DISCORD ============

interface JobFailureAlertOptions {
  job_name: string;
  tipo_problema: 'error' | 'partial' | 'stale' | 'stuck' | 'validation_failed';
  bar_id?: number | null;
  error_message?: string;
  resumo?: string;
  detalhes?: Record<string, any>;
}

/**
 * Envia alerta de falha de job para o Discord
 * Busca webhook da tabela discord_webhooks (tipo='alertas') ou usa variável de ambiente como fallback
 */
export async function sendJobFailureAlert(options: JobFailureAlertOptions, supabase?: any): Promise<boolean> {
  let webhookUrl: string | null = null;
  
  // Tentar buscar da tabela discord_webhooks primeiro
  if (supabase) {
    try {
      const { data: webhook } = await supabase
        .from('discord_webhooks')
        .select('webhook_url')
        .eq('tipo', 'alertas')
        .eq('ativo', true)
        .limit(1)
        .single();
      
      if (webhook?.webhook_url) {
        webhookUrl = webhook.webhook_url;
      }
    } catch (err) {
      console.warn('⚠️ [Heartbeat] Erro ao buscar webhook da tabela:', err);
    }
  }
  
  // Fallback para variáveis de ambiente
  if (!webhookUrl) {
    webhookUrl = Deno.env.get('DISCORD_WEBHOOK_ALERTAS') || Deno.env.get('DISCORD_WEBHOOK_URL') || null;
  }
  
  if (!webhookUrl) {
    console.warn('⚠️ [Heartbeat] Discord webhook não configurado, alerta não enviado');
    return false;
  }

  const { job_name, tipo_problema, bar_id, error_message, resumo, detalhes } = options;

  // Cores por tipo de problema
  const cores: Record<string, number> = {
    error: 0xff0000,      // Vermelho
    partial: 0xffaa00,    // Laranja
    stale: 0xffff00,      // Amarelo
    stuck: 0xff6600,      // Laranja escuro
    validation_failed: 0x9900ff, // Roxo
  };

  // Emojis por tipo
  const emojis: Record<string, string> = {
    error: '❌',
    partial: '⚠️',
    stale: '⏰',
    stuck: '🔴',
    validation_failed: '🛡️',
  };

  // Descrições por tipo
  const descricoes: Record<string, string> = {
    error: 'Job falhou com erro',
    partial: 'Job concluiu com erros parciais',
    stale: 'Job não executou no tempo esperado',
    stuck: 'Job travado em execução',
    validation_failed: 'Validação de estrutura falhou',
  };

  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    { name: '🔧 Job', value: `\`${job_name}\``, inline: true },
    { name: '📋 Tipo', value: descricoes[tipo_problema] || tipo_problema, inline: true },
  ];

  if (bar_id) {
    fields.push({ name: '🏪 Bar ID', value: String(bar_id), inline: true });
  }

  if (error_message) {
    fields.push({
      name: '💬 Erro',
      value: error_message.length > 500 ? error_message.substring(0, 497) + '...' : error_message,
      inline: false
    });
  }

  if (resumo) {
    fields.push({ name: '📝 Resumo', value: resumo, inline: false });
  }

  if (detalhes && Object.keys(detalhes).length > 0) {
    const detalhesStr = Object.entries(detalhes)
      .slice(0, 5)
      .map(([k, v]) => `• ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('\n');
    fields.push({ name: '📊 Detalhes', value: detalhesStr.substring(0, 500), inline: false });
  }

  const embed = {
    title: `${emojis[tipo_problema] || '⚠️'} Alerta: ${job_name}`,
    description: `**${tipo_problema.toUpperCase()}** detectado`,
    color: cores[tipo_problema] || 0xffaa00,
    fields,
    timestamp: new Date().toISOString(),
    footer: {
      text: 'Zykor Cron Monitor'
    }
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok) {
      console.error(`❌ [Heartbeat] Erro ao enviar alerta Discord: ${response.status}`);
      return false;
    }

    console.log(`📢 [Heartbeat] Alerta Discord enviado: ${job_name} - ${tipo_problema}`);
    return true;
  } catch (err) {
    console.error('❌ [Heartbeat] Exceção ao enviar alerta Discord:', err);
    return false;
  }
}

interface HeartbeatStartResult {
  heartbeatId: number | null;
  startTime: number;
  lockAcquired?: boolean;
}

/**
 * Registra o início de uma execução de job/cron
 * 
 * @param supabase - Cliente Supabase já configurado
 * @param jobName - Nome da edge function (ex: 'contahub-sync-automatico')
 * @param barId - ID do bar sendo processado (opcional)
 * @param action - Ação específica (ex: 'sync', 'backfill') (opcional)
 * @param triggeredBy - Origem da execução: 'pgcron', 'manual', 'api', 'webhook' (default: 'pgcron')
 * @param useLock - Se true, tenta adquirir advisory lock antes de iniciar (default: false)
 * @param lockTimeout - Timeout em minutos para considerar lock órfão (default: 30)
 * @returns heartbeatId, startTime e lockAcquired para uso no heartbeatEnd
 */
export async function heartbeatStart(
  supabase: any,
  jobName: string,
  barId?: number | null,
  action?: string | null,
  triggeredBy: string = 'pgcron',
  useLock: boolean = false,
  lockTimeout: number = 30
): Promise<HeartbeatStartResult> {
  const startTime = Date.now();
  
  try {
    // Tentar adquirir lock se solicitado
    if (useLock) {
      const { data: lockResult, error: lockError } = await supabase
        .rpc('acquire_job_lock', { 
          job_name: jobName, 
          timeout_minutes: lockTimeout 
        });

      if (lockError) {
        console.warn(`⚠️ [Heartbeat] Erro ao tentar adquirir lock: ${lockError.message}`);
        return { heartbeatId: null, startTime, lockAcquired: false };
      }

      if (!lockResult) {
        console.log(`🔒 [Heartbeat] Lock não adquirido: ${jobName} já está em execução`);
        return { heartbeatId: null, startTime, lockAcquired: false };
      }

      console.log(`🔓 [Heartbeat] Lock adquirido: ${jobName}`);
    }

    const { data, error } = await supabase
      .schema('system')
      .from('cron_heartbeats')
      .insert({
        job_name: jobName,
        action: action || null,
        bar_id: barId || null,
        started_at: new Date().toISOString(),
        status: 'running',
        triggered_by: triggeredBy,
      })
      .select('id')
      .single();

    if (error) {
      console.warn(`⚠️ [Heartbeat] Erro ao registrar início: ${error.message}`);
      // Se falhou ao inserir mas adquiriu lock, libera o lock
      if (useLock) {
        await supabase.rpc('release_job_lock', { job_name: jobName });
      }
      return { heartbeatId: null, startTime, lockAcquired: false };
    }

    console.log(`💓 [Heartbeat] Iniciado: ${jobName}${barId ? ` (bar_id=${barId})` : ''} → ID ${data.id}`);
    return { heartbeatId: data.id, startTime, lockAcquired: useLock };
  } catch (err) {
    console.warn(`⚠️ [Heartbeat] Exceção ao registrar início:`, err);
    // Se falhou mas adquiriu lock, libera o lock
    if (useLock) {
      try {
        await supabase.rpc('release_job_lock', { job_name: jobName });
      } catch (releaseErr) {
        console.warn(`⚠️ [Heartbeat] Erro ao liberar lock após exceção:`, releaseErr);
      }
    }
    return { heartbeatId: null, startTime, lockAcquired: false };
  }
}

/**
 * Registra o fim de uma execução de job/cron
 * 
 * @param supabase - Cliente Supabase já configurado
 * @param heartbeatId - ID retornado pelo heartbeatStart
 * @param status - Status final: 'success', 'partial', 'error'
 * @param startTime - Timestamp do início (para calcular duration_ms)
 * @param recordsAffected - Quantidade de registros processados (opcional)
 * @param responseSummary - Objeto JSON com resumo da resposta (opcional)
 * @param errorMessage - Mensagem de erro se status='error' (opcional)
 * @param jobName - Nome do job (opcional, para alertas Discord e release de lock)
 * @param barId - ID do bar (opcional, para alertas Discord)
 * @param releaseLock - Se true, libera advisory lock ao finalizar (default: false)
 */
export async function heartbeatEnd(
  supabase: any,
  heartbeatId: number | null,
  status: HeartbeatStatus,
  startTime: number,
  recordsAffected?: number,
  responseSummary?: Record<string, any>,
  errorMessage?: string,
  jobName?: string,
  barId?: number | null,
  releaseLock: boolean = false
): Promise<void> {
  if (!heartbeatId) {
    console.warn(`⚠️ [Heartbeat] heartbeatId nulo, ignorando finalização`);
    return;
  }

  const durationMs = Date.now() - startTime;

  try {
    // Buscar job_name do registro se não foi passado
    let resolvedJobName = jobName;
    let resolvedBarId = barId;
    
    if (!resolvedJobName && heartbeatId) {
      const { data: hbData } = await supabase
        .schema('system')
        .from('cron_heartbeats')
        .select('job_name, bar_id')
        .eq('id', heartbeatId)
        .single();
      
      if (hbData) {
        resolvedJobName = hbData.job_name;
        resolvedBarId = resolvedBarId ?? hbData.bar_id;
      }
    }

    const { error } = await supabase
      .schema('system')
      .from('cron_heartbeats')
      .update({
        finished_at: new Date().toISOString(),
        status,
        records_affected: recordsAffected ?? 0,
        response_summary: responseSummary ?? null,
        error_message: errorMessage ?? null,
        duration_ms: durationMs,
      })
      .eq('id', heartbeatId);

    if (error) {
      console.warn(`⚠️ [Heartbeat] Erro ao registrar fim: ${error.message}`);
      return;
    }

    const statusEmoji = status === 'success' ? '✅' : status === 'partial' ? '⚠️' : '❌';
    console.log(`💓 [Heartbeat] Finalizado: ID ${heartbeatId} → ${statusEmoji} ${status} (${durationMs}ms, ${recordsAffected ?? 0} registros)`);

    // Liberar lock se solicitado
    if (releaseLock && resolvedJobName) {
      try {
        await supabase.rpc('release_job_lock', { job_name: resolvedJobName });
        console.log(`🔓 [Heartbeat] Lock liberado: ${resolvedJobName}`);
      } catch (lockErr) {
        console.warn(`⚠️ [Heartbeat] Erro ao liberar lock:`, lockErr);
      }
    }

    // Enviar alerta Discord para status error ou partial
    if ((status === 'error' || status === 'partial') && resolvedJobName) {
      await sendJobFailureAlert({
        job_name: resolvedJobName,
        tipo_problema: status,
        bar_id: resolvedBarId,
        error_message: errorMessage,
        resumo: responseSummary ? `${recordsAffected ?? 0} registros processados` : undefined,
        detalhes: responseSummary,
      }, supabase);
    }
  } catch (err) {
    console.warn(`⚠️ [Heartbeat] Exceção ao registrar fim:`, err);
  }
}

/**
 * Shortcut para registrar erro rapidamente
 * Útil em blocos catch onde já se tem o heartbeatId
 * 
 * @param jobName - Nome do job (opcional, para alertas Discord e release de lock)
 * @param barId - ID do bar (opcional, para alertas Discord)
 * @param releaseLock - Se true, libera advisory lock ao finalizar (default: false)
 */
export async function heartbeatError(
  supabase: any,
  heartbeatId: number | null,
  startTime: number,
  error: Error | string,
  responseSummary?: Record<string, any>,
  jobName?: string,
  barId?: number | null,
  releaseLock: boolean = false
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  await heartbeatEnd(supabase, heartbeatId, 'error', startTime, 0, responseSummary, errorMessage, jobName, barId, releaseLock);
}
