/**
 * 🎭 ORCHESTRATOR - Agent V2 Pipeline
 * 
 * Coordena o pipeline completo de análise de insights:
 * Detector (regras) → Narrator (LLM) → Notificações
 * 
 * Fluxo:
 * 1. Recebe { bar_id, data? } (default = ontem)
 * 2. Chama agente-detector (detecta eventos)
 * 3. Se houver eventos, chama agente-narrator (gera insights)
 * 4. Se houver insights críticos, envia notificação Discord
 * 5. Retorna resumo completo da execução
 * 
 * @version 1.0.0
 * @date 2026-04-01
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse, errorResponse, handleCorsOptions } from '../_shared/cors.ts';
import { heartbeatStart, heartbeatEnd, heartbeatError } from '../_shared/heartbeat.ts';
import { formatDateISO, daysAgo } from '../_shared/date-helpers.ts';
import { 
  sendDiscordEmbed, 
  createWarningEmbed, 
  DiscordColors,
  getDiscordWebhookFromDb 
} from '../_shared/discord-notifier.ts';

// ============================================================
// TIPOS
// ============================================================

interface OrchestratorRequest {
  bar_id: number;
  data?: string;
}

interface DetectorResponse {
  success: boolean;
  data_analise: string;
  eventos_detectados: number;
  eventos_salvos: number;
  eventos: Array<{
    tipo: string;
    severidade: string;
    evidencias: string[];
  }>;
}

interface NarratorResponse {
  success: boolean;
  data_analise: string;
  eventos_processados: number;
  insights_gerados: number;
  insights_salvos: number;
  insights: Array<{
    titulo: string;
    severidade: string;
    tipo: string;
    descricao: string;
    causa_provavel: string;
    acoes_recomendadas: string[];
  }>;
  resumo_geral: string;
}

// ============================================================
// CHAMADAS INTERNAS ÀS EDGE FUNCTIONS
// ============================================================

async function chamarDetector(
  barId: number,
  data: string
): Promise<DetectorResponse> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
  }

  console.log(`🔍 Chamando agente-detector para bar_id=${barId}, data=${data}`);

  const response = await fetch(`${supabaseUrl}/functions/v1/agente-detector`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bar_id: barId, data }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Detector retornou ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  console.log(`✅ Detector: ${result.eventos_detectados} eventos detectados`);
  
  return result as DetectorResponse;
}

async function chamarNarrator(
  barId: number,
  data: string,
  eventos?: any[]
): Promise<NarratorResponse> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
  }

  console.log(`📖 Chamando agente-narrator para bar_id=${barId}, data=${data}`);

  const payload: any = { bar_id: barId, data };
  if (eventos && eventos.length > 0) {
    payload.eventos = eventos;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/agente-narrator`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Narrator retornou ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  console.log(`✅ Narrator: ${result.insights_gerados} insights gerados`);
  
  return result as NarratorResponse;
}

// ============================================================
// NOTIFICAÇÕES DISCORD
// ============================================================

async function enviarNotificacoesCriticas(
  supabase: any,
  barId: number,
  insights: NarratorResponse['insights']
): Promise<number> {
  const insightsCriticos = insights.filter(i => i.severidade === 'alta');
  
  if (insightsCriticos.length === 0) {
    console.log('ℹ️ Nenhum insight crítico para notificar');
    return 0;
  }

  const { data: barConfig } = await supabase
    .from('bares_config')
    .select('bar_id, nome_bar')
    .eq('bar_id', barId)
    .maybeSingle();

  const barNome = barConfig?.nome_bar || `Bar ${barId}`;
  let notificacoesEnviadas = 0;

  for (const insight of insightsCriticos) {
    try {
      const webhookUrl = await getDiscordWebhookFromDb(supabase, 'agentes', barId);
      
      if (!webhookUrl) {
        console.warn('⚠️ Webhook Discord não configurado, pulando notificação');
        continue;
      }

      const embed = {
        title: `🔴 [${barNome}] Insight Crítico`,
        description: `**${insight.titulo}**\n\n${insight.descricao.substring(0, 300)}${insight.descricao.length > 300 ? '...' : ''}`,
        color: DiscordColors.ERROR,
        fields: [
          {
            name: '🎯 Tipo',
            value: insight.tipo === 'problema' ? '⚠️ Problema' : '✨ Oportunidade',
            inline: true,
          },
          {
            name: '📊 Severidade',
            value: '🔴 Alta',
            inline: true,
          },
          {
            name: '💡 Causa Provável',
            value: insight.causa_provavel?.substring(0, 500) || 'Não identificada',
            inline: false,
          },
          {
            name: '✅ Ações Recomendadas',
            value: insight.acoes_recomendadas.slice(0, 3).map((a, i) => `${i + 1}. ${a}`).join('\n').substring(0, 1000),
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Zykor Agent V2',
        },
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });

      if (response.ok) {
        notificacoesEnviadas++;
        console.log(`📢 Notificação enviada: ${insight.titulo}`);
      } else {
        console.error(`❌ Erro ao enviar notificação: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ Erro ao enviar notificação para insight "${insight.titulo}":`, error);
    }
  }

  return notificacoesEnviadas;
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  let heartbeatId: number | null = null;
  let startTime: number = Date.now();
  let barIdForError: number | undefined;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.json().catch(() => ({})) as OrchestratorRequest;
    const { bar_id, data } = body;

    if (!bar_id) {
      return errorResponse('bar_id é obrigatório', null, 400);
    }

    barIdForError = bar_id;

    const hbResult = await heartbeatStart(supabase, 'agente-pipeline-v2', bar_id, 'orchestrate', 'api');
    heartbeatId = hbResult.heartbeatId;
    startTime = hbResult.startTime;

    const dataAnalise = data || formatDateISO(daysAgo(1));
    console.log(`🎭 Iniciando pipeline v2 para bar_id=${bar_id}, data=${dataAnalise}`);

    // ============================================================
    // ETAPA 1: DETECTOR
    // ============================================================
    
    const detectorResult = await chamarDetector(bar_id, dataAnalise);
    
    if (!detectorResult.success) {
      throw new Error('Detector falhou');
    }

    console.log(`📊 Detector concluído: ${detectorResult.eventos_detectados} eventos`);

    // ============================================================
    // ETAPA 2: NARRATOR (só se houver eventos)
    // ============================================================
    
    let narratorResult: NarratorResponse | null = null;
    
    if (detectorResult.eventos_detectados > 0) {
      narratorResult = await chamarNarrator(bar_id, dataAnalise);
      
      if (!narratorResult.success) {
        throw new Error('Narrator falhou');
      }

      console.log(`💡 Narrator concluído: ${narratorResult.insights_gerados} insights`);
    } else {
      console.log('ℹ️ Nenhum evento detectado, pulando narrator');
    }

    // ============================================================
    // ETAPA 3: NOTIFICAÇÕES DISCORD (só se houver insights críticos)
    // ============================================================
    
    let notificacoesEnviadas = 0;
    
    if (narratorResult && narratorResult.insights.length > 0) {
      notificacoesEnviadas = await enviarNotificacoesCriticas(
        supabase,
        bar_id,
        narratorResult.insights
      );
      
      if (notificacoesEnviadas > 0) {
        console.log(`📢 ${notificacoesEnviadas} notificações críticas enviadas`);
      }
    }

    // ============================================================
    // FINALIZAÇÃO
    // ============================================================

    const totalInsights = narratorResult?.insights_gerados || 0;
    
    await heartbeatEnd(supabase, heartbeatId, 'success', startTime, totalInsights, {
      eventos_detectados: detectorResult.eventos_detectados,
      insights_gerados: totalInsights,
      notificacoes_enviadas: notificacoesEnviadas,
      data_analise: dataAnalise,
    });

    return jsonResponse({
      success: true,
      data_analise: dataAnalise,
      pipeline: {
        detector: {
          eventos_detectados: detectorResult.eventos_detectados,
          eventos_salvos: detectorResult.eventos_salvos,
        },
        narrator: narratorResult ? {
          eventos_processados: narratorResult.eventos_processados,
          insights_gerados: narratorResult.insights_gerados,
          insights_salvos: narratorResult.insights_salvos,
        } : null,
        notificacoes: {
          enviadas: notificacoesEnviadas,
        },
      },
      insights: narratorResult?.insights || [],
      resumo_geral: narratorResult?.resumo_geral || 'Sem anomalias detectadas.',
    });

  } catch (error) {
    console.error('❌ Erro no orchestrator:', error);
    await heartbeatError(supabase, heartbeatId, startTime, error as Error, {}, 'agente-pipeline-v2', barIdForError);
    return errorResponse('Erro ao executar pipeline', error, 500);
  }
});
